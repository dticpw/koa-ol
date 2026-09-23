'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  let game = null;
  let busy = false;
  let pending = null;
  let available = true;
  const lab = document.body.dataset.fiction === 'lab';
  const API = document.body.dataset.api || (lab ? '/api/fiction-lab' : '/api/fiction');
  const pendingKey = 'fiction.pending.v1:' + API;
  let pendingSession = null;
  try { const saved = JSON.parse(localStorage.getItem(pendingKey));
    if (saved?.body?.op === 'turn' && /^[a-zA-Z0-9_-]{16,80}$/.test(saved.body.requestId || '') && Number.isSafeInteger(saved.body.expectedRevision)) { pending = saved.body; pendingSession = saved.sessionId; }
  } catch { /* Private browsing/storage restrictions: keep in-memory recovery. */ }
  function savePending() {
    try { if (pending?.op === 'turn') localStorage.setItem(pendingKey, JSON.stringify({ body: pending, sessionId: pendingSession })); else localStorage.removeItem(pendingKey); } catch {}
  }
  function clearPending() { pending = null; pendingSession = null; savePending(); }
  const uncommittedErrors = new Set([
    'budget_exhausted', 'model_unavailable', 'classification_failed', 'adjudication_failed', 'rate_limited',
    'invalid_request', 'invalid_choice', 'invalid_origin', 'start_limited', 'game_finished',
  ]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function renderHosts(hosts) {
    if(!Array.isArray(hosts))return;
    let saved;try{saved=localStorage.getItem('fiction.host-model');}catch{}
    const selected=hosts.find(h=>h.id===saved&&h.available)?.id||'gpt-5.6-sol';
    for(const [id,parent]of [['host-choice',$('start').parentElement],['restart-host-choice',$('reset-dialog').querySelector('.dialog-actions')]]){
      let select=$(id);
      if(!select){const label=element('label',id==='host-choice'?'本次冒险的主持':'新冒险的主持','host-picker');label.htmlFor=id;select=element('select');select.id=id;label.append(select);if(id==='host-choice')parent.prepend(label);else parent.before(label);
        select.addEventListener('change',()=>{if(!game)$('model-label').textContent=select.selectedOptions[0]?.textContent||'GPT-5.6 Sol';document.querySelectorAll('.host-picker select').forEach(n=>n.value=select.value);try{localStorage.setItem('fiction.host-model',select.value);}catch{}});
      }
      select.replaceChildren(...hosts.map(h=>{const o=element('option',h.label+(h.available?'':' · 暂未开放'));o.value=h.id;o.disabled=!h.available;return o;}));select.value=selected;
    }
  }
  function setBusy(value, message = '主持正在回应…') {
    busy = value;
    if (lab) window.dispatchEvent(new CustomEvent('fiction-busy', { detail: value }));
    $('thinking').hidden = !value;
    $('thinking').textContent = message;
    $('adventure').setAttribute('aria-busy', String(value));
    $('start').disabled = value || !available;
    $('restart').disabled = value;
    document.querySelectorAll('.host-picker select').forEach(n=>n.disabled=value);
    $('action').disabled = value;
    $('send').disabled = value || !game || game.status !== 'playing';
    $('retry').disabled = value;
    $('refresh').disabled = value;
    document.querySelectorAll('.choice').forEach((button) => { button.disabled = value; });
  }
  function notice(message, retry) {
    // Announce once, next to the current interaction rather than above the cover.
    const target = game ? $('action-notice') : $('notice');
    [$('notice'), $('action-notice')].forEach((node) => {
      node.replaceChildren();
      node.hidden = true;
    });
    if (!message) return;
    target.hidden = false;
    target.append(element('span', message));
    if (retry) {
      const button = element('button', '重新连接');
      button.type = 'button';
      button.addEventListener('click', retry);
      target.append(button);
    }
  }
  function showError(message) {
    if (!game || game.status === 'ended') { notice(message, pending ? retryPending : restore); return; }
    $('error-text').textContent = message;
    $('error').hidden = false;
    $('retry').hidden = !pending;
  }
  function clearError() { $('error').hidden = true; }
  async function request(body, query = '') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), document.body.dataset.api ? 130000 : 100000);
    try {
      const response = await fetch(API + query, {
        method: body ? 'POST' : 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error('暂时无法读取主持的回复，请稍后重试。'); }
      if (!response.ok) {
        const error = new Error(data.error || `连接暂时未完成（${response.status}），请重试。`);
        error.status = response.status;
        error.code = data.code;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('这次等待有些久。你的行动仍保留着，重试前会先检查存档。');
      if (error instanceof TypeError) throw new Error('连接中断了。你的行动仍保留着，请检查网络后重试。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function renderLog(log) {
    const previous = $('story').querySelector('details');
    const wasOpen = Boolean(previous && previous.open);
    $('story').replaceChildren();
    const entries = Array.isArray(log) ? log : [];
    const oldCount = Math.max(0, entries.length - 9);
    let archive;
    if (oldCount > 0) {
      const details = element('details');
      details.open = wasOpen;
      details.append(element('summary', `翻阅之前的记录 · ${oldCount} 段`));
      archive = element('div', undefined, 'archive-content');
      details.append(archive);
      $('story').append(details);
    }
    entries.forEach((entry, index) => {
      const role = ['narrator', 'player', 'system'].includes(entry.role) ? entry.role : 'narrator';
      const text = role === 'player' ? `你：${entry.text}` : entry.text;
      const paragraph = element('p', text, `story-entry ${role}`);
      if (index < oldCount) archive.append(paragraph);
      else $('story').append(paragraph);
    });
  }
  function renderNotes(id, items, titleKey, textKey, empty) {
    const list = $(id);
    list.replaceChildren();
    if (!items.length) { list.append(element('li', empty, 'empty-note')); return; }
    items.forEach((item) => {
      const li = element('li');
      li.append(element('h3', item[titleKey]), element('p', item[textKey]));
      list.append(li);
    });
  }
  function render(view, scroll = false) {
    game = view;
    if (lab) window.dispatchEvent(new CustomEvent('fiction-view', { detail: { sessionId: game?.sessionId || null, game } }));
    $('welcome').hidden = Boolean(game);
    $('adventure').hidden = !game;
    $('start').textContent = document.body.dataset.startLabel || (lab ? '来到门前 ↗' : '提灯入墓 ↗');
    if (!game) return;
    $('location').textContent = game.location.name;
    $('location-description').textContent = game.location.description;
    $('turn-count').textContent = lab ? `第 ${game.turn} 段 · 自由探索` : `第 ${game.turn} 轮 · 余 ${game.remainingTurns} 轮`;
    $('model-label').textContent = game.modelLabel || game.model || 'GPT-5.6 Sol';
    renderLog(game.log);
    $('choices').replaceChildren();
    (game.choices || []).forEach((choice, index) => {
      const button = element('button', undefined, 'choice');
      button.type = 'button';
      const copy = element('span', choice.label, 'choice-copy');
      if (choice.hint) copy.append(element('span', choice.hint, 'choice-hint'));
      button.append(element('span', String(index + 1).padStart(2, '0'), 'choice-index'), copy);
      button.addEventListener('click', () => turn({ choiceId: choice.id }));
      button.disabled = busy;
      $('choices').append(button);
    });
    $('map').replaceChildren();
    (game.map || []).forEach((room) => {
      const li = element('li', room.name, room.current ? 'current' : room.visited ? 'visited' : 'unknown');
      if (room.current) { li.append(element('span', '你在这里')); li.setAttribute('aria-current', 'location'); }
      else if (!room.visited) li.append(element('span', '尚未探索'));
      $('map').append(li);
    });
    renderNotes('inventory', game.inventory || [], 'name', 'description', '背包里暂时没有物品。');
    renderNotes('clues', game.clues || [], 'title', 'text', '还没有记录。仔细观察，线索会留在这里。');
    $('inventory-count').textContent = String((game.inventory || []).length);
    $('clue-count').textContent = String((game.clues || []).length);
    $('resolve').textContent = String(game.stats?.resolve ?? '—');
    $('treasure').textContent = String(game.stats?.treasure ?? '—');
    const ended = game.status === 'ended';
    $('ending').hidden = !ended;
    $('action-area').hidden = ended;
    if (ended) {
      $('ending-title').textContent = game.ending?.title || '冒险暂告一段落';
      $('ending-text').textContent = game.ending?.text || '你合上了这本探险手记。';
    }
    if (scroll) {
      requestAnimationFrame(() => {
        const lastNarrator = [...$('story').querySelectorAll(':scope > .narrator')].pop();
        const target = ended ? $('ending') : lastNarrator || $('action-area');
        target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
        $('story').focus({ preventScroll: true });
      });
    }
  }
  function applyResult(data, scroll) {
    clearError();
    render(data.game, scroll && !data.clarification);
    if (data.clarification) {
      notice(data.clarification);
      requestAnimationFrame(() => {
        $('action-notice').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' });
        $('action').focus({ preventScroll: true });
      });
    } else {
      if (pending?.action || pending?.op === 'start') { $('action').value = ''; $('char-count').textContent = '0'; }
      notice(data.degraded ? (data.message || '这一轮 AI 连接暂时中断，已按剧本规则继续并保存结果。你可以继续冒险。') : '');
    }
    clearPending();
  }
  async function restore() {
    if (busy) return;
    setBusy(true, '正在读取存档…');
    clearError();
    try {
      const data = await request();
      available = data.available !== false;
      renderHosts(data.hosts);
      const previousSession = pendingSession || game?.sessionId;
      render(data.game);
      notice(available ? '' : '主持暂时未开放，请稍后回来。');
      // A pending turn may have succeeded while the connection was interrupted.
      if (pending && data.game && (data.game.revision > pending.expectedRevision || data.game.sessionId !== previousSession)) {
        if (pending.action) { $('action').value = ''; $('char-count').textContent = '0'; }
        clearPending();
      } else if (pending) {
        if (pending.action) { $('action').value = pending.action; $('char-count').textContent = String(pending.action.length); }
        showError('存档尚未确认上一次行动。请重试这次行动，系统会避免重复推进。');
      }
    } catch (error) {
      available = Boolean(game);
      showError(error.message);
      $('start').textContent = '暂时无法读取存档';
    } finally { setBusy(false); }
  }
  async function postPending() {
    if (!pending || busy) return;
    setBusy(true);
    clearError();
    notice('');
    try { applyResult(await request(pending), true); }
    catch (error) {
      if (error.code === 'session_expired') {
        clearPending();
        available = true;
        render(null);
        notice(error.message);
        return;
      }
      if (uncommittedErrors.has(error.code) || error.status === 400 || error.status === 422) clearPending();
      showError(error.message);
      // A conflict can mean that a reply was already committed. Keep the same
      // request ID; an explicit retry checks GET before replaying the request.
    } finally { setBusy(false); if (lab) window.dispatchEvent(new Event('fiction-trace-refresh')); }
  }
  async function retryPending() {
    if (busy) return;
    if (!pending) return restore();
    setBusy(true, '正在核对上次行动…');
    try {
      const data = await request(undefined, pending.op === 'turn' ? '?receipt=' + encodeURIComponent(pending.requestId) : '');
      if (pending.op === 'turn' && data.requestStatus === 'processing') {
        render(data.game);
        showError('主持仍在处理上一轮，行动已保留。稍后重新连接即可，不必再次描述。');
        return;
      }
      if (pending.op === 'turn' && data.game && (data.requestStatus === 'committed' || data.game.revision > pending.expectedRevision || data.game.sessionId !== (pendingSession || game?.sessionId))) {
        applyResult(data, true);
        notice('已恢复服务端保存的最新进度。');
        return;
      }
      if (pending.op === 'start' && data.game && (!game || data.game.sessionId !== game.sessionId)) {
        applyResult(data, true);
        return;
      }
      if (pending.op === 'turn' && !data.game) {
        clearPending();
        render(null);
        notice('当前存档已失效。可以重新开始；原行动仍保留在输入框中。');
        return;
      }
    } catch (error) {
      if (error.code === 'session_expired') { clearPending(); render(null); available = true; }
      showError(error.message); return;
    }
    finally { setBusy(false); }
    await postPending();
  }
  function turn(input) {
    if (busy || !game || game.status !== 'playing') return;
    // Once the player edits or chooses another action, reconcile any uncertain
    // previous attempt first. This prevents accidentally advancing two turns.
    if (pending) {
      showError('上一次行动的结果尚未确认，请先重试或重新读取存档，再提交新的行动。');
      return;
    }
    pending = { op: 'turn', requestId: crypto.randomUUID(), expectedRevision: game.revision, ...input };
    pendingSession = game.sessionId; savePending();
    postPending();
  }
  async function start(reset = false) {
    if (busy) return;
    if (pending?.op === 'turn') { await retryPending(); return; }
    if (game && !reset) return;
    pending = { op: 'start', hostModel:$(reset?'restart-host-choice':'host-choice')?.value||'gpt-5.6-sol', ...(reset ? { reset: true } : {}) };
    savePending();
    await postPending();
  }
  $('start').addEventListener('click', () => start());
  $('restart').addEventListener('click', () => $('reset-dialog').showModal());
  $('reset-dialog').addEventListener('close', () => { if ($('reset-dialog').returnValue === 'confirm') start(true); });
  $('retry').addEventListener('click', retryPending);
  $('refresh').addEventListener('click', restore);
  $('action').addEventListener('input', () => { $('char-count').textContent = String($('action').value.length); });
  $('action-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const action = $('action').value.trim();
    if (!action) { $('action').focus(); return; }
    turn({ action });
  });
  $('action').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); $('action-form').requestSubmit(); }
  });
  const tabs = [...document.querySelectorAll('[role=tab]')];
  function selectTab(tab) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      $(`panel-${item.dataset.panel}`).hidden = !selected;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') next = tabs[(index + tabs.length - 1) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (next) { event.preventDefault(); selectTab(next); next.focus(); }
    });
  });
  restore().then(() => { if (pending?.op === 'turn' && game) retryPending(); });
})();
