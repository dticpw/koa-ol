// Shared by both lobbies and the Ace table. Only an explicit button sends activity.
export function timeoutNotice(root, onStay) {
  root.innerHTML = '<div><p class="timeout-message" role="status"></p><span class="timeout-clock" role="timer" aria-live="off"></span></div><button type="button" class="timeout-stay">我还在，继续等待</button>';
  const message = root.querySelector('.timeout-message'), clock = root.querySelector('.timeout-clock'), button = root.querySelector('button');
  let table = null, offset = 0, busy = false;
  function tick() {
    const me = table?.seats.find(p => p?.you), timing = table?.timing;
    const now = Date.now() - offset;
    const idle = me?.idleDeadline && me.idleDeadline - now <= timing?.idleWarning;
    const turn = me && timing?.turnPlayer === me.id && timing.turnDeadline - now <= timing.turnWarning;
    root.hidden = !idle && !turn;
    if (root.hidden) return;
    const text = idle ? '长时间未操作，即将自动离座。' : table.game === 'texas' ? '行动即将超时，请及时操作；超时将自动弃牌。' : '行动即将超时，请抽牌、用牌或停牌；超时将自动停牌。';
    if (message.textContent !== text) message.textContent = text;
    const seconds = Math.max(0, Math.ceil(((idle ? me.idleDeadline : timing.turnDeadline) - now) / 1000));
    clock.textContent = seconds ? `剩余 ${seconds} 秒` : '等待服务器处理…';
    button.hidden = !idle; button.disabled = busy || seconds === 0;
  }
  button.addEventListener('click', async () => {
    if (busy || !table) return;
    busy = true; tick();
    try { await onStay(table.id); } finally { busy = false; tick(); }
  });
  const timer = setInterval(tick, 500);
  return {
    update(data, serverNow) { table = data; if (Number.isFinite(serverNow)) offset = Date.now() - serverNow; tick(); },
    stop() { clearInterval(timer); },
  };
}
