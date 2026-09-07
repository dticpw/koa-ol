(() => {
  const frame = document.getElementById('shrine-frame');
  const stage = document.getElementById('scene-stage');
  const hint = document.getElementById('scene-hint');
  document.getElementById('year').textContent = new Date().getFullYear();
  let inView = true;
  let ready = false;
  const tellVisibility = () => {
    if (ready) frame.contentWindow.postMessage({type:'shrine-visibility',visible:inView && !document.hidden},location.origin);
  };
  // Keep the poster until the child has rendered, including on WebGL failure.
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'shrine-ready') {
      ready = true;
      stage.classList.add('is-ready');
      hint.textContent = '拖动旋转 · 打开完整场景可缩放';
      tellVisibility();
    }
    if (event.data?.type === 'shrine-unavailable') {
      ready = false;
      stage.classList.remove('is-ready');
      hint.textContent = '博丽神社 · 微缩庭院';
    }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      tellVisibility();
    },{rootMargin:'100px'}).observe(stage);
  }
  document.addEventListener('visibilitychange',tellVisibility);
  frame.src = frame.dataset.src;
})();
