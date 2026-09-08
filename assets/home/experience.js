(() => {
  const hero = document.querySelector('.hero');
  const projects = document.querySelector('.projects');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const cards = [...document.querySelectorAll('.project-card')];
  let pending = 0;
  const update = () => {
    pending = 0;
    const rect = projects.getBoundingClientRect();
    document.body.classList.toggle('collection-active', rect.top < innerHeight * .65);
    const p = Math.max(0, Math.min(1, scrollY / Math.max(1,document.documentElement.scrollHeight-innerHeight)));
    document.documentElement.style.setProperty('--journey',p);
    hero.style.setProperty('--scene-y',reduced.matches ? '0px' : `${Math.min(55,scrollY*.09)}px`);
  };
  const schedule = () => { if (!pending && !document.hidden) pending = requestAnimationFrame(update); };
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  document.addEventListener('visibilitychange',() => {
    if(document.hidden){cancelAnimationFrame(pending);pending=0;}else schedule();
  });
  hero.addEventListener('pointermove',e => {
    if(!fine.matches || reduced.matches)return;
    const r=hero.getBoundingClientRect();
    hero.style.setProperty('--drift-x',`${(e.clientX-r.left-r.width/2)*.025}px`);
    hero.style.setProperty('--drift-y',`${(e.clientY-r.top-r.height/2)*.025}px`);
  },{passive:true});
  hero.addEventListener('pointerleave',()=>{hero.style.setProperty('--drift-x','0px');hero.style.setProperty('--drift-y','0px');});
  for(const card of cards){
    card.addEventListener('pointermove',e=>{
      if(!fine.matches || reduced.matches)return;
      const r=card.getBoundingClientRect();
      card.style.setProperty('--px',`${e.clientX-r.left}px`);
      card.style.setProperty('--py',`${e.clientY-r.top}px`);
    },{passive:true});
    const pulse=()=>{if(!reduced.matches)card.classList.add('is-pulsing');};
    card.addEventListener('pointerenter',()=>{if(fine.matches)pulse();});
    card.addEventListener('focus',pulse);
    card.addEventListener('animationend',e=>{if(e.target===card)card.classList.remove('is-pulsing');});
    card.addEventListener('pointerleave',()=>card.classList.remove('is-pulsing'));
  }
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}
    },{threshold:.08});
    document.querySelectorAll('.section-heading,.about').forEach(el=>{el.classList.add('reveal-ready');observer.observe(el);});
  }
  const motionChange=()=>{if(reduced.matches){hero.classList.remove('opening');cards.forEach(c=>c.classList.remove('is-pulsing'));}schedule();};
  reduced.addEventListener('change',motionChange);
  // A short decorative reveal never blocks navigation or waits for WebGL.
  if(!reduced.matches)hero.classList.add('opening');
  hero.addEventListener('pointerdown',()=>hero.classList.remove('opening'),{once:true});
  schedule();
})();
