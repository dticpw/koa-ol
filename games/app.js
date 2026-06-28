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

const STORAGE_KEY = "koaOlGamesLobby";

const savedState = loadState();
playerNameInput.value = savedState.playerName || "";
gameTypeInput.value = savedState.gameType || "blackjack";
roomCodeInput.value = getRoomFromUrl() || savedState.roomCode || "";

syncSelectedGame();

playerNameInput.addEventListener("input", () => {
  persistState();
});

gameTypeInput.addEventListener("change", () => {
  syncSelectedGame();
  persistState();
});

roomCodeInput.addEventListener("input", persistState);

gameCards.forEach((card) => {
  card.addEventListener("click", () => {
    gameTypeInput.value = card.dataset.gameCard;
    syncSelectedGame();
    persistState();
  });
});

createRoomButton.addEventListener("click", () => {
  roomCodeInput.value = createRoomCode();
  handleRoomIntent("created");
});

roomForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!roomCodeInput.value.trim()) {
    showNeedCode();
    return;
  }

  handleRoomIntent("joined");
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
    roomStatus.textContent = "Ready";
  }, 1400);
});

function handleRoomIntent(mode) {
  const playerName = normalizePlayerName(playerNameInput.value);
  const roomCode = normalizeRoomCode(roomCodeInput.value) || createRoomCode();
  const gameType = gameTypeInput.value;

  playerNameInput.value = playerName;
  roomCodeInput.value = roomCode;
  persistState();

  const roomUrl = buildRoomUrl(roomCode, gameType);
  roomLinkInput.value = roomUrl;
  linkBox.hidden = false;

  roomStatus.textContent = mode === "created" ? "Created" : "Joined";
  statusTitle.textContent = `${gameLabel(gameType)} · ${roomCode}`;
  statusCopy.textContent = mode === "created"
    ? "房间已就绪。复制链接发给朋友。"
    : "已锁定房间。下一步会进入真实牌桌。";

  updateUrl(roomCode, gameType);
}

function showNeedCode() {
  roomStatus.textContent = "Need Code";
  statusTitle.textContent = "输入房间码才能加入";
  statusCopy.textContent = "没有房间码就点「开新房」，系统会自动生成一个可分享的链接。";
  linkBox.hidden = true;
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

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeRoomCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

function normalizePlayerName(value) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed || "Guest";
}

function gameLabel(value) {
  return value === "texas" ? "Texas Hold'em" : "Blackjack";
}

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const game = params.get("game");
  if (game === "blackjack" || game === "texas") {
    gameTypeInput.value = game;
  }
  return normalizeRoomCode(params.get("room") || "");
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
