'use strict';
(() => {
  const $=id=>document.getElementById(id), API=(document.body.dataset.api||'/api/fiction-lab')+'/archives';
  let game=null,busy=false,saving=false,libraryReady=false,initializing=null,selected=null,naming=null,readGeneration=0,listGeneration=0;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const date=value=>new Date(value).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});
  async function request(body,id){
    const r=await fetch(API+(id?'?id='+encodeURIComponent(id):''),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
    const data=await r.json();if(!r.ok)throw Error(data.error||'暂时无法读取收藏，请重试。');return data;
  }
  async function ready(){
    if(libraryReady)return;
    initializing ||= request().then(()=>{libraryReady=true;}).finally(()=>{initializing=null;});
    await initializing;
  }
  function controls(){
    $('save-adventure').disabled=!game||busy||saving;$('ending-save').disabled=!game||busy||saving;
    $('name-submit').disabled=saving||(!naming?.id&&busy);
  }
  function titleFor(archive){return `${date(archive.createdAt)} · ${archive.game.status==='ended'?'已结束的冒险':'进行中的快照'} · 第 ${archive.game.turn} 段`;}
  function story(target,view){
    target.replaceChildren();
    for(const entry of view.log||[]){const role=['player','narrator','system'].includes(entry.role)?entry.role:'narrator';target.append(node('p',(role==='player'?'你：':'')+entry.text,'archive-entry '+role));}
    if(view.ending){target.append(node('h3',view.ending.title),node('p',view.ending.text,'archive-entry'));}
    const facts=node('details',undefined,'archive-facts');facts.append(node('summary','最后所在、随身物品与发现'));
    facts.append(node('h3',view.location.name),node('p',view.location.description));
    facts.append(node('h3','随身物品'));if(!view.inventory.length)facts.append(node('p','没有随身物品。'));
    view.inventory.forEach(item=>facts.append(node('h3',item.name),node('p',item.description)));
    facts.append(node('h3','探查记录'));view.clues.forEach(item=>facts.append(node('h3',item.title),node('p',item.text)));
    target.append(facts);
  }
  function show(archive){selected=archive;$('archive-title').textContent=archive.title;$('archive-meta').textContent=titleFor(archive);$('archive-status').textContent='';story($('archive-body'),archive.game);if(!$('archive-reader').open)$('archive-reader').showModal();}
  async function read(id){
    const generation=++readGeneration;$('collection-status').textContent='正在翻开这段冒险…';
    try{const data=await request(null,id);if(generation!==readGeneration)return;show(data.archive);$('collection-status').textContent='';}
    catch(error){if(generation===readGeneration)$('collection-status').textContent=error.message;}
  }
  async function refresh(){
    const generation=++listGeneration;$('collection-status').textContent='正在读取收藏…';$('collection-refresh').disabled=true;
    try{await ready();const data=await request();if(generation!==listGeneration)return;
      $('collection-list').replaceChildren(...data.entries.map(entry=>{const li=node('li'),button=node('button',entry.title,'collection-entry');button.type='button';button.addEventListener('click',()=>read(entry.id));li.append(button,node('p',`${date(entry.createdAt)} · ${entry.status==='ended'?'已结束':'进行中快照'} · 第 ${entry.revision} 段`));return li;}));
      $('collection-status').textContent=data.entries.length?`已收藏 ${data.entries.length} 段冒险。`:'还没有收藏。为一段经历起名，它就会留在这里。';
    }catch(error){if(generation===listGeneration)$('collection-status').textContent=error.message;}
    finally{if(generation===listGeneration)$('collection-refresh').disabled=false;}
  }
  function openName(archive=null){
    if(saving||(!archive&&(!game||busy)))return;
    naming=archive?{id:archive.id}:{sessionId:game.sessionId,expectedRevision:game.revision};
    $('name-dialog-title').textContent=archive?'给这段冒险换个名字':'为这段冒险留名';
    $('name-context').textContent=archive?'只修改收藏标题，故事正文保持原样。':`保存第 ${game.turn} 段的完整记录${game.status==='ended'?'与结局':'；当前冒险仍可继续'}。`;
    $('adventure-name').value=archive?archive.title:$('ending-name').value;$('name-status').textContent='';controls();$('name-dialog').showModal();$('adventure-name').focus();
  }
  async function save(title,target,status){
    if(saving||(!target.id&&busy))return;
    saving=true;controls();status.textContent='正在收藏这段冒险…';
    try{
      await ready();const data=await request(target.id?{op:'rename',id:target.id,title}:{op:'save',...target,title});
      status.textContent=`已收藏《${data.archive.title}》。重开新局也会保留。`;
      if(!target.id&&game?.sessionId===target.sessionId&&game?.revision===target.expectedRevision){$('ending-name').value=data.archive.title;$('ending-save-status').textContent=status.textContent;}
      if($('name-dialog').open)$('name-dialog').close();
      if(target.id&&selected?.id===target.id)show(data.archive);
      else{if(!$('collection-dialog').open)$('collection-dialog').showModal();show(data.archive);}
      await refresh();
    }catch(error){status.textContent=error.name==='TimeoutError'?'保存等待超时，可以用同一个名字重试；不会重复收藏同一进度。':error.message;}
    finally{saving=false;controls();}
  }
  function download(content,type,suffix){
    const url=URL.createObjectURL(new Blob([content],{type}));const a=node('a');a.href=url;a.download=(selected.title.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,70)||'冒险')+suffix;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('collection-open').addEventListener('click',()=>{$('collection-dialog').showModal();refresh();});$('collection-refresh').addEventListener('click',refresh);
  $('collection-dialog').addEventListener('close',()=>{readGeneration++;});
  $('save-adventure').addEventListener('click',()=>openName());$('name-cancel').addEventListener('click',()=>$('name-dialog').close());
  $('name-form').addEventListener('submit',event=>{event.preventDefault();save($('adventure-name').value.trim(),naming,$('name-status'));});
  $('ending-name-form').addEventListener('submit',event=>{event.preventDefault();if(game)save($('ending-name').value.trim(),{sessionId:game.sessionId,expectedRevision:game.revision},$('ending-save-status'));});
  $('archive-rename').addEventListener('click',()=>{if(selected)openName(selected);});
  $('archive-delete').addEventListener('click',async()=>{
    if(!selected||saving)return;const archive=selected;
    if(!confirm(`删除收藏《${archive.title}》？当前游戏不受影响；删除后无法在收藏中找回。`))return;
    saving=true;controls();
    try{await request({op:'delete',id:archive.id});selected=null;$('archive-reader').close();await refresh();}
    catch(error){$('archive-status').textContent=error.message;}
    finally{saving=false;controls();}
  });
  $('archive-json').addEventListener('click',()=>{if(selected)download(JSON.stringify({format:'koa-fiction-adventure',version:1,attribution:selected.game.credits||{scenario:'门后的火光，改编自 Skerples《Tomb of the Serpent Kings》',source:'https://coinsandscrolls.blogspot.com/2017/06/osr-tomb-of-serpent-kings-megapost.html',license:'https://creativecommons.org/licenses/by-nc-sa/4.0/'},...selected},null,2),'application/json','.json');});
  $('archive-export').addEventListener('click',()=>{
    if(!selected)return;const doc=document.implementation.createHTMLDocument(selected.title);doc.documentElement.lang='zh-CN';
    const charset=doc.createElement('meta');charset.setAttribute('charset','UTF-8');doc.head.prepend(charset);
    const viewport=doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';doc.head.append(viewport);
    const style=doc.createElement('style');style.textContent='body{max-width:760px;margin:40px auto;padding:0 24px;background:#f4efe4;color:#292d27;font:17px/2 Georgia,"Songti SC",serif}h1{line-height:1.5;overflow-wrap:anywhere}.archive-entry{white-space:pre-wrap;overflow-wrap:anywhere}.player{border-left:2px solid #a6936c;padding-left:16px;color:#706448;font-size:14px}.archive-facts{border-top:1px solid #ccc7b7;margin-top:32px;padding-top:20px;font-size:14px}.archive-facts p{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:40px;border-top:1px solid #ccc7b7;padding-top:20px;font-size:12px}';doc.head.append(style);
    doc.body.append(node('h1',selected.title),node('p',titleFor(selected)));const article=node('article');story(article,selected.game);article.querySelectorAll('details').forEach(d=>d.open=true);doc.body.append(article,node('footer',selected.game.credits?`${selected.game.title} · ${selected.game.credits.adaptation} · ${selected.game.credits.author} · ${selected.game.credits.original} · ${[selected.game.credits.licenseText||selected.game.credits.license,selected.game.credits.source].filter(Boolean).join(' · ')}`:'门后的火光 · Koa 游艺室 · '+location.origin+'/games/lantern-tomb-lab/ · 场景改编自 Skerples《Tomb of the Serpent Kings》，CC BY-NC-SA 4.0（https://creativecommons.org/licenses/by-nc-sa/4.0/）。原作：https://coinsandscrolls.blogspot.com/2017/06/osr-tomb-of-serpent-kings-megapost.html'));
    download('<!doctype html>\n'+doc.documentElement.outerHTML,'text/html;charset=utf-8','.html');
  });
  window.addEventListener('fiction-view',event=>{
    const next=event.detail.game;if(game?.sessionId!==next?.sessionId||game?.revision!==next?.revision){$('ending-save-status').textContent='';if(game?.sessionId!==next?.sessionId)$('ending-name').value='';}
    game=next;controls();
  });
  window.addEventListener('fiction-busy',event=>{busy=event.detail;controls();});
  $('reset-dialog').addEventListener('close',()=>{if($('reset-dialog').returnValue==='archive')openName();});
})();
