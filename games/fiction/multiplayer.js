'use strict';
(() => {
 const $=id=>document.getElementById(id),API='/api/fiction-rooms',play=document.body.dataset.multiplayer==='play';
 const number=Number(new URL(location.href).searchParams.get('table'));
 let you=null,table=null,inFlight=false,loading=false,lastSignature='',lastLog='',lastChat='',stopped=false,entries=[],historyRun=null,historyOlder=false;
 const storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{}}};
 const pendingKey='fiction.multi.resolve:'+number;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 function notice(text=''){ $('notice').textContent=text; }
 async function request(body,query='',retry=0){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),body?.op==='resolve'?165000:20000);
  try{const r=await fetch(API+query,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},credentials:'same-origin',cache:'no-store',...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});let d;try{d=await r.json();}catch{throw Error('连接返回异常，请刷新重试。');}if(!r.ok){
   // Two players can submit together. A rejected short write has not executed;
   // retry the same round after jitter, retaining all server authorization checks.
   if(d.code==='table_busy'&&retry<3&&['join','leave','start','act','withdraw','close','pause','resume'].includes(body?.op)){clearTimeout(timer);await new Promise(resolve=>setTimeout(resolve,600+Math.random()*600));return request(body,query,retry+1);}
   const e=new Error(d.error||'操作没有完成。');e.code=d.code;throw e;}return d;}finally{clearTimeout(timer);}
 }
 function errorMessage(e){return e.name==='AbortError'?'连接超时，进度可能仍在处理中。请刷新查看，不必重复声明行动。':e.message||'连接暂时中断，请稍后刷新。';}
 async function mutation(body){
  if(inFlight)return;inFlight=true;renderBusy();notice();
  try{const result=await request(body);await refresh(true);return result;}
  catch(e){notice(errorMessage(e));await refresh(false);return null;}
  finally{inFlight=false;renderBusy();}
 }
 function renderBusy(){if(!play)return;const disabled=inFlight||!!table?.busy||!!table?.game?.ended||!table?.game||table?.status==='paused';
  for(const id of ['submit-action','hold','withdraw','advance'])if($(id))$(id).disabled=disabled||(id==='advance'&&table.members.some(p=>!table.game?.drafts[p.id]));
  $('leave').disabled=inFlight||!!table?.busy||!table?.members.some(p=>p.id===you?.id);
  $('close').disabled=inFlight||!!table?.busy;
  for(const id of ['pause','resume'])if($(id))$(id).disabled=inFlight||!!table?.busy;
  $('thinking').hidden=!(table?.busy||inFlight&&table?.game);
 }
 function button(label,fn,secondary=false){const b=el('button',label,secondary?'secondary':'');b.type='button';b.addEventListener('click',fn);return b;}
 function playURL(n){return '/games/fiction/prisoner-13/play/?table='+n;}
 async function identity(){const name=$('player-name').value.trim();if(!name){notice('先给自己起一个名字，再上桌。');$('player-name').focus();return false;}if(you&&you.name===name)return true;
  try{const d=await request({op:'hello',name});you=d.you;storage.set('koa-games-nickname',you.name);$('identity-id').textContent='ID · '+you.id;return true;}catch(e){notice(errorMessage(e));return false;}
 }
 function renderLobby(data){
  you=data.you;if(you){$('identity-id').textContent='ID · '+you.id;if(!$('player-name').value)$('player-name').value=you.name;}
  const sig=JSON.stringify([data.you,data.tables,data.saves,data.hosts]);if(sig===lastSignature)return;lastSignature=sig;
  const rows=data.tables.map(t=>{const row=el('article',undefined,'table-row'+(you?.table===t.number?' mine':''));row.setAttribute('aria-label','第'+t.number+'桌');
   const no=el('div',String(t.number),'table-number');no.append(el('small',`${t.members.length} / ${t.maxPlayers} · ${t.status==='waiting'?'等待同伴':t.status==='ended'?'已结束':t.status==='paused'?'等候原队员':'冒险中'}`));
   const seats=el('div',undefined,'seats');for(const p of t.members){const seat=el('span',p.name+(p.id===t.hostId?' · 房主':''),'seat');seat.append(el('small',p.id+(p.id===you?.id?' · 你':'')));seats.append(seat);}if(!t.members.length)seats.append(el('span','空席 · 等待第一位冒险者','seat empty'));
   const controls=el('div',undefined,'table-controls');
   if(you?.table===t.number){
    if(t.status==='waiting'&&t.hostId===you.id){
     const label=el('label','主持','host-picker'),select=el('select');select.setAttribute('aria-label','第 '+t.number+' 桌主持');
     for(const h of data.hosts||[{id:'gpt-5.6-sol',label:'GPT-5.6 Sol',available:true}]){const option=el('option',h.label+(h.available?'':' · 暂未开放'));option.value=h.id;option.disabled=!h.available;select.append(option);}
     const preferred=storage.get('fiction.host-model');if([...select.options].some(o=>o.value===preferred&&!o.disabled))select.value=preferred;
     select.disabled=t.busy;select.addEventListener('change',()=>storage.set('fiction.host-model',select.value));label.append(select);controls.append(label);
     const b=button(t.members.length<t.minPlayers?`还差 ${t.minPlayers-t.members.length} 人`:'开局',async()=>{const result=await mutation({op:'start',table:t.number,hostModel:select.value,requestId:crypto.randomUUID()});if(result)location.href=playURL(t.number);});b.disabled=t.busy||t.members.length<t.minPlayers;controls.append(b);}
    else if(t.status==='waiting')controls.append(el('span','等待房主开局','identity-id'));
    else{const a=el('a','进入冒险');a.href=playURL(t.number);controls.append(a);}
    const leave=button('离桌',async()=>{if(t.status!=='waiting'&&!confirm('离桌会暂停冒险，原队员可返回。最后一位离桌时会自动保存到“未完的冒险”。继续吗？'))return;await mutation({op:'leave',table:t.number});},true);leave.disabled=t.busy;controls.append(leave);
   }else{const b=button(t.canRejoin?'返回原角色':t.status!=='waiting'?'已开局':t.members.length>=t.maxPlayers?'满员':'上桌',async()=>{if(inFlight)return;if(!await identity())return;await mutation({op:'join',table:t.number});});b.disabled=t.busy||t.status!=='waiting'&&!t.canRejoin||t.members.length>=t.maxPlayers||you?.table!=null;controls.append(b);}
   row.append(no,seats,controls);return row;});$('table-list').replaceChildren(...rows);
  if($('saved-list')){const saves=data.saves||[];$('saved-section').hidden=!saves.length;$('saved-list').replaceChildren(...saves.map(saved=>{const row=el('article',undefined,'save-row');row.append(el('strong',saved.title));const select=el('select');select.setAttribute('aria-label','恢复 '+saved.title+' 的桌位');for(const t of data.tables.filter(t=>t.status==='waiting'&&!t.busy&&!t.members.length)){const o=el('option','第 '+t.number+' 桌');o.value=t.number;select.append(o);}const b=button('恢复冒险',async()=>{const r=await mutation({op:'restore',table:Number(select.value),runId:saved.runId});if(r)location.href=playURL(Number(select.value));});b.disabled=!select.options.length||you?.table!=null;row.append(select,b);return row;}));}
  const mine=data.tables.find(t=>t.number===you?.table);if(mine&&['playing','paused'].includes(mine.status))location.href=playURL(mine.number);
 }
 function renderPlay(data){
  const previousGame=table?.game;you=data.you;table=data.table;$('room-number').textContent='冒险桌 / '+number;
  const g=table.game;if(g){if(historyRun!==g.runId){entries=[];historyRun=g.runId;historyOlder=false;lastLog='';lastChat='';}if(!entries.length||g.history.first!==null&&g.history.first<=entries[0].seq)historyOlder=g.history.hasOlder;const merged=new Map(entries.map(e=>[e.seq,e]));for(const e of g.log)merged.set(e.seq,e);entries=[...merged.values()].sort((a,b)=>a.seq-b.seq);g.log=entries;}if(g&&previousGame&&g.round>previousGame.round&&$('action').value.trim()===previousGame.drafts[you?.id]?.text)$('action').value='';$('room-content').hidden=!g;$('room-empty').hidden=!!g;
  if(!g){$('room-state').textContent=you?.table===number?'等待房主开局':'尚未加入此桌';renderBusy();return;}
  $('room-state').textContent=`${g.location} · 第 ${g.round} 轮 · ${g.ended?'冒险已结束':table.status==='paused'?'已暂停 · 等候原队员':table.members.length+' 位同伴'} · 主持：${g.modelLabel||'GPT-5.6 Sol'}`;
  $('export').disabled=false;$('close').hidden=table.hostId!==you.id;$('advance').hidden=table.hostId!==you.id||g.ended;$('action-form').hidden=g.ended;
  $('pause').hidden=table.hostId!==you.id||g.ended;$('resume').hidden=table.hostId!==you.id||table.status!=='paused';$('older').hidden=!historyOlder;
  let pending;try{pending=JSON.parse(storage.get(pendingKey));}catch{}
  if(pending&&(pending.runId!==g.runId||g.round>pending.round)){storage.set(pendingKey,null);pending=null;}
  $('advance').textContent=pending?'重试 / 查看本轮结算':'请主持推进';
  const sig=JSON.stringify(g.log);if(sig!==lastLog){lastLog=sig;const log=$('story-log'),nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<110;log.replaceChildren(...g.log.map(x=>{const n=el('article',undefined,'log-entry '+x.role);n.append(el('span',`${x.name} · 第 ${x.round} 轮`,'speaker'),document.createTextNode(x.text));return n;}));if(nearBottom||g.round===0)log.scrollTop=log.scrollHeight;}
  $('roster').replaceChildren(...table.members.map(p=>{const li=el('li',p.name+(p.id===table.hostId?' · 房主':'')+(p.id===you.id?' · 你':''));li.append(el('small',p.id));const d=g.drafts[p.id];li.append(el('span',d?'已提交':'尚未声明',d?'ready-mark':''));if(d)li.append(el('div',d.text,'draft-text'));return li;}));
  const ready=table.members.filter(p=>g.drafts[p.id]).length;$('readiness').textContent=g.ended?'可导出故事后离桌。':table.status==='paused'?'请等待原队员返回，由房主点击“继续冒险”，然后重新声明行动；也可以休局保存。':`${ready} / ${table.members.length} 人已提交。${ready===table.members.length?'等待房主推进。':'每位队员可以行动或原地观察。'}`;
  $('withdraw').hidden=!g.drafts[you.id]||g.ended;$('submit-action').textContent=g.drafts[you.id]?'更新行动':'提交行动';
  $('inventory').replaceChildren(...g.inventory.map(i=>el('li',i.name+'：'+i.condition)));
  const chatSig=JSON.stringify(g.chat);if(chatSig!==lastChat){lastChat=chatSig;$('chat-log').replaceChildren(...g.chat.map(x=>{const n=el('div',undefined,'chat-message');n.append(el('strong',x.name+'：'),document.createTextNode(x.text));return n;}));$('chat-log').scrollTop=$('chat-log').scrollHeight;}
  renderBusy();
 }
 async function refresh(showError=true){if(loading||stopped)return;loading=true;try{const data=await request(null,play?'?table='+number+'&window=1'+(entries.length?'&after='+entries.at(-1).seq:''):'?story=prisoner-13');if(play)renderPlay(data);else renderLobby(data);}catch(e){if(showError)notice(errorMessage(e));}finally{loading=false;}}
 $('refresh').addEventListener('click',()=>refresh(true));
 if(!play){
  $('player-name').value=storage.get('koa-games-nickname')||'';
  $('identity-form').addEventListener('submit',async e=>{e.preventDefault();notice();if(await identity()){notice('名字已保存。');await refresh();}});
 }else{
  if(!Number.isSafeInteger(number)||number<20000||number>20003){stopped=true;notice('桌号无效，请返回剧本详情页选择桌位。');$('room-empty').hidden=false;return;}
  $('action-form').addEventListener('submit',async e=>{e.preventDefault();if(!table?.game)return;const text=$('action').value.trim();if(!text)return;await mutation({op:'act',table:number,round:table.game.round,text,hold:false});});
  $('hold').addEventListener('click',()=>mutation({op:'act',table:number,round:table.game.round,hold:true}));
  $('withdraw').addEventListener('click',()=>mutation({op:'withdraw',table:number,round:table.game.round}));
  $('advance').addEventListener('click',async()=>{if(inFlight||!table?.game)return;let p;try{p=JSON.parse(storage.get(pendingKey));}catch{}if(!p||p.runId!==table.game.runId||p.round!==table.game.round){p={runId:table.game.runId,round:table.game.round,requestId:crypto.randomUUID()};storage.set(pendingKey,JSON.stringify(p));}const result=await mutation({op:'resolve',table:number,round:p.round,requestId:p.requestId});if(result)storage.set(pendingKey,null);});
  $('chat-form').addEventListener('submit',async e=>{e.preventDefault();const input=$('chat'),text=input.value.trim();if(!text)return;const b=e.submitter;b.disabled=true;try{await request({op:'chat',table:number,text,requestId:crypto.randomUUID()});if(input.value.trim()===text)input.value='';await refresh(false);}catch(err){notice(errorMessage(err));}finally{b.disabled=false;}});
  $('pause').addEventListener('click',async()=>{const title=prompt('给这段未完的冒险起个名字','冰海中的同路人');if(title===null)return;if(await mutation({op:'pause',table:number,title:title.slice(0,80)})){stopped=true;location.href='../#saved-section';}});
  $('resume').addEventListener('click',()=>mutation({op:'resume',table:number}));
  $('older').addEventListener('click',async()=>{if(!entries.length)return;const b=$('older');b.disabled=true;try{const d=await request(null,'?table='+number+'&window=1&before='+entries[0].seq);const empty=!d.table.game.log.length;renderPlay(d);if(empty){historyOlder=false;b.hidden=true;}else $('story-log').scrollTop=0;}catch(e){notice(errorMessage(e));}finally{b.disabled=false;}});
  $('leave').addEventListener('click',async()=>{if(!confirm('离桌会暂停冒险并保留原角色；最后一位离桌时自动保存。之后可以使用原浏览器回来继续。确定离桌？'))return;if(await mutation({op:'leave',table:number})){stopped=true;location.href='../#tables';}});
  $('close').addEventListener('click',async()=>{if(!confirm('这会让所有队员离桌并收起本局。请先导出故事，并确认同伴同意结束。继续？'))return;if(await mutation({op:'close',table:number})){stopped=true;location.href='../#tables';}});
  $('export').addEventListener('click',async()=>{let g=table?.game;if(!g)return;const exportingRun=g.runId;const title=prompt('给这段共同冒险起个名字','冰海中的同路人');if(title===null)return;try{g=(await request(null,'?table='+number)).table.game;}catch(e){notice(errorMessage(e));return;}if(!g||g.runId!==exportingRun){notice('冒险已休局或收起，请恢复后再导出。');return;}const text=`# ${title.trim()||'13号囚犯'}\n\n剧本：13号囚犯 · 非官方合作叙事改编\n原作：Wizards of the Coast / Keys from the Golden Vault\n桌号：${number}\n\n`+g.log.map(x=>`## ${x.name} · 第 ${x.round} 轮\n\n${x.text}\n`).join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'})),a=el('a');a.href=url;a.download=(title.replace(/[\\/:*?"<>|]/g,'_').slice(0,60)||'冒险记录')+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 }
 refresh();setInterval(()=>{if(!document.hidden)refresh(false);},4000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
})();
