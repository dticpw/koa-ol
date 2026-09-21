import { populateDeckSelect } from '../src/saved-decks.js';
import {timeoutNotice} from '../src/timeout-notice.js';
import {esc,nickname,request,act} from '/games/table-client.js';
const game=document.body.dataset.game, $=id=>document.getElementById(id);
let initialLoaded=false, tables=[],busy=false,current=null,lastSignature='',pokerSignature='',polling=false,noticeTimer,clockOffset=0;
const timeout=timeoutNotice($('timeout-notice'),id=>action(id,{type:'stay'}));
const decks=populateDeckSelect($('lobby-deck'));
const pickedDeck=()=>decks.find(d=>d.id===$('lobby-deck').value)||decks[0];
$('apply-deck').addEventListener('click',()=>{const mine=tables.find(t=>t.seats.some(p=>p?.you));if(!mine){notice('已选择，入座时将使用这套牌组。');return;}const d=pickedDeck();action(mine.id,{type:'deck',deck:d.entries,deckName:d.name});});
const name=$('nickname');name.value=nickname();name.addEventListener('input',()=>nickname(name.value));
const positions=game==='texas'?[[18,14],[50,12],[82,14],[89,50],[82,86],[50,88],[18,86],[11,50]]:[[50,14],[50,86]];
function notice(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,7000);}
try{const message=sessionStorage.getItem('koa-seat-notice');if(message){notice(message);sessionStorage.removeItem('koa-seat-notice');}}catch{}
function playLink(t){return `/games/ace-21/?table=${t.id}`;}
function render(){
 const signature=JSON.stringify(tables);if(signature===lastSignature)return;
 // Keep an unfinished settings edit and keyboard focus through remote seat updates.
 const focus=document.activeElement,focusId=focus?.id,selection=focus?.selectionStart;
 const drafts=[...document.querySelectorAll('.host-settings')].map(d=>({id:d.dataset.id,open:d.open,values:[...d.querySelectorAll('input')].map(i=>[i.id,i.value])}));
 $('tables').innerHTML=tables.map(t=>{
 const people=t.seats.filter(Boolean),me=people.find(p=>p.you),host=me?.host,waiting=t.status==='waiting';
 return `<article class="table-card ${game}" data-table="${t.id}"><header class="table-heading"><h2><small>TABLE</small>${t.id}</h2><span class="table-status ${t.status}">${waiting?'等待开局':'对局中'} · ${people.length}/${t.capacity} 人</span></header><div class="seat-map"><div class="felt"><b>${game==='texas'?"TEXAS HOLD’EM":'ACE 21'}</b><span>${game==='texas'?'2 人起开局':'满 2 人，由房主开始'}</span></div>${t.seats.map((p,i)=>`<button class="seat-button ${p?'occupied':''} ${p?.you?'mine':''}" style="--x:${positions[i][0]}%;--y:${positions[i][1]}%" data-sit="${i}" data-table="${t.id}" ${p||!waiting?'disabled':''} aria-label="${i+1}号座${p?'：'+esc(p.name)+(p.host?'，房主':''):'，点击入座'}"><span>${p?esc(p.name):'＋ 入座'}</span><small class="${p?.host?'crown':''}">${p?`${p.you?'你 · ':''}${p.host?'♛ 房主':'玩家'}${p.online?'':' · 离线'}`:`${i+1} 号座`}</small></button>`).join('')}</div><p class="table-summary">${game==='texas'?`盲注 ${t.settings.smallBlind} / ${t.settings.bigBlind} · 起始 ${t.settings.initialChips} · 每手上限 ${t.settings.maxBet}`:'双方 10 点生命 · 房主先手'}${t.message?'<br>'+esc(t.message):''}</p>${me?`<div class="table-controls"><p>${host?'♛ 你是房主':`房主：${esc(people.find(p=>p.host)?.name)}`} · 你在 ${me.seat+1} 号座 · ${esc(me.deckName||'初始牌组')}</p>${host&&game==='texas'&&waiting?`<details class="host-settings" data-id="${t.id}"><summary>房主面板 · 盲注与筹码</summary><form data-settings="${t.id}"><div class="settings-grid">${[['smallBlind','小盲注'],['bigBlind','大盲注'],['maxBet','每手下注上限'],['initialChips','起始筹码']].map(([k,label])=>`<label>${label}<input id="setting-${t.id}-${k}" name="${k}" type="number" min="1" max="100000" value="${t.settings[k]}" required></label>`).join('')}</div><div class="buttons"><button type="submit">保存设置</button><button type="button" data-reset="${t.id}">重置筹码</button></div><small>起始筹码用于新入座者；重置会将全桌筹码恢复到设定值。</small></form></details>`:''}<div class="buttons">${waiting&&host?`<button class="primary" data-start="${t.id}" ${people.length<2?'disabled':''}>${people.length<2?'等待另一位玩家':'开始游戏'}</button>`:waiting?'<span>等待房主开始游戏</span>':game==='ace21'?`<a href="${playLink(t)}">进入对局 →</a>`:`<button class="primary" data-watch="${t.id}">查看牌局 ↓</button>`}<button data-leave="${t.id}">离座</button></div></div>`:''}</article>`;
 }).join('');
 for(const d of drafts){const el=document.querySelector(`.host-settings[data-id="${d.id}"]`);if(el){el.open=d.open;for(const [id,value] of d.values)if($(id))$(id).value=value;}}
 if(focusId&&$(focusId)){ $(focusId).focus({preventScroll:true});try{$(focusId).setSelectionRange(selection,selection);}catch{} }
 lastSignature=signature;
}
const phaseNames={pre_flop:'翻牌前',flop:'翻牌',turn:'转牌',river:'河牌',showdown:'摊牌',finished:'本手结束'};
function cards(list){return `<div class="cards">${list.map(c=>`<span class="playing-card ${c==='XX'?'back':/[HD]$/.test(c)?'red':''}" aria-label="${c==='XX'?'隐藏底牌':esc(c)}">${c==='XX'?'♠':esc((c[0]==='T'?'10':c[0])+({H:'♥',D:'♦',C:'♣',S:'♠'}[c[1]]||''))}</span>`).join('')}</div>`;}
function renderPoker(data){
 if(Number.isFinite(data?.serverNow))clockOffset=Date.now()-data.serverNow;
 const previous=current;current=data;const g=data?.poker;if(!g){$('poker').hidden=true;pokerSignature='';return;}
 const entering=!previous?.poker||previous.id!==data.id||previous.poker.hand!==g.hand;
 const sig=JSON.stringify({...data,serverNow:undefined});if(sig===pokerSignature)return;pokerSignature=sig;
 const own=g.players[data.you],turn=g.current_player===data.you,call=Math.max(0,g.current_bet-(own?.current_bet||0));
 const min=call+(g.current_bet?g.min_raise:g.big_blind),max=Math.max(0,Math.min(own?.chips||0,g.max_bet_per_hand-(own?.total_bet||0)));
 const amount=$('bet-amount')?.value,hadFocus=document.activeElement?.id==='bet-amount';
 $('poker').hidden=false;$('poker').innerHTML=`<header class="poker-head"><div><h2>${data.id} 号桌 · ${phaseNames[g.phase]||g.phase}</h2><small>第 ${data.hand} 手 · 盲注 ${g.small_blind} / ${g.big_blind}</small></div><a href="#tables">返回座位区 ↑</a></header><div class="board"><span class="pot">底池 ${g.pot}</span>${cards(g.community_cards.length?g.community_cards:['XX','XX','XX','XX','XX'])}</div><div class="poker-players">${Object.entries(g.players).map(([id,p],i)=>`<section class="poker-player ${g.current_player===id?'is-turn':''} ${p.status==='folded'?'folded':''}"><h3>${esc(p.username)} ${id===data.you?'· 你':''} ${i===g.dealer_position?'ⓓ':''}</h3>${cards(p.hole_cards)}<p>筹码 ${p.chips} · 本轮下注 ${p.current_bet}</p><span class="is-turn-tag">${g.current_player===id?'▶ 正在行动':p.status==='folded'?'已弃牌':p.last_action?({call:'跟注',check:'过牌',raise:'加注',bet:'下注',fold:'弃牌'}[p.last_action]||p.last_action):'等待'}</span></section>`).join('')}</div>${g.phase==='finished'?`<div class="poker-results">${Object.values(g.game_results).filter(p=>p.is_winner).map(p=>`${esc(p.username)} 赢得 ${p.winnings} 筹码${p.hand_name?' · '+esc(p.hand_name):''}`).join('<br>')}</div><p>本手已结束，返回座位区，由房主开始下一手。</p>`:`<p class="turn-banner" role="status">${turn?'轮到你行动':`等待 ${esc(g.players[g.current_player]?.username)} 行动`} · <span id="countdown"></span></p><div class="poker-actions"><button data-move="fold" ${turn?'':'disabled'}>弃牌</button><button data-move="${call?'call':'check'}" ${turn?'':'disabled'}>${call?'跟注 '+call:'过牌'}</button><label>本次投入筹码<input id="bet-amount" type="number" min="${min}" max="${max}" value="${min}" step="1" ${turn&&max>=min?'':'disabled'}></label><button class="primary" data-move="${g.current_bet?'raise':'bet'}" ${turn&&max>=min?'':'disabled'}>${g.current_bet?'加注':'下注'}</button></div>`}<p class="poker-rules">本手最多投入 ${g.max_bet_per_hand} 筹码（取房主设置与最短起手筹码的较小值）。不提供主动全下。每次行动 30 秒，超时弃牌。</p>`;
 if(amount&&$('bet-amount'))$('bet-amount').value=amount;if(hadFocus)$('bet-amount')?.focus({preventScroll:true});countdown();
 // Bring every seated player to a new hand once; heartbeats must not steal scroll.
 if(entering)$('poker').scrollIntoView({behavior:'auto'});
}
function countdown(){if($('countdown'))$('countdown').textContent=`${Math.max(0,Math.ceil((current?.poker?.deadline||0)-(Date.now()-clockOffset)/1000))} 秒 · 超时自动弃牌`;}
setInterval(countdown,500);
async function refresh(){
 if(polling||busy)return;polling=true;
 try{const previous=tables;const wasLoaded=initialLoaded;const data=await request(`/tables/${game}`);tables=data.tables;initialLoaded=true;render();$('connection').textContent='● 大厅已连接 · 座位实时更新';const mine=tables.find(t=>t.seats.some(p=>p?.you));timeout.update(mine,data.serverNow);
 if(previous.some(t=>t.seats.some(p=>p?.you))&&!mine)notice('你的座位已释放，请重新选择空座。');
 if(game==='texas'){if(mine)renderPoker(await request(`/tables/${game}/${mine.id}`));else renderPoker(null);}
 else if(mine?.status==='playing'&&wasLoaded&&previous.find(t=>t.id===mine.id)?.status==='waiting')location.assign(playLink(mine));
 }catch(e){$('connection').textContent='连接中断，正在重试；座位暂时保留。';}finally{polling=false;}
}
async function action(id,a){if(busy)return;const t=tables.find(t=>t.id===id);if(!t)return;busy=true;
 try{const data=await act(game,t,a);tables=tables.map(v=>v.id===id?{...v,...data,host:data.seats.find(p=>p?.host)?.id}:v);lastSignature='';render();timeout.update(tables.find(t=>t.seats.some(p=>p?.you)),data.serverNow);if(game==='texas'){renderPoker(data);if(a.type==='start')$('poker').scrollIntoView({behavior:'auto'});}else if(data.status==='playing'&&a.type!=='stay')location.assign(playLink(data));if(a.type==='settings')notice('设置已保存，下一手生效。');}
 catch(e){notice(e.message);}finally{busy=false;await refresh();}}
$('tables').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.sit!==undefined){if(!name.value.trim()){name.value='';name.reportValidity();name.focus();return;}nickname(name.value);action(b.dataset.table,{type:'sit',seat:Number(b.dataset.sit),name:name.value.trim(),deck:pickedDeck().entries,deckName:pickedDeck().name});}
 if(b.dataset.start)action(b.dataset.start,{type:'start'});
 if(b.dataset.leave){const t=tables.find(t=>t.id===b.dataset.leave);if(t.status==='playing'&&!confirm(game==='ace21'?'离座将结束本场王牌对局，确定离座？':'离座会弃掉本手牌，确定离座？'))return;action(b.dataset.leave,{type:'leave'});}
 if(b.dataset.reset&&confirm('将全桌筹码重置为房主设置的起始值？'))action(b.dataset.reset,{type:'reset-chips'});
 if(b.dataset.watch)$('poker').scrollIntoView({behavior:'auto'});
});
$('tables').addEventListener('submit',e=>{const f=e.target.closest('[data-settings]');if(!f)return;e.preventDefault();action(f.dataset.settings,{type:'settings',settings:Object.fromEntries([...new FormData(f)].map(([k,v])=>[k,Number(v)]))});});
$('poker').addEventListener('click',e=>{const b=e.target.closest('[data-move]');if(!b||!current)return;const move=b.dataset.move;if(['raise','bet'].includes(move)&&!$('bet-amount').reportValidity())return;action(current.id,{type:'poker',move,amount:['raise','bet'].includes(move)?Number($('bet-amount').value):0});});
async function poll(){await refresh();setTimeout(poll,document.hidden?5000:1400);}poll();
