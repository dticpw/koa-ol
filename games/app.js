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
const gameState = document.querySelector("#game-state");
const gameStateBody = document.querySelector("#game-state-body");

const STORAGE_KEY = "koaOlGamesLobby";
const PLAYER_ID_KEY = "koaOlGamesPlayerId";
const POLL_MS = 3000;

let currentRoom = null;
let pollTimer = null;

const savedState = loadState();
const urlRoom = getRoomFromUrl();
const urlGame = getGameFromUrl();

playerNameInput.value = savedState.playerName || "";
gameTypeInput.value = urlGame || savedState.gameType || "blackjack";
roomCodeInput.value = urlRoom || savedState.roomCode || "";

syncSelectedGame();

if (urlRoom) {
  statusTitle.textContent = `准备加入 ${urlRoom}`;
  statusCopy.textContent = "填好昵称后点击「加入房间」，即可看到房间内玩家。";
  previewRoom(urlRoom);
}

playerNameInput.addEventListener("input", persistState);

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = normalizeRoomCode(roomCodeInput.value);
  persistState();
});

gameCards.forEach((card) => {
  card.addEventListener("click", () => {
    gameTypeInput.value = card.dataset.gameCard;
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
  await postRoomAction(currentRoom.roomId, { action: "start" });
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

async function createRoom() {
  setBusy(true);
  showStatus("创建中", "正在开新房", "房间创建后会直接进入房间。");

  try {
    const room = await requestJson("/api/games/rooms", {
      method: "POST",
      body: {
        gameType: gameTypeInput.value,
        playerName: normalizePlayerName(playerNameInput.value),
        playerId: getPlayerId(),
      },
    });

    enterRoom(room.room);
    updateUrl(room.room.roomId, room.room.gameType);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function joinRoom() {
  const roomId = normalizeRoomCode(roomCodeInput.value);
  if (!roomId) {
    showNeedCode();
    return;
  }

  setBusy(true);
  showStatus("加入中", `正在加入 ${roomId}`, "加入后会显示当前房间玩家。");

  try {
    const room = await postRoomAction(roomId, {
      action: "join",
      playerName: normalizePlayerName(playerNameInput.value),
    });
    enterRoom(room.room);
    updateUrl(room.room.roomId, room.room.gameType);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function postRoomAction(roomId, payload) {
  return requestJson(`/api/games/rooms/${encodeURIComponent(roomId)}`, {
    method: "POST",
    body: {
      ...payload,
      playerId: getPlayerId(),
    },
  }).then((data) => {
    if (data.room) enterRoom(data.room);
    return data;
  });
}

async function pollRoom() {
  if (!currentRoom) return;

  try {
    const data = await requestJson(
      `/api/games/rooms/${encodeURIComponent(currentRoom.roomId)}?playerId=${encodeURIComponent(getPlayerId())}`
    );
    enterRoom(data.room, { silent: true });
  } catch (error) {
    showStatus("断线", "房间同步失败", error.message || "稍后会重试。");
  }
}

async function previewRoom(roomId) {
  try {
    const data = await requestJson(
      `/api/games/rooms/${encodeURIComponent(roomId)}?playerId=${encodeURIComponent(getPlayerId())}`
    );
    enterRoom(data.room, { silent: true, preview: true });
    showStatus("可加入", `${gameLabel(data.room.gameType)} · ${data.room.roomId}`, "房间信息已加载。填好昵称后点击「加入房间」。");
  } catch (error) {
    showError(error);
  }
}

function enterRoom(room, options = {}) {
  currentRoom = room;
  roomCodeInput.value = room.roomId;
  gameTypeInput.value = room.gameType;
  persistState();
  syncSelectedGame();
  renderRoom(room);
  renderRoomLink(room);

  if (!options.silent) {
    showStatus("房间中", `${gameLabel(room.gameType)} · ${room.roomId}`, "把链接发给朋友；玩家进入后这里会自动刷新。");
  }

  if (!pollTimer) {
    pollTimer = window.setInterval(pollRoom, POLL_MS);
  }
}

function renderRoom(room) {
  const isHost = room.hostPlayerId === getPlayerId();
  const isJoined = room.players.some((player) => player.playerId === getPlayerId());
  const canStart = isHost && room.status === "lobby" && room.players.length >= 2 && room.players.length <= 8;

  roomCard.hidden = false;
  roomBadge.textContent = room.status === "started" ? "STARTED" : "LOBBY";
  roomTitle.textContent = `${gameLabel(room.gameType)} · ${room.roomId}`;
  playerCount.textContent = `${room.players.length} / 8 玩家`;
  hostState.textContent = isHost ? "你是房主" : `房主：${hostName(room)}`;
  startGameButton.hidden = !isHost || room.status !== "lobby";
  startGameButton.disabled = !canStart;
  startGameButton.textContent = room.players.length < 2 ? "至少 2 人开始" : "开始游戏";

  playerList.innerHTML = room.players.map((player) => renderPlayer(player, room)).join("");
  if (!isJoined && room.status === "lobby") {
    playerList.insertAdjacentHTML("beforeend", `
      <article class="player-card join-hint">
        <div>
          <strong>你还未入座</strong>
          <span>点击「加入房间」后进入玩家列表</span>
        </div>
        <small>待加入</small>
      </article>
    `);
  }

  if (room.status === "started") {
    gameState.hidden = false;
    gameStateBody.innerHTML = renderStartedState(room);
  } else {
    gameState.hidden = true;
    gameStateBody.innerHTML = "";
  }
}

function renderPlayer(player, room) {
  const seat = player.seatIndex === null || player.seatIndex === undefined ? "未入座" : `座位 ${player.seatIndex + 1}`;
  const chips = player.chips ? `${player.chips} 筹码` : "待分筹码";
  const tags = [
    player.isHost ? "房主" : "",
    player.isYou ? "你" : "",
    room.status === "started" ? seat : "",
  ].filter(Boolean);

  return `
    <article class="player-card">
      <div>
        <strong>${escapeHtml(player.displayName)}</strong>
        <span>${chips}</span>
      </div>
      <small>${tags.length ? tags.join(" · ") : "玩家"}</small>
    </article>
  `;
}

function renderStartedState(room) {
  const you = room.players.find((player) => player.isYou);
  const privateState = you ? you.privateState : {};

  if (room.gameType === "texas") {
    return `
      <p>${escapeHtml(room.publicState.message || "第一手牌已发出。")}</p>
      <div class="state-grid">
        <span>庄位：座位 ${(room.publicState.dealerSeat ?? 0) + 1}</span>
        <span>小盲：座位 ${(room.publicState.smallBlindSeat ?? 0) + 1}</span>
        <span>大盲：座位 ${(room.publicState.bigBlindSeat ?? 0) + 1}</span>
        <span>你的手牌：${renderCards(privateState.holeCards)}</span>
      </div>
    `;
  }

  return `
    <p>${escapeHtml(room.publicState.message || "第一手牌已发出。")}</p>
    <div class="state-grid">
      <span>庄家明牌：${renderCards([room.publicState.dealerVisibleCard])}</span>
      <span>你的手牌：${renderCards(privateState.hand)}</span>
    </div>
  `;
}

function renderCards(cards) {
  if (!cards || !cards.length) return "未发牌";
  return cards.map((card) => `<b class="mini-card">${escapeHtml(card)}</b>`).join("");
}

function renderRoomLink(room) {
  roomLinkInput.value = buildRoomUrl(room.roomId, room.gameType);
  linkBox.hidden = false;
}

function showNeedCode() {
  showStatus("Need Code", "输入房间码才能加入", "没有房间码就点「开新房」，系统会自动生成一个可分享的链接。");
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

function setBusy(isBusy) {
  createRoomButton.disabled = isBusy;
  roomForm.querySelector("[data-action='join']").disabled = isBusy;
  startGameButton.disabled = isBusy || startGameButton.disabled;
}

async function requestJson(url, options = {}) {
  const init = {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
  };

  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
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
    playerId = `p_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  return playerId;
}

function normalizeRoomCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

function normalizePlayerName(value) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed || "Guest";
}

function gameLabel(value) {
  return value === "texas" ? "Texas Hold'em" : "Blackjack";
}

function hostName(room) {
  const host = room.players.find((player) => player.playerId === room.hostPlayerId);
  return host ? host.displayName : "未知";
}

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeRoomCode(params.get("room") || "");
}

function getGameFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const game = params.get("game");
  return game === "blackjack" || game === "texas" ? game : "";
}

function syncSelectedGame() {
  gameCards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.gameCard === gameTypeInput.value);
  });
}

function persistState() {
  const state = {
    playerName: playerNameInput.value,
    gameType: gameTypeInput.value,
    roomCode: normalizeRoomCode(roomCodeInput.value),
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
