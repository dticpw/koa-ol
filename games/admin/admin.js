const POKER_API_BASE = "https://poker-backend-2fs9.onrender.com";
const ADMIN_USERNAME = "admin";
const TOKEN_KEY = "koaOlGamesAdminToken";

const loginCard = document.querySelector("#login-card");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const usernameInput = document.querySelector("#admin-username");
const passwordInput = document.querySelector("#admin-password");
const loginMessage = document.querySelector("#login-message");
const logoutButton = document.querySelector("#logout-button");
const refreshButton = document.querySelector("#refresh-button");
const cleanupButton = document.querySelector("#cleanup-button");
const broadcastButton = document.querySelector("#broadcast-button");
const broadcastMessage = document.querySelector("#broadcast-message");
const broadcastHint = document.querySelector("#broadcast-hint");
const statusLine = document.querySelector("#status-line");
const statsGrid = document.querySelector("#stats-grid");
const roomsList = document.querySelector("#rooms-list");
const roomCount = document.querySelector("#room-count");
const tabs = document.querySelectorAll("[data-tab]");
const panels = {
  stats: document.querySelector("#stats-panel"),
  rooms: document.querySelector("#rooms-panel"),
  broadcast: document.querySelector("#broadcast-panel"),
};

let token = sessionStorage.getItem(TOKEN_KEY) || "";
let refreshTimer = null;
let latestStats = null;
let latestRooms = [];

if (token) {
  showDashboard();
  refreshAll();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await login();
});

logoutButton.addEventListener("click", logout);
refreshButton.addEventListener("click", refreshAll);
cleanupButton.addEventListener("click", cleanupRooms);
broadcastButton.addEventListener("click", sendBroadcast);

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab.dataset.tab);
  });
});

roomsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;

  const action = button.dataset.adminAction;
  const roomId = button.dataset.roomId;
  const userId = button.dataset.userId;

  if (action === "delete-room") {
    await deleteRoom(roomId);
  }

  if (action === "end-game") {
    await endGame(roomId);
  }

  if (action === "kick-player") {
    await kickPlayer(roomId, userId);
  }
});

async function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  loginMessage.textContent = "";

  if (username !== ADMIN_USERNAME) {
    loginMessage.textContent = "管理员账号不正确。";
    return;
  }

  setLoginBusy(true);
  try {
    const data = await requestJson(`${POKER_API_BASE}/api/admin/login`, {
      method: "POST",
      body: { password },
      withoutToken: true,
    });

    token = data.token;
    sessionStorage.setItem(TOKEN_KEY, token);
    passwordInput.value = "";
    showDashboard();
    await refreshAll();
  } catch (error) {
    loginMessage.textContent = error.message || "登录失败。";
  } finally {
    setLoginBusy(false);
  }
}

async function logout() {
  if (token) {
    try {
      await requestJson(`${POKER_API_BASE}/api/admin/logout`, { method: "POST" });
    } catch {
      // Local logout should still happen when the backend session is already gone.
    }
  }

  token = "";
  sessionStorage.removeItem(TOKEN_KEY);
  clearInterval(refreshTimer);
  refreshTimer = null;
  latestStats = null;
  latestRooms = [];
  dashboard.hidden = true;
  logoutButton.hidden = true;
  loginCard.hidden = false;
  setStatus("");
}

function showDashboard() {
  loginCard.hidden = true;
  dashboard.hidden = false;
  logoutButton.hidden = false;
  clearInterval(refreshTimer);
  refreshTimer = window.setInterval(refreshAll, 10000);
}

async function refreshAll() {
  if (!token) return;

  setStatus("正在刷新...");
  try {
    const [stats, rooms] = await Promise.all([
      requestJson(`${POKER_API_BASE}/api/admin/stats`),
      requestJson(`${POKER_API_BASE}/api/admin/rooms`),
    ]);

    latestStats = stats;
    latestRooms = rooms.rooms || [];
    renderStats();
    renderRooms();
    setStatus(`已刷新：${formatTime(new Date())}`);
  } catch (error) {
    handleAdminError(error);
  }
}

async function deleteRoom(roomId) {
  if (!window.confirm("确定删除这个房间？房间内玩家会被通知并返回大厅。")) return;

  try {
    await requestJson(`${POKER_API_BASE}/api/admin/rooms/${encodeURIComponent(roomId)}`, {
      method: "DELETE",
    });
    setStatus("房间已删除。");
    await refreshAll();
  } catch (error) {
    handleAdminError(error);
  }
}

async function endGame(roomId) {
  if (!window.confirm("确定强制结束这个游戏？房间会回到等待状态。")) return;

  try {
    await requestJson(`${POKER_API_BASE}/api/admin/rooms/${encodeURIComponent(roomId)}/end-game`, {
      method: "POST",
    });
    setStatus("游戏已结束。");
    await refreshAll();
  } catch (error) {
    handleAdminError(error);
  }
}

async function kickPlayer(roomId, userId) {
  if (!window.confirm("确定踢出这个玩家？")) return;

  try {
    await requestJson(`${POKER_API_BASE}/api/admin/rooms/${encodeURIComponent(roomId)}/kick/${encodeURIComponent(userId)}`, {
      method: "POST",
    });
    setStatus("玩家已踢出。");
    await refreshAll();
  } catch (error) {
    handleAdminError(error);
  }
}

async function cleanupRooms() {
  try {
    const data = await requestJson(`${POKER_API_BASE}/api/admin/cleanup`, {
      method: "POST",
    });
    setStatus(`已清理 ${data.cleaned_rooms || 0} 个空房间。`);
    await refreshAll();
  } catch (error) {
    handleAdminError(error);
  }
}

async function sendBroadcast() {
  const message = broadcastMessage.value.trim();
  if (!message) {
    setStatus("请输入广播内容。", true);
    return;
  }

  try {
    const data = await requestJson(`${POKER_API_BASE}/api/admin/broadcast`, {
      method: "POST",
      body: { message },
    });
    broadcastMessage.value = "";
    setStatus(`广播已发送给 ${data.sent_to || 0} 个用户。`);
  } catch (error) {
    handleAdminError(error);
  }
}

function renderStats() {
  if (!latestStats) return;
  const stats = latestStats;
  const online = stats.connections?.total_connections || 0;
  const usersInRooms = stats.connections?.users_in_rooms || 0;
  const activeGames = stats.games?.active || 0;
  const totalRooms = stats.rooms?.total || 0;

  statsGrid.innerHTML = [
    renderStat("总房间数", totalRooms),
    renderStat("在线连接", online),
    renderStat("房间内用户", usersInRooms),
    renderStat("进行中游戏", activeGames),
    renderStat("等待中", stats.rooms?.by_status?.waiting || 0),
    renderStat("游戏中", stats.rooms?.by_status?.playing || 0),
    renderStat("已结束", stats.rooms?.by_status?.finished || 0),
    renderStat("断线待清理", stats.connections?.pending_disconnects || 0),
  ].join("");

  broadcastHint.textContent = `消息将发送给当前在线的 ${online} 个用户。`;
}

function renderStat(label, value) {
  return `
    <article class="stat-card">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `;
}

function renderRooms() {
  roomCount.textContent = `${latestRooms.length} 个房间`;
  if (!latestRooms.length) {
    roomsList.innerHTML = `<div class="empty-state">暂无房间</div>`;
    return;
  }

  roomsList.innerHTML = latestRooms.map((room) => `
    <article class="room-item ${escapeHtml(room.status)}">
      <div class="room-title-row">
        <div>
          <div class="room-name">${escapeHtml(room.room_name || room.room_id)}</div>
          <div class="room-id">ID: ${escapeHtml(room.room_id)}</div>
        </div>
        <span class="status-badge ${escapeHtml(room.status)}">${statusLabel(room.status)}</span>
      </div>

      <div class="room-meta">
        <span>${gameTypeLabel(room.game_type)}</span>
        <span>${room.current_players} / ${room.max_players} 玩家</span>
        <span>房主：${escapeHtml(hostName(room))}</span>
      </div>

      <div class="players-list">
        ${(room.players || []).map((player) => renderPlayer(room, player)).join("") || `<div class="empty-state">无玩家</div>`}
      </div>

      <div class="room-actions">
        ${room.status === "playing"
          ? `<button class="warning-button" type="button" data-admin-action="end-game" data-room-id="${escapeHtml(room.room_id)}">结束游戏</button>`
          : ""}
        <button class="danger-button" type="button" data-admin-action="delete-room" data-room-id="${escapeHtml(room.room_id)}">删除房间</button>
      </div>
    </article>
  `).join("");
}

function renderPlayer(room, player) {
  return `
    <div class="player-item">
      <div>
        <div class="player-name">${escapeHtml(player.name)}${player.id === room.creator_id ? " · 房主" : ""}</div>
        <div class="player-id">${escapeHtml(player.id)}</div>
      </div>
      <button class="danger-button" type="button" data-admin-action="kick-player" data-room-id="${escapeHtml(room.room_id)}" data-user-id="${escapeHtml(player.id)}">踢出</button>
    </div>
  `;
}

function setActiveTab(tabName) {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === tabName);
  });

  Object.entries(panels).forEach(([name, panel]) => {
    panel.hidden = name !== tabName;
  });
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 30000);
  const headers = { "Content-Type": "application/json" };

  if (!options.withoutToken) {
    headers.Authorization = `Bearer ${token}`;
  }

  const init = {
    method: options.method || "GET",
    headers,
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
      const message = data.detail || data.error || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Render 后端响应超时。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function handleAdminError(error) {
  if (error.status === 401) {
    setStatus("登录已过期，请重新登录。", true);
    logout();
    return;
  }

  setStatus(error.message || "操作失败。", true);
}

function setLoginBusy(isBusy) {
  loginForm.querySelector("button[type='submit']").disabled = isBusy;
  usernameInput.disabled = isBusy;
  passwordInput.disabled = isBusy;
}

function setStatus(message, isError = false) {
  statusLine.textContent = message || "";
  statusLine.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function hostName(room) {
  const host = (room.players || []).find((player) => player.id === room.creator_id);
  return host ? host.name : "未知";
}

function statusLabel(status) {
  const labels = {
    waiting: "等待中",
    playing: "游戏中",
    finished: "已结束",
  };
  return labels[status] || status || "未知";
}

function gameTypeLabel(type) {
  const labels = {
    texas_holdem: "德州扑克",
    blackjack: "21点",
  };
  return labels[type] || type || "未知游戏";
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
