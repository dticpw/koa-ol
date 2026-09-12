// Approved long-term-topic template: one default layout for all entry types.
function defaultTopic(e){
 const sections=[];for(const [key,title] of Object.entries(labels)){if(key!=='summary'&&e[key]?.trim())sections.push({id:'body-'+key,title,paragraphs:e[key].split(/\n\n+/)});}
 for(const [i,s] of (e.sections||[]).entries())if(s.body?.trim())sections.push({id:'section-'+i,title:s.title,paragraphs:s.body.split(/\n\n+/)});
 const related=state.entries.filter(x=>x.id!==e.id&&(x.id===e.project||x.project===e.id||x.topic?.sources.some(s=>s.id===e.id)));
 return {state:e.current_state||statuses[e.status]||'已收录',checked:'更新于 '+(e.updated||e.date||'').slice(0,10),actions:[],sections,webpages:(e.resources||[]).filter(r=>r.kind==='link'&&r.group!=='files'&&safeSource(r.url)).map(r=>({title:r.title,url:r.url})),sources:related.map(x=>({id:x.id,title:x.title,date:x.date,related:true}))};
}
function appendArchiveDownload(e,host){
 const details=create('details','archive-files');details.append(create('summary','','归档清单与打包下载'));const actions=create('div','reader-actions'),b=create('button','','下载网页档案 ZIP');b.onclick=()=>busy(b,async()=>{const epoch=state.epoch,files=[];for(const f of e.files)files.push({name:e.id+'/'+f.name,data:await asset(f)});files.push({name:e.id+'/WEB-MANIFEST.json',data:new TextEncoder().encode(JSON.stringify({resources:e.resources||[],omitted_files:e.omitted_files||[],note:'仅含已上传文件；外链和本地索引不是原文件备份。'},null,2))});if(epoch===state.epoch)download(e.id+'.zip',makeZip(files),'application/zip');});actions.append(b);details.append(actions);mountFileBrowser(e,details,{internal:true});host.append(details);
}
'use strict';
function renderTopic(e,host){
 const t=e.topic||defaultTopic(e);host.classList.add('topic-page');
 const section=(id,title)=>{const s=create('section','topic-section');s.id='topic-'+id;s.append(create('h2','',title));return s;};
 host.append(create('p','eyebrow','KOA-OL / 持续维护的主题'),create('h1','reader-title',e.title),create('p','topic-summary',e.summary));
 const front=(e.resources||[]).find(r=>r.presentation==='frontpage'&&r.kind==='file'&&/\.html?$/i.test(r.file)&&e.files.some(f=>f.name===r.file));
 if(front){const node=create('section','entry-front');host.append(node);const f=e.files.find(f=>f.name===front.file),epoch=state.epoch;asset(f).then(raw=>{if(epoch===state.epoch&&node.isConnected)return renderHTML(e,f.name,new TextDecoder().decode(raw),node,false,true);}).catch(()=>{if(node.isConnected)node.append(link('打开门面文件',href(e.id,f.name)));});}
 else if(!t.image&&e.cover_kind==='screenshot'){const fig=create('figure','topic-figure'),img=create('img');img.alt=e.title+'的截图';img.src=safeCover(e.cover||'');if(state.unlocked&&e.cover_asset)loadCover(img,e.cover_asset);fig.append(img);host.append(fig);}
 if(!front&&t.image){const fig=create('figure','topic-figure');const im=create('img');im.alt=t.image.alt;im.width=t.image.width;im.height=t.image.height;const f=e.files.find(f=>f.name===t.image.file);if(f){const epoch=state.epoch;asset(f).then(raw=>{if(epoch===state.epoch&&im.isConnected)im.src=blobURL(new Blob([raw],{type:'image/png'}));}).catch(()=>{fig.replaceChildren(create('p','reader-meta','截图暂未载入，可从文件区打开原图。'));});fig.append(im,create('figcaption','',t.image.caption));host.append(fig);}}
 const status=section('status','当前状态与操作入口');status.append(create('p','',t.state),create('p','reader-meta',t.checked));const actions=create('div','topic-actions');for(const l of t.actions)actions.append(link(l.title,l.url));status.append(actions);host.append(status);
 const toc=create('nav','topic-toc');toc.setAttribute('aria-label','主题目录');toc.append(create('span','','本页目录'));for(const s of [...t.sections,{id:'webpages',title:'网页'},{id:'files',title:'文件'},{id:'history',title:'历史与来源'},...(state.unlocked?[{id:'prompts',title:'用户原话'}]:[])]){const a=create('a','',s.title);a.href='#topic-'+s.id;toc.append(a);}host.append(toc);
 for(const s of t.sections){const node=section(s.id,s.title);for(const p of s.paragraphs||[])node.append(create('p','',p));for(const image of s.images||[])node.append(topicGalleryFigure(e,image));if(s.items){const ul=create('ul','topic-items');for(const item of s.items){const li=create('li');li.append(create('strong','',item.title),create('p','',item.body));if(item.entry){const target=state.entries.find(x=>x.id===item.entry);li.append(link('打开 '+(target?.title||item.title),href(item.entry)));}ul.append(li);}node.append(ul);}host.append(node);}
 const web=section('webpages','网页');const webRows=create('div','topic-rows');for(const l of t.webpages)webRows.append(link(l.title,l.url));web.append(webRows);host.append(web);
 const files=section('files','文件');mountFileBrowser(e,files);appendArchiveDownload(e,files);host.append(files);
 const history=section('history','历史与来源');const hrows=create('div','topic-rows');for(const source of t.sources){const row=create('div','topic-file');row.append(link(source.title,href(source.id)),create('small','reader-meta',source.date));hrows.append(row);}history.append(hrows);host.append(history);
 if(state.unlocked&&(e.prompt_records?.length||e.source_records?.some(s=>s.prompt_records?.length)||t.sources.some(s=>!s.related&&state.entries.find(x=>x.id===s.id)?.prompt_records?.length))){
  const prompts=section('prompts','用户原话');
  prompts.append(create('p','reader-meta','按真实来源会话展示，保持原顺序；原话仅馆主可见。'));
  const groups=[...(e.source_records||[])];
  if(e.prompt_records?.length)groups.push({title:'本条目保存的来源原话',session:e.session,prompt_records:e.prompt_records});
  for(const source of t.sources.filter(s=>!s.related)){const journal=state.entries.find(x=>x.id===source.id);if(journal?.prompt_records?.length)groups.push({title:source.title,session:journal.session,prompt_records:journal.prompt_records});}
  const seen=new Set();
  for(const source of groups){
   const session=source.session||{},key=session.id?session.provider+':'+session.id:null;if(key&&seen.has(key))continue;if(key)seen.add(key);
   const group=create('details','topic-prompt-group');group.open=true;
   group.append(create('summary','',source.title+' · '+source.prompt_records.length+' 条'));
   for(const p of source.prompt_records){const d=create('details','prompt');d.open=true;d.append(create('summary','',String(p.ordinal).padStart(2,'0')+' / '+(p.timestamp||'用户原话')),create('pre','',p.text));group.append(d);}
   prompts.append(group);
  }
  host.append(prompts);
 }

 for(const node of [...host.querySelectorAll('.topic-section')]){if(node.id==='topic-status')continue;const meaningful=node.querySelector('a,button,details,.file-browser')||node.querySelector('p')?.textContent;if(node.children.length<=2&&!meaningful){toc.querySelector('a[href="#'+node.id+'"]')?.remove();node.remove();}}
 const extra=(e.resources||[]).filter(r=>r.kind==='note'||r.kind==='local');if(extra.length){const node=section('notes','补充资料与原件索引');for(const r of extra){node.append(create('h3','',r.title));if(r.description)node.append(create('p','',r.description));if(r.kind==='local'){node.append(create('p','reader-meta','原文件索引 · 未备份'),create('p','reader-meta',r.path||''));if(r.reason)node.append(create('p','reader-meta',r.reason));if(Number.isFinite(r.bytes))node.append(create('p','reader-meta',sizeLabel(r.bytes)));if(r.sha256)node.append(create('p','reader-meta','SHA256 · '+r.sha256));}}host.append(node);const a=create('a','','补充资料与原件索引');a.href='#topic-notes';toc.append(a);}
 for(const a of [...toc.querySelectorAll('a')])if(!host.querySelector(a.getAttribute('href')))a.remove();
 enhanceTopicReading(host);
}

// Opt-in reading layout; source records and their permissions remain unchanged.
let disposeTopicReading=()=>{};
function enhanceTopicReading(host){
 host.classList.add('topic-reading');
 const layout=create('div','topic-reading-layout'),aside=create('aside','topic-reading-aside'),prose=create('div','topic-reading-prose');
 const toc=host.querySelector('.topic-toc'),details=create('details'),summary=create('summary','','本页目录');details.open=true;
 toc.querySelector('span')?.remove();details.append(summary,toc);aside.append(details);layout.append(aside,prose);
 const chapters=[...host.querySelectorAll('.topic-section')].filter(n=>n.id!=='topic-status');
 chapters.forEach((n,i)=>{const h=n.querySelector('h2');const head=create('header','topic-chapter-head'),number=create('span','topic-chapter-number',String(i+1).padStart(2,'0'));number.setAttribute('aria-hidden','true');h.before(head);head.append(number,h);prose.append(n);});host.append(layout);
 const links=[...toc.querySelectorAll('a')];
 function update(){let current=0;for(let i=0;i<chapters.length;i++)if(chapters[i].getBoundingClientRect().top<innerHeight*.35)current=i;if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)current=chapters.length-1;links.forEach((a,i)=>i===current?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));}
 addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
 disposeTopicReading=()=>{removeEventListener('scroll',update);removeEventListener('resize',update);host.classList.remove('topic-reading');disposeTopicReading=()=>{};};
}

function topicGalleryFigure(e,image){
 const fig=create('figure','topic-figure'),img=create('img');img.alt=image.alt;img.width=image.width;img.height=image.height;
 const caption=create('figcaption','',image.caption+' ');caption.append(link('打开原图',href(e.id,image.file)));fig.append(img,caption);
 const f=e.files.find(f=>f.name===image.file),epoch=state.epoch;
 if(f)asset(f).then(raw=>{if(epoch===state.epoch&&img.isConnected)img.src=blobURL(new Blob([raw],{type:'image/png'}));}).catch(()=>{if(img.isConnected)img.replaceWith(create('p','','图片暂未载入，请打开原图重试。'));});
 return fig;
}
