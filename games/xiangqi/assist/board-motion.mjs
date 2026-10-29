// Presentation has no authority over the position. A new command cancels this
// finite visual transaction; the DOM underneath already contains the latest state.
export function createBoardMotion(board, squares, audio) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div'); layer.className = 'board-motion'; layer.setAttribute('aria-hidden', 'true'); board.append(layer);
  let running = null;
  const cancel = (settle = false) => {
    if (!running) return;
    const completed = running; running = null;
    cancelAnimationFrame(completed.raf); for (const animation of completed.animations) animation.cancel();
    for (const piece of completed.hidden) piece.style.removeProperty('visibility');
    layer.replaceChildren(); board.removeAttribute('data-motion');
    // Resize / reduced motion / a new move snaps the committed position into
    // place now. Emit its outstanding feedback once, never replay on resume.
    if (settle && !document.hidden) {
      if (!completed.sounded) audio.play(completed.capture ? 'capture' : 'move');
      if (completed.check) audio.play('check', completed.sounded ? 0 : completed.capture ? .13 : .08);
    }
  };
  const prepare = (from, to) => {
    cancel();
    return { from, to, mover: squares[from].querySelector('.piece')?.cloneNode(true), victim: squares[to].querySelector('.piece')?.cloneNode(true) };
  };
  const play = (snapshot, check) => {
    if (!snapshot?.mover) return;
    const { from, to, mover, victim } = snapshot;
    if (reduced.matches || document.hidden || !Element.prototype.animate) {
      if (!document.hidden) { audio.play(victim ? 'capture' : 'move'); if (check) audio.play('check', victim ? .13 : .08); } return;
    }
    const rect = board.getBoundingClientRect(), dx = (to % 9 - from % 9) * 60 / 564 * rect.width, dy = (Math.floor(to / 9) - Math.floor(from / 9)) * 60 / 650 * rect.height;
    const lift = rect.width / 564 * 4, travel = Math.min(210, 145 + Math.hypot(dx, dy) * .12), impact = travel + (victim ? 52 : 0), duration = impact + 75;
    const actor = (piece, index) => { const n = document.createElement('div'); n.className = 'motion-piece'; n.style.left = squares[index].style.left; n.style.top = squares[index].style.top; n.append(piece); layer.append(n); return n; };
    const target = squares[to].querySelector('.piece'); if (target) target.style.visibility = 'hidden';
    const tx = (x, y, scale = 1) => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
    const moving = actor(mover, from), animations = [], hidden = target ? [target] : [];
    if (victim) {
      const taken = actor(victim, to); taken.classList.add('taken-piece');
      animations.push(taken.animate([{ opacity: 1, transform: tx(0, 0), offset: 0 }, { opacity: 1, transform: tx(0, 0), offset: travel / duration }, { opacity: 0, transform: tx(dx ? Math.sign(dx) * 5 : 3, 4, .87), offset: Math.min(1, (travel + 85) / duration) }, { opacity: 0, transform: tx(3, 4, .87) }], { duration, fill: 'both', easing: 'linear' }));
    }
    const movement = moving.animate([
      { transform: tx(0, -lift), offset: 0, easing: 'cubic-bezier(.22,.65,.32,1)' },
      { transform: tx(dx, dy - lift), offset: travel / duration },
      ...(victim ? [{ transform: tx(dx, dy - lift), offset: (impact - 28) / duration }] : []),
      { transform: tx(dx, dy + .5, .994), offset: (impact + 12) / duration, easing: 'ease-out' },
      { transform: tx(dx, dy), offset: 1 }
    ], { duration, fill: 'both' });
    animations.push(movement); running = { animations, hidden, raf: 0, capture: Boolean(victim), check, sounded: false }; const transaction = running;
    board.dataset.motion = victim ? 'capture-travel' : 'travel'; let sounded = false, contacted = false;
    const tick = () => {
      if (running !== transaction) return;
      const elapsed = Number(movement.currentTime || 0);
      if (!contacted && elapsed >= travel) { contacted = true; board.dataset.motion = victim ? 'capture-contact' : 'landing'; }
      if (!sounded && elapsed >= (victim ? travel : impact)) { sounded = true; transaction.sounded = true; audio.play(victim ? 'capture' : 'move'); }
      // WAAPI rounds fractional millisecond durations; currentTime can finish a
      // few ulps below the JS input. The animation's finished state is definitive.
      if (movement.playState === 'finished' || elapsed >= duration) {
        // Finish without calling cancel(): the short impact can decay naturally.
        for (const p of hidden) p.style.removeProperty('visibility'); layer.replaceChildren(); running = null; board.removeAttribute('data-motion');
        if (check) audio.play('check'); return;
      }
      transaction.raf = requestAnimationFrame(tick);
    };
    transaction.raf = requestAnimationFrame(tick);
  };
  new ResizeObserver(() => cancel(true)).observe(board);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  reduced.addEventListener('change', () => cancel(true));
  return { prepare, play, cancel };
}
