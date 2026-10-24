import {START,parseFen,fen,side,square,coords,legalMoves,apply,status,pieceName,notation,positionKey} from './engine.mjs';
import {lookup,annotations,bookTitle,pathLabel} from './library.mjs';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let data=null, loading=false, state=parseFen(START),timeline=[state],cursor=0,selected=null,legal=[],found=null,choice=null,sourceId=null,pathId=null,opened=null,lineId='0',lineIndex=0,focusIndex=85;
const squares=[];
const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
function drawGrid(){
  const grid=$('board-lines');
  const boardGroup=svg('g',{transform:'translate(12 25)'});grid.append(boardGroup);
  const line=(x1,y1,x2,y2)=>boardGroup.append(svg('line',{x1,y1,x2,y2,stroke:'#876640','stroke-width':1.2}));
  for(let y=0;y<10;y++)line(30,30+y*60,510,30+y*60);
  for(let x=0;x<9;x++){if(x===0||x===8)line(30+x*60,30,30+x*60,570);else{line(30+x*60,30,30+x*60,270);line(30+x*60,330,30+x*60,570);}}
  for(const y of [30,450]){line(210,y,330,y+120);line(330,y,210,y+120);}
  for(let x=0;x<9;x++){for(const [y,t]of [[-1,String(x+1)],[603,'九八七六五四三二一'[x]]]){const tx=svg('text',{x:30+x*60,y,'text-anchor':'middle','font-size':11,fill:'#795936'});tx.textContent=t;boardGroup.append(tx);}}
  for(const [x,t]of [[150,'楚 河'],[390,'漢 界']]){const tx=svg('text',{x,y:309,'text-anchor':'middle','font-size':23,'font-family':'serif',fill:'#957147','letter-spacing':8});tx.textContent=t;boardGroup.append(tx);}
  for(const [x,y]of [[1,2],[7,2],[1,7],[7,7],...[0,2,4,6,8].flatMap(x=>[[x,3],[x,6]])]){
    for(const dx of [-1,1])for(const dy of [-1,1]){if((x===0&&dx===-1)||(x===8&&dx===1))continue;const a=30+x*60,b=30+y*60;line(a+dx*7,b+dy*7,a+dx*15,b+dy*7);line(a+dx*7,b+dy*7,a+dx*7,b+dy*15);}
  }
  for(let i=0;i<90;i++){
    const b=el('button',undefined,'square');b.type='button';b.dataset.square=square(i);b.style.left=`${(42+i%9*60)/564*100}%`;b.style.top=`${(55+Math.floor(i/9)*60)/650*100}%`;
    b.addEventListener('click',()=>{focusIndex=i;clickSquare(i);});
    b.addEventListener('keydown',e=>{const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-9,ArrowDown:9};if(e.key==='Escape'){selected=null;renderBoard();return;}if(!(e.key in steps))return;e.preventDefault();const j=Math.max(0,Math.min(89,i+steps[e.key]));focusIndex=j;renderFocus();squares[j].focus();});
    b.addEventListener('focus',()=>{focusIndex=i;renderFocus();});squares.push(b);$('squares').append(b);
  }
}
function renderFocus(){squares.forEach((b,i)=>b.tabIndex=i===focusIndex?0:-1);}
function renderBoard(){
  const st=status(state,legal),dest=new Set(selected===null?[]:legal.filter(u=>coords(u)[0]===selected).map(u=>coords(u)[1]));
  const prev=cursor?findMove(timeline[cursor-1],state):null,last=prev?coords(prev):[];
  squares.forEach((b,i)=>{const p=state.board[i];b.replaceChildren();b.className='square';b.classList.toggle('selected',selected===i);b.classList.toggle('legal',dest.has(i));b.classList.toggle('last',last.includes(i));b.classList.toggle('checked',st.check&&p===(state.turn==='w'?'K':'k'));b.setAttribute('aria-pressed',String(selected===i));b.setAttribute('aria-label',`${square(i)} ${p?(side(p)==='w'?'红':'黑')+pieceName(p):'空位'}${dest.has(i)?'，可落子':''}`);if(p)b.append(el('span',pieceName(p),`piece ${side(p)==='w'?'red':'black'}`));});
  renderFocus();drawArrow();
  const turn=state.turn==='w'?'红':'黑';$('turn').textContent=st.ended?`${st.winner==='w'?'红':'黑'}方胜 · ${st.reason}`:`${turn}方行棋${st.check?' · 将军，须应将':''}`;
  $('turn-dot').classList.toggle('black',state.turn==='b');$('step').textContent=`第 ${cursor} 手`;
  $('undo').disabled=cursor===0;$('redo').disabled=cursor===timeline.length-1;
}
function drawArrow(){
  const layer=$('arrows');layer.replaceChildren();if(!$('show-arrow').checked||!choice||!found?.moves.has(choice)||!legal.includes(choice))return;
  const [a,b]=coords(choice),x1=42+a%9*60,y1=55+Math.floor(a/9)*60,x2=42+b%9*60,y2=55+Math.floor(b/9)*60,dist=Math.hypot(x2-x1,y2-y1),dx=(x2-x1)/dist,dy=(y2-y1)/dist;
  const defs=svg('defs',{}),marker=svg('marker',{id:'arrow-tip',viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:4,markerHeight:4,orient:'auto'});marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#145b70'}));defs.append(marker);layer.append(defs);
  layer.append(svg('line',{x1:x1+dx*21,y1:y1+dy*21,x2:x2-dx*13,y2:y2-dy*13,stroke:'#145b70','stroke-width':6,'stroke-linecap':'round','marker-end':'url(#arrow-tip)',opacity:.85}));
  const title=svg('title',{});title.textContent=`谱中着法 ${notation(state,choice)}，${choice}`;layer.append(title);
}
function message(text){$('move-message').textContent=text;}
function clickSquare(i){
  if(status(state,legal).ended){message('本局已无合法着法。可撤回或重置，再试其他走法。');return;}
  if(selected!==null){const u=square(selected)+square(i);if(legal.includes(u)){move(u);return;}}
  if(side(state.board[i])===state.turn){selected=selected===i?null:i;renderBoard();message(selected===null?'已取消选择。':`已选${state.turn==='w'?'红':'黑'}${pieceName(state.board[i])}（${square(i)}），圆点标出合法落点。`);}
  else if(selected!==null)message('这里不能落子：须符合棋子走法，且走后不能使己方将帅被将军。');
  else message(`现在轮到${state.turn==='w'?'红':'黑'}方，请先选择这一方的棋子。`);
}
function findMove(before,after){let a=-1,b=-1;for(let i=0;i<90;i++)if(before.board[i]!==after.board[i]){if(!after.board[i])a=i;else b=i;}return a>=0&&b>=0?square(a)+square(b):null;}
function move(uci){
  if(!legal.includes(uci))return;const label=notation(state,uci);timeline=timeline.slice(0,cursor+1);state=apply(state,uci);timeline.push(state);cursor++;selected=null;syncLineIndex();refresh();const st=status(state,legal);message(`${label}。${st.ended?'本局结束：'+st.reason:st.check?'将军，请应将。':`轮到${state.turn==='w'?'红':'黑'}方。`}`);
}
function syncLineIndex(){if(!opened)return;const ids=currentLine().node_ids;lineIndex=ids.findIndex(n=>positionKey(data.games[opened].nodes[n].fen)===positionKey(state));}
function refresh(){legal=legalMoves(state);refreshMatches();renderBoard();renderContext();renderHistory();}
function refreshMatches(){
  if(!data)return;
  found=lookup(data,state);const count=found.sources.size;
  $('match-count').textContent=count?`找到 ${count} 局棋谱 · ${found.occurrences} 条匹配路径`:'本局面在三书中未命中';
  $('no-match').hidden=count>0;$('match-body').hidden=count===0;
  if(!count){choice=null;return;}
  if(!found.moves.has(choice))choice=found.moves.keys().next().value||null;
  if(!found.sources.has(sourceId))sourceId=found.sources.has(opened)?opened:found.sources.keys().next().value;
  $('source-total').textContent=`全部 ${count} 局可选`;
  $('source-select').replaceChildren(...[...found.sources.values()].map(({game,paths})=>{const opt=el('option',`${bookTitle(game.book_id)} · ${game.title}（${paths.length} 路径）`);opt.value=game.id;return opt;}));
  $('source-select').value=sourceId;renderNext();renderPaths();
}
function renderNext(){
  $('next-moves').replaceChildren(...[...found.moves].map(([uci,refs])=>{const b=el('button',notation(state,uci));b.dataset.uci=uci;b.setAttribute('aria-pressed',String(choice===uci));b.append(el('span',`${uci} · ${new Set(refs.map(r=>r.game.id)).size} 局记载`));b.addEventListener('click',()=>{choice=uci;const supporting=refs.filter(r=>r.game.id===sourceId);if(!supporting.length){sourceId=refs[0].game.id;$('source-select').value=sourceId;pathId=refs[0].node.id;}else if(!supporting.some(r=>r.node.id===pathId))pathId=supporting[0].node.id;renderNext();renderPaths();drawArrow();});return b;}));
  $('next-note').textContent=choice?'选着法看箭头与走后原注，点下方按钮落子。':'这些来源已到记录末尾。仍可在棋盘上继续自战。';
  $('play-choice').disabled=!choice||!legal.includes(choice);$('play-choice').textContent=choice?`走这一步 · ${notation(state,choice)}`:'没有谱中后续着法';
}
function renderPaths(){
  const source=found.sources.get(sourceId);if(!source)return;
  if(!source.paths.some(n=>n.id===pathId))pathId=source.paths[0].id;
  $('path-select').replaceChildren(...source.paths.map(n=>{const o=el('option',pathLabel(n));o.value=n.id;return o;}));$('path-select').value=pathId;
  renderSource();
}
function annotationBlock(parent,game,node,label){
  parent.append(el('p',label,'annotation-label'));
  const ann=annotations(game,node);
  if(!ann.length){parent.append(el('p','此处没有非空原注。','empty-note'));return;}
  for(const a of ann){parent.append(el('p',`${a.source_line_id==='0'?'主线':`分支 ${a.source_line_id}`} · 走后第 ${a.source_after_ply} 手`,'annotation-path'),el('p',a.text,'annotation'));}
}
function renderSource(){
  const {game}=found.sources.get(sourceId),node=game.nodes[pathId],box=$('source-content');box.replaceChildren();
  box.append(el('h3',game.title,'source-title'));
  const link=el('a','永乐象棋棋谱 · 查看原出处 ↗','source-link');if(/^https:\/\//.test(game.url))link.href=game.url;link.target='_blank';link.rel='noopener noreferrer';box.append(link);
  annotationBlock(box,game,node,'当前局面原注');
  if(choice){const refs=(found.moves.get(choice)||[]).filter(r=>r.game.id===sourceId&&r.node.id===pathId);
    if(refs.length)for(const ref of refs)annotationBlock(box,game,ref.child,`走后原注 · ${notation(state,choice)} · ${pathLabel(ref.child)}`);
    else box.append(el('p','所选路径未记录这一步；切换上方棋谱或路径可查看其他出处。','empty-note'));
  }
  const ctx=game.page_context||{};
  if(ctx.summary_text?.trim()){const d=el('details',undefined,'summary');d.append(el('summary','整局说明 · 与当前步无关'),el('p',ctx.summary_text));box.append(d);}
  const authorNote={meihua:'原著王再越；采用永乐所载王再越本体系。现代评注者及所据底本未确证。',zichudonglai:'古谱署纯阳道人，成书时间未考。',juzhongmi:'明朱晋桢辑。来源中另有陈来明署名及李浭增注线索，不能与原著作者混同。'}[game.book_id];
  box.append(el('p',`${authorNote}\n网页上传者：${ctx.uploader||'未注明'}。上传者不等于评注作者；原注保留来源署名。`,'source-meta'));
  const open=el('button','从这局的原始布子打开','quiet');open.addEventListener('click',()=>openGame(game.id));box.append(open);
}
function currentLine(){return data.games[opened].lines.find(l=>l.id===lineId);}
function renderContext(){
  $('line-controls').hidden=!opened;
  if(!opened){$('game-title').textContent='自由自战 · 标准开局';$('game-note').textContent='红黑双方均由你走棋。';return;}
  const g=data.games[opened],line=currentLine();$('game-title').textContent=g.title;$('game-note').textContent=`${bookTitle(g.book_id)} · ${g.standard_start?'原谱为标准布子':'原谱为让马布子，保留缺子'}`;
  $('line-prev').disabled=lineIndex<=0;$('line-next').disabled=lineIndex<0||lineIndex>=line.node_ids.length-1;
  $('line-status').textContent=lineIndex<0?'当前已离开所选线路；可继续自战，或回到原始局面。':`${lineId==='0'?'主线':`分支 ${lineId}`} · ${lineIndex} / ${line.node_ids.length-1} 手${lineIndex===line.node_ids.length-1?' · 已到谱中末尾':''}`;
}
function renderHistory(){
  $('history-count').textContent=`${cursor} 手`;$('history').replaceChildren();for(let i=1;i<=cursor;i++){const u=findMove(timeline[i-1],timeline[i]);if(u)$('history').append(el('li',`${notation(timeline[i-1],u)} · ${u}`));}
}
function fresh(initial){state=parseFen(initial);timeline=[state];cursor=0;selected=null;choice=null;pathId=null;refresh();}
function openGame(id){opened=id;lineId='0';lineIndex=0;sourceId=id;const g=data.games[id];$('line-select').replaceChildren(...g.lines.map(l=>{const o=el('option',l.id==='0'?`主线 · ${l.path_plies} 手`:`分支 ${l.id} · 从第 ${l.start_ply} 手变化（共 ${l.path_plies} 手）`);o.value=l.id;return o;}));$('library-dialog').close();fresh(g.root_fen);message('已打开原谱初始局面。可沿谱走，也可自己选择合法着法。');}
function goLine(index){
  const g=data.games[opened],line=currentLine();lineIndex=Math.max(0,Math.min(index,line.node_ids.length-1));timeline=line.node_ids.slice(0,lineIndex+1).map(n=>parseFen(g.nodes[n].fen));cursor=timeline.length-1;state=timeline[cursor];selected=null;choice=null;pathId=null;sourceId=opened;refresh();message(`已到${lineId==='0'?'主线':'分支 '+lineId}第 ${lineIndex} 手。`);
}
function renderLibrary(){
  if(!data){$('library-count').textContent=loading?'棋谱正在加载…':'棋谱尚未加载，请关闭书架后重试。';$('game-list').replaceChildren();return;}
  const book=$('book-filter').value,search=$('search').value.trim();const games=data.books.flatMap(b=>b.game_ids.map(id=>data.games[id])).filter(g=>(!book||g.book_id===book)&&(!search||g.title.includes(search)));
  $('library-count').textContent=`${games.length} 局`;$('game-list').replaceChildren(...games.map(g=>{const b=el('button',undefined,'game-item');b.dataset.game=g.id;b.append(el('span',`${bookTitle(g.book_id)} · ${g.standard_start?'标准布子':'让马原局'} · ${g.lines.length-1} 个分支`),el('b',g.title));b.addEventListener('click',()=>openGame(g.id));return b;}));
}
async function loadData(){
  if(loading)return;loading=true;$('data-error').hidden=true;$('no-match').hidden=true;$('match-body').hidden=true;$('match-count').textContent='正在加载三书… 自战棋盘已可使用。';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  try{const response=await fetch('../data/three-books.json',{signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);const incoming=await response.json();if(incoming.schema_version!==1||!incoming.games||!incoming.position_index||!Array.isArray(incoming.books)||Object.keys(incoming.games).length!==117)throw new Error('棋谱内容不完整');data=incoming;refresh();}
  catch(error){data=null;found=null;choice=null;drawArrow();$('match-body').hidden=true;$('no-match').hidden=true;$('data-error').hidden=false;$('error-text').textContent='棋谱加载失败。仍可自战，但暂时无法查找出处与原注；请检查连接后重试。';$('match-count').textContent='棋谱未加载，尚未进行局面匹配。';}
  finally{clearTimeout(timeout);loading=false;renderLibrary();}
}
$('undo').addEventListener('click',()=>{if(!cursor)return;cursor--;state=timeline[cursor];selected=null;syncLineIndex();refresh();message('已撤回一步。');});
$('redo').addEventListener('click',()=>{if(cursor>=timeline.length-1)return;cursor++;state=timeline[cursor];selected=null;syncLineIndex();refresh();message('已重走一步。');});
$('reset').addEventListener('click',()=>{lineIndex=0;fresh(opened?data.games[opened].root_fen:START);message('已重置到本局的原始布子。');});
$('standard').addEventListener('click',()=>{opened=null;lineId='0';fresh(START);message('已回到标准开局。');});
$('show-arrow').addEventListener('change',drawArrow);$('play-choice').addEventListener('click',()=>choice&&move(choice));
$('source-select').addEventListener('change',e=>{sourceId=e.target.value;pathId=null;renderPaths();});
$('path-select').addEventListener('change',e=>{pathId=e.target.value;renderSource();});
$('browse').addEventListener('click',()=>{renderLibrary();$('library-dialog').showModal();});$('close-library').addEventListener('click',()=>$('library-dialog').close());
$('book-filter').addEventListener('change',renderLibrary);$('search').addEventListener('input',renderLibrary);
$('line-select').addEventListener('change',e=>{lineId=e.target.value;const l=currentLine();goLine(l.id==='0'?0:l.start_ply-1);});
$('line-start').addEventListener('click',()=>goLine(0));$('line-prev').addEventListener('click',()=>goLine(lineIndex-1));$('line-next').addEventListener('click',()=>goLine(lineIndex+1));$('retry').addEventListener('click',loadData);
drawGrid();refresh();loadData();
