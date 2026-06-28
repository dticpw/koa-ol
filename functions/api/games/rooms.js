export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ error: "D1 database is not bound as DB." }, 500);
  }

  await ensureSchema(env.DB);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const gameType = normalizeGameType(body.gameType);
  const playerName = normalizeName(body.playerName);
  const playerId = normalizePlayerId(body.playerId);

  if (!gameType || !playerId) {
    return json({ error: "Missing or invalid gameType/playerId." }, 400);
  }

  const roomId = createRoomId();
  const now = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO koa_game_rooms
        (room_id, game_type, host_player_id, status, state_json, created_at, updated_at)
       VALUES (?, ?, ?, 'lobby', '{}', ?, ?)`
    ).bind(roomId, gameType, playerId, now, now),
    env.DB.prepare(
      `INSERT INTO koa_game_players
        (room_id, player_id, display_name, seat_index, chips, is_host, joined_at, last_seen_at)
       VALUES (?, ?, ?, NULL, 0, 1, ?, ?)`
    ).bind(roomId, playerId, playerName, now, now),
  ]);

  const room = await loadRoom(env.DB, roomId, playerId);
  return json({ room });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
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

function normalizeGameType(value) {
  return value === "texas" || value === "blackjack" ? value : null;
}

function normalizeName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 24);
  return name || "Guest";
}

function normalizePlayerId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id) ? id : null;
}

function createRoomId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
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
