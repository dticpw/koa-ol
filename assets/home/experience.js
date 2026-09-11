(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const hero=document.querySelector('.hero');
  if(hero&&!reduced.matches)hero.classList.add('opening');
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
    },{threshold:.08});
    document.querySelectorAll('.section-heading,.about').forEach(el=>{el.classList.add('reveal-ready');observer.observe(el);});
  }
  reduced.addEventListener('change',()=>{if(reduced.matches)hero?.classList.remove('opening');});
})();
