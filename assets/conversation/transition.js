(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.documentElement.dataset.nativeTransitions = String('onpageswap' in window);
  // Don't force focus, hijack clicks, or delay requests; native links retain modifier-key and back behavior.
  window.addEventListener('pagereveal', event => {
    if (reduced.matches) event.viewTransition?.skipTransition();
  });
  window.addEventListener('pageswap', event => {
    if (reduced.matches) event.viewTransition?.skipTransition();
  });
  window.addEventListener('pageshow', () => {
    document.body.classList.remove('page-leaving');
  });
})();
