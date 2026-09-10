'use strict';
const $=s=>document.querySelector(s);
const create=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const state={public:[],entries:[],unlocked:false,kind:'journal',tag:'',expanded:false,payload:null,selected:null,epoch:0};
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
function link(text,url){const a=create('a','related-link',text);a.href=url;a.target='_blank';a.rel='noopener';return a;}
function tagNodes(tags){const row=create('div','entry-tags');for(const tag of tags||[])row.append(create('span','tag','#'+tag));return row;}
function renderTags(){const counts=new Map();for(const e of state.entries.filter(e=>state.kind==='all'||e.kind===state.kind))for(const tag of e.tags||[])counts.set(tag,(counts.get(tag)||0)+1);const host=$('#tags');host.replaceChildren();const all=create('button','tag','全部标签');all.setAttribute('aria-pressed',String(!state.tag));all.onclick=()=>{state.tag='';render();};host.append(all);const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));for(const [tag,count] of state.expanded?sorted:sorted.slice(0,12)){const b=create('button','tag','#'+tag+' '+count);b.setAttribute('aria-pressed',String(state.tag===tag));b.onclick=()=>{state.tag=state.tag===tag?'':tag;render();};host.append(b);}if(sorted.length>12){const b=create('button','tag',state.expanded?'收起标签':'展开全部 '+sorted.length);b.onclick=()=>{state.expanded=!state.expanded;render();};host.append(b);}}
const isLocal=location.hostname==='127.0.0.1';
const message=text=>$('#message').textContent=text;
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function safeCover(value){return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)||/^covers\/[a-z0-9_-]+\.png$/.test(value)?value:'./favicon.svg';}
async function json(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('馆藏读取失败，请稍后重试。');return response.json();}
function promptCount(e){return Array.isArray(e.prompt_records)?e.prompt_records.length:e.prompt_count||0;}
function setCounts(){const journals=state.entries.filter(e=>e.kind==='journal').length;$('#count').textContent=String(state.entries.length).padStart(2,'0');$('#count-description').textContent=`${journals} 篇日记 / ${state.entries.length-journals} 个项目`;}
function render(){
 renderTags();const host=$('#entries');host.replaceChildren();const query=$('#search').value.trim().toLocaleLowerCase();
 const result=state.entries.filter(e=>{
  if(state.kind!=='all'&&e.kind!==state.kind)return false;
  if(state.tag&&!(e.tags||[]).includes(state.tag))return false;
  if($('#status-filter').value!=='all'&&e.status!==$('#status-filter').value)return false;
  const text=state.unlocked?[e.title,...Object.keys(labels).map(k=>e[k]),e.prompts].join('\n'):[e.title,e.summary].join('\n');
  return (text+' '+(e.tags||[]).join(' ')).toLocaleLowerCase().includes(query);
 }).sort((a,b)=>(b.date+b.updated).localeCompare(a.date+a.updated));
 if(!result.length){const box=create('div','empty');box.append(create('h3','',query?'这一页，还没有找到。':'馆藏正在慢慢生长。'),create('p','',query?'换一个关键词，或调整筛选条件。':state.unlocked?'用 muQ Skill 归档一次会话，它就会出现在这里。':'公开目录暂未收录内容，可由馆主解锁完整档案。'));host.append(box);return;}
 const groups=new Map();for(const e of result){const month=e.date.slice(0,7);if(!groups.has(month))groups.set(month,[]);groups.get(month).push(e);}
 for(const [month,entries] of groups){const section=create('section');const h=create('h3','month-title',month.replace('-',' / '));h.append(create('small','',`${entries.length} 份馆藏`));section.append(h);const grid=create('div','card-grid');for(const e of entries){const card=create('a','card');card.href=href(e.id);card.target='_blank';card.rel='noopener';card.setAttribute('aria-label',`打开${e.kind==='journal'?'日记':'项目'}：${e.title}`);const cover=create('div','card-cover');const img=create('img');img.src=safeCover(e.cover||'');if(state.unlocked&&e.cover_asset)loadCover(img,e.cover_asset);img.alt=e.cover_kind==='screenshot'?`${e.title}的产出截图`:`${e.title}的内容概览图`;img.loading='lazy';img.width=1200;img.height=750;cover.append(img,create('span','cover-label',e.cover_kind==='screenshot'?'产出截图':'内容概览'));const body=create('div','card-body');const meta=create('div','card-meta');meta.append(create('span','kind',e.kind==='journal'?'会话日记':'项目档案'),create('time','',e.date));body.append(meta,create('h3','',e.title),create('p','card-description',e.summary||'打开这一页，看看探索的过程。'));const bottom=create('div','card-bottom');bottom.append(create('span','',`${statuses[e.status]||'已收录'}${e.kind==='journal'?' · '+promptCount(e)+' 条提示词':''}`),create('b','','↗'));body.append(tagNodes(e.tags),bottom);card.append(cover,body);grid.append(card);}section.append(grid);host.append(section);}
}
function download(name,data,type){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=create('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function asset(descriptor){
 const epoch=state.epoch;if(!state.unlocked)throw new Error('请先解锁图书馆。');
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
 host.append(link('← 返回这篇档案',href(e.id)),create('h2','file-title',f.name));const b=create('button','primary','下载原文件');b.onclick=()=>busy(b,fileDownload(e,f));host.append(b,create('p','reader-meta',(f.bytes/1024).toFixed(1)+' KB · 原文件按需解密'));
 const view=create('section','file-view');host.append(view);view.textContent='正在读取附件…';const epoch=state.epoch;
 const ext=name.split('.').pop().toLowerCase();if(!['png','jpg','jpeg','webp','gif','pdf','html','htm','md','txt','json','csv','log','py','js','ts','css','yaml','yml','toml','xml','svg','sh'].includes(ext)){view.textContent='此格式暂不支持在线预览，请下载原文件后打开。';return;}
 try{const raw=await asset(f);if(epoch!==state.epoch)return;view.replaceChildren();
 const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
 if(types[ext]){const img=create('img','file-image');img.alt=f.name;img.src=blobURL(new Blob([raw],{type:types[ext]}));view.append(img);}
 else if(ext==='pdf'&&new TextDecoder().decode(raw.slice(0,5))==='%PDF-'){const frame=create('iframe','file-frame');frame.title=f.name;frame.src=blobURL(new Blob([raw],{type:'application/pdf'}));view.append(frame);}
 else if(['html','htm'].includes(ext)){const doc=new DOMParser().parseFromString(new TextDecoder().decode(raw),'text/html');doc.querySelectorAll('script,iframe,object,embed,base,meta,link,form').forEach(n=>n.remove());for(const n of doc.querySelectorAll('*'))for(const a of [...n.attributes])if(a.name.startsWith('on')||['src','srcset','href','action','formaction','poster','data'].includes(a.name))n.removeAttribute(a.name);const frame=create('iframe','file-frame');frame.title=f.name;frame.setAttribute('sandbox','');frame.srcdoc='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:">'+doc.documentElement.outerHTML;view.append(create('p','reader-meta','静态 HTML 预览：脚本、外部链接和未打包资源不执行。完整文件可下载。'),frame);}
 else if(['md','txt','json','csv','log','py','js','ts','css','yaml','yml','toml','xml','svg','sh'].includes(ext)){const pre=create('pre','file-text',new TextDecoder().decode(raw));view.append(pre);}
 else view.append(create('p','','此格式暂不支持在线预览，请下载原文件后打开。'));
 }catch(error){if(epoch===state.epoch)view.textContent=error.message;}
}
function openEntry(id){
 state.selected=id;const host=$('#reader-content');host.replaceChildren();const e=state.entries.find(x=>x.id===id);
 if(!e){host.append(create('h1','reader-title','这份档案需要馆主解锁'));const b=create('button','primary','解锁完整馆藏');b.onclick=showLogin;host.append(b);return;}
 document.title=e.title+' · muQ';
 if(state.unlocked&&params.get('file')){previewFile(e,params.get('file'),host);return;}
 const img=create('img','reader-cover');img.src=safeCover(e.cover||'');if(state.unlocked&&e.cover_asset)loadCover(img,e.cover_asset);img.alt='本篇档案概览';host.append(img,create('h1','reader-title',e.title),create('p','reader-meta',`${e.kind==='journal'?'会话日记':'项目档案'} · ${e.date} · ${statuses[e.status]||'已收录'}`),tagNodes(e.tags));
 if(!state.unlocked){host.append(create('div','record-text',e.summary));const note=create('div','locked-note');note.append(create('p','','公开页面展示概览；完整过程、原始提示词和附件需馆主解锁。'));const b=create('button','primary','馆主解锁正文');b.onclick=showLogin;note.append(b);host.append(note);return;}
 const actions=create('div','reader-actions');const bundle=create('button','','下载完整档案 ZIP');bundle.onclick=()=>busy(bundle,async()=>{const epoch=state.epoch;const files=[];for(const f of e.files)files.push({name:e.id+'/'+f.name,data:await asset(f)});if(epoch!==state.epoch)return;download(e.id+'.zip',makeZip(files),'application/zip');});actions.append(bundle);host.append(actions);
 const toc=create('nav','detail-toc');toc.setAttribute('aria-label','本篇目录');for(const [field,label]of Object.entries({...labels,attachments:'文件与产物',prompts:'用户原话'})){const a=create('a','',label);a.href='#section-'+field;toc.append(a);}host.append(toc);
 for(const [field,label]of Object.entries(labels)){const section=create('section','reader-section');section.id='section-'+field;section.append(create('h2','',label),create('div','record-text',e[field]||'尚未记录'));host.append(section);}
 const attachments=create('section','reader-section');attachments.id='section-attachments';attachments.append(create('h2','',`文件与产物 · ${e.files.length} 份`));const ul=create('ul','attachment-list');for(const f of e.files){const li=create('li');li.append(link(f.name+' ↗',href(e.id,f.name)),create('small','',(f.bytes/1024).toFixed(1)+' KB'));ul.append(li);}attachments.append(ul);host.append(attachments);
 if(e.kind==='journal'){const section=create('section','reader-section');section.id='section-prompts';section.append(create('h2','',`用户原话 · ${promptCount(e)} 条`));for(const p of e.prompt_records||[]){const d=create('details','prompt');d.append(create('summary','',String(p.ordinal).padStart(2,'0')+' / '+(p.timestamp||'原始提示词')),create('pre','',p.text));section.append(d);}host.append(section);}
 const related=state.entries.filter(x=>e.kind==='project'?x.project===e.id:x.id===e.project);if(related.length){const section=create('section','reader-section');section.append(create('h2','',e.kind==='project'?'项目中的会话':'归属项目'));for(const other of related)section.append(link(other.title,href(other.id)));host.append(section);}
}
function showLogin(){$('#login-error').textContent='';$('#login').showModal();$('#password').focus();}
function resetIdle(){clearTimeout(idleTimer);if(!state.unlocked)return;const remaining=rememberedUntil?rememberedUntil-Date.now():30*60*1000;if(remaining<=0){lock();return;}idleTimer=setTimeout(()=>rememberedUntil>Date.now()?resetIdle():lock(),Math.min(remaining,2147483647));}
function lock(broadcast=true){state.epoch++;rememberedUntil=0;deviceMemory.clear().catch(()=>message('页面已退出，但浏览器存储清除失败；请清除此网站的数据。'));state.unlocked=false;state.payload=null;state.entries=state.public;clearAssets();coverObserver.disconnect();$('#password').value='';$('#reader-content').replaceChildren();$('#lock').hidden=true;$('#unlock-top').textContent='馆主入口 ⌑';$('#access-status').textContent='公开目录 · 正文待解锁';$('#access-status').classList.remove('unlocked');$('#search').placeholder='搜索标题与概述';state.tag='';setCounts();render();if(entryId)openEntry(entryId);message('已锁定，完整档案已清除。');clearTimeout(idleTimer);if(broadcast)channel?.postMessage({type:'lock'});}
function accept(payload,expires=0){rememberedUntil=expires;if(payload.schema!==2)throw new Error('档案已更新，请刷新重试。');state.payload=payload;state.unlocked=true;state.entries=payload.entries;$('#password').value='';$('#login').close();$('#lock').hidden=false;$('#unlock-top').textContent='退出并忘记此设备';$('#access-status').textContent='馆主阅读 · 完整档案已解锁';$('#access-status').classList.add('unlocked');$('#search').placeholder='搜索正文与每条原始提示词';setCounts();render();resetIdle();message(rememberedUntil?'此浏览器已记住，至 '+new Date(rememberedUntil).toLocaleDateString('zh-CN')+'。':'已临时解锁完整馆藏。');if(entryId)openEntry(entryId);}
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
async function init(){try{const catalogue=await json('./catalogue.json');state.public=catalogue.entries;state.entries=state.public;setCounts();$('#updated').textContent='更新于 '+catalogue.updated.slice(0,10);render();if(entryId){$('.skip').href='#reader';$('.skip').textContent='跳到正文';document.body.classList.add('reading');$('main').hidden=true;$('#reader').hidden=false;openEntry(entryId);}await restoreDevice();if(!state.unlocked)channel?.postMessage({type:'request',from:tabId});}catch(e){message(e.message);$('#entries').append(create('div','empty','暂时无法读取馆藏。请刷新页面重试。'));}}
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
