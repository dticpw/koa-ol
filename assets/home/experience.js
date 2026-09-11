(() => {
  const chapters=[...document.querySelectorAll('[data-chapter]')];
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const button=document.querySelector('.motion-toggle');
  const visible=new Map(chapters.map(el=>[el,false]));
  let manualPause=false;
  const update=()=>{
    document.body.classList.toggle('motion-ready',!motion.matches);
    document.body.classList.toggle('page-hidden',document.hidden);
    document.body.classList.toggle('animations-paused',manualPause);
    chapters.forEach(el=>el.classList.toggle('is-playing',visible.get(el)&&el.classList.contains('is-entered')&&!document.hidden&&!motion.matches&&!manualPause));
  };
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        visible.set(entry.target,entry.isIntersecting);
        if(entry.isIntersecting&&entry.intersectionRatio>=.14)entry.target.classList.add('is-entered');
        else if(!entry.isIntersecting)entry.target.classList.remove('is-entered');
      }
      update();
    },{threshold:[0,.14,.35]});
    chapters.forEach(el=>observer.observe(el));
    const currentObserver=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){
        document.body.dataset.chapter=entry.target.dataset.chapter;
        document.querySelectorAll('.site-header nav a').forEach(a=>{if(a.hash==='#'+entry.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
      }
    },{rootMargin:'-35% 0px -45% 0px'});
    chapters.forEach(el=>currentObserver.observe(el));
  } else chapters.forEach(el=>{visible.set(el,true);el.classList.add('is-entered');});
  button?.addEventListener('click',()=>{
    manualPause=!manualPause;
    button.setAttribute('aria-pressed',String(manualPause));
    button.setAttribute('aria-label',manualPause?'继续持续动效':'暂停持续动效');
    button.querySelector('.motion-label').textContent=manualPause?'继续动效':'暂停动效';
    button.firstElementChild.textContent=manualPause?'▶':'Ⅱ';
    update();
  });
  motion.addEventListener('change',update);
  document.addEventListener('visibilitychange',update);
  window.addEventListener('pageshow',update);
  update();
})();
