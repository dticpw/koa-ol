'use strict';
/* The sandbox has an opaque origin: never add allow-same-origin. */
async function renderHTML(entry,name,source,host,interactive=false){
 const epoch=state.epoch;const doc=new DOMParser().parseFromString(source,'text/html');const missing=new Set();const cache=new Map();
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
 for(const n of doc.querySelectorAll('[href]')){if(!n.getAttribute('href').startsWith('#'))n.removeAttribute('href');}
 if(epoch!==state.epoch)return;
 host.replaceChildren();const controls=create('div','reader-actions');const toggle=create('button','',interactive?'切回静态阅读':'启用隔离交互');toggle.onclick=()=>busy(toggle,()=>renderHTML(entry,name,source,host,!interactive));controls.append(toggle);host.append(controls,create('p','reader-meta',interactive?'隔离交互已启用：仅使用已入馆资源，网络请求与外部页面跳转关闭。':'静态阅读：脚本不执行；可切换隔离交互查看报告自身的图表与按钮。'));
 if(missing.size)host.append(create('p','reader-meta','部分配套资源未入馆或为外部资源，未加载：'+[...missing].slice(0,6).join('、')));
 const frame=create('iframe','file-frame');frame.title=name+(interactive?' · 隔离交互':' · 阅读');frame.setAttribute('sandbox',interactive?'allow-scripts':'');frame.referrerPolicy='no-referrer';const policy="default-src 'none'; script-src "+(interactive?"'unsafe-inline' blob:":"'none'")+"; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src blob:; connect-src 'none'; form-action 'none'; base-uri 'none'";
 const meta=doc.createElement('meta');meta.httpEquiv='Content-Security-Policy';meta.content=policy;doc.head.prepend(meta);frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;host.append(frame);
}
