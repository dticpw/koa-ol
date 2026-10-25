import {esc, nickname, request, act} from '../table-client.js';
import {timeoutNotice} from '../ace-21/src/timeout-notice.js?v=104';

const $ = id => document.getElementById(id);
const ids = ['10200', '10201', '10202', '10203'];
// Decorative board only: seat 0 stays north, seat 1 stays south; protocol is unchanged.
const boardMarkup = `<svg class="board-lines" viewBox="0 0 420 470" aria-hidden="true" focusable="false">
  <g class="board-grid">
    <rect x="10" y="10" width="400" height="448" rx="2"/>
    <path d="${Array.from({length: 10}, (_, row) => `M18 ${18 + row * 48}H402`).join(' ')}"/>
    <path d="M18 18V450 M402 18V450 ${Array.from({length: 7}, (_, col) => `M${66 + col * 48} 18V210 M${66 + col * 48} 258V450`).join(' ')}"/>
    <path class="palace north" d="M162 18L258 114 M258 18L162 114"/>
    <path class="palace south" d="M162 354L258 450 M258 354L162 450"/>
  </g>
  <g class="river"><text x="114" y="240">楚 河</text><text x="306" y="240">汉 界</text></g>
</svg>`;
let tables = [], connection = 'loading', busy = false, polling = false, epoch = 0, signature = '';
const name = $('nickname');
name.value = nickname();
name.addEventListener('input', () => nickname(name.value));
const timeout = timeoutNotice($('timeout-notice'), id => action(id, {type: 'stay'}));
const mine = () => tables.find(t => t.seats.some(p => p?.you));

function notice(message) {
  $('notice').textContent = message;
  $('notice').hidden = !message;
}

function render() {
  const next = JSON.stringify([tables, connection, busy]);
  if (signature === next) return;
  signature = next;
  const focus = document.activeElement;
  const focusId = focus?.id;
  const focusTable = focus?.dataset.table;
  const ready = connection === 'connected';
  const seated = !!mine();
  $('tables').innerHTML = ids.map(id => {
    const t = tables.find(t => t.id === id);
    const people = t?.seats.filter(Boolean) || [];
    const me = people.find(p => p.you);
    const status = ready ? `${people.length} / 2 人` : t ? '上次记录 · 未连接' : '座位状态未知';
    return `<article class="chess-table ${me ? 'my-table' : ''} ${ready ? '' : 'unavailable'}" data-table="${id}" aria-labelledby="table-${id}">
      <header><h3 id="table-${id}"><small>TABLE</small>${id}</h3><span class="table-status">${status}</span></header>
      <div class="seat-map">${boardMarkup}${[0, 1].map(i => {
        const p = t?.seats[i];
        const label = p ? p.name : ready ? '＋ 入座' : '暂不可入座';
        const detail = p ? `${p.you ? '你 · ' : ''}${p.host ? '房主' : '玩家'}${p.online ? '' : ' · 离线'}` : `${i + 1} 号座`;
        return `<button id="seat-${id}-${i}" class="seat ${p ? 'occupied' : ''} ${p?.you ? 'mine' : ''}" data-table="${id}" data-sit="${i}" ${!ready || busy || p || seated ? 'disabled' : ''} aria-label="${i + 1}号座，${esc(label)}，${esc(detail)}"><span>${esc(label)}</span><small>${esc(detail)}</small></button>`;
      }).join('')}</div>
      <div class="table-bottom"><p>${me ? `你在 ${me.seat + 1} 号座${me.host ? ' · 房主' : ''}` : seated && ready ? '换桌请先离座' : '双人对弈待开放'}</p>${me ? `<button id="leave-${id}" data-table="${id}" data-leave="${id}" ${!ready || busy ? 'disabled' : ''}>离座</button>` : '<span class="seat-only">仅座位同步</span>'}</div>
    </article>`;
  }).join('');
  if (focusId) {
    const restored = $(focusId);
    if (restored && !restored.disabled) restored.focus({preventScroll: true});
    else if (focusTable && !busy) {
      const fallback = $(`leave-${focusTable}`) || document.querySelector(`.chess-table[data-table="${focusTable}"] .seat:not(:disabled)`);
      fallback?.focus({preventScroll: true});
    }
  }
  $('connection').textContent = ready ? '座位已连接 · 自动更新' : connection === 'loading' ? '正在连接座位服务…' : '座位服务连接中断，正在重试。自战入口仍可访问。';
  $('retry').hidden = connection !== 'offline';
}

async function refresh() {
  if (polling || busy) return;
  polling = true;
  const version = epoch;
  try {
    const data = await request('/tables/xiangqi');
    if (version !== epoch) return; // A GET started before a click cannot overwrite that action.
    if (!Array.isArray(data.tables) || data.tables.length !== 4 || !ids.every(id => data.tables.filter(t => t.id === id && t.game === 'xiangqi' && t.capacity === 2 && Array.isArray(t.seats) && t.seats.length === 2).length === 1)) throw new Error('座位数据不完整');
    const hadSeat = !!mine();
    tables = data.tables;
    connection = 'connected';
    if (hadSeat && !mine()) notice('你的座位已释放，请重新选择空座。');
    timeout.update(mine(), data.serverNow);
  } catch {
    if (version !== epoch) return;
    connection = 'offline';
    timeout.update(null); // Never offer a stale stay action while disconnected.
  } finally {
    polling = false;
    render();
  }
}

async function action(id, value) {
  const t = tables.find(t => t.id === id);
  if (!t || busy || connection !== 'connected') return;
  const trigger = document.activeElement;
  busy = true;
  epoch++;
  notice('');
  render();
  try {
    const data = await act('xiangqi', t, value);
    tables = tables.map(t => t.id === id ? {...t, ...data} : t);
    timeout.update(mine(), data.serverNow);
    notice(value.type === 'leave' ? '已离座。' : value.type === 'stay' ? '已为你继续留座。' : '入座成功。双人对弈尚未开放。');
  } catch (error) {
    notice(error.status ? error.message : '操作结果尚未确认，正在重新连接；请以恢复后的座位状态为准。');
    if (!error.status || error.status >= 500) { connection = 'offline'; timeout.update(null); }
  } finally {
    busy = false;
    render();
    if (trigger?.dataset.table === id) {
      const same = $(trigger.id);
      const target = same && !same.disabled ? same : $(`leave-${id}`) || document.querySelector(`.chess-table[data-table="${id}"] .seat:not(:disabled)`);
      target?.focus({preventScroll: true});
    }
    await refresh();
  }
}

$('tables').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.sit !== undefined) {
    if (!name.value.trim()) {
      name.value = '';
      notice('请先填写入座昵称；前往自战无需昵称。');
      name.focus();
      name.reportValidity();
      return;
    }
    nickname(name.value);
    action(button.dataset.table, {type: 'sit', seat: Number(button.dataset.sit), name: name.value.trim()});
  } else if (button.dataset.leave) action(button.dataset.leave, {type: 'leave'});
});
$('retry').addEventListener('click', refresh);
window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
render();
async function poll() {
  await refresh();
  setTimeout(poll, document.hidden ? 5000 : 1400);
}
poll();
