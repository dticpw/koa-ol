import { buildCatalog, validateDeck, parseDeck, serializeDeck, loadCollection, STORAGE_KEY } from './deck-builder.js?v=103';
import { toneLabel } from './feedback.js?v=103';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog,index,rules,state,scope='ordinary',tone='all',selected=null,toastTimer,writeBlocked=false;
const fresh=()=>({id:crypto.randomUUID(),name:'未命名牌组',entries:[]});
const current=()=>state.decks.find(d=>d.id===state.active);
const result=()=>validateDeck(current().entries,catalog,rules);
const quantity=key=>current().entries.find(e=>e.key===key)?.count||0;
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function storageError(message){$('storage-alert').textContent=message;$('storage-alert').hidden=false;}
function persist(){
  if(writeBlocked){$('save-status').textContent='尚未保存；请先导出当前草稿';return;}
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$('save-status').textContent='已自动保存到当前浏览器';}
  catch{$('save-status').textContent='保存失败，请导出牌组备份';storageError('浏览器未能保存牌组。当前编辑仍可继续，请使用「导出牌组」保留内容。');}
}
function options(){const select=$('deck-select');select.replaceChildren(...state.decks.map(d=>new Option(d.name,d.id)));select.value=state.active;}
function rememberFocus(fn){const el=document.activeElement;const focusKey=el?.dataset.focus;fn();if(focusKey)document.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`)?.focus({preventScroll:true});}
function renderGrid(){
  const query=$('search').value.trim().toLocaleLowerCase();
  let cards=catalog.filter(c=>c.status===scope&&(tone==='all'||tone===c.tone)&&(!query||`${c.name} ${c.text}`.toLocaleLowerCase().includes(query)));
  const sort=$('sort').value;
  if(sort==='power')cards.sort((a,b)=>(a.power??Infinity)-(b.power??Infinity));
  if(sort==='power-desc')cards.sort((a,b)=>(b.power??-1)-(a.power??-1));
  if(sort==='name')cards.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true}));
  $('result-count').textContent=`${cards.length} 张卡牌`;
  $('scope-note').textContent=scope==='ordinary'?'数字与挑战按指定点数分别选入。同名牌不限数量，零牌力卡也计入30张。':scope==='special'?'希儿专属卡仅供查阅，不参与玩家组牌，也不计为零牌力卡。':'本批已采纳的新卡均已实装，可在普通王牌中组牌。';
  $('no-results').hidden=cards.length>0;
  const full=result().count>=rules.cardCount;
  $('card-grid').innerHTML=cards.map(c=>`<article class="catalog-card" data-tone="${c.tone}" data-key="${c.key}"><button class="art-button" data-detail="${c.key}" data-focus="detail-${c.key}" aria-label="查看${esc(c.name)}详情"><img src="../assets/trump-${c.art}.webp" alt="" loading="lazy"><span class="power-chip">${c.power===null?'希儿专属':`<b>${c.power}</b> 牌力`}</span><span class="detail-hint">查看详情 ↗</span></button><div class="card-copy"><span class="card-type">${toneLabel[c.tone]} · ${c.status==='planned'?'待实装':c.stay?'持续':'瞬时'}</span><h3>${esc(c.name)}</h3><p class="card-effect">${esc(c.text)}</p><div class="card-bottom"><span>${c.deckEligible?(quantity(c.key)?`已选 ${quantity(c.key)} 张`:'未加入'):c.status==='special'?'仅希儿使用':'牌效设计已采纳'}</span>${c.deckEligible?`<button class="add-card" data-add="${c.key}" data-focus="add-${c.key}" aria-label="加入${esc(c.name)}" ${full?'disabled':''}>${full?'已满30张':'＋ 加入'}</button>`:''}</div></div></article>`).join('');
}
function renderDeck(){
  const d=current(),r=result();
  $('deck-count').textContent=r.count;$('deck-power').textContent=r.power;
  $('count-meter').value=r.count;$('power-meter').value=r.power;
  $('count-meter').parentElement.classList.toggle('over',r.count>rules.cardCount);
  $('power-meter').parentElement.classList.toggle('over',r.power>rules.maxPower);
  $('deck-validity').textContent=r.valid?'✓ 满足组牌规则 · 可在开局前选择':r.errors.join(' · ');
  $('deck-validity').className=r.valid?'valid':r.power>rules.maxPower||r.count>rules.cardCount?'invalid':'';
  const entries=[...d.entries].sort((a,b)=>catalog.indexOf(index.get(a.key))-catalog.indexOf(index.get(b.key)));
  $('deck-list').innerHTML=entries.length?entries.map(e=>{const c=index.get(e.key);return `<div class="deck-row" data-tone="${c.tone}"><div class="row-info"><button data-detail="${c.key}" data-focus="row-${c.key}">${esc(c.name)}</button><small>${c.power} 牌力 × ${e.count} = ${c.power*e.count}</small></div><div class="quantity"><button data-remove="${c.key}" data-focus="minus-${c.key}" aria-label="移除一张${esc(c.name)}">−</button><input type="number" min="0" max="30" inputmode="numeric" value="${e.count}" data-count="${c.key}" data-focus="count-${c.key}" aria-label="${esc(c.name)}数量"><button data-add="${c.key}" data-focus="plus-${c.key}" aria-label="再加入一张${esc(c.name)}" ${r.count>=rules.cardCount?'disabled':''}>＋</button></div></div>`;}).join(''):'<div class="deck-empty">第一张王牌，由你来选。<small>点击图鉴中的「＋ 加入」开始组牌</small></div>';
  $('clear-deck').disabled=!entries.length;
}
function renderAll(){rememberFocus(()=>{renderGrid();renderDeck();});if(selected)updateDetailButton();}
function changeCard(key,delta){
  if(!index.get(key)?.deckEligible)return;
  if(delta>0&&result().count>=rules.cardCount){notify('牌组已满30张，请先移除卡牌');return;}
  const entries=current().entries,at=entries.findIndex(e=>e.key===key);
  if(at<0&&delta>0)entries.push({key,count:1});
  else if(at>=0){entries[at].count+=delta;if(entries[at].count<=0)entries.splice(at,1);}
  persist();renderAll();
}
function updateDetailButton(){const c=index.get(selected),full=result().count>=rules.cardCount;const button=$('detail-add');button.disabled=!c.deckEligible||full;button.textContent=!c.deckEligible?(c.status==='special'?'希儿专属 · 不参与组牌':'待实装 · 暂不能组牌'):full?'牌组已满30张':`加入牌组${quantity(c.key)?` · 已选${quantity(c.key)}张`:''}`;}
function showDetail(key){
  const c=index.get(key);if(!c)return;selected=key;
  $('detail-content').innerHTML=`<img class="detail-art" src="../assets/trump-${c.art}.webp" alt=""><p class="detail-meta">${toneLabel[c.tone]} · ${c.power===null?'希儿专属':`${c.power} 牌力`}${c.status==='planned'?' · 待实装':''}</p><h2 id="detail-title">${esc(c.name)}</h2><p class="detail-effect">${esc(c.text)}</p><p class="detail-note">${c.status==='ordinary'?`${c.stay?'持续牌，留在桌面时生效。':'瞬时牌，结算效果后不留在桌面。'}${c.powerStatus==='working-proposal'?'牌力为初始暂定值。':''}`:c.status==='special'?'仅用于希儿对战，不可加入玩家的30张牌组。':'已采纳设计，尚未接入规则引擎；完整交互与结算细节待定稿。'}</p>`;
  updateDetailButton();if(!$('card-detail').open)$('card-detail').showModal();
}
function switchDeck(id){state.active=id;document.querySelector('[data-scope=planned]').hidden=!catalog.some(c=>c.status==='planned');
    options();$('deck-name').value=current().name;renderAll();persist();}
function addDeck(deck=fresh()){state.decks.push(deck);switchDeck(deck.id);}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

async function init(){
  try{
    const responses=await Promise.all([fetch('../data/card-balance.json?v=103'),fetch('../data/planned-cards.json?v=103')]);
    if(responses.some(r=>!r.ok))throw new Error('卡牌资料加载失败');
    const [balance,planned]=await Promise.all(responses.map(r=>r.json()));rules=balance.deckRules;catalog=buildCatalog(balance,planned.cards);index=new Map(catalog.map(c=>[c.key,c]));
    try{state=loadCollection(localStorage.getItem(STORAGE_KEY),catalog,rules);}
    catch{writeBlocked=true;storageError('本地牌组暂时无法读取，原记录未覆盖。你仍可查看图鉴、编辑并导出新草稿；修复浏览器存储后刷新重试。');}
    if(!state){const d=fresh();state={version:1,decks:[d],active:d.id};}
    document.querySelector('[data-scope=planned]').hidden=!catalog.some(c=>c.status==='planned');
    options();$('deck-name').value=current().name;renderAll();
    $('save-status').textContent=writeBlocked?'自动保存不可用，请导出备份':'修改后自动保存到当前浏览器';
    $('load-status').hidden=true;$('workbench').hidden=false;
  }catch(e){$('load-status').textContent='卡牌档案加载失败，请刷新重试。';console.error(e);return;}
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.add)changeCard(b.dataset.add,1);
    if(b.dataset.remove)changeCard(b.dataset.remove,-1);
    if(b.dataset.detail)showDetail(b.dataset.detail);
    if(b.dataset.scope){scope=b.dataset.scope;tone='all';$('search').value='';document.querySelectorAll('[data-scope]').forEach(x=>x.setAttribute('aria-pressed',x===b));document.querySelectorAll('.tones button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.tone==='all'));renderGrid();}
    if(b.dataset.tone){tone=b.dataset.tone;document.querySelectorAll('.tones button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderGrid();}
  });
  $('deck-list').addEventListener('change',e=>{
    const key=e.target.dataset.count;if(!key)return;
    const count=Number(e.target.value),entry=current().entries.find(c=>c.key===key);
    if(!entry)return;
    const limit=Math.max(entry.count,rules.cardCount-result().count+entry.count);
    if(e.target.value===''||!Number.isInteger(count)||count<0||count>limit){notify(`该卡数量请输入0至${limit}的整数`);renderAll();return;}
    entry.count=count;if(!count)current().entries=current().entries.filter(c=>c!==entry);
    persist();renderAll();
  });
  $('search').addEventListener('input',renderGrid);$('sort').addEventListener('change',renderGrid);
  $('reset-filters').addEventListener('click',()=>{$('search').value='';tone='all';document.querySelectorAll('.tones button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tone==='all'));renderGrid();});
  $('deck-select').addEventListener('change',e=>switchDeck(e.target.value));
  $('deck-name').addEventListener('input',e=>{current().name=e.target.value.trim().slice(0,32)||'未命名牌组';options();persist();});
  $('new-deck').addEventListener('click',()=>{addDeck();$('deck-name').focus();$('deck-name').select();});
  $('clear-deck').addEventListener('click',()=>{if(confirm('清空这套牌组的全部卡牌？')){current().entries=[];persist();renderAll();}});
  $('delete-deck').addEventListener('click',()=>{if(!confirm('删除这套牌组？此操作无法撤销。'))return;state.decks=state.decks.filter(d=>d.id!==state.active);if(!state.decks.length)state.decks.push(fresh());switchDeck(state.decks[0].id);});
  $('export-deck').addEventListener('click',()=>download(serializeDeck(current()),'ace21-deck.json'));
  $('import-deck').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>100000)throw new Error('文件过大，请选择牌组JSON文件');const d=parseDeck(await file.text(),catalog,rules);addDeck({...d,id:crypto.randomUUID()});notify('已作为新牌组导入，原牌组保留');}
    catch(err){notify(err instanceof SyntaxError?'无法读取JSON牌组文件':err.message);}
    finally{e.target.value='';}
  });
  $('close-detail').addEventListener('click',()=>$('card-detail').close());
  $('card-detail').addEventListener('click',e=>{if(e.target===$('card-detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('detail-add').addEventListener('click',()=>changeCard(selected,1));
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){writeBlocked=true;storageError('另一标签页修改了牌组。为避免覆盖，当前页已暂停自动保存；请先导出需要保留的内容，再刷新读取最新记录。');$('save-status').textContent='自动保存已暂停';}});
}
init();
