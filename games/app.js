const POKER_API_BASE = "https://poker-backend-2fs9.onrender.com";
const POKER_WS_BASE = "wss://poker-backend-2fs9.onrender.com";
const TEXAS_GAME_TYPE = "texas_holdem";

const roomForm = document.querySelector("#room-form");
const playerNameInput = document.querySelector("#player-name");
const gameTypeInput = document.querySelector("#game-type");
const roomCodeInput = document.querySelector("#room-code");
const createRoomButton = document.querySelector("#create-room");
const roomStatus = document.querySelector("#room-status");
const statusTitle = document.querySelector("#status-title");
const statusCopy = document.querySelector("#status-copy");
const linkBox = document.querySelector("#link-box");
const roomLinkInput = document.querySelector("#room-link");
const copyLinkButton = document.querySelector("#copy-link");
const gameCards = document.querySelectorAll("[data-game-card]");
const roomCard = document.querySelector("#room-card");
const roomBadge = document.querySelector("#room-badge");
const roomTitle = document.querySelector("#room-title");
const playerCount = document.querySelector("#player-count");
const hostState = document.querySelector("#host-state");
const playerList = document.querySelector("#player-list");
const startGameButton = document.querySelector("#start-game");
const leaveRoomButton = document.querySelector("#leave-room");
const gameState = document.querySelector("#game-state");
const gameStateBody = document.querySelector("#game-state-body");

const STORAGE_KEY = "koaOlGamesLobby";
const PLAYER_ID_KEY = "koaOlRenderPokerPlayerId";
const WS_RECONNECT_MS = 1600;

let currentRoom = null;
let currentGameState = null;
let ws = null;
let reconnectTimer = null;
let pingTimer = null;
let roomPollTimer = null;
let wsReconnectAttempts = 0;
let isManualDisconnect = false;
let wsUserId = null;
let personalSyncInFlight = false;

const savedState = loadState();
const urlRoom = getRoomFromUrl();
const urlGame = getGameFromUrl();

playerNameInput.value = savedState.playerName || "";
gameTypeInput.value = urlGame || savedState.gameType || "texas";
roomCodeInput.value = urlRoom || savedState.roomCode || "";
gameTypeInput.value = "texas";

syncSelectedGame();
connectWebSocket();

if (urlRoom) {
  statusTitle.textContent = `准备加入 ${urlRoom}`;
  statusCopy.textContent = "Render 游戏服务器唤醒后，会加载房间信息。";
  previewRoom(urlRoom);
}

playerNameInput.addEventListener("input", persistState);

roomCodeInput.addEventListener("input", () => {
  persistState();
});

gameCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (card.classList.contains("is-disabled")) return;
    gameTypeInput.value = "texas";
    syncSelectedGame();
    persistState();
  });
});

createRoomButton.addEventListener("click", async () => {
  await createRoom();
});

roomForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await joinRoom();
});

startGameButton.addEventListener("click", async () => {
  if (!currentRoom) return;
  await startTexasGame(currentRoom.room_id);
});

leaveRoomButton.addEventListener("click", async () => {
  await leaveRoom();
});

copyLinkButton.addEventListener("click", async () => {
  const link = roomLinkInput.value;
  if (!link) return;

  try {
    await navigator.clipboard.writeText(link);
    roomStatus.textContent = "Copied";
  } catch {
    roomLinkInput.select();
    document.execCommand("copy");
    roomStatus.textContent = "Copied";
  }

  window.setTimeout(() => {
    roomStatus.textContent = currentRoom ? "房间中" : "待开局";
  }, 1400);
});

window.addEventListener("beforeunload", () => {
  isManualDisconnect = true;
  if (ws) ws.close();
});

async function createRoom() {
  setBusy(true);
  showStatus("创建中", "正在连接 Render 游戏服务器", "如果服务休眠，第一次创建可能需要等待十几秒。");

  try {
    connectWebSocket(true);
    const playerName = normalizePlayerName(playerNameInput.value);
    const data = await requestJson(`${POKER_API_BASE}/api/rooms/create`, {
      method: "POST",
      body: {
        game_type: TEXAS_GAME_TYPE,
        room_name: `${playerName} 的德州房间`,
        max_players: 8,
        creator_id: getPlayerId(),
        creator_name: playerName,
      },
    });

    enterRoom(data.room);
    updateUrl(data.room.room_id, "texas");
    showStatus("房间中", `${gameLabel(data.room.game_type)} · ${shortRoom(data.room.room_id)}`, "把链接发给朋友；玩家进入后会通过 WebSocket 同步。");
    window.setTimeout(() => sendWs({ type: "sync_room" }), 300);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function joinRoom() {
  const roomId = extractRoomCode(roomCodeInput.value);
  if (!roomId) {
    showNeedCode();
    return;
  }

  setBusy(true);
  showStatus("加入中", `正在加入 ${shortRoom(roomId)}`, "正在连接 Render 房间。");

  try {
    connectWebSocket(true);
    const data = await requestJson(`${POKER_API_BASE}/api/rooms/${encodeURIComponent(roomId)}/join`, {
      method: "POST",
      body: {
        user_id: getPlayerId(),
        username: normalizePlayerName(playerNameInput.value),
      },
    });

    enterRoom(data.room);
    if (data.game_state) {
      renderGameState(data.game_state);
    }
    updateUrl(data.room.room_id, renderGameParam(data.room.game_type));
    showStatus("房间中", `${gameLabel(data.room.game_type)} · ${shortRoom(data.room.room_id)}`, "你已加入房间。");
    window.setTimeout(() => {
      sendWs({ type: "sync_room" });
      sendWs({ type: "sync_game_state", room_id: data.room.room_id });
    }, 300);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function previewRoom(roomId) {
  try {
    const data = await requestJson(`${POKER_API_BASE}/api/rooms/${encodeURIComponent(roomId)}/details`);
    enterRoom(data.room, { preview: true });
    showStatus("可加入", `${gameLabel(data.room.game_type)} · ${shortRoom(data.room.room_id)}`, "房间信息已加载。填好昵称后点击「加入房间」。");
  } catch (error) {
    showError(error);
  }
}

async function startTexasGame(roomId) {
  setBusy(true);
  try {
    const data = await requestJson(`${POKER_API_BASE}/api/game/texas-holdem/${encodeURIComponent(roomId)}/start`, {
      method: "POST",
      body: {
        user_id: getPlayerId(),
        max_bet_multiplier: 10,
        small_blind: 1,
        initial_chips: 1000,
      },
    });
    if (data.game_state) {
      renderGameState(data.game_state);
      showStatus("游戏中", phaseLabel(data.game_state.phase), "游戏已开始。");
    }
    window.setTimeout(syncPersonalGameState, 400);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function sendTexasAction(action, amount = 0) {
  if (!currentRoom) return;

  setBusy(true);
  try {
    await requestJson(`${POKER_API_BASE}/api/game/texas-holdem/${encodeURIComponent(currentRoom.room_id)}/action`, {
      method: "POST",
      body: {
        user_id: getPlayerId(),
        action,
        amount,
      },
    });
    window.setTimeout(syncPersonalGameState, 400);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function resetTexasGame() {
  if (!currentRoom) return;

  setBusy(true);
  try {
    const data = await requestJson(`${POKER_API_BASE}/api/game/texas-holdem/${encodeURIComponent(currentRoom.room_id)}/reset`, {
      method: "POST",
      body: { user_id: getPlayerId() },
    });
    if (data.game_state) {
      renderGameState(data.game_state);
    }
    window.setTimeout(syncPersonalGameState, 400);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function syncPersonalGameState() {
  if (!currentRoom || currentRoom.status !== "playing") return;
  if (personalSyncInFlight) return;

  personalSyncInFlight = true;
  try {
    const data = await requestJson(`${POKER_API_BASE}/api/rooms/${encodeURIComponent(currentRoom.room_id)}/join`, {
      method: "POST",
      body: {
        user_id: getPlayerId(),
        username: normalizePlayerName(playerNameInput.value),
      },
      timeoutMs: 12000,
    });
    if (data.room) {
      enterRoom(data.room, { silent: true, noPersonalSync: true });
    }
    if (data.game_state) {
      renderGameState(data.game_state);
    }
  } catch {
    // Best-effort fallback for private game state when WebSocket is unavailable.
  } finally {
    personalSyncInFlight = false;
  }
}

async function leaveRoom() {
  if (!currentRoom) return;

  if (currentRoom.status === "playing") {
    const confirmed = window.confirm("游戏正在进行中，离开页面不会移除你的座位。确定离开当前房间视图吗？");
    if (!confirmed) return;
    clearCurrentRoom();
    return;
  }

  setBusy(true);
  try {
    await requestJson(`${POKER_API_BASE}/api/rooms/${encodeURIComponent(currentRoom.room_id)}/leave`, {
      method: "POST",
      body: { user_id: getPlayerId() },
    });
  } catch (error) {
    showError(error);
  } finally {
    clearCurrentRoom();
    setBusy(false);
  }
}

function clearCurrentRoom() {
  currentRoom = null;
  currentGameState = null;
  clearInterval(roomPollTimer);
  roomPollTimer = null;
  roomCodeInput.value = "";
  roomCard.hidden = true;
  gameState.hidden = true;
  gameStateBody.innerHTML = "";
  linkBox.hidden = true;
  persistState();
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url);
  showStatus("待开局", "准备好就点「开新房」", "如果朋友已经发你房间码，填入后直接加入。");
}

function connectWebSocket(force = false) {
  const playerId = getPlayerId();
  if (!force && ws && wsUserId === playerId && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  if (ws && wsUserId !== playerId) {
    isManualDisconnect = true;
    ws.close();
    ws = null;
  }

  isManualDisconnect = false;
  wsUserId = playerId;
  const url = `${POKER_WS_BASE}/ws/${encodeURIComponent(playerId)}`;
  ws = new WebSocket(url);

  ws.addEventListener("open", () => {
    wsReconnectAttempts = 0;
    showConnection("WS 已连接");
    clearInterval(pingTimer);
    pingTimer = window.setInterval(() => sendWs({ type: "ping" }), 30000);
    if (currentRoom) {
      sendWs({ type: "sync_room" });
      sendWs({ type: "sync_game_state", room_id: currentRoom.room_id });
    }
  });

  ws.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    handleWsMessage(message);
  });

  ws.addEventListener("close", () => {
    clearInterval(pingTimer);
    ws = null;
    showConnection("WS 重连中");
    if (!isManualDisconnect) {
      clearTimeout(reconnectTimer);
      wsReconnectAttempts += 1;
      const delay = Math.min(WS_RECONNECT_MS * wsReconnectAttempts, 10000);
      reconnectTimer = window.setTimeout(connectWebSocket, delay);
    }
  });

  ws.addEventListener("error", () => {
    showConnection("WS 错误");
  });
}

function sendWs(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(message));
  return true;
}

function handleWsMessage(message) {
  switch (message.type) {
    case "pong":
      return;
    case "room_state":
    case "player_joined":
    case "player_left":
    case "player_reconnected":
    case "player_kicked":
      if (message.room) {
        enterRoom(message.room, { silent: true });
      } else if (message.type === "player_left") {
        showStatus("关闭", "房间已关闭", "所有玩家都已离开。");
        currentRoom = null;
        roomCard.hidden = true;
      }
      return;
    case "lobby_update":
      return;
    case "game_started":
    case "game_state_update":
    case "game_state_sync":
      if (message.game_state) {
        renderGameState(message.game_state);
        showStatus("游戏中", phaseLabel(message.game_state.phase), "Render 后端正在同步牌局。");
      }
      return;
    case "player_action_result":
      showConnection(`${message.player_id === getPlayerId() ? "你" : "玩家"} ${message.action}`);
      return;
    case "player_timeout":
      showStatus("超时", message.player_id === getPlayerId() ? "你已超时弃牌" : "有玩家超时弃牌", message.message || "等待下一步同步。");
      return;
    case "player_disconnected":
      showConnection("有玩家断线");
      return;
    case "room_closed":
    case "kicked":
    case "game_ended_by_admin":
      showStatus("结束", message.message || "房间状态已改变", "请重新进入房间。");
      return;
    case "admin_broadcast":
      showStatus("公告", "管理员消息", message.message || "");
      return;
    default:
      return;
  }
}

function enterRoom(room, options = {}) {
  currentRoom = room;
  roomCodeInput.value = room.room_id;
  gameTypeInput.value = renderGameParam(room.game_type);
  persistState();
  syncSelectedGame();
  renderRoom(room);
  renderRoomLink(room);
  roomCard.hidden = false;

  if (!options.silent && !options.preview) {
    showStatus("房间中", `${gameLabel(room.game_type)} · ${shortRoom(room.room_id)}`, "把链接发给朋友；玩家进入后会通过 WebSocket 同步。");
  }

  if (room.status === "playing" && !options.noPersonalSync) {
    sendWs({ type: "sync_game_state", room_id: room.room_id });
    window.setTimeout(syncPersonalGameState, 500);
  }

  startRoomPolling();
}

function startRoomPolling() {
  clearInterval(roomPollTimer);
  if (!currentRoom) return;
  roomPollTimer = window.setInterval(pollRoomDetails, 3000);
}

async function pollRoomDetails() {
  if (!currentRoom) return;

  try {
    const data = await requestJson(`${POKER_API_BASE}/api/rooms/${encodeURIComponent(currentRoom.room_id)}/details`, {
      timeoutMs: 12000,
    });
    if (data.room) {
      currentRoom = data.room;
      renderRoom(data.room);
      renderRoomLink(data.room);
    }

    if (currentRoom.status === "playing") {
      await syncPersonalGameState();
    }
  } catch {
    // WebSocket and direct actions remain primary; polling is only a quiet lobby fallback.
  }
}

function renderRoom(room) {
  const isHost = room.creator_id === getPlayerId();
  const canStart = isHost && room.status !== "playing" && room.current_players >= 2;

  roomBadge.textContent = room.status === "playing" ? "PLAYING" : "ROOM";
  roomTitle.textContent = `${gameLabel(room.game_type)} · ${shortRoom(room.room_id)}`;
  playerCount.textContent = `${room.current_players} / ${room.max_players} 玩家`;
  hostState.textContent = isHost ? "你是房主" : `房主：${hostName(room)}`;
  startGameButton.hidden = !isHost || room.status === "playing";
  startGameButton.disabled = !canStart;
  startGameButton.textContent = room.current_players < 2 ? "至少 2 人开始" : "开始游戏";

  playerList.innerHTML = (room.players || []).map((player, index) => renderPlayer(player, room, index)).join("");

  const isJoined = (room.players || []).some((player) => player.id === getPlayerId());
  if (!isJoined && room.status !== "playing") {
    playerList.insertAdjacentHTML("beforeend", `
      <article class="player-card join-hint">
        <div>
          <strong>你还未入座</strong>
          <span>点击「加入房间」进入玩家列表</span>
        </div>
        <small>待加入</small>
      </article>
    `);
  }
}

function renderPlayer(player, room, index) {
  const tags = [
    player.id === room.creator_id ? "房主" : "",
    player.id === getPlayerId() ? "你" : "",
    room.status === "playing" ? `座位 ${index + 1}` : "",
  ].filter(Boolean);

  const livePlayer = currentGameState?.players?.[player.id];
  const chips = livePlayer ? `${livePlayer.chips} 筹码` : "等待开局";

  return `
    <article class="player-card">
      <div>
        <strong>${escapeHtml(player.name)}</strong>
        <span>${chips}</span>
      </div>
      <small>${tags.length ? tags.join(" · ") : "玩家"}</small>
    </article>
  `;
}

function renderGameState(state) {
  currentGameState = state;
  gameState.hidden = false;
  roomBadge.textContent = "PLAYING";
  if (currentRoom) {
    currentRoom.status = "playing";
    renderRoom(currentRoom);
  }

  const self = state.players?.[getPlayerId()];
  const players = Object.values(state.players || {});
  const isCreator = currentRoom?.creator_id === getPlayerId();
  const isMyTurn = state.current_player === getPlayerId();

  gameStateBody.innerHTML = `
    <div class="texas-table">
      <div class="texas-board">
        <div>
          <span class="state-label">阶段</span>
          <strong>${phaseLabel(state.phase)}</strong>
        </div>
        <div>
          <span class="state-label">底池</span>
          <strong>${state.pot || 0}</strong>
        </div>
        <div>
          <span class="state-label">当前下注</span>
          <strong>${state.current_bet || 0}</strong>
        </div>
        <div>
          <span class="state-label">倒计时</span>
          <strong>${state.time_remaining ?? "-"}</strong>
        </div>
      </div>

      <div class="community-row">
        <span>公共牌</span>
        <div>${renderCards(state.community_cards || [], 5)}</div>
      </div>

      <div class="texas-player-grid">
        ${players.map((player) => renderTexasPlayer(player, state)).join("")}
      </div>

      ${self ? renderSelfPanel(self, state, isMyTurn) : ""}
      ${renderResults(state)}
      ${isCreator && state.phase === "finished" ? `<button class="button primary inline-action" data-texas-reset="1">再来一局</button>` : ""}
    </div>
  `;

  gameStateBody.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const amountInput = gameStateBody.querySelector("#bet-amount");
      const amount = amountInput ? Number(amountInput.value || 0) : 0;
      sendTexasAction(action, amount);
    });
  });

  const resetButton = gameStateBody.querySelector("[data-texas-reset]");
  if (resetButton) {
    resetButton.addEventListener("click", resetTexasGame);
  }
}

function renderTexasPlayer(player, state) {
  const isCurrent = state.current_player === player.user_id;
  const isSelf = player.user_id === getPlayerId();
  const cardsVisible = isSelf || state.phase === "showdown" || state.phase === "finished";
  return `
    <article class="texas-player ${isCurrent ? "is-current" : ""} ${isSelf ? "is-self" : ""} ${player.status === "folded" ? "is-folded" : ""}">
      <div class="texas-player-top">
        <strong>${escapeHtml(player.username)}</strong>
        <span>${isSelf ? "你" : player.status}</span>
      </div>
      <div class="texas-cards">${renderCards(cardsVisible ? player.hole_cards : ["XX", "XX"], 2)}</div>
      <div class="texas-numbers">
        <span>筹码 ${player.chips}</span>
        <span>本轮 ${player.current_bet}</span>
        <span>总注 ${player.total_bet}</span>
      </div>
    </article>
  `;
}

function renderSelfPanel(self, state, isMyTurn) {
  const callAmount = Math.max(0, (state.current_bet || 0) - (self.current_bet || 0));
  const canCheck = (state.current_bet || 0) === (self.current_bet || 0);
  const minBet = state.current_bet > 0 ? (state.current_bet || 0) + (state.min_raise || state.big_blind || 2) : (state.big_blind || 2);
  const maxBet = Math.max(0, Math.min(self.chips || 0, (state.max_bet_per_hand || 20) - (self.total_bet || 0)));

  if (!isMyTurn || state.phase === "finished" || state.phase === "showdown") {
    return `
      <div class="action-strip muted-action">
        ${state.phase === "finished" ? "本手牌结束" : "等待其他玩家行动"}
      </div>
    `;
  }

  return `
    <div class="action-strip">
      <button data-action="fold">弃牌</button>
      ${canCheck ? `<button data-action="check">过牌</button>` : `<button data-action="call">跟注 ${callAmount}</button>`}
      <label>
        <span>${state.current_bet > 0 ? "加注到" : "下注"}</span>
        <input id="bet-amount" type="number" min="${minBet}" max="${maxBet}" value="${minBet}">
      </label>
      <button data-action="${state.current_bet > 0 ? "raise" : "bet"}">${state.current_bet > 0 ? "加注" : "下注"}</button>
    </div>
  `;
}

function renderResults(state) {
  if (state.phase !== "finished" && state.phase !== "showdown") return "";
  const results = state.game_results || {};
  const items = Object.entries(results).map(([playerId, result]) => `
    <article class="result-card ${result.is_winner ? "winner" : ""}">
      <strong>${escapeHtml(result.username || playerId)}</strong>
      <span>${escapeHtml(result.hand_name || (result.folded ? "已弃牌" : ""))}</span>
      <span>${result.is_winner ? `赢得 ${result.winnings}` : ""}</span>
      <div>${renderCards(result.hole_cards || [], 2)}</div>
    </article>
  `).join("");

  return `<div class="results-grid">${items}</div>`;
}

function renderCards(cards, placeholders = 0) {
  const list = [...cards];
  while (list.length < placeholders) list.push("");
  return list.map((card) => {
    const value = card || "?";
    return `<b class="mini-card ${card === "XX" || !card ? "card-back" : ""}">${escapeHtml(value)}</b>`;
  }).join("");
}

function renderRoomLink(room) {
  roomLinkInput.value = buildRoomUrl(room.room_id, renderGameParam(room.game_type));
  linkBox.hidden = false;
}

function showNeedCode() {
  showStatus("Need Code", "输入房间码才能加入", "没有房间码就点「开新房」，系统会自动创建 Render 房间。");
  linkBox.hidden = true;
}

function showError(error) {
  showStatus("错误", "操作失败", error.message || "请稍后重试。");
}

function showStatus(status, title, copy) {
  roomStatus.textContent = status;
  statusTitle.textContent = title;
  statusCopy.textContent = copy;
}

function showConnection(text) {
  if (!currentRoom) return;
  statusCopy.textContent = text;
}

function setBusy(isBusy) {
  createRoomButton.disabled = isBusy;
  roomForm.querySelector("[data-action='join']").disabled = isBusy;
  if (currentRoom && !startGameButton.hidden) {
    const isHost = currentRoom.creator_id === getPlayerId();
    const canStart = isHost && currentRoom.status !== "playing" && currentRoom.current_players >= 2;
    startGameButton.disabled = isBusy || !canStart;
  }
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 30000);
  const init = {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
  };

  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, init);
    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.detail || data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Render 游戏服务器响应超时，可能正在冷启动，请稍后重试。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildRoomUrl(roomCode, gameType) {
  const url = new URL(window.location.href);
  url.pathname = "/games/";
  url.search = "";
  url.searchParams.set("room", roomCode);
  url.searchParams.set("game", gameType);
  return url.toString();
}

function updateUrl(roomCode, gameType) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomCode);
  url.searchParams.set("game", gameType);
  window.history.replaceState({}, "", url);
}

function getPlayerId() {
  let playerId = localStorage.getItem(PLAYER_ID_KEY);
  if (!playerId) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    playerId = `u_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  return playerId;
}

function normalizePlayerName(value) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed || "Guest";
}

function gameLabel(value) {
  return value === TEXAS_GAME_TYPE || value === "texas" ? "Texas Hold'em" : "Blackjack";
}

function renderGameParam(value) {
  return value === TEXAS_GAME_TYPE ? "texas" : value;
}

function hostName(room) {
  const host = (room.players || []).find((player) => player.id === room.creator_id);
  return host ? host.name : "未知";
}

function shortRoom(roomId) {
  return String(roomId || "").slice(0, 8).toUpperCase();
}

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("room") || "").trim();
}

function getGameFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const game = params.get("game");
  return game === "blackjack" || game === "texas" ? game : "";
}

function phaseLabel(phase) {
  const labels = {
    waiting: "等待中",
    pre_flop: "翻牌前",
    flop: "翻牌",
    turn: "转牌",
    river: "河牌",
    showdown: "摊牌",
    finished: "已结束",
  };
  return labels[phase] || phase || "未知阶段";
}

function syncSelectedGame() {
  gameCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.gameCard === "texas");
  });
}

function persistState() {
  const state = {
    playerName: playerNameInput.value,
    gameType: "texas",
    roomCode: roomCodeInput.value.trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractRoomCode(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const room = url.searchParams.get("room");
    if (room) return room.trim();
  } catch {
    // Plain room IDs are expected; URLs are only a convenience.
  }

  const match = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : trimmed;
}
