(() => {
  document.body.classList.add('page-enter');
  const revealTargets = document.querySelectorAll('.project-card, .utility a, .cards, table');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  revealTargets.forEach((target, index) => {
    target.classList.add('reveal');
    target.style.transitionDelay = `${Math.min(index * 55, 220)}ms`;
    observer.observe(target);
  });
  document.querySelectorAll('a[href^="/"]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      event.preventDefault();
      document.body.classList.add('page-leaving');
      setTimeout(() => { location.href = url.href; }, 180);
    });
  });
})();
