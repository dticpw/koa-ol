(() => {
 const frame=document.getElementById('library-frame'),stage=document.getElementById('library-stage');
 if(!frame||!stage)return;
 let visible=false,ready=false,loaded=false;
 const active=()=>document.body.dataset.chapter==='library';
 const entrance=()=>{if(ready)frame.contentWindow.postMessage({type:'library-entrance',active:active()},location.origin);};
 document.addEventListener('chapterchange',entrance);
 const tell=()=>{if(ready)frame.contentWindow.postMessage({type:'library-visibility',visible:visible&&!document.hidden},location.origin);};
 const load=()=>{if(!loaded){frame.src=frame.dataset.src;loaded=true;}};
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
  if(e.data?.type==='library-ready'){ready=true;stage.classList.add('is-ready');entrance();tell();}
  if(e.data?.type==='library-unavailable'){ready=false;stage.classList.remove('is-ready');}
 });
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)load();tell();},{rootMargin:'100px'}).observe(stage);
 else{visible=true;load();}
 document.addEventListener('visibilitychange',tell);
})();
