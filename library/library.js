'use strict';
const $=s=>document.querySelector(s);
const create=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const state={public:[],entries:[],unlocked:false,kind:'all',selected:null,epoch:0};
const labels={summary:'这一章的概述',work:'做过的事',problems:'问题与现状',decisions:'处理与决策',outputs:'产出与证据',next:'下一页，从这里继续'};
const statuses={active:'进行中',done:'已完成',archived:'已归档'};
let idleTimer;
const isLocal=location.hostname==='127.0.0.1';
const message=text=>$('#message').textContent=text;
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function safeCover(value){return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)||/^covers\/[a-z0-9_-]+\.png$/.test(value)?value:'./favicon.svg';}
async function json(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('馆藏读取失败，请稍后重试。');return response.json();}
function promptCount(e){return Array.isArray(e.prompt_records)?e.prompt_records.length:e.prompt_count||0;}
function setCounts(){const journals=state.entries.filter(e=>e.kind==='journal').length;$('#count').textContent=String(state.entries.length).padStart(2,'0');$('#count-description').textContent=`${journals} 篇日记 / ${state.entries.length-journals} 个项目`;}
function render(){
 const host=$('#entries');host.replaceChildren();const query=$('#search').value.trim().toLocaleLowerCase();
 const result=state.entries.filter(e=>{
  if(state.kind!=='all'&&e.kind!==state.kind)return false;
  if($('#status-filter').value!=='all'&&e.status!==$('#status-filter').value)return false;
  const text=state.unlocked?[e.title,...Object.keys(labels).map(k=>e[k]),e.prompts].join('\n'):[e.title,e.summary].join('\n');
  return text.toLocaleLowerCase().includes(query);
 }).sort((a,b)=>(b.date+b.updated).localeCompare(a.date+a.updated));
 if(!result.length){const box=create('div','empty');box.append(create('h3','',query?'这一页，还没有找到。':'馆藏正在慢慢生长。'),create('p','',query?'换一个关键词，或调整筛选条件。':state.unlocked?'用 muQ Skill 归档一次会话，它就会出现在这里。':'公开目录暂未收录内容，可由馆主解锁完整档案。'));host.append(box);return;}
 const groups=new Map();for(const e of result){const month=e.date.slice(0,7);if(!groups.has(month))groups.set(month,[]);groups.get(month).push(e);}
 for(const [month,entries] of groups){const section=create('section');const h=create('h3','month-title',month.replace('-',' / '));h.append(create('small','',`${entries.length} 份馆藏`));section.append(h);const grid=create('div','card-grid');for(const e of entries){const card=create('button','card');card.type='button';card.setAttribute('aria-label',`打开${e.kind==='journal'?'日记':'项目'}：${e.title}`);const cover=create('div','card-cover');const img=create('img');img.src=safeCover(e.cover);img.alt=e.cover_kind==='screenshot'?`${e.title}的产出截图`:`${e.title}的内容概览图`;img.loading='lazy';img.width=1200;img.height=750;cover.append(img,create('span','cover-label',e.cover_kind==='screenshot'?'产出截图':'内容概览'));const body=create('div','card-body');const meta=create('div','card-meta');meta.append(create('span','kind',e.kind==='journal'?'会话日记':'项目档案'),create('time','',e.date));body.append(meta,create('h3','',e.title),create('p','card-description',e.summary||'打开这一页，看看探索的过程。'));const bottom=create('div','card-bottom');bottom.append(create('span','',`${statuses[e.status]||'已收录'}${e.kind==='journal'?' · '+promptCount(e)+' 条提示词':''}`),create('b','','↗'));body.append(bottom);card.append(cover,body);card.onclick=()=>openEntry(e.id);grid.append(card);}section.append(grid);host.append(section);}
}
function download(name,data,type){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=create('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function openEntry(id){
 const e=state.entries.find(x=>x.id===id);if(!e){message('该档案未在当前目录中；完整馆藏需要解锁。');return;}
 state.selected=id;history.replaceState(null,'','#'+encodeURIComponent(id));const host=$('#reader-content');host.replaceChildren();
 const img=create('img','reader-cover');img.src=safeCover(e.cover);img.alt=e.cover_kind==='screenshot'?'本次产出截图':'本次会话内容概览图';host.append(img);
 const title=create('h1','reader-title',e.title);title.id='reader-title';host.append(title,create('p','reader-meta',`${e.kind==='journal'?'会话日记':'项目档案'} · ${e.date} · ${statuses[e.status]||'已收录'}`));
 if(!state.unlocked){host.append(create('div','record-text',e.summary));const note=create('div','locked-note');note.append(create('p','',`这里是公开的封面与概述。${e.kind==='journal'?promptCount(e)+' 条原始提示词、':''}完整过程与产物保存在馆藏正文中。`));const button=create('button','primary','馆主解锁正文');button.onclick=showLogin;note.append(button);host.append(note);}else{
  const actions=create('div','reader-actions');const bundle=create('button','','下载完整档案');bundle.onclick=()=>download(e.id+'.zip',bytes(e.bundle),'application/zip');actions.append(bundle);
  if(e.kind==='journal'){const prompts=create('button','','导出全部提示词');prompts.onclick=()=>download(e.id+'-prompts.json',JSON.stringify(e.prompt_records,null,2),'application/json;charset=utf-8');actions.append(prompts);}host.append(actions);
  for(const [field,label] of Object.entries(labels)){const section=create('section','reader-section');section.append(create('h3','',label),create('div','record-text',e[field]||'尚未记录'));host.append(section);}
  if(e.kind==='journal'){
   const section=create('section','reader-section');section.append(create('h3','',`用户原话 · ${promptCount(e)} 条`));
   if(e.session){section.append(create('p','reader-meta',`${e.session.provider} / ${e.session.id}\n${e.session.coverage}`));}
   for(const p of e.prompt_records||[]){const detail=create('details','prompt');const summary=create('summary','',String(p.ordinal).padStart(2,'0')+' / '+(p.text.slice(0,76).replace(/\s+/g,' ')||'图片或附件输入')+(p.text.length>76?'…':''));detail.append(summary,create('small','',p.timestamp||'时间未记录'),create('pre','',p.text));if(p.content?.some(b=>!['text','input_text'].includes(b.type)))detail.append(create('small','','此条包含非文本内容，原始内容块保存在提示词 JSON 中。'));section.append(detail);}host.append(section);
  }
  const attachments=create('section','reader-section');attachments.append(create('h3','',`过程产物 · ${(e.artifacts||[]).length} 份`));const ul=create('ul','attachment-list');for(const a of e.artifacts||[])ul.append(create('li','',`${a.name} · ${(a.bytes/1024).toFixed(1)} KB`));attachments.append(ul);if(!(e.artifacts||[]).length)attachments.append(create('p','reader-meta','尚未收录附件。'));host.append(attachments);
  const related=state.entries.filter(x=>e.kind==='project'?x.project===e.id:x.id===e.project);if(related.length){const section=create('section','reader-section');section.append(create('h3','',e.kind==='project'?'这个项目的会话':'归属项目'));for(const other of related){const link=create('a','related-link',other.title);link.href='#'+other.id;link.onclick=ev=>{ev.preventDefault();openEntry(other.id);};section.append(link);}host.append(section);}
 }
 if(!$('#reader').open)$('#reader').showModal();$('#reader').scrollTop=0;
}
function showLogin(){$('#reader').close();$('#login-error').textContent='';$('#login').showModal();$('#password').focus();}
function resetIdle(){clearTimeout(idleTimer);if(state.unlocked)idleTimer=setTimeout(lock,30*60*1000);}
function lock(){state.epoch++;state.unlocked=false;state.entries=state.public;state.selected=null;$('#password').value='';$('#reader').close();$('#reader-content').replaceChildren();$('#lock').hidden=true;$('#unlock-top').textContent='馆主入口 ⌑';$('#access-status').textContent='公开目录 · 正文待解锁';$('#access-status').classList.remove('unlocked');$('#search').placeholder='搜索标题与概述';history.replaceState(null,'','#collection');setCounts();render();message('已锁定，页面中的完整档案已清除。');clearTimeout(idleTimer);}
async function unlock(password){
 const epoch=++state.epoch;const envelope=await json('./archive.enc.json');
 if(envelope.schema!==1||envelope.iterations!==600000)throw new Error('不支持的档案格式');
 const encoder=new TextEncoder();const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(envelope.salt),iterations:envelope.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
 let payload;try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.nonce),additionalData:encoder.encode('muQ-v1')},key,bytes(envelope.ciphertext));payload=JSON.parse(new TextDecoder().decode(plain));}catch(e){throw new Error('口令不正确，或档案在传输中损坏。请检查后重试。');}
 if(epoch!==state.epoch)return;
 state.unlocked=true;state.entries=payload.entries;$('#password').value='';$('#login').close();$('#lock').hidden=false;$('#unlock-top').textContent='锁定图书馆';$('#access-status').textContent='馆主阅读 · 完整档案已解锁';$('#access-status').classList.add('unlocked');$('#search').placeholder='搜索正文与每条原始提示词';setCounts();render();resetIdle();message('已解锁完整馆藏。');if(state.selected)openEntry(state.selected);
}
$('#login-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('#login-error').textContent='正在打开馆藏…';try{await unlock($('#password').value);}catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;$('#password').value='';}};
$('#local-unlock').hidden=!isLocal;
$('#local-copy').hidden=!isLocal;
$('#local-copy').onclick=async()=>{try{const r=await fetch('/api/local-key',{headers:{'X-MuQ-Local':'1'}});if(!r.ok)throw new Error('未能读取本机口令');const data=await r.json();await navigator.clipboard.writeText(data.password);$('#login-error').textContent='已复制，可到个人网站的馆主入口粘贴。';}catch(e){$('#login-error').textContent='复制失败，请通过密码本读取 muq-library 条目。';}};
$('#local-unlock').onclick=async()=>{const button=$('#local-unlock');button.disabled=true;$('#login-error').textContent='正在读取本机馆主口令…';try{const r=await fetch('/api/local-key',{headers:{'X-MuQ-Local':'1'}});if(!r.ok)throw new Error('本机服务尚未配置馆主口令。');const {password}=await r.json();await unlock(password);}catch(e){$('#login-error').textContent=e.message;}finally{button.disabled=false;}};
$('#unlock-top').onclick=()=>state.unlocked?lock():showLogin();$('#lock').onclick=lock;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{const id=b.dataset.close;$('#'+id).close();if(id==='reader'){state.selected=null;history.replaceState(null,'','#collection');}});
$('#reader').addEventListener('cancel',()=>{state.selected=null;history.replaceState(null,'','#collection');});
$('.reader-home').onclick=e=>{e.preventDefault();$('#reader').close();state.selected=null;history.replaceState(null,'','#collection');};
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{state.kind=b.dataset.kind;document.querySelectorAll('[data-kind]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));render();});
$('#search').addEventListener('input',render);$('#status-filter').addEventListener('change',render);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('dialog[open]')){e.preventDefault();$('#search').focus();}resetIdle();});document.addEventListener('pointerdown',resetIdle);
async function init(){try{const catalogue=await json('./catalogue.json');state.public=catalogue.entries;state.entries=state.public;setCounts();$('#updated').textContent='更新于 '+catalogue.updated.slice(0,10);render();const id=decodeURIComponent(location.hash.slice(1));if(id&&id!=='collection')openEntry(id);}catch(e){message(e.message);$('#entries').append(create('div','empty','暂时无法读取馆藏。请刷新页面重试。'));}}
init();
