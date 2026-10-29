// Original modal wood impacts. No recordings, game assets or third-party samples.
// Offline previews and live playback use this same signal path.
export function renderCue(ctx, output, kind, time, volume = .22) {
  const sources = [], nodes = [];
  const hit = (at, strength, pitch, length) => {
    const bus = ctx.createGain(); bus.gain.value = volume * strength; bus.connect(output); nodes.push(bus);
    const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .028), ctx.sampleRate);
    const data = noise.getChannelData(0); let seed = 7183;
    for (let i = 0; i < data.length; i++) { seed = (1664525 * seed + 1013904223) >>> 0; data[i] = (seed / 2147483648 - 1) * Math.exp(-i / (ctx.sampleRate * .004)); }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noise; filter.type = 'bandpass'; filter.frequency.value = 1650 * pitch; filter.Q.value = .7; gain.gain.value = .48;
    source.connect(filter).connect(gain).connect(bus); source.start(at); sources.push(source); nodes.push(filter, gain);
    for (const [frequency, amplitude, decay] of [[390,.46,1],[823,.24,.58],[1457,.11,.32],[2380,.035,.16]]) {
      const oscillator = ctx.createOscillator(), envelope = ctx.createGain(); oscillator.frequency.value = frequency * pitch;
      envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(amplitude, at + .0015);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + length * decay);
      oscillator.connect(envelope).connect(bus); oscillator.start(at); oscillator.stop(at + length * decay + .006);
      sources.push(oscillator); nodes.push(envelope);
    }
  };
  if (kind === 'select') hit(time, .32, 1.23, .055);
  else if (kind === 'capture') { hit(time, .85, 1.12, .09); hit(time + .052, .72, .74, .13); }
  else if (kind === 'check') { hit(time, .52, 1.36, .085); hit(time + .105, .56, 1.66, .09); }
  else hit(time, .78, .92, .115);
  let remaining = sources.length;
  const disconnect = () => { for (const node of [...sources, ...nodes]) { try { node.disconnect(); } catch {} } };
  for (const source of sources) source.onended = () => { if (--remaining === 0) disconnect(); };
  return () => { for (const source of sources) { try { source.stop(); } catch {} } disconnect(); };
}

export function createBoardAudio({ toggle, volume, preview, note }) {
  const key = 'xiangqi-board-sound-v1'; let enabled = true, level = .22, context = null, generation = 0, lastSelect = -Infinity;
  const voices = new Set();
  try { const saved = JSON.parse(localStorage.getItem(key)); if (saved) { enabled = saved.enabled !== false; if (Number.isFinite(saved.volume)) level = Math.max(0, Math.min(.6, saved.volume)); } } catch {}
  const update = () => { toggle.setAttribute('aria-pressed', String(enabled)); toggle.textContent = enabled ? '音效：开' : '音效：关'; volume.value = String(Math.round(level * 100)); volume.setAttribute('aria-valuetext', `${Math.round(level * 100)}%`); };
  const save = () => { try { localStorage.setItem(key, JSON.stringify({ enabled, volume: level })); } catch {} };
  const stop = () => { generation++; for (const cancel of voices) cancel(); voices.clear(); };
  const unlock = () => {
    if (!enabled || document.hidden) return;
    try { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) { note.textContent = '此浏览器暂不支持音效，走棋不受影响。'; return; }
      context ??= new Audio({ latencyHint: 'interactive' });
      if (context.state === 'suspended') void context.resume().catch(() => { note.textContent = '音效未能启用，可继续走棋。'; });
    } catch { note.textContent = '音效未能启用，可继续走棋。'; }
  };
  const play = (kind, delay = 0) => {
    if (!enabled || !level || document.hidden || context?.state !== 'running') return false;
    const now = context.currentTime;
    // Only repeated selection taps are coalesced. Committed move/capture/check
    // events are never suppressed by a preceding selection or one another.
    if (kind === 'select') { if (now - lastSelect < .025) return false; lastSelect = now; }
    if (voices.size >= 3) { const oldest = voices.values().next().value; oldest(); voices.delete(oldest); }
    try { const cancel = renderCue(context, context.destination, kind, now + Math.max(0,Math.min(.15,delay)), level); voices.add(cancel); setTimeout(() => voices.delete(cancel), 500); return true; } catch { return false; }
  };
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => { stop(); if (document.hidden && context?.state === 'running') void context.suspend().catch(() => {}); });
  toggle.addEventListener('click', () => { enabled = !enabled; stop(); update(); save(); if (enabled) unlock(); });
  volume.addEventListener('input', () => { level = Number(volume.value) / 100; stop(); update(); save(); });
  preview.addEventListener('click', async () => {
    stop(); unlock(); const ticket = generation;
    if (!enabled || !level) { note.textContent = '打开音效并调高音量后可试听。'; return; }
    if (!context) return;
    try { if (context?.state === 'suspended') await context.resume(); } catch { return; }
    if (ticket !== generation) return;
    note.textContent = '依次试听：选子、落子、吃子、将军。';
    for (const [i, kind] of ['select', 'move', 'capture', 'check'].entries()) setTimeout(() => { if (ticket === generation) play(kind); }, i * 550);
  });
  update(); return { play, stop };
}
