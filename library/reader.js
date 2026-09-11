'use strict';
/* The sandbox has an opaque origin: never add allow-same-origin. */
// Only size messages from a currently mounted, dedicated frame are accepted.
window.addEventListener('message',event=>{
 if(event.data?.type==='muq-front-anchor'&&Number.isFinite(event.data.offset)){for(const frame of document.querySelectorAll('iframe.entry-front-frame'))if(event.source===frame.contentWindow){window.scrollTo({top:window.scrollY+frame.getBoundingClientRect().top+event.data.offset-24,behavior:'auto'});break;}return;}
 if(event.data?.type!=='muq-front-height'||!Number.isFinite(event.data.height))return;
 for(const frame of document.querySelectorAll('iframe.entry-front-frame'))if(event.source===frame.contentWindow){
  frame.style.height=Math.min(200000,Math.max(200,Math.ceil(event.data.height)))+'px';break;
 }
});
async function renderHTML(entry,name,source,host,interactive=false,frontpage=false){
 const epoch=state.epoch;const doc=new DOMParser().parseFromString(source,'text/html');const missing=new Set();const cache=new Map();const references=[];
 const resolve=(value,base=name)=>{try{const root=new URL(base,'https://bundle.invalid/');const u=new URL(value,root);if(u.origin!=='https://bundle.invalid'||u.search)return null;return decodeURIComponent(u.pathname.slice(1));}catch{return null;}};
 const mime=n=>({css:'text/css',js:'text/javascript',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',woff2:'font/woff2'})[n.split('.').pop().toLowerCase()]||'application/octet-stream';
 async function local(value,base=name){if(/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value))return value;const path=resolve(value,base);const f=entry.files.find(f=>f.name===path);if(!f){missing.add(value);return '';}if(!cache.has(path))cache.set(path,asset(f).then(raw=>blobURL(new Blob([raw],{type:mime(path)}))));return cache.get(path);}
 async function css(text,base){text=text.replace(/@import\s+[^;]+;/gi,'');const matches=[...text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)];for(const m of matches){const u=await local(m[1],base);text=text.replace(m[0],u?'url("'+u+'")':'none');}return text;}
 doc.querySelectorAll('iframe,object,embed,base,meta,form').forEach(n=>n.remove());
 for(const n of doc.querySelectorAll('*'))for(const a of [...n.attributes])if((a.name.startsWith('on')&&!interactive)||['srcset','action','formaction','ping','data','autofocus'].includes(a.name))n.removeAttribute(a.name);
 for(const n of doc.querySelectorAll('link')){if(n.rel==='stylesheet'){const path=resolve(n.getAttribute('href'));const f=entry.files.find(f=>f.name===path);if(f){const style=doc.createElement('style');style.textContent=await css(new TextDecoder().decode(await asset(f)),path);n.replaceWith(style);continue;}missing.add(n.getAttribute('href'));}n.remove();}
 for(const n of doc.querySelectorAll('style'))n.textContent=await css(n.textContent,name);
 for(const n of doc.querySelectorAll('[style]'))n.setAttribute('style',await css(n.getAttribute('style'),name));
 for(const n of doc.querySelectorAll('script')){if(!interactive){n.remove();continue;}if(n.src){const path=resolve(n.getAttribute('src'));const f=entry.files.find(f=>f.name===path);if(!f){missing.add(n.getAttribute('src'));n.remove();continue;}n.removeAttribute('src');n.textContent=new TextDecoder().decode(await asset(f));}}
 for(const n of doc.querySelectorAll('[src],[poster]')){for(const a of ['src','poster'])if(n.hasAttribute(a)){const u=await local(n.getAttribute(a));if(u)n.setAttribute(a,u);else n.removeAttribute(a);}}
 for(const n of doc.querySelectorAll('[href]')){const value=n.getAttribute('href');if(value.startsWith('#'))continue;const source=safeSource(value);const path=resolve(value);if(source)references.push({title:n.textContent.trim()||source,url:source});else if(entry.files.some(f=>f.name===path))references.push({title:n.textContent.trim()||path,url:href(entry.id,path)});n.removeAttribute('href');}
 if(epoch!==state.epoch)return;
 host.replaceChildren();const controls=create('div','reader-actions');const toggle=create('button','',interactive?'切回静态阅读':'启用隔离交互');toggle.onclick=()=>busy(toggle,()=>renderHTML(entry,name,source,host,!interactive,frontpage));controls.append(toggle);host.append(controls,create('p','reader-meta',frontpage?(interactive?'现在可以筛选场景与复制提示词。':'正文已展开；需要筛选或复制提示词时，可启用交互。'):interactive?'隔离交互已启用：无法读取馆主页面；fetch、表单与外部子资源受限。需要联网的作品请单独托管。':'静态阅读：脚本不执行；可切换隔离交互查看报告自身的图表与按钮。'));
 if(references.length){const d=create(frontpage?'nav':'details',frontpage?'front-links':'more-resources');if(frontpage)d.setAttribute('aria-label','项目入口');else d.append(create('summary','',`文内链接 · ${references.length}`));for(const r of references)d.append(link(r.title+' ↗',r.url));host.append(d);}
 if(missing.size)host.append(create('p','reader-meta','部分配套资源未入馆或为外部资源，未加载：'+[...missing].slice(0,6).join('、')));
 const frame=create('iframe',frontpage?'file-frame entry-front-frame':'file-frame');frame.title=name+(interactive?' · 隔离交互':' · 阅读');frame.setAttribute('sandbox',(interactive||frontpage)?'allow-scripts':'');frame.referrerPolicy='no-referrer';const nonce=crypto.randomUUID();const policy="default-src 'none'; script-src "+(interactive?"'unsafe-inline' blob:":frontpage?"'nonce-"+nonce+"'":"'none'")+"; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src blob:; connect-src 'none'; form-action 'none'; base-uri 'none'";
 if(frontpage){
  // Original scripts remain disabled in static mode. This nonce authorizes only
  // our size reporter, without same-origin access or network access.
  const reporter=doc.createElement('script');reporter.setAttribute('nonce',nonce);
  reporter.textContent="(()=>{const report=()=>parent.postMessage({type:'muq-front-height',height:document.body.getBoundingClientRect().height+32},'*');new ResizeObserver(report).observe(document.body);addEventListener('load',report);report();document.addEventListener('click',e=>{const a=e.target.closest('a[href^=\"#\"]');if(!a)return;const target=document.getElementById(a.getAttribute('href').slice(1));if(!target)return;e.preventDefault();document.querySelectorAll('nav a[aria-current]').forEach(n=>n.removeAttribute('aria-current'));a.setAttribute('aria-current','location');parent.postMessage({type:'muq-front-anchor',offset:target.getBoundingClientRect().top+scrollY},'*');});})();";
  doc.body.append(reporter);
 }
 const meta=doc.createElement('meta');meta.httpEquiv='Content-Security-Policy';meta.content=policy;doc.head.prepend(meta);frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;host.append(frame);
}
