'use strict';
const $=s=>document.querySelector(s);
const create=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const state={public:[],entries:[],unlocked:false,kind:'all',tag:'',expanded:false,payload:null,selected:null,epoch:0};
const labels={summary:'这一章的概述',work:'做过的事',problems:'问题与现状',decisions:'处理与决策',outputs:'产出与证据',next:'下一页，从这里继续'};
const statuses={active:'进行中',done:'已完成',archived:'已归档'};
let idleTimer;
let rememberedUntil=0;
const params=new URLSearchParams(location.search);
const entryId=params.get('id');
const assetURLs=new Set();
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('muq-reading-v2'):null;
const tabId=crypto.randomUUID();
const href=(id,file)=>'./entry.html?id='+encodeURIComponent(id)+(file?'&file='+encodeURIComponent(file):'');
function blobURL(blob){const url=URL.createObjectURL(blob);assetURLs.add(url);return url;}
function clearAssets(){for(const url of assetURLs)URL.revokeObjectURL(url);assetURLs.clear();}
function entryTarget(url){try{const u=new URL(url,location.href);if(![location.hostname,'koa-ol.com','www.koa-ol.com','127.0.0.1','localhost'].includes(u.hostname)||!u.pathname.endsWith('/library/entry.html'))return null;return u.searchParams.get('id');}catch{return null;}}
function link(text,url){const id=entryTarget(url),target=state.entries.find(e=>e.id===id);if(!state.unlocked&&id&&(!target||target.locked)){const n=create('span','related-link locked-link','🔒 '+(target?.title||'私密条目')+' · 馆主解锁后可查看');n.setAttribute('aria-disabled','true');return n;}const a=create('a','related-link',text);const u=id?new URL(url,location.href):null;a.href=u?'./entry.html'+u.search+u.hash:url;a.target='_blank';a.rel='noopener';return a;}
function tagNodes(tags){const row=create('div','entry-tags');for(const tag of tags||[])row.append(create('span','tag','#'+tag));return row;}
function renderTags(){const counts=new Map();for(const e of state.entries.filter(e=>state.kind==='all'||e.kind===state.kind))for(const tag of e.tags||[])counts.set(tag,(counts.get(tag)||0)+1);const host=$('#tags');host.replaceChildren();const all=create('button','tag','全部标签');all.setAttribute('aria-pressed',String(!state.tag));all.onclick=()=>{state.tag='';render();};host.append(all);const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));for(const [tag,count] of state.expanded?sorted:sorted.slice(0,12)){const b=create('button','tag','#'+tag+' '+count);b.setAttribute('aria-pressed',String(state.tag===tag));b.onclick=()=>{state.tag=state.tag===tag?'':tag;render();};host.append(b);}if(sorted.length>12){const b=create('button','tag',state.expanded?'收起标签':'展开全部 '+sorted.length);b.onclick=()=>{state.expanded=!state.expanded;render();};host.append(b);}}
const isLocal=location.hostname==='127.0.0.1';
const message=text=>$('#message').textContent=text;
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function safeCover(value){return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)||/^covers\/[a-z0-9_-]+\.png$/.test(value)?value:'./favicon.svg';}
async function json(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('馆藏读取失败，请稍后重试。');return response.json();}
function promptCount(e){return (Array.isArray(e.prompt_records)?e.prompt_records.length:e.prompt_count||0)+(e.source_records||[]).reduce((n,s)=>n+s.prompt_records.length,0);}
function setCounts(){const journals=state.entries.filter(e=>e.kind==='journal').length;$('#count').textContent=String(state.entries.length).padStart(2,'0');$('#count-description').textContent=`${journals} 篇日记 / ${state.entries.length-journals} 个项目`;}
function render(){
 renderTags();const host=$('#entries');host.replaceChildren();const query=$('#search').value.trim().toLocaleLowerCase();
 const result=state.entries.filter(e=>{
  if(state.kind!=='all'&&e.kind!==state.kind)return false;
  if(state.tag&&!(e.tags||[]).includes(state.tag))return false;
  if($('#status-filter').value!=='all'&&e.status!==$('#status-filter').value)return false;
  const text=(state.unlocked||e.public_content)?[e.title,...Object.keys(labels).map(k=>e[k]),e.prompts,JSON.stringify(e.source_records||[]),e.current_state,JSON.stringify(e.sections||[]),JSON.stringify(e.resources||[]),JSON.stringify(e.search_index||[]),JSON.stringify(e.topic||{})].join('\n'):[e.title,e.summary].join('\n');
  return (text+' '+(e.tags||[]).join(' ')).toLocaleLowerCase().includes(query);
 }).sort((a,b)=>(a.catalogue_order??0)-(b.catalogue_order??0));
 if(!result.length){const box=create('div','empty');box.append(create('h3','',query?'这一页，还没有找到。':'馆藏正在慢慢生长。'),create('p','',query?'换一个关键词，或调整筛选条件。':state.unlocked?'用 muQ Skill 归档一次会话，它就会出现在这里。':'公开目录暂未收录内容，可由馆主解锁完整档案。'));host.append(box);return;}
 const groups=new Map([['馆藏',result]]);
 for(const [month,entries] of groups){const section=create('section');const h=create('h3','month-title',month.replace('-',' / '));h.append(create('small','',`${entries.length} 份馆藏`));section.append(h);const grid=create('div','card-grid');for(const e of entries){const locked=!state.unlocked&&e.locked;const card=create(locked?'article':'a','card'+(locked?' locked-card':''));card.dataset.entryId=e.id;if(!locked){card.href=href(e.id);card.target='_blank';card.rel='noopener';}else card.setAttribute('aria-disabled','true');card.setAttribute('aria-label',(locked?'已锁定：':'打开：')+e.title);const cover=create('div','card-cover');const img=create('img');img.src=safeCover(e.cover||'');if(state.unlocked&&e.cover_asset)loadCover(img,e.cover_asset);img.alt=e.cover_kind==='screenshot'?`${e.title}的产出截图`:`${e.title}的内容概览图`;img.loading='lazy';img.width=1200;img.height=750;cover.append(img,create('span','cover-label',locked?'🔒 私密条目':e.cover_kind==='screenshot'?'产出截图':'内容概览'));const body=create('div','card-body');const meta=create('div','card-meta');meta.append(create('span','kind',e.kind==='journal'?'会话日记':'项目档案'),create('time','',e.date));body.append(meta,create('h3','',e.title),create('p','card-description',e.summary||'打开这一页，看看探索的过程。'));const bottom=create('div','card-bottom');bottom.append(create('span','',locked?'馆主解锁后可查看':`${statuses[e.status]||'已收录'}${state.unlocked&&e.kind==='journal'?' · '+promptCount(e)+' 条提示词':''}`),create('b','',locked?'🔒':'↗'));if(query){const hit=(e.search_index||[]).find(x=>x.text.toLocaleLowerCase().includes(query));if(hit){const at=hit.text.toLocaleLowerCase().indexOf(query);body.append(create('p','search-hit',hit.file+' · …'+hit.text.slice(Math.max(0,at-35),at+100)+'…'));}}body.append(tagNodes(e.tags),bottom);card.append(cover,body);grid.append(card);}section.append(grid);host.append(section);}
}
function download(name,data,type){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=create('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function asset(descriptor){
 const epoch=state.epoch;
 if(descriptor.url){
  if(!/^public-files\/[a-z0-9_-]+\/[a-f0-9]{64}\.bin$/.test(descriptor.url))throw new Error('公开附件路径无效');
  const response=await fetch('./'+descriptor.url);if(!response.ok)throw new Error('公开附件暂时无法读取');
  const raw=new Uint8Array(await response.arrayBuffer());
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
  if(raw.length!==descriptor.bytes||digest!==descriptor.sha256)throw new Error('附件校验失败');
  return raw;
 }
 if(!state.unlocked)throw new Error('请先解锁图书馆。');
 const key=await crypto.subtle.importKey('raw',bytes(state.payload.asset_key),'AES-GCM',false,['decrypt']);
 const chunks=[];for(const part of descriptor.parts){if(!/^assets\/[a-f0-9]{64}\.bin$/.test(part))throw new Error('附件路径无效');const r=await fetch('./'+part);if(!r.ok)throw new Error('附件暂时无法读取，请重试。');const raw=new Uint8Array(await r.arrayBuffer());chunks.push(new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12),additionalData:new TextEncoder().encode('muQ-asset-v2')},key,raw.slice(12))));}
 const result=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){result.set(c,at);at+=c.length;}
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',result)),b=>b.toString(16).padStart(2,'0')).join('');
 if(epoch!==state.epoch||!state.unlocked)throw new Error('图书馆已锁定。');if(result.length!==descriptor.bytes||digest!==descriptor.sha256)throw new Error('附件校验失败。');return result;
}
const coverObserver=new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){coverObserver.unobserve(item.target);const descriptor=item.target._asset;loadCoverNow(item.target,descriptor);}});
function loadCover(img,descriptor){img._asset=descriptor;coverObserver.observe(img);}
async function loadCoverNow(img,descriptor){try{const raw=await asset(descriptor);if(img.isConnected)img.src=blobURL(new Blob([raw],{type:'image/png'}));}catch(e){/* retain safe placeholder */}}
async function busy(button,action){const text=button.textContent;button.disabled=true;button.textContent='正在读取…';try{await action();}catch(e){message(e.message);const notice=create('p','file-error',e.message);button.after(notice);}finally{button.disabled=false;button.textContent=text;}}
function fileDownload(e,f){return async()=>{const raw=await asset(f);download(f.name.split('/').pop(),raw,'application/octet-stream');};}
async function previewFile(e,name,host){
 const f=e.files.find(x=>x.name===name);if(!f){host.append(create('p','','此附件不在当前档案中。'));return;}
 host.append(link('← 返回这篇档案',href(e.id)),create('h2','file-title',f.name));const b=create('button','primary','下载原文件');b.onclick=()=>busy(b,fileDownload(e,f));host.append(b,create('p','reader-meta',(f.bytes/1024).toFixed(1)+' KB · '+(state.unlocked?'原文件按需解密':'公开原文件')));
 const view=create('section','file-view');host.append(view);view.textContent='正在读取附件…';const epoch=state.epoch;
 const ext=name.split('.').pop().toLowerCase();if(!['png','jpg','jpeg','webp','gif','pdf','html','htm','md','txt','json','csv','log','py','js','ts','css','yaml','yml','toml','xml','svg','sh'].includes(ext)){view.textContent='此格式暂不支持在线预览，请下载原文件后打开。';return;}
 try{const raw=await asset(f);if(epoch!==state.epoch)return;view.replaceChildren();
 const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
 if(types[ext]){const img=create('img','file-image');img.alt=f.name;img.src=blobURL(new Blob([raw],{type:types[ext]}));view.append(img);}
 else if(ext==='pdf'&&new TextDecoder().decode(raw.slice(0,5))==='%PDF-'){const frame=create('iframe','file-frame');frame.title=f.name;frame.src=blobURL(new Blob([raw],{type:'application/pdf'}));view.append(frame);}
 else if(['html','htm'].includes(ext)||ext==='md'&&f.reading){const rawHTML=ext==='md'?await asset(f.reading):raw;await renderHTML(e,name,new TextDecoder().decode(rawHTML),view,false);}
 else if(['md','txt','json','csv','log','py','js','ts','css','yaml','yml','toml','xml','svg','sh'].includes(ext)){const pre=create('pre','file-text',new TextDecoder().decode(raw));view.append(pre);}
 else view.append(create('p','','此格式暂不支持在线预览，请下载原文件后打开。'));
 }catch(error){if(epoch===state.epoch)view.textContent=error.message;}
}
function sizeLabel(n){return n>=1048576?(n/1048576).toFixed(1)+' MiB':(n/1024).toFixed(1)+' KiB';}
function safeSource(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch(e){return null;}}
function entryBreadcrumb(e){
 const bar=$('.reader-bar');bar.replaceChildren();const nav=create('nav','entry-breadcrumb');nav.setAttribute('aria-label','面包屑');
 const home=create('a','','馆藏');home.href='./';nav.append(home,create('span','','/'));
 const visible=e&&(state.unlocked||!e.locked),name=visible?e.title:'私密条目',file=visible&&params.get('file');
 const current=create(file?'a':'span','',name);if(file)current.href=href(e.id);else current.setAttribute('aria-current','page');nav.append(current);
 if(file&&e.files.some(f=>f.name===file)){
  let prefix='';const parts=file.split('/');for(const part of parts.slice(0,-1)){prefix+=part+'/';const a=create('a','',part);a.href=href(e.id)+'&dir='+encodeURIComponent(prefix)+'#topic-files';nav.append(create('span','','/'),a);}
  const last=create('span','',parts.at(-1));last.setAttribute('aria-current','page');nav.append(create('span','','/'),last);
 }bar.append(nav);
}
function openEntry(id){
 disposeTopicReading();state.selected=id;const host=$('#reader-content');host.classList.remove('has-frontpage','topic-page');host.replaceChildren();const e=state.entries.find(x=>x.id===id);entryBreadcrumb(e);
 if(!e||!state.unlocked&&e.locked){document.title='muQ · 大图书馆';host.append(create('h1','reader-title','这份档案需要馆主解锁'));const b=create('button','primary','解锁完整馆藏');b.onclick=showLogin;host.append(b);return;}
 document.title=e.title+' · muQ';
 if(state.unlocked){const scope=create('button','entry-visibility',e.public?'公开 · 调整可见范围':'私有 · 调整可见范围');scope.onclick=()=>openManagement(e.id);host.append(scope);}
 if(params.get('file')){previewFile(e,params.get('file'),host);return;}
 renderTopic(e,host);
}
function showLogin(){$('#login-error').textContent='';$('#login').showModal();$('#password').focus();}
function resetIdle(){clearTimeout(idleTimer);if(!state.unlocked)return;const remaining=rememberedUntil?rememberedUntil-Date.now():30*60*1000;if(remaining<=0){lock();return;}idleTimer=setTimeout(()=>rememberedUntil>Date.now()?resetIdle():lock(),Math.min(remaining,2147483647));}
function lock(broadcast=true){disposeTopicReading();endManagement();state.epoch++;rememberedUntil=0;deviceMemory.clear().catch(()=>message('页面已退出，但浏览器存储清除失败；请清除此网站的数据。'));state.unlocked=false;$('#manage-top').hidden=true;state.payload=null;state.entries=state.public;clearAssets();coverObserver.disconnect();$('#password').value='';$('#reader-content').replaceChildren();$('#lock').hidden=true;$('#unlock-top').textContent='馆主入口 ⌑';$('#access-status').textContent='游客浏览 · 私有条目已锁定';$('#access-status').classList.remove('unlocked');$('#search').placeholder='搜索可见正文与附件';state.tag='';setCounts();render();if(entryId)openEntry(entryId);message('已锁定，完整档案已清除。');clearTimeout(idleTimer);if(broadcast)channel?.postMessage({type:'lock'});}
function accept(payload,expires=0){rememberedUntil=expires;if(payload.schema!==2)throw new Error('档案已更新，请刷新重试。');state.payload=payload;state.unlocked=true;$('#manage-top').hidden=false;state.entries=payload.entries;$('#password').value='';$('#login').close();$('#lock').hidden=false;$('#unlock-top').textContent='退出并忘记此设备';$('#access-status').textContent='馆主阅读 · 完整档案已解锁';$('#access-status').classList.add('unlocked');$('#search').placeholder='搜索正文、附件与原始提示词';setCounts();render();resetIdle();message(rememberedUntil?'此浏览器已记住，至 '+new Date(rememberedUntil).toLocaleDateString('zh-CN')+'。':'已临时解锁完整馆藏。');if(entryId)openEntry(entryId);if(params.get('manage')==='1'&&!$('#management').open)openManagement();}
async function readArchive(material){
 const envelope=await json('./archive.enc.json');
 if(envelope.schema!==1||envelope.iterations!==600000)throw new Error('不支持的档案格式');
 const encoder=new TextEncoder();
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(envelope.salt),iterations:envelope.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
 try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.nonce),additionalData:encoder.encode('muQ-v1')},key,bytes(envelope.ciphertext));return JSON.parse(new TextDecoder().decode(plain));}catch(e){const error=new Error('口令不正确，或档案在传输中损坏。请检查后重试。');error.code='INVALID_KEY';throw error;}
}
async function unlock(password){
 const epoch=++state.epoch;
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const payload=await readArchive(material);if(epoch!==state.epoch)return;
 let expires=0,storageFailed=false;
 try{if($('#remember-device').checked){expires=Date.now()+30*24*60*60*1000;await deviceMemory.save({key:material,expires});}else await deviceMemory.clear();}catch(e){expires=0;storageFailed=true;}
 if(epoch!==state.epoch){await deviceMemory.clear().catch(()=>{});return;}
 accept(payload,expires);if(storageFailed)message('已临时解锁；浏览器不允许保存设备记忆，下次需重新输入。');
}
async function restoreDevice(){
 const epoch=state.epoch;
 let saved;try{saved=await deviceMemory.load();}catch(e){return;}
 if(!saved||epoch!==state.epoch)return;
 try{const payload=await readArchive(saved.key);if(epoch===state.epoch&&saved.expires>Date.now())accept(payload,saved.expires);}
 catch(e){if(epoch===state.epoch){if(e.code==='INVALID_KEY'){await deviceMemory.clear().catch(()=>{});message('设备记忆无法打开当前档案，请重新输入馆主口令。');}else message('暂时无法读取馆藏，设备记忆已保留，请稍后刷新。');}}
}
$('#login-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('#login-error').textContent='正在打开馆藏…';try{await unlock($('#password').value);}catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;$('#password').value='';}};
$('#local-unlock').hidden=!isLocal;
$('#local-copy').hidden=!isLocal;
$('#local-copy').onclick=async()=>{try{const r=await fetch('/api/local-key',{headers:{'X-MuQ-Local':'1'}});if(!r.ok)throw new Error('未能读取本机口令');const data=await r.json();await navigator.clipboard.writeText(data.password);$('#login-error').textContent='已复制，可到个人网站的馆主入口粘贴。';}catch(e){$('#login-error').textContent='复制失败，请通过密码本读取 muq-library 条目。';}};
$('#local-unlock').onclick=async()=>{const button=$('#local-unlock');button.disabled=true;$('#login-error').textContent='正在读取本机馆主口令…';try{const r=await fetch('/api/local-key',{headers:{'X-MuQ-Local':'1'}});if(!r.ok)throw new Error('本机服务尚未配置馆主口令。');const {password}=await r.json();await unlock(password);}catch(e){$('#login-error').textContent=e.message;}finally{button.disabled=false;}};
$('#unlock-top').onclick=()=>state.unlocked?lock():showLogin();$('#lock').onclick=()=>lock();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{state.kind=b.dataset.kind;state.tag='';document.querySelectorAll('[data-kind]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));render();});
$('#search').addEventListener('input',render);$('#status-filter').addEventListener('change',render);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('dialog[open]')){e.preventDefault();$('#search').focus();}resetIdle();});document.addEventListener('pointerdown',resetIdle);
async function init(){try{const catalogue=await json('./catalogue.json');state.public=catalogue.entries;state.entries=state.public;setCounts();$('#updated').textContent='更新于 '+catalogue.updated.slice(0,10);render();if(entryId){$('.skip').href='#reader';$('.skip').textContent='跳到正文';document.body.classList.add('reading');$('main').hidden=true;$('#reader').hidden=false;openEntry(entryId);}await restoreDevice();if(params.get('manage')==='1'&&!state.unlocked)showLogin();if(!state.unlocked)channel?.postMessage({type:'request',from:tabId});}catch(e){message(e.message);$('#entries').append(create('div','empty','暂时无法读取馆藏。请刷新页面重试。'));}}
if(channel)channel.onmessage=event=>{const m=event.data;if(m.type==='request'&&state.unlocked&&(!rememberedUntil||rememberedUntil>Date.now()))channel.postMessage({type:'grant',to:m.from,payload:state.payload,expires:rememberedUntil});if(m.type==='grant'&&m.to===tabId&&!state.unlocked&&(!m.expires||m.expires>Date.now()))accept(m.payload,m.expires||0);if(m.type==='lock')lock(false);};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.unlocked&&rememberedUntil&&rememberedUntil<=Date.now())lock();});
init();
// ZIP "store" format: no duplicate ZIP payload is uploaded; assemble only on request.
function makeZip(files){
 const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const crc=data=>{let n=0xffffffff;for(const b of data)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;};
 const records=[],central=[];let offset=0,size=0;const encoder=new TextEncoder();
 for(const f of files){const name=encoder.encode(f.name),checksum=crc(f.data);if(f.data.length>0xffffffff)throw new Error('附件超出 ZIP 支持范围');const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,checksum,true);v.setUint32(18,f.data.length,true);v.setUint32(22,f.data.length,true);v.setUint16(26,name.length,true);h.set(name,30);records.push(h,f.data);
 const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,checksum,true);d.setUint32(20,f.data.length,true);d.setUint32(24,f.data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+f.data.length;size+=c.length;}
 if(files.length>65535||offset+size>0xffffffff)throw new Error('档案太大，请逐个下载附件。');const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...records,...central,end],{type:'application/zip'});
}

// Management sessions exist only on the local owner service, never on the public site.
let managementToken='';
let managementScope='all';
const syncLabels={pending:'待同步：本地修改尚未发布',deploying:'已推送，等待网站部署',live:'网站已生效',failed:'同步失败，本地修改已保留'};
async function showSyncStatus(){if(!managementToken||!state.unlocked||!$('#management').open)return;try{const result=await manageAPI('status');if(managementToken&&state.unlocked)$('#management-message').textContent=syncLabels[result.state]||'待同步';}catch{}}
setInterval(showSyncStatus,15000);
async function manageAPI(path,data){
 const headers={'X-MuQ-Local':'1'};if(managementToken)headers.Authorization='Bearer '+managementToken;
 if(data!==undefined)headers['Content-Type']='application/json';
 const r=await fetch('/api/manage/'+path,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data)});
 const result=await r.json();if(!r.ok)throw new Error(result.error||'管理操作失败');return result;
}
function endManagement(){
 if(managementToken&&isLocal)manageAPI('logout',{}).catch(()=>{});
 managementToken='';$('#management')?.close();$('#management-entries')?.replaceChildren();
}
async function refreshPublic(){
 const catalogue=await json('./catalogue.json');state.public=catalogue.entries;
 if(!state.unlocked){state.entries=state.public;setCounts();render();if(entryId)openEntry(entryId);}
 $('#updated').textContent='更新于 '+catalogue.updated.slice(0,10);
}
async function renderManagement(){
 const epoch=state.epoch;const result=await manageAPI('entries');if(epoch!==state.epoch||!state.unlocked)return;
 const host=$('#management-entries');host.replaceChildren();
 const filters=create('div','management-filters');for(const [value,label] of [['all','全部'],['public','公开'],['private','私有']]){const b=create('button','secondary',label);b.type='button';b.setAttribute('aria-pressed',String(managementScope===value));b.onclick=()=>{managementScope=value;renderManagement();};filters.append(b);}host.append(filters);
 for(const e of result.entries){
  if(managementScope!=='all'&&e.public!==(managementScope==='public'))continue;
  const form=create('form','management-entry');form.dataset.entryId=e.id;const heading=create('div','management-heading');
  heading.append(create('h3','',e.title),create('span','visibility-badge',e.public?'公开':'私有 · 游客锁定'));form.append(heading);
  const scope=create('fieldset','visibility-options');scope.append(create('legend','','可见范围'));
  for(const [value,text] of [['private','私有 · 游客仅见锁定卡片'],['public','公开']]){const label=create('label');const input=create('input');input.type='radio';input.name='visibility';input.value=value;input.checked=value===(e.public?'public':'private');label.append(input,document.createTextNode(text));scope.append(label);}
  const fields=create('div','public-fields');const title=create('input');title.type='text';title.maxLength=200;title.value=e.public_title||e.title;title.id='public-title-'+e.id;
  const titleLabel=create('label','','公开标题');titleLabel.htmlFor=title.id;
  const summary=create('textarea');summary.rows=3;summary.maxLength=5000;summary.value=e.public_summary||e.summary||'';summary.id='public-summary-'+e.id;
  const summaryLabel=create('label','','公开概述');summaryLabel.htmlFor=summary.id;
  fields.append(titleLabel,title,summaryLabel,summary,create('p','reader-meta','公开标题、概述、正文及可上传附件。原始提示词和本机文件索引仍仅馆主可见。'));
  const lockedFields=create('div','locked-fields'),lockedTitle=create('input'),lockedLabel=create('label','','游客可见名称（可留空）');lockedTitle.id='locked-title-'+e.id;lockedLabel.htmlFor=lockedTitle.id;lockedTitle.value=e.locked_title||'';lockedTitle.maxLength=200;lockedTitle.placeholder='私密条目';lockedFields.append(lockedLabel,lockedTitle,create('p','reader-meta','游客可见模糊封面与条目数量，不能打开。设为私有并同步后会撤下公开内容，已下载的副本无法收回。'));
  const preview=create('section','visitor-preview');preview.setAttribute('aria-label','游客预览');
  const updateFields=()=>{const visible=form.elements.visibility.value==='public';fields.hidden=!visible;lockedFields.hidden=visible;title.required=summary.required=visible;preview.replaceChildren(create('h4','','游客预览'),create('strong','',visible?title.value:lockedTitle.value||'私密条目'),create('p','',visible?summary.value:'🔒 馆主解锁后可查看'));
   const entry=state.entries.find(v=>v.id===e.id);if(visible){const count=(entry?.files||[]).filter(f=>f.name.startsWith('artifacts/')).length;preview.append(create('p','reader-meta',`将公开正文及 ${count} 个可上传附件；原话、本机路径和禁止发布附件不公开。`));preview.append(link('检查当前正文与文件',href(e.id)));const coverButton=create('button','secondary','预览公开封面');coverButton.type='button';coverButton.onclick=()=>busy(coverButton,async()=>{const snap={title:title.value,summary:summary.value};const response=await manageAPI('preview',{id:e.id,...snap});if(!state.unlocked||!preview.isConnected||title.value!==snap.title||summary.value!==snap.summary)return;preview.querySelector('img')?.remove();const image=create('img');image.src=safeCover(response.cover);image.alt='游客将看到的封面';preview.append(image);});preview.append(coverButton);}else{const card=state.public.find(v=>v.id===e.id);if(card?.locked){const image=create('img');image.src=safeCover(card.cover);image.alt='游客看到的模糊封面';preview.append(image);}}};
  scope.onchange=updateFields;title.oninput=summary.oninput=lockedTitle.oninput=updateFields;
  const save=create('button','secondary','保存可见范围');save.type='submit';
  const notice=create('p','management-result');notice.setAttribute('role','status');
  form.append(scope,fields,lockedFields,preview,save,notice);host.append(form);updateFields();
  form.onsubmit=async event=>{event.preventDefault();save.disabled=true;notice.textContent='正在保存…';$('#management-message').textContent='正在保存…';
   try{const result=await manageAPI('visibility',{id:e.id,revision:e.revision,public:form.elements.visibility.value==='public',title:title.value,summary:summary.value,locked_title:lockedTitle.value});
    await refreshPublic();
    if(epoch!==state.epoch||!state.unlocked)return;
    const owner=state.entries.find(v=>v.id===e.id);if(owner){owner.public=form.elements.visibility.value==='public';owner.public_content=owner.public;owner.revision=result.revision;}
    if(entryId)openEntry(entryId);
    await renderManagement();
    $('#management-message').textContent=result.status==='saved_build_failed'?result.error:'已保存并更新本机。点击“同步到网站”发布这些设置。';
   }catch(error){if(epoch===state.epoch)notice.textContent=error.message;}finally{save.disabled=false;}
  };
 }
}
async function openManagement(focusId){
 const modal=$('#management');$('#management-message').textContent='';$('#management-entries').replaceChildren();modal.showModal();
 $('#management-build').hidden=$('#management-publish').hidden=!isLocal;
 if(!isLocal){const p=create('p','dialog-description','馆藏的原始档案保存在你的电脑上。请打开本机管理，保存后同步到网站。');const a=link('打开本机馆藏管理 ↗','http://127.0.0.1:6767/library/'+(entryId?'entry.html?id='+encodeURIComponent(entryId)+'&':'?')+'manage=1');$('#management-entries').append(p,a);return;}
 const epoch=state.epoch;$('#management-message').textContent='正在验证本机馆主身份…';
 try{
  const r=await fetch('/api/local-key',{headers:{'X-MuQ-Local':'1'}});if(!r.ok)throw new Error('请启动更新后的本机图书馆服务');
  const local=await r.json();const session=await manageAPI('session',{password:local.password});local.password='';
  if(epoch!==state.epoch||!state.unlocked)return;managementToken=session.token;
  managementScope='all';await renderManagement();await showSyncStatus();if(typeof focusId==='string'){$('#management-entries').querySelector(`[data-entry-id="${CSS.escape(focusId)}"]`)?.scrollIntoView({block:'start'});}
 }catch(error){if(epoch===state.epoch)$('#management-message').textContent=error.message;}
}
$('#manage-top').onclick=()=>openManagement();
for(const [id,path,done] of [['management-build','build','本地图书馆已更新。'],['management-publish','publish','已推送网站更新，正在等待部署。']]){
 $('#'+id).onclick=async()=>{const button=$('#'+id);button.disabled=true;$('#management-message').textContent=path==='publish'?'正在同步网站，请稍候…':'正在构建…';
  try{await manageAPI(path,{});await refreshPublic();$('#management-message').textContent=done;}catch(error){$('#management-message').textContent=error.message;}finally{button.disabled=false;}
 };
}
const viewToggle=create('button','view-toggle','紧凑纵览');viewToggle.setAttribute('aria-pressed','false');viewToggle.onclick=()=>{const compact=document.body.classList.toggle('compact-view');viewToggle.textContent=compact?'图文纵览':'紧凑纵览';viewToggle.setAttribute('aria-pressed',String(compact));};$('.catalogue-tools').append(viewToggle);
