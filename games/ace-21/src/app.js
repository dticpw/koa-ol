import { CATALOG, createGame, dispatch, cardName, total, targetOf, slots, damage, playError, observe } from './engine.js';
import { chooseAction } from './ai.js';
import { RoomClient, savedRoom } from './network.js?v=041';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const artMap = { shield: 'shield', sword: 'sword', star: 'crown', crown: 'crown', eye: 'eye', moon: 'moon', harvest: 'moon', cycle: 'scales', return: 'scales', swap: 'scales', break: 'sword', number: 'scales' };
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
// Choose the mode before showing any UI; a failed online connection is never solo.
const multiplayerEntry = new URL(location.href).searchParams.has('table');
let state = multiplayerEntry ? null : createGame(seed()), started = false, paused = false, selected = null;
let aiTimer, toastTimer, fxTimer, fast = false, sound = false, audioContext;
const animations = new Set();
let online = null, room = null, connected = false, networkBusy = false;
const deckCount = () => online ? state.deckCount ?? 0 : state.deck.length;
const enemyName = () => online && room?.state ? state.players[1].name : '希儿';
const loss = actor => online && room?.state ? state.damage[actor] : damage(state, actor);
const cardError = id => online ? state.playErrors?.[id] || '' : playError(state, 0, id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const anyDialog = () => Boolean(document.querySelector('dialog[open]'));

function art(card) { return `<span class="trump-art art-${artMap[CATALOG[card.type].icon]}" aria-hidden="true"></span>`; }
function trumpHTML(c) {
  const def = CATALOG[c.type];
  return `<button class="trump ${selected === c.id ? 'selected' : ''}" data-hand="${c.id}" data-cid="${c.id}" aria-pressed="${selected === c.id}" aria-label="${esc(cardName(c))}，${def.cost} 格，${def.stay ? '持续' : '瞬时'}王牌，点击查看效果"><span class="trump-top"><span>${def.family}</span><span class="trump-cost">${'◇'.repeat(def.cost)}</span></span>${art(c)}${c.value ? `<span class="trump-value" aria-hidden="true">${c.value}</span>` : ''}<span class="trump-name">${esc(cardName(c))}</span><span class="trump-note">${def.stay ? '置于桌面' : '即时生效'}</span></button>`;
}
function numberHTML(c, owner, index) {
  const hidden = owner === 1 && index === 0 && state.phase === 'playing';
  return `<div class="num-card ${hidden ? 'back' : ''} ${index === 0 ? 'hole' : ''} ${c.generated ? 'generated' : ''}" data-cid="${index === 0 ? `hole-${state.round}-${owner}` : c.id}" data-face="${hidden ? 'back' : 'front'}" aria-label="${hidden ? esc(enemyName()) + '的底牌，未知' : `${c.generated ? '创造牌' : index === 0 ? '底牌' : '明牌'} ${c.value} 点`}">${hidden ? '<span class="pip">?</span><span class="card-suit">底牌</span>' : `<span class="corner">${c.value}<br>♠</span><span class="pip">${c.value}</span><span class="corner bottom">${c.value}<br>♠</span>${c.generated ? '<span class="hole-label">创造</span>' : index === 0 ? '<span class="hole-label">底牌</span>' : ''}`}</div>`;
}

function scheduleAI() {
  clearTimeout(aiTimer);
  if (online || !started || paused || document.hidden || anyDialog() || state.phase !== 'playing' || state.actor !== 1) return;
  aiTimer = setTimeout(() => perform(chooseAction(observe(state, 1))), fast ? 400 : 1250);
}
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3300);
}
function soundEffect(type) {
  if (!sound || document.hidden || !audioContext) return;
  try {
    const now = audioContext.currentTime;
    const pitches = { draw: [520, 790], play: [330, 495, 660], stand: [260], next: [440, 550], result: [330, 440, 660] }[type] || [500];
    pitches.forEach((freq, i) => {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = type === 'play' ? 'triangle' : 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * .055); gain.gain.linearRampToValueAtTime(.04, now + i * .055 + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + i * .055 + .15);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(now + i * .055); osc.stop(now + i * .055 + .18);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  } catch { /* Audio is optional; gameplay remains available. */ }
}

function captureCards() {
  return new Map([...document.querySelectorAll('[data-cid]')].map(el => [el.dataset.cid, { rect: el.getBoundingClientRect(), node: el.cloneNode(true), face: el.dataset.face }]));
}
function animate(el, frames, options) {
  if (reduced.matches || document.hidden) return;
  const a = el.animate(frames, options); animations.add(a);
  a.finished.catch(() => {}).finally(() => animations.delete(a)); return a;
}
function transitionCards(before) {
  if (reduced.matches || document.hidden) return;
  const deck = $('deck').getBoundingClientRect();
  const elements = [...document.querySelectorAll('[data-cid]')];
  const boxes = elements.map(el => ({ el, box: el.getBoundingClientRect(), old: before.get(el.dataset.cid) }));
  const current = new Set(elements.map(el => el.dataset.cid));
  for (const { el, box, old } of boxes) {
    if (!old && el.classList.contains('generated')) {
      animate(el, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' });
      continue;
    }
    if (old?.face === 'back' && el.dataset.face === 'front') {
      animate(el, [{ transform: 'perspective(600px) rotateY(88deg)', opacity: .5 }, { transform: 'perspective(600px) rotateY(0)', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.2,.7,.2,1)' });
    } else {
      const origin = old?.rect || deck, dx = origin.left - box.left, dy = origin.top - box.top;
      if (Math.abs(dx) + Math.abs(dy) < 2 && old) continue;
      animate(el, [
        { transform: `translate(${dx}px,${dy}px) scale(${Math.max(.3, Math.min(1.5, origin.width / box.width))}) rotate(${old ? 0 : -9}deg)`, opacity: old ? 1 : .25 },
        { transform: 'translate(0,-2px) scale(1.02)', opacity: 1, offset: .82 },
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
      ], { duration: fast ? 260 : 520, easing: 'cubic-bezier(.2,.75,.2,1)' });
    }
  }
  for (const [id, old] of before) if (!current.has(id)) {
    if (!old.rect.width || old.rect.bottom < 0 || old.rect.top > innerHeight) continue;
    const ghost = old.node; ghost.removeAttribute('data-cid'); ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true'); ghost.setAttribute('tabindex', '-1');
    Object.assign(ghost.style, { position: 'fixed', top: `${old.rect.top}px`, left: `${old.rect.left}px`, width: `${old.rect.width}px`, height: `${old.rect.height}px`, margin: '0', zIndex: '12', pointerEvents: 'none' });
    document.body.append(ghost);
    const isNumber = ghost.classList.contains('num-card');
    const a = animate(ghost, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: isNumber ? `translate(${deck.left - old.rect.left}px,${deck.top - old.rect.top}px) scale(.4) rotate(-8deg)` : 'translateY(-20px) scale(.8)' }], { duration: 350, easing: 'ease-out' });
    if (a) a.finished.catch(() => {}).finally(() => ghost.remove()); else ghost.remove();
  }
}

function impact(actor, symbol, label, tone = 'gold') {
  if (reduced.matches || document.hidden) return;
  const el = document.createElement('div');
  el.className = `impact-effect impact-${tone}`; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<span>${symbol}</span><b>${label}</b>`;
  $('seat-' + actor).append(el);
  const a = animate(el, [
    { opacity: 0, transform: 'translate(-50%, 8px) scale(.75)' },
    { opacity: 1, transform: 'translate(-50%, -6px) scale(1.03)', offset: .2 },
    { opacity: 1, transform: 'translate(-50%, -9px) scale(1)', offset: .65 },
    { opacity: 0, transform: 'translate(-50%, -24px) scale(1)' },
  ], { duration: fast ? 550 : 950, easing: 'ease-out' });
  if (a) a.finished.catch(() => {}).finally(() => el.remove()); else el.remove();
}

function cardFeedback(old, action) {
  if (action.type !== 'play') return;
  const actor = action.actor ?? old.actor, card = old.players[actor].hand.find(c => c.id === action.id);
  if (!card) return;
  const def = {
    shield: [actor, '◇', '护盾展开', 'silver'], shield2: [actor, '◇', '护盾强化', 'silver'],
    destroy: [1 - actor, '╳', '王牌破坏', 'red'], destroyAll: [1 - actor, '╳', '桌面清除', 'red'],
    add1: [1 - actor, '↑', '败北伤害 +1', 'red'], add2: [1 - actor, '↑', '败北伤害 +2', 'red'],
    desire: [1 - actor, '◉', '欲望生效', 'red'], curse: [1 - actor, '◉', '强制抽牌', 'red'],
    harvest: [actor, '☾', '收割生效', 'gold'], devil: [actor, '☾', '王牌 +3', 'gold'],
    seelieCute: [actor, '♡', '本轮免结算', 'silver'], seelieAngry: [actor, '╳', '双方王牌封锁', 'red'],
    seelieInsight: [actor, '◉', '创造数牌', 'gold'], seelieWant: [actor, '✧', '普通王牌 +3', 'gold'],
    seelieForget: [actor, '↺', '双方明牌洗回', 'silver'], seelieDecision: [actor, '♛', '目标已锁定', 'gold'],
    perfect: [actor, '✧', '完美时机', 'gold'], perfect2: [actor, '✧', '完美时机', 'gold'],
  }[card.type];
  if (def) impact(...def);
  if (card.type === 'joy') { impact(0, '✧', '王牌 +1'); impact(1, '✧', '王牌 +1'); }
}

function render() {
  if (!state) return;
  const focused = document.activeElement?.dataset.hand;
  const revealed = state.phase !== 'playing', target = targetOf(state);
  $('round-label').textContent = `第 ${String(state.round).padStart(2, '0')} 局`;
  $('target').textContent = target;
  const special = state.players.flatMap(p => p.table).find(c => CATALOG[c.type].special);
  $('special-status').hidden = !special;
  $('special-status').innerHTML = special ? `<div><span class="eyebrow">希儿专属 · 已生效</span><strong>${esc(cardName(special))}${special.type === 'seelieDecision' ? ` · 目标 ${special.value}` : ''}</strong></div><p>${esc(CATALOG[special.type].text)}</p>` : '';
  $('deck-count').textContent = `牌池剩余 ${deckCount()} 张`;
  $('enemy-hand').textContent = `手牌王牌 ${state.players[1].handCount ?? state.players[1].hand.length} 张`;
  for (let actor = 0; actor < 2; actor++) {
    const p = state.players[actor];
    const active = started && !paused && state.phase === 'playing' && state.actor === actor;
    $('seat-' + actor).classList.toggle('is-active-turn', active);
    $('turn-badge-' + actor).textContent = active ? (actor === 0 ? '▶ 轮到你行动' : '▶ 正在行动') : '';
    $('hp-' + actor).innerHTML = `<strong>${p.hp}</strong> / ${p.maxHp} 生命`;
    $('loss-' + actor).textContent = `败北 −${loss(actor)}`;
    $('life-' + actor).style.width = `${p.hp / p.maxHp * 100}%`;
    const sum = actor === 1 && !revealed ? total({ numbers: p.numbers.slice(1) }) : total(p);
    $('score-' + actor).innerHTML = `<strong>${sum}${actor === 1 && !revealed ? '<small> + ?</small>' : ''}</strong>${actor === 1 && !revealed ? '明牌点数' : sum > target ? '已爆牌' : sum === target ? '正好命中' : '当前点数'}${state.stood[actor] && !revealed ? ' · 已停牌' : ''}`;
    $('score-' + actor).classList.toggle('bust', (actor === 0 || revealed) && sum > target);
    $('numbers-' + actor).innerHTML = p.numbers.map((c, i) => numberHTML(c, actor, i)).join('');
    $('slots-' + actor).textContent = `桌面王牌 ${slots(p)}/5`;
    $('effects-' + actor).innerHTML = p.table.map(c => `<button class="effect-chip ${CATALOG[c.type].special ? 'special-effect' : ''}" data-effect="${c.id}" data-cid="${c.id}" aria-label="查看 ${esc(cardName(c))} 效果">${esc(cardName(c))}<small>${'◇'.repeat(CATALOG[c.type].cost)}</small></button>`).join('') + Array.from({ length: 5 - slots(p) }, () => '<span class="effect-slot" aria-hidden="true">·</span>').join('');
  }
  const hand = state.players[0].hand;
  if (!hand.some(c => c.id === selected)) selected = null;
  $('hand').innerHTML = hand.length ? hand.map(trumpHTML).join('') : '<p class="empty-hand">手中暂时没有王牌。下一局会补充一张。</p>';
  $('hand-count').textContent = `${hand.length} 张`;
  if (focused) document.querySelector(`[data-hand="${focused}"]`)?.focus({ preventScroll: true });
  const yourTurn = started && (!online || (connected && !networkBusy)) && !paused && state.phase === 'playing' && state.actor === 0;
  $('turn-box').classList.toggle('your-turn', yourTurn);
  $('turn-title').textContent = !started ? '等待入席' : paused ? '牌局已暂停' : revealed ? state.phase === 'finished' ? '本场结束' : '本局已开牌' : state.actor === 1 ? `${enemyName()}的回合` : '轮到你了';
  $('turn-description').textContent = !started ? '准备开始你的牌局' : paused ? '继续时从当前状态恢复' : revealed ? '底牌揭晓，查看结算结果' : state.actor === 1 ? online ? '等待对手行动，可以查看牌效' : '思考中，你可以查看手牌效果' : '可以连续行动，停牌才交出回合';
  $('center-message').textContent = state.stood[1] && !revealed ? `${enemyName()}已停牌，现在由你决定。` : total(state.players[0]) > target && !revealed ? '你已爆牌，王牌仍能扭转局势。' : '离目标近一点，离危险远一点。';
  if (special && !revealed) $('center-message').textContent = ({seelieCute:'本轮结束不扣血，直接重新发牌。',seelieAngry:'王牌已封锁 · 仍可抽数牌或停牌',seelieDecision:`目标锁定 ${special.value} · 挑战牌不可用`,seelieInsight:'创造牌离场即消失，不进入共用牌池。',seelieWant:'破坏此牌会让希儿再获得 2 张普通王牌。',seelieForget:'破坏此牌，你将抽到池中最小数牌。'})[special.type];
  const card = hand.find(c => c.id === selected);
  const reason = card ? !started ? '开始对局后可以使用。' : paused ? '请先继续对局。' : cardError(card.id) : '';
  $('selection').classList.toggle('has-card', Boolean(card));
  if (card) {
    const def = CATALOG[card.type];
    $('selection').innerHTML = `<div class="selection-visual">${art(card)}</div><div class="selection-copy"><div class="selection-heading"><strong>${esc(cardName(card))}</strong><span>${def.stay ? '持续' : '瞬时'} · ${def.cost} 格</span><button id="clear-selection" class="close" aria-label="取消选牌">×</button></div><p>${esc(def.text)}</p>${reason ? `<div class="unavailable">${esc(reason)}</div>` : '<span class="selection-label">确认效果后，点击「打出王牌」</span>'}</div>`;
  } else $('selection').innerHTML = `<span class="selection-label">${yourTurn ? '由你决定' : '行动提示'}</span><p>${yourTurn ? '抽一张数牌，或选一张王牌改变局势。准备好就停牌。' : '点击手中或桌上的王牌，随时查看效果。'}</p>`;
  $('play').disabled = !card || !yourTurn || Boolean(reason);
  $('draw').disabled = !yourTurn || !deckCount();
  $('draw').title = !deckCount() ? '数牌池已空' : '抽一张数牌，有 1/6 概率额外获得王牌';
  $('stand').disabled = !yourTurn;
  $('pause').textContent = paused ? '继续对局' : '暂停对局';
  $('pause-overlay').hidden = !paused;
  const log = $('log'), wasBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 50;
  log.innerHTML = state.log.map(e => `<li class="log-${e.kind}">${esc(e.text)}</li>`).join('');
  if (wasBottom) log.scrollTop = log.scrollHeight;
  $('result').hidden = !revealed;
  if (revealed) {
    const r = state.result, finished = state.phase === 'finished';
    const heading = finished ? state.players[0].hp > 0 ? '这场命运，属于你。' : `这一场，${esc(enemyName())}胜出。` : r.winner === null ? '平局 · 无人受伤' : r.winner === 0 ? '你赢下了这一手' : `${esc(enemyName())}赢下了这一手`;
    const description = r.forfeit ? '对手或你已离开房间，本场结束。' : `你 ${r.sums[0]}${r.bust[0] ? '（爆牌）' : ''} · ${esc(enemyName())} ${r.sums[1]}${r.bust[1] ? '（爆牌）' : ''}${r.victim === null ? '' : ` ／ ${r.victim === 0 ? '你' : esc(enemyName())} −${r.damage} 生命`}`;
    $('result').innerHTML = `<span class="eyebrow">${finished ? 'MATCH COMPLETE' : 'CARDS REVEALED'}</span><h2>${heading}</h2><p>${description}</p><button id="next-round" class="gold-button">${online ? room.status === 'closed' ? '返回入场页' : room.ready[0] ? '已准备，等待对手' : finished ? '返回大厅' : '准备下一局' : finished ? '再来一场' : '下一局'} <span aria-hidden="true">→</span></button>`;
    if (online) $('next-round').disabled = room.status !== 'closed' && (!finished && room.ready[0] || networkBusy || !connected);
  }
  $('opponent-name').textContent = enemyName();
  $('opponent-label').textContent = `YOU × ${enemyName()}`;
  $('mode-label').textContent = online ? '双人联机' : '单人对战';
  $('pause').hidden = Boolean(online); $('pace').hidden = Boolean(online);
  $('restart').textContent = online ? '离座' : '重新开局';
}

function perform(action) {
  if (!started || paused || anyDialog() || document.hidden) return;
  if (online) { sendOnline(action); return; }
  const old = state, before = captureCards(), result = dispatch(state, action);
  if (result.error) { toast(result.error); return; }
  state = result.state;
  render(); transitionCards(before); cardFeedback(old, action);
  if (state.round > old.round && action.type === 'stand') toast('「希儿很可爱」：本轮不扣血，已发下一局。');
  soundEffect(state.phase !== 'playing' ? 'result' : action.type);
  if (targetOf(old) !== targetOf(state)) { $('target').classList.remove('target-changed'); void $('target').offsetWidth; $('target').classList.add('target-changed'); }
  for (let actor = 0; actor < 2; actor++) if (state.players[actor].hp < old.players[actor].hp) {
    $('seat-' + actor).classList.add('hit');
    clearTimeout(fxTimer); fxTimer = setTimeout(() => document.querySelectorAll('.hit').forEach(e => e.classList.remove('hit')), 400);
  }
  if (state.result && old.phase === 'playing' && state.result.victim !== null) {
    const victim = state.result.victim;
    if (state.players[victim].table.some(c => c.type === 'shield' || c.type === 'shield2')) impact(victim, '◇', state.result.damage === 0 ? '护盾抵消了伤害' : '护盾减伤', 'silver');
  }
  const events = state.log.filter(e => e.id > old.eventId).map(e => e.text);
  $('announcement').textContent = events.join(' ') + (state.phase === 'playing' && state.actor === 0 ? ' 轮到你了。' : '');
  if (state.phase !== 'playing') $('next-round')?.focus({ preventScroll: true });
  scheduleAI();
}

function openDialog(id) { clearTimeout(aiTimer); $(id).showModal(); }
function start() {
  if (multiplayerEntry || online) return;
  clearTimeout(aiTimer); animations.forEach(a => a.cancel());
  state = createGame(seed()); selected = null; paused = false; started = true;
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  render(); scheduleAI(); $('help').focus({ preventScroll: true });
}
function togglePause() { if (!started || state.phase !== 'playing') return; paused = !paused; render(); scheduleAI(); }

$('hand').addEventListener('click', e => {
  const button = e.target.closest('[data-hand]'); if (!button) return;
  button.focus({ preventScroll: true });
  selected = selected === button.dataset.hand ? null : button.dataset.hand;
  render();
  if (selected && !matchMedia('(max-width:600px)').matches) $('selection').scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'instant' : 'smooth' });
});
$('table').addEventListener('click', e => {
  const button = e.target.closest('[data-effect]');
  if (button) {
    const c = state.players.flatMap(p => p.table).find(c => c.id === button.dataset.effect);
    if (!c) return;
    $('detail-content').innerHTML = `${art(c)}<span class="eyebrow">${CATALOG[c.type].family}</span><h2 id="detail-title">${esc(cardName(c))}</h2><p>${esc(CATALOG[c.type].text)}</p><small>${CATALOG[c.type].special ? '希儿专属 · 场上最多一张' : '桌面持续效果'} · ${CATALOG[c.type].cost} 格</small>`;
    openDialog('card-detail');
  }
  if (e.target.closest('#next-round')) { if (online) { if (room.status === 'closed' || state.phase === 'finished') exitOnline(); else sendOnline({ type: 'ready' }); } else if (state.phase === 'finished') start(); else perform({ type: 'next' }); }
});
$('play').addEventListener('click', () => perform({ type: 'play', actor: 0, id: selected }));
$('draw').addEventListener('click', () => perform({ type: 'draw', actor: 0 }));
$('stand').addEventListener('click', () => perform({ type: 'stand', actor: 0 }));
$('start').addEventListener('click', start);
$('help').addEventListener('click', () => openDialog('rules'));
$('welcome-rules').addEventListener('click', () => openDialog('rules'));
$('restart').addEventListener('click', confirmRestart);
$('confirm-restart').addEventListener('click', async () => { if (online) { if (room?.status === 'closed') exitOnline(); else if (await sendOnline({ type: 'leave' })) exitOnline(); } else start(); });
$('pause').addEventListener('click', togglePause);
$('resume').addEventListener('click', togglePause);
$('pace').addEventListener('click', () => { fast = !fast; $('pace').textContent = `节奏：${fast ? '快速' : '标准'}`; $('pace').setAttribute('aria-pressed', fast); scheduleAI(); });
$('sound').addEventListener('click', async () => {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) { toast('此浏览器暂不支持音效。'); return; }
  try {
    audioContext ||= new Audio();
    sound = !sound;
    if (sound) await audioContext.resume(); else await audioContext.suspend();
    $('sound').textContent = `音效：${sound ? '开' : '关'}`; $('sound').setAttribute('aria-pressed', sound); $('sound').title = sound ? '关闭音效' : '开启音效';
    if (sound) soundEffect('draw');
  } catch { sound = false; $('sound').textContent = '音效：关'; $('sound').setAttribute('aria-pressed', false); toast('音效暂时不可用，牌局可以继续。'); }
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('close', scheduleAI));
$('welcome').addEventListener('cancel', e => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(aiTimer); animations.forEach(a => a.cancel()); if (audioContext) audioContext.suspend().catch(() => {}); }
  else { if (sound && audioContext) audioContext.resume().catch(() => {}); scheduleAI(); }
});
reduced.addEventListener('change', () => { if (reduced.matches) animations.forEach(a => a.cancel()); });
document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || anyDialog() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
  if (!started || state.actor !== 0 || paused || state.phase !== 'playing') return;
  if (e.key.toLowerCase() === 'd') { e.preventDefault(); perform({ type: 'draw', actor: 0 }); }
  if (e.key.toLowerCase() === 's') { e.preventDefault(); perform({ type: 'stand', actor: 0 }); }
});

$('catalog').innerHTML = Object.entries(CATALOG).map(([type, c]) => `<article class="${c.special ? 'special-catalog' : ''}"><h4>${c.name}${type === 'number' ? ' 1～11' : type === 'challenge' ? ' 22～30' : ''}</h4><p>${c.text}</p><small>${c.family} · ${c.stay ? '持续' : '瞬时'} · ${c.cost} 格${c.special ? ' · 场上最多一张' : ''}</small></article>`).join('');
if (matchMedia('(max-width: 920px)').matches) document.querySelector('.chronicle').open = false;


function confirmRestart() {
  $('restart-title').textContent = online ? '确认离座？' : '重新入席？';
  $('restart-description').textContent = online ? '离座会结束本场对局并释放座位。只想看看大厅，可使用上方「返回大厅」。' : '当前生命、手牌和牌局记录将清空。';
  $('confirm-restart').textContent = online ? '确认离座' : '重新开局';
  openDialog('restart-dialog');
}
function networkStatus(status, data, message) {
  const wasConnected = connected; connected = status === 'connected';
  const text = connected ? data.opponentOnline ? '双方在线' : '等待对手连接' : '连接中断，正在重连…';
  $('room-connection').textContent = `${data?.code || room?.code || online?.session.code || ''} 号桌 · ${text}`;
  if (!started) {
    $('joining-status').textContent = connected ? '牌局已连接，正在接收你的手牌…' : '暂时无法连接牌桌，正在自动重试。连接恢复后会直接进入对局。';
  }
  if (wasConnected !== connected && started) render();
  if (status === 'expired') { toast(message || '座位已释放'); exitOnline(); }
}
function receiveRoom(data) {
  const hadState = started, changed = !hadState || !room || data.revision > room.revision, old = state;
  room = data;
  $('room-bar').hidden = false;
  if (!data.you || !data.state) { exitOnline(); return; }
  if (changed) {
    const before = captureCards(); state = data.state;
    paused = false; started = true;
    render();
    if (!hadState) {
      document.querySelectorAll('dialog[open]').forEach(d => d.close());
      $('joining').hidden = true; $('game-layout').hidden = false;
      $('turn-title').focus({ preventScroll: true });
      $('announcement').textContent = '已进入双人牌局，你的底牌和王牌已发放。';
    }
    transitionCards(before);
    if (hadState && state.eventId !== old.eventId) {
      soundEffect(state.phase !== 'playing' ? 'result' : 'play');
      $('announcement').textContent = state.log.filter(e => e.id > old.eventId).map(e => e.text).join(' ');
    }
    if (state.phase !== 'playing' && !anyDialog()) $('next-round')?.focus({ preventScroll: true });
  }
}
async function sendOnline(action) {
  if (!online || networkBusy || !connected) return false;
  networkBusy = true; render();
  try { await online.act(action); return true; }
  catch (error) { toast(error.message || '连接暂时不可用，请稍后再试。'); return false; }
  finally { networkBusy = false; render(); }
}
function exitOnline() { online?.stop(); location.assign('./lobby/'); }
$('selection').addEventListener('click', e => { if (e.target.closest('#clear-selection')) { selected = null; render(); } });
$('multiplayer').addEventListener('click', () => location.assign('./lobby/'));
const saved = savedRoom();
if (multiplayerEntry) {
  $('start').disabled = true; $('pace').hidden = true;
  $('joining').hidden = false;
  if (saved) {
    $('joining-title').textContent = `正在进入 ${saved.code} 号桌`;
    online = new RoomClient(receiveRoom, networkStatus, saved); online.poll();
  } else $('joining-status').textContent = '正在返回大厅，请重新入座。';
} else {
  render(); $('game-layout').hidden = false; openDialog('welcome');
}
new ResizeObserver(([entry]) => document.documentElement.style.setProperty('--dock-height', `${entry.target.getBoundingClientRect().height}px`)).observe($('controls'));
