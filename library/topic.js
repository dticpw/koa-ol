'use strict';
function renderTopic(e,host){
 const t=e.topic;host.classList.add('topic-page');
 const section=(id,title)=>{const s=create('section','topic-section');s.id='topic-'+id;s.append(create('h2','',title));return s;};
 host.append(create('p','eyebrow','KOA-OL / 持续维护的主题'),create('h1','reader-title',e.title),create('p','topic-summary',e.summary));
 if(t.image){const fig=create('figure','topic-figure');const im=create('img');im.alt=t.image.alt;im.width=t.image.width;im.height=t.image.height;const f=e.files.find(f=>f.name===t.image.file);if(f){const epoch=state.epoch;asset(f).then(raw=>{if(epoch===state.epoch&&im.isConnected)im.src=blobURL(new Blob([raw],{type:'image/png'}));}).catch(()=>{fig.replaceChildren(create('p','reader-meta','截图暂未载入，可从文件区打开原图。'));});fig.append(im,create('figcaption','',t.image.caption));host.append(fig);}}
 const status=section('status','当前状态与操作入口');status.append(create('p','',t.state),create('p','reader-meta',t.checked));const actions=create('div','topic-actions');for(const l of t.actions)actions.append(link(l.title,l.url));status.append(actions);host.append(status);
 const toc=create('nav','topic-toc');toc.setAttribute('aria-label','主题目录');toc.append(create('span','','本页目录'));for(const s of [...t.sections,{id:'webpages',title:'网页'},{id:'files',title:'文件'},{id:'history',title:'历史与来源'},...(state.unlocked?[{id:'prompts',title:'用户原话'}]:[])]){const a=create('a','',s.title);a.href='#topic-'+s.id;toc.append(a);}host.append(toc);
 for(const s of t.sections){const node=section(s.id,s.title);for(const p of s.paragraphs||[])node.append(create('p','',p));for(const image of s.images||[])node.append(topicGalleryFigure(e,image));if(s.items){const ul=create('ul','topic-items');for(const item of s.items){const li=create('li');li.append(create('strong','',item.title),create('p','',item.body));if(item.entry){const target=state.entries.find(x=>x.id===item.entry);li.append(link('打开 '+(target?.title||item.title),href(item.entry)));}ul.append(li);}node.append(ul);}host.append(node);}
 const web=section('webpages','网页');const webRows=create('div','topic-rows');for(const l of t.webpages)webRows.append(link(l.title,l.url));web.append(webRows);host.append(web);
 const files=section('files','文件');mountFileBrowser(e,files);host.append(files);
 const history=section('history','历史与来源');const hrows=create('div','topic-rows');for(const source of t.sources){const row=create('div','topic-file');row.append(link(source.title,href(source.id)),create('small','reader-meta',source.date));hrows.append(row);}history.append(hrows);host.append(history);
 if(state.unlocked){const prompts=section('prompts','用户原话');prompts.append(create('p','reader-meta','按真实来源会话展示，保持原顺序；不合并或重新编写原话。'));const promptSources=e.prompt_records?.length?[{id:e.id,title:'本条目保存的完整来源会话快照'}]:t.sources;for(const source of promptSources){const journal=state.entries.find(x=>x.id===source.id);if(!journal?.prompt_records?.length)continue;const group=create('details','topic-prompt-group');group.open=true;group.append(create('summary','',source.title+' · '+journal.prompt_records.length+' 条'));for(const p of journal.prompt_records){const d=create('details','prompt');d.open=true;d.append(create('summary','',String(p.ordinal).padStart(2,'0')+' / '+(p.timestamp||'用户原话')),create('pre','',p.text));group.append(d);}prompts.append(group);}host.append(prompts);}
 if(t.layout==='reading-v2')enhanceTopicReading(host);
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
