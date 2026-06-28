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
const copyRoomLinkButton = document.querySelector("#copy-room-link");
const connectionStatus = document.querySelector("#connection-status");
const leaveRoomButton = document.querySelector("#leave-room");
const gameState = document.querySelector("#game-state");
const gameStateTitle = document.querySelector("#game-state h3");
const gameStateBody = document.querySelector("#game-state-body");
const gameLogList = document.querySelector("#game-log-list");

const STORAGE_KEY = "koaOlGamesLobby";
const PLAYER_ID_KEY = "koaOlRenderPokerPlayerId";
const WS_RECONNECT_MS = 1600;
const DEFAULT_SMALL_BLIND = 1;
const DEFAULT_MAX_BET_SMALL_BLIND_MULTIPLIER = 100;

let currentRoom = null;
let currentGameState = null;
let ws = null;
let reconnectTimer = null;
let pingTimer = null;
let roomPollTimer = null;
let countdownTimer = null;
let wsReconnectAttempts = 0;
let isManualDisconnect = false;
let wsUserId = null;
let personalSyncInFlight = false;
let gameLogs = [];
let selfHoleCardsByRoom = new Map();
let personalSyncTimer = null;
let hostSettings = {
  smallBlind: DEFAULT_SMALL_BLIND,
  maxHandBet: DEFAULT_SMALL_BLIND * DEFAULT_MAX_BET_SMALL_BLIND_MULTIPLIER,
  maxBetTouched: false,
};

const savedState = loadState();
const urlRoom = getRoomFromUrl();
const urlGame = getGameFromUrl();

playerNameInput.value = savedState.playerName || "";
gameTypeInput.value = urlGame || savedState.gameType || "texas";
roomCodeInput.value = urlRoom || savedState.roomCode || "";
gameTypeInput.value = "texas";

syncSelectedGame();
setAppMode("lobby");
renderGameLog();
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

roomCard.addEventListener("click", async (event) => {
  const kickButton = event.target.closest("[data-kick-player]");
  if (kickButton) {
    await kickPlayer(kickButton.dataset.kickPlayer);
    return;
  }

  if (event.target.closest("[data-disband-room]")) {
    await disbandRoom();
  }
});

roomCard.addEventListener("input", (event) => {
  if (event.target.matches("#small-blind-setting")) {
    const smallBlind = clampInteger(event.target.value, 1, 100);
    hostSettings.smallBlind = smallBlind;
    if (!hostSettings.maxBetTouched) {
      hostSettings.maxHandBet = smallBlind * DEFAULT_MAX_BET_SMALL_BLIND_MULTIPLIER;
      const maxInput = document.querySelector("#max-hand-bet-setting");
      if (maxInput) maxInput.value = hostSettings.maxHandBet;
    }
    updateHostSettingHint();
  }

  if (event.target.matches("#max-hand-bet-setting")) {
    hostSettings.maxBetTouched = true;
    hostSettings.maxHandBet = clampInteger(event.target.value, hostSettings.smallBlind * 2, 100000);
    updateHostSettingHint();
  }
});

copyLinkButton.addEventListener("click", async () => {
  await copyRoomLink();
});

copyRoomLinkButton.addEventListener("click", async () => {
  await copyRoomLink();
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

    resetGameLog();
    resetHostSettings();
    enterRoom(data.room);
    addGameLog("房间已创建，等待玩家加入。");
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

    resetGameLog();
    enterRoom(data.room);
    addGameLog("你已加入房间。");
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
    const settings = readHostSettings();
    const data = await requestJson(`${POKER_API_BASE}/api/game/texas-holdem/${encodeURIComponent(roomId)}/start`, {
      method: "POST",
      body: {
        user_id: getPlayerId(),
        max_bet_multiplier: settings.maxBetMultiplier,
        small_blind: settings.smallBlind,
        initial_chips: 1000,
      },
    });
    if (data.game_state) {
      addGameLog("房主已开始游戏。");
      clearSelfHoleCards(roomId);
      renderGameState(data.game_state);
      showStatus("游戏中", phaseLabel(data.game_state.phase), "游戏已开始。");
    }
    queuePersonalGameStateSync(200);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function kickPlayer(playerId) {
  if (!currentRoom || currentRoom.status === "playing") return;
  if (currentRoom.creator_id !== getPlayerId() || playerId === getPlayerId()) return;

  const player = (currentRoom.players || []).find((item) => item.id === playerId);
  const confirmed = window.confirm(`确定将 ${player?.name || "该玩家"} 移出房间？`);
  if (!confirmed) return;

  setBusy(true);
  try {
    await requestJson(`${POKER_API_BASE}/api/rooms/${encodeURIComponent(currentRoom.room_id)}/leave`, {
      method: "POST",
      body: { user_id: playerId },
    });
    addGameLog(`${player?.name || "玩家"} 已被房主移出房间。`);
    await pollRoomDetails();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function disbandRoom() {
  if (!currentRoom || currentRoom.creator_id !== getPlayerId()) return;

  const confirmed = window.confirm("确定解散当前房间？所有未开局玩家都会被移出。");
  if (!confirmed) return;

  setBusy(true);
  try {
    const players = [...(currentRoom.players || [])];
    for (const player of players.filter((item) => item.id !== getPlayerId())) {
      await requestJson(`${POKER_API_BASE}/api/rooms/${encodeURIComponent(currentRoom.room_id)}/leave`, {
        method: "POST",
        body: { user_id: player.id },
      });
    }

    await requestJson(`${POKER_API_BASE}/api/rooms/${encodeURIComponent(currentRoom.room_id)}/leave`, {
      method: "POST",
      body: { user_id: getPlayerId() },
    });
    clearCurrentRoom();
    showStatus("已解散", "房间已解散", "可以重新开新房。");
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
    addGameLog(`你选择了 ${actionLabel(action)}${amount ? ` ${amount}` : ""}。`);
    queuePersonalGameStateSync(300);
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
      clearSelfHoleCards(currentRoom.room_id);
      renderGameState(data.game_state);
    }
    queuePersonalGameStateSync(200);
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

function queuePersonalGameStateSync(delay = 250) {
  clearTimeout(personalSyncTimer);
  personalSyncTimer = window.setTimeout(syncPersonalGameState, delay);
}

function mergeSelfHoleCards(state) {
  const selfId = getPlayerId();
  const self = state?.players?.[selfId];
  if (!state || !self) return state;

  const roomId = state.room_id || currentRoom?.room_id || "";
  if (hasVisibleHoleCards(self.hole_cards)) {
    selfHoleCardsByRoom.set(roomId, [...self.hole_cards]);
    return state;
  }

  const cachedCards = selfHoleCardsByRoom.get(roomId);
  if (self.has_cards && hasVisibleHoleCards(cachedCards)) {
    return {
      ...state,
      players: {
        ...state.players,
        [selfId]: {
          ...self,
          hole_cards: [...cachedCards],
        },
      },
    };
  }

  return state;
}

function clearSelfHoleCards(roomId) {
  if (roomId) {
    selfHoleCardsByRoom.delete(roomId);
  } else {
    selfHoleCardsByRoom.clear();
  }
}

function hasVisibleHoleCards(cards) {
  return Array.isArray(cards) && cards.length === 2 && cards.every((card) => {
    const value = String(card || "");
    return value && value !== "XX" && value !== "??";
  });
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
  selfHoleCardsByRoom = new Map();
  resetGameLog();
  clearInterval(roomPollTimer);
  clearInterval(countdownTimer);
  clearTimeout(personalSyncTimer);
  roomPollTimer = null;
  countdownTimer = null;
  roomCodeInput.value = "";
  roomCard.hidden = true;
  setAppMode("lobby");
  gameState.hidden = true;
  gameStateTitle.textContent = "第一手牌";
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
        if (message.type === "player_joined") addGameLog("有玩家加入房间。");
        if (message.type === "player_left") addGameLog("有玩家离开房间。");
        if (message.type === "player_reconnected") addGameLog("有玩家重新连接。");
      } else if (message.type === "player_left") {
        showStatus("关闭", "房间已关闭", "所有玩家都已离开。");
        currentRoom = null;
        roomCard.hidden = true;
        addGameLog("房间已关闭。");
      }
      return;
    case "lobby_update":
      return;
    case "game_started":
    case "game_state_update":
    case "game_state_sync":
      if (message.game_state) {
        if (message.type === "game_started") addGameLog("牌局开始。");
        if (message.type === "game_started") clearSelfHoleCards(message.game_state.room_id);
        renderGameState(message.game_state);
        showStatus("游戏中", phaseLabel(message.game_state.phase), "Render 后端正在同步牌局。");
      }
      return;
    case "player_action_result":
      showConnection(`${message.player_id === getPlayerId() ? "你" : "玩家"} ${message.action}`);
      addGameLog(`${message.player_id === getPlayerId() ? "你" : "玩家"} ${actionLabel(message.action)}。`);
      return;
    case "player_timeout":
      showStatus("超时", message.player_id === getPlayerId() ? "你已超时弃牌" : "有玩家超时弃牌", message.message || "等待下一步同步。");
      addGameLog(message.player_id === getPlayerId() ? "你超时弃牌。" : "有玩家超时弃牌。");
      return;
    case "player_disconnected":
      showConnection("有玩家断线");
      addGameLog("有玩家断线，等待重连。");
      return;
    case "room_closed":
    case "kicked":
    case "game_ended_by_admin":
      showStatus("结束", message.message || "房间状态已改变", "请重新进入房间。");
      roomCard.hidden = true;
      setAppMode("lobby");
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
  roomCard.hidden = Boolean(options.preview);
  setAppMode(options.preview ? "lobby" : "room");

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

  if (room.status !== "playing") {
    renderWaitingRoom(room, isHost, canStart);
    updateHostSettingHint();
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
      ${room.status !== "playing" && room.creator_id === getPlayerId() && player.id !== getPlayerId()
        ? `<button class="kick-button" type="button" data-kick-player="${escapeHtml(player.id)}">踢出</button>`
        : ""}
    </article>
  `;
}

function renderGameState(state) {
  state = mergeSelfHoleCards(state);
  currentGameState = state;
  gameState.hidden = false;
  gameStateTitle.textContent = "牌局进行中";
  roomCard.hidden = false;
  setAppMode("room");
  roomBadge.textContent = "PLAYING";
  if (currentRoom) {
    currentRoom.status = "playing";
    renderRoom(currentRoom);
  }

  const self = state.players?.[getPlayerId()];
  const players = Object.values(state.players || {});
  const isCreator = currentRoom?.creator_id === getPlayerId();
  const isMyTurn = state.current_player === getPlayerId();
  const tablePlayers = arrangeTablePlayers(players, getPlayerId());
  const currentPlayer = players.find((player) => player.user_id === state.current_player);

  gameStateBody.innerHTML = `
    <div class="poker-table-stage">
      <div class="poker-felt">
        <div class="table-rail" aria-hidden="true"></div>
        <div class="table-seats">
          ${tablePlayers.others.map((player, index) => renderTableSeat(player, state, index + 1)).join("")}
          ${renderEmptyTableSeats(tablePlayers.others.length)}
        </div>

        <div class="table-center-area">
          <div class="community-cards-new">
            ${renderCards(state.community_cards || [], 5)}
          </div>
          <div class="table-info-right">
            <div class="phase-info-card">
              <div class="phase-title">${phaseLabel(state.phase)}</div>
              <div class="pot-display">${state.pot || 0}</div>
              <div class="current-bet-display">当前下注 ${state.current_bet || 0}</div>
            </div>
            <div class="current-action-card ${Number(state.time_remaining || 0) <= 10 ? "is-urgent" : ""}">
              <span>当前行动</span>
              <strong>${escapeHtml(currentPlayer?.username || "等待同步")}</strong>
              <b data-countdown>${state.time_remaining ?? "-"} 秒</b>
            </div>
          </div>
        </div>

        ${self ? renderSelfSeat(self, state) : ""}
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

  startCountdown(state.time_remaining);
  if (self?.has_cards && !hasVisibleHoleCards(self.hole_cards)) {
    queuePersonalGameStateSync(150);
  }
}

function renderWaitingRoom(room, isHost, canStart) {
  gameState.hidden = false;
  gameStateTitle.textContent = "等待开局";
  gameStateBody.innerHTML = `
    <div class="waiting-room-panel">
      <div>
        <strong>${canStart ? "人数已满足，可以开始游戏" : "等待更多玩家加入"}</strong>
        <p>${isHost ? "你是房主，2 到 8 人即可开始。" : "等待房主开始游戏。"}</p>
      </div>
      <div class="waiting-room-code">
        <span>房间码</span>
        <b>${escapeHtml(room.room_id)}</b>
      </div>
      <div class="seat-grid">
        ${renderSeats(room)}
      </div>
      ${isHost ? renderHostControls(room, canStart) : ""}
    </div>
  `;
}

function renderHostControls(room, canStart) {
  return `
    <section class="host-control-panel" aria-label="房主管理">
      <div class="host-control-head">
        <div>
          <strong>房主管理</strong>
          <span>开局前可调整盲注、下注上限、移除玩家或解散房间。</span>
        </div>
        <button class="button secondary danger-lite" type="button" data-disband-room="1">解散房间</button>
      </div>
      <div class="host-setting-grid">
        <label>
          <span>小盲注</span>
          <input id="small-blind-setting" type="number" min="1" max="100" step="1" value="${hostSettings.smallBlind}">
        </label>
        <label>
          <span>每手下注上限</span>
          <input id="max-hand-bet-setting" type="number" min="${hostSettings.smallBlind * 2}" max="100000" step="1" value="${hostSettings.maxHandBet}">
        </label>
        <div class="host-setting-hint" id="host-setting-hint"></div>
      </div>
      <p>${canStart ? "人数已满足，设置确认后可以开始。" : `还差 ${Math.max(0, 2 - room.current_players)} 名玩家即可开始。`}</p>
    </section>
  `;
}

function readHostSettings() {
  const smallBlindInput = document.querySelector("#small-blind-setting");
  const maxHandBetInput = document.querySelector("#max-hand-bet-setting");
  const smallBlind = clampInteger(smallBlindInput?.value ?? hostSettings.smallBlind, 1, 100);
  const maxHandBet = clampInteger(maxHandBetInput?.value ?? hostSettings.maxHandBet, smallBlind * 2, 100000);
  const bigBlind = smallBlind * 2;
  hostSettings.smallBlind = smallBlind;
  hostSettings.maxHandBet = maxHandBet;

  return {
    smallBlind,
    maxHandBet,
    maxBetMultiplier: Math.max(1, Math.ceil(maxHandBet / bigBlind)),
  };
}

function resetHostSettings() {
  hostSettings = {
    smallBlind: DEFAULT_SMALL_BLIND,
    maxHandBet: DEFAULT_SMALL_BLIND * DEFAULT_MAX_BET_SMALL_BLIND_MULTIPLIER,
    maxBetTouched: false,
  };
}

function updateHostSettingHint() {
  const hint = document.querySelector("#host-setting-hint");
  if (!hint) return;
  const settings = readHostSettings();
  const bigBlind = settings.smallBlind * 2;
  hint.innerHTML = `
    <span>大盲注：${bigBlind}</span>
    <span>后端上限：大盲注 x ${settings.maxBetMultiplier}，实际上限约 ${bigBlind * settings.maxBetMultiplier}</span>
  `;
}

function renderSeats(room) {
  const players = room.players || [];
  const seatCount = Math.max(room.max_players || 8, 8);
  return Array.from({ length: seatCount }, (_, index) => {
    const player = players[index];
    if (!player) {
      return `
        <article class="seat-card is-empty">
          <span>座位 ${index + 1}</span>
          <strong>空位</strong>
        </article>
      `;
    }

    const tags = [
      player.id === room.creator_id ? "房主" : "",
      player.id === getPlayerId() ? "你" : "",
    ].filter(Boolean);

    return `
      <article class="seat-card ${player.id === getPlayerId() ? "is-self" : ""}">
        <b>${escapeHtml(playerInitial(player.name))}</b>
        <span>座位 ${index + 1}${tags.length ? ` · ${tags.join(" · ")}` : ""}</span>
        <strong>${escapeHtml(player.name)}</strong>
      </article>
    `;
  }).join("");
}

function renderTableSeat(player, state, position) {
  const isCurrent = state.current_player === player.user_id;
  const isSelf = player.user_id === getPlayerId();
  const cardsVisible = isSelf || state.phase === "showdown" || state.phase === "finished";
  const isDealer = getDealerPlayerId(state) === player.user_id;
  return `
    <article class="table-seat occupied position-${position} ${isCurrent ? "current-turn" : ""} ${player.status === "folded" ? "is-folded" : ""}">
      ${isDealer ? `<div class="dealer-chip">D</div>` : ""}
      <div class="seat-content">
        <div class="seat-row-1">
          <div class="player-info-compact">
            <div class="player-name-compact">${escapeHtml(player.username)}</div>
            <div class="chips-compact">${player.chips} 筹码</div>
          </div>
          <div class="hole-cards-inline">${renderCards(cardsVisible ? player.hole_cards : ["XX", "XX"], 2, true)}</div>
        </div>
        <div class="seat-row-2">
          ${renderActionBubble(player)}
          ${Number(player.current_bet || 0) > 0 ? `<div class="bet-display">下注 ${player.current_bet}</div>` : ""}
        </div>
      </div>
      ${isCurrent ? `<div class="turn-indicator-border"></div>` : ""}
    </article>
  `;
}

function renderSelfSeat(player, state) {
  const isCurrent = state.current_player === player.user_id;
  const isDealer = getDealerPlayerId(state) === player.user_id;
  return `
    <article class="self-player-card ${isCurrent ? "current-turn" : ""}">
      ${isDealer ? `<div class="dealer-chip">D</div>` : ""}
      <div class="self-player-header">
        <div class="self-player-name">${escapeHtml(player.username)} <span class="you-badge">你</span></div>
        <div class="self-chips-display">${player.chips}</div>
      </div>
      <div class="self-hole-cards">${renderCards(player.hole_cards || [], 2)}</div>
      <div class="self-bet-info">
        <div><span>本轮</span><strong>${player.current_bet || 0}</strong></div>
        <div><span>总注</span><strong>${player.total_bet || 0}</strong></div>
        <div><span>状态</span><strong>${player.status || "active"}</strong></div>
      </div>
      ${isCurrent ? `<div class="turn-indicator-border"></div>` : ""}
    </article>
  `;
}

function arrangeTablePlayers(players, selfId) {
  const list = players.filter((player) => player.user_id !== selfId);
  return {
    others: list.slice(0, 7),
  };
}

function renderEmptyTableSeats(occupiedCount) {
  const totalSeats = 7;
  return Array.from({ length: Math.max(0, totalSeats - occupiedCount) }, (_, index) => {
    const position = occupiedCount + index + 1;
    return `
      <article class="table-seat empty position-${position}">
        <div class="empty-seat-indicator">
          <span>座位 ${position}</span>
          <strong>空座</strong>
        </div>
      </article>
    `;
  }).join("");
}

function renderActionBubble(player) {
  const action = player.last_action || (player.status === "folded" ? "fold" : "");
  if (!action) return "";

  const className = action === "fold"
    ? "action-fold"
    : action === "raise" || action === "all_in"
      ? "action-raise"
      : action === "bet"
        ? "action-bet"
        : "action-normal";

  return `<div class="action-display ${className}">${escapeHtml(actionLabel(action))}</div>`;
}

function getDealerPlayerId(state) {
  const players = Object.values(state.players || {});
  const dealerIndex = Number(state.dealer_position);
  return players[dealerIndex]?.user_id || "";
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
    <div class="action-strip active-action">
      <div class="action-info">
        <strong>轮到你了</strong>
        <span class="timer-badge ${Number(state.time_remaining || 0) <= 10 ? "urgent" : ""}" data-countdown>${state.time_remaining ?? "-"} 秒</span>
        <span>底池 ${state.pot || 0}</span>
        <span>下注限制 ${self.total_bet || 0}/${state.max_bet_per_hand || "-"}</span>
      </div>
      <div class="action-buttons">
        <button class="action-btn fold-btn" data-action="fold">弃牌</button>
        ${canCheck ? `<button class="action-btn check-btn" data-action="check">过牌</button>` : `<button class="action-btn call-btn" data-action="call">跟注 ${callAmount}</button>`}
        <label class="bet-input-wrap">
          <span>${state.current_bet > 0 ? "加注到" : "下注"}</span>
          <input id="bet-amount" type="number" min="${minBet}" max="${maxBet}" value="${Math.min(minBet, maxBet || minBet)}">
        </label>
        <button class="action-btn ${state.current_bet > 0 ? "raise-btn" : "bet-btn"}" data-action="${state.current_bet > 0 ? "raise" : "bet"}">${state.current_bet > 0 ? "加注" : "下注"}</button>
      </div>
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

function startCountdown(seconds) {
  clearInterval(countdownTimer);
  let remaining = Number(seconds);
  if (!Number.isFinite(remaining)) return;

  updateCountdownDisplays(remaining);
  countdownTimer = window.setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    updateCountdownDisplays(remaining);
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
}

function updateCountdownDisplays(remaining) {
  document.querySelectorAll("[data-countdown]").forEach((node) => {
    node.textContent = `${remaining} 秒`;
    node.classList.toggle("urgent", remaining <= 10);
  });
  const actionCard = document.querySelector(".current-action-card");
  if (actionCard) {
    actionCard.classList.toggle("is-urgent", remaining <= 10);
  }
}

function renderCards(cards, placeholders = 0, small = false) {
  const list = [...cards];
  while (list.length < placeholders) list.push("");
  return list.map((card) => {
    const parsed = parseCard(card);
    if (parsed.isBack) {
      return `<b class="playing-card card-back ${small ? "small" : ""}" aria-label="隐藏牌"></b>`;
    }
    return `
      <b class="playing-card ${parsed.color} ${small ? "small" : ""}" aria-label="${escapeHtml(parsed.rank + parsed.suit)}">
        <span class="card-rank">${escapeHtml(parsed.rank)}</span>
        <span class="card-suit">${escapeHtml(parsed.suit)}</span>
      </b>
    `;
  }).join("");
}

function parseCard(card) {
  const value = String(card || "");
  if (!value || value === "XX") {
    return { rank: "", suit: "", color: "gray", isBack: true };
  }

  const rankText = value.slice(0, -1);
  const suitText = value.slice(-1);
  const ranks = {
    T: "10",
    J: "J",
    Q: "Q",
    K: "K",
    A: "A",
  };
  const suits = {
    S: { suit: "♠", color: "black" },
    H: { suit: "♥", color: "red" },
    D: { suit: "♦", color: "red" },
    C: { suit: "♣", color: "black" },
  };

  return {
    rank: ranks[rankText] || rankText,
    ...(suits[suitText] || { suit: "?", color: "gray" }),
    isBack: false,
  };
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
  connectionStatus.textContent = text;
  connectionStatus.classList.toggle("is-online", text.includes("已连接"));
  connectionStatus.classList.toggle("is-error", text.includes("错误") || text.includes("重连"));
  if (!currentRoom) return;
  statusCopy.textContent = text;
}

async function copyRoomLink() {
  const link = roomLinkInput.value || (currentRoom ? buildRoomUrl(currentRoom.room_id, renderGameParam(currentRoom.game_type)) : "");
  if (!link) return;

  try {
    await navigator.clipboard.writeText(link);
    roomStatus.textContent = "Copied";
    addGameLog("邀请链接已复制。");
  } catch {
    roomLinkInput.value = link;
    roomLinkInput.select();
    document.execCommand("copy");
    roomStatus.textContent = "Copied";
    addGameLog("邀请链接已复制。");
  }

  window.setTimeout(() => {
    roomStatus.textContent = currentRoom ? "房间中" : "待开局";
  }, 1400);
}

function addGameLog(message) {
  const text = String(message || "").trim();
  if (!text) return;
  if (gameLogs[0]?.text === text) return;
  gameLogs = [
    {
      id: `${Date.now()}-${Math.random()}`,
      time: new Date(),
      text,
    },
    ...gameLogs,
  ].slice(0, 16);
  renderGameLog();
}

function resetGameLog() {
  gameLogs = [];
  renderGameLog();
}

function renderGameLog() {
  if (!gameLogList) return;
  if (!gameLogs.length) {
    gameLogList.innerHTML = `<p class="empty-log">等待房间事件。</p>`;
    return;
  }

  gameLogList.innerHTML = gameLogs.map((item) => `
    <article>
      <time>${formatLogTime(item.time)}</time>
      <span>${escapeHtml(item.text)}</span>
    </article>
  `).join("");
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

function actionLabel(action) {
  const labels = {
    fold: "弃牌",
    check: "过牌",
    call: "跟注",
    bet: "下注",
    raise: "加注",
    all_in: "All In",
  };
  return labels[action] || action || "行动";
}

function playerInitial(name) {
  const text = String(name || "P").trim();
  return text.slice(0, 1).toUpperCase();
}

function formatLogTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function clampInteger(value, min, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function syncSelectedGame() {
  gameCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.gameCard === "texas");
  });
}

function setAppMode(mode) {
  document.body.classList.toggle("is-room-view", mode === "room");
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
