export async function onRequestGet(context) {
  const { env, params, request } = context;

  if (!env.DB) {
    return json({ error: "D1 database is not bound as DB." }, 500);
  }

  await ensureSchema(env.DB);

  const roomId = normalizeRoomId(params.roomId);
  const url = new URL(request.url);
  const playerId = normalizePlayerId(url.searchParams.get("playerId"));

  if (!roomId) return json({ error: "Invalid room id." }, 400);

  if (playerId) {
    await touchPlayer(env.DB, roomId, playerId);
  }

  const room = await loadRoom(env.DB, roomId, playerId);
  if (!room) return json({ error: "Room not found." }, 404);

  return json({ room });
}

export async function onRequestPost(context) {
  const { request, env, params } = context;

  if (!env.DB) {
    return json({ error: "D1 database is not bound as DB." }, 500);
  }

  await ensureSchema(env.DB);

  const roomId = normalizeRoomId(params.roomId);
  if (!roomId) return json({ error: "Invalid room id." }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const action = body.action;
  const playerId = normalizePlayerId(body.playerId);

  if (!playerId) return json({ error: "Missing or invalid playerId." }, 400);

  if (action === "join") {
    return joinRoom(env.DB, roomId, playerId, body.playerName);
  }

  if (action === "start") {
    return startRoom(env.DB, roomId, playerId);
  }

  if (action === "heartbeat") {
    await touchPlayer(env.DB, roomId, playerId);
    const room = await loadRoom(env.DB, roomId, playerId);
    if (!room) return json({ error: "Room not found." }, 404);
    return json({ room });
  }

  return json({ error: "Unknown action." }, 400);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function joinRoom(db, roomId, playerId, playerNameValue) {
  const room = await db.prepare(
    `SELECT room_id, status FROM koa_game_rooms WHERE room_id = ?`
  ).bind(roomId).first();

  if (!room) return json({ error: "Room not found." }, 404);

  const existing = await db.prepare(
    `SELECT player_id FROM koa_game_players WHERE room_id = ? AND player_id = ?`
  ).bind(roomId, playerId).first();

  const countRow = await db.prepare(
    `SELECT COUNT(*) AS count FROM koa_game_players WHERE room_id = ?`
  ).bind(roomId).first();

  if (!existing && room.status !== "lobby") {
    return json({ error: "Game already started." }, 409);
  }

  if (!existing && Number(countRow.count) >= 8) {
    return json({ error: "Room is full." }, 409);
  }

  const playerName = normalizeName(playerNameValue);
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO koa_game_players
      (room_id, player_id, display_name, seat_index, chips, is_host, joined_at, last_seen_at)
     VALUES (?, ?, ?, NULL, 0, 0, ?, ?)
     ON CONFLICT(room_id, player_id) DO UPDATE SET
      display_name = excluded.display_name,
      last_seen_at = excluded.last_seen_at`
  ).bind(roomId, playerId, playerName, now, now).run();

  await db.prepare(
    `UPDATE koa_game_rooms SET updated_at = ? WHERE room_id = ?`
  ).bind(now, roomId).run();

  const nextRoom = await loadRoom(db, roomId, playerId);
  return json({ room: nextRoom });
}

async function startRoom(db, roomId, playerId) {
  const room = await db.prepare(
    `SELECT room_id, game_type, host_player_id, status
     FROM koa_game_rooms
     WHERE room_id = ?`
  ).bind(roomId).first();

  if (!room) return json({ error: "Room not found." }, 404);
  if (room.host_player_id !== playerId) return json({ error: "Only host can start." }, 403);
  if (room.status !== "lobby") return json({ error: "Game already started." }, 409);

  const playersResult = await db.prepare(
    `SELECT player_id, display_name, joined_at
     FROM koa_game_players
     WHERE room_id = ?
     ORDER BY joined_at`
  ).bind(roomId).all();
  const players = playersResult.results || [];

  if (players.length < 2 || players.length > 8) {
    return json({ error: "Need 2 to 8 players to start." }, 409);
  }

  const deck = shuffleDeck();
  const now = new Date().toISOString();
  const chips = 1000;
  const publicState = room.game_type === "texas"
    ? createTexasState(players, deck)
    : createBlackjackState(players, deck);

  const statements = [
    db.prepare(
      `UPDATE koa_game_rooms
       SET status = 'started', state_json = ?, updated_at = ?, started_at = ?
       WHERE room_id = ?`
    ).bind(JSON.stringify(publicState), now, now, roomId),
  ];

  players.forEach((player, index) => {
    const privateState = publicState.privateByPlayerId[player.player_id] || {};
    statements.push(
      db.prepare(
        `UPDATE koa_game_players
         SET seat_index = ?, chips = ?, private_state_json = ?, last_seen_at = ?
         WHERE room_id = ? AND player_id = ?`
      ).bind(index, chips, JSON.stringify(privateState), now, roomId, player.player_id)
    );
  });

  delete publicState.privateByPlayerId;

  statements[0] = db.prepare(
    `UPDATE koa_game_rooms
     SET status = 'started', state_json = ?, updated_at = ?, started_at = ?
     WHERE room_id = ?`
  ).bind(JSON.stringify(publicState), now, now, roomId);

  await db.batch(statements);

  const nextRoom = await loadRoom(db, roomId, playerId);
  return json({ room: nextRoom });
}

function createTexasState(players, deck) {
  const privateByPlayerId = {};
  players.forEach((player) => {
    privateByPlayerId[player.player_id] = { holeCards: [deck.pop(), deck.pop()] };
  });

  const dealerSeat = 0;
  const smallBlindSeat = players.length === 2 ? 0 : 1;
  const bigBlindSeat = players.length === 2 ? 1 : 2;

  return {
    phase: "preflop",
    handNumber: 1,
    chipsPerPlayer: 1000,
    board: [],
    deckRemaining: deck.length,
    dealerSeat,
    smallBlindSeat,
    bigBlindSeat,
    pot: 0,
    currentTurnSeat: smallBlindSeat,
    message: "Seats and first private cards are dealt. Betting logic is the next step.",
    privateByPlayerId,
  };
}

function createBlackjackState(players, deck) {
  const privateByPlayerId = {};
  players.forEach((player) => {
    privateByPlayerId[player.player_id] = { hand: [deck.pop(), deck.pop()] };
  });

  const dealerCards = [deck.pop(), deck.pop()];

  return {
    phase: "initial-deal",
    handNumber: 1,
    chipsPerPlayer: 1000,
    dealerVisibleCard: dealerCards[0],
    dealerHidden: true,
    deckRemaining: deck.length,
    message: "Initial hands are dealt. Hit/stand logic is the next step.",
    privateByPlayerId,
  };
}

async function touchPlayer(db, roomId, playerId) {
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE koa_game_players
     SET last_seen_at = ?
     WHERE room_id = ? AND player_id = ?`
  ).bind(now, roomId, playerId).run();
}

async function ensureSchema(db) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS koa_game_rooms (
        room_id TEXT PRIMARY KEY,
        game_type TEXT NOT NULL,
        host_player_id TEXT NOT NULL,
        status TEXT NOT NULL,
        state_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT
      )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS koa_game_players (
        room_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        seat_index INTEGER,
        chips INTEGER NOT NULL DEFAULT 0,
        is_host INTEGER NOT NULL DEFAULT 0,
        private_state_json TEXT NOT NULL DEFAULT '{}',
        joined_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY (room_id, player_id)
      )`
    ),
  ]);
}

async function loadRoom(db, roomId, viewerPlayerId) {
  const room = await db.prepare(
    `SELECT room_id, game_type, host_player_id, status, state_json, created_at, updated_at, started_at
     FROM koa_game_rooms
     WHERE room_id = ?`
  ).bind(roomId).first();

  if (!room) return null;

  const playersResult = await db.prepare(
    `SELECT player_id, display_name, seat_index, chips, is_host, private_state_json, joined_at, last_seen_at
     FROM koa_game_players
     WHERE room_id = ?
     ORDER BY COALESCE(seat_index, 999), joined_at`
  ).bind(roomId).all();

  return serializeRoom(room, playersResult.results || [], viewerPlayerId);
}

function serializeRoom(room, players, viewerPlayerId) {
  const publicState = parseJson(room.state_json, {});

  return {
    roomId: room.room_id,
    gameType: room.game_type,
    status: room.status,
    hostPlayerId: room.host_player_id,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
    startedAt: room.started_at || null,
    publicState,
    players: players.map((player) => {
      const privateState = parseJson(player.private_state_json, {});
      return {
        playerId: player.player_id,
        displayName: player.display_name,
        seatIndex: player.seat_index,
        chips: player.chips,
        isHost: player.is_host === 1,
        isYou: player.player_id === viewerPlayerId,
        joinedAt: player.joined_at,
        lastSeenAt: player.last_seen_at,
        privateState: player.player_id === viewerPlayerId ? privateState : {},
      };
    }),
  };
}

function shuffleDeck() {
  const suits = ["S", "H", "D", "C"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck = [];
  suits.forEach((suit) => ranks.forEach((rank) => deck.push(`${rank}${suit}`)));

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const byte = new Uint8Array(1);
    crypto.getRandomValues(byte);
    const j = byte[0] % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function normalizeRoomId(value) {
  const id = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  return id || null;
}

function normalizePlayerId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id) ? id : null;
}

function normalizeName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 24);
  return name || "Guest";
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
