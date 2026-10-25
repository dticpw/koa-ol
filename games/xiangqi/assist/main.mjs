import {START,parseFen,fen,side,square,coords,legalMoves,apply,status,pieceName,notation,positionKey} from './engine.mjs';
import {Library,annotations,pathLabel,partialText} from './library.mjs';
import {Comparison,conditionFromHistory,originalPath} from './comparison.mjs?v=d0e0359847ba';
const $=id=>document.getElementById(id);
// Traditional forms are restricted to the two board faces; notation stays original.
const faceName=p=>({车:'車',马:'馬'}[pieceName(p)]||pieceName(p));
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let library=null, loading=false, openedGame=null, matchRequest=null, sourceRequest=null, openRequest=null, matchSerial=0, sourceSerial=0, openSerial=0, session=0, libraryLimit=50,  state=parseFen(START),timeline=[state],cursor=0,selected=null,legal=[],found=null,choice=null,sourceId=null,pathId=null,opened=null,lineId='0',lineIndex=0,focusIndex=85;
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
  squares.forEach((b,i)=>{const p=state.board[i];b.replaceChildren();b.className='square';b.classList.toggle('selected',selected===i);b.classList.toggle('legal',dest.has(i));b.classList.toggle('last',last.includes(i));b.classList.toggle('checked',st.check&&p===(state.turn==='w'?'K':'k'));b.setAttribute('aria-pressed',String(selected===i));b.setAttribute('aria-label',`${square(i)} ${p?(side(p)==='w'?'红':'黑')+pieceName(p):'空位'}${dest.has(i)?'，可落子':''}`);if(p){const disk=el('span',undefined,`piece ${side(p)==='w'?'red':'black'}`);disk.append(el('span',faceName(p),'piece-glyph'));b.append(disk);}});
  renderFocus();drawArrow();
  const turn=state.turn==='w'?'红':'黑';$('turn').textContent=st.ended?`${st.winner==='w'?'红':'黑'}方胜 · ${st.reason}`:`${turn}方行棋${st.check?' · 将军，须应将':''}`;
  $('turn-dot').classList.toggle('black',state.turn==='b');$('step').textContent=`第 ${cursor} 手`;
  $('undo').disabled=cursor===0;$('redo').disabled=cursor===timeline.length-1;
}
function arrowGeometry(sx,sy,cx,cy,ex,ey,headSize){
  const len=Math.hypot(ex-cx,ey-cy),ux=(ex-cx)/len,uy=(ey-cy)/len;
  const headLength=Math.min(headSize,((ex-sx)*ux+(ey-sy)*uy)*.6),bx=ex-ux*headLength,by=ey-uy*headLength;
  const tailLength=Math.hypot(bx-sx,by-sy),controlLength=Math.min(Math.max(len-headLength,tailLength*.2),tailLength*.5),tx=bx-ux*controlLength,ty=by-uy*controlLength;
  // The butt-ended shaft stops at the head base. A half-unit internal overlap
  // avoids raster seams; opacity is applied once to the entire arrow group.
  return {
    shaft:`M ${sx} ${sy} Q ${tx} ${ty} ${bx} ${by} L ${bx+ux*.5} ${by+uy*.5}`,
    edge:`M ${sx} ${sy} Q ${tx} ${ty} ${bx} ${by}`,
    head:`M ${bx-uy*headSize/2} ${by+ux*headSize/2} L ${ex} ${ey} L ${bx+uy*headSize/2} ${by-ux*headSize/2}`
  };
}
function drawArrow(){
  const layer=$('arrows');layer.replaceChildren();$('arrow-count').textContent='';
  if(cursor===0&&positionKey(state)===positionKey(START)){$('arrow-count').textContent='红方首着不显示箭头。';return;}
  if(!$('show-arrow').checked){$('arrow-count').textContent='棋盘箭头已隐藏。';return;}
  if(!found||found.key!==positionKey(state))return;
  const moves=[...found.moves].filter(([uci])=>legal.includes(uci)).map(([uci,refs])=>{
    const [a,b]=coords(uci),x1=42+a%9*60,y1=55+Math.floor(a/9)*60,x2=42+b%9*60,y2=55+Math.floor(b/9)*60,dist=Math.hypot(x2-x1,y2-y1);
    return {uci,count:new Set(refs.map(r=>r.gameId)).size,a,x1,y1,x2,y2,dist,dx:(x2-x1)/dist,dy:(y2-y1)/dist};
  }).sort((a,b)=>b.count-a.count||a.uci.localeCompare(b.uci));
  if(!moves.length)return;
  $('arrow-count').textContent=`${moves.length} 种谱中着法。`;
  const min=Math.min(...moves.map(m=>m.count)),max=Math.max(...moves.map(m=>m.count));
  moves.forEach(m=>{
    const weight=max===min?.5:(Math.log1p(m.count)-Math.log1p(min))/(Math.log1p(max)-Math.log1p(min));
    const width=2.8+4.2*weight,opacity=.72+.24*weight,color=`rgb(18 ${105-Math.round(36*weight)} ${124-Math.round(38*weight)})`;
    // Separate collinear moves from the same square; each still ends at its own real destination.
    const ray=moves.filter(n=>n.a===m.a&&Math.abs(n.dx-m.dx)<1e-6&&Math.abs(n.dy-m.dy)<1e-6).sort((a,b)=>a.dist-b.dist);
    const bendLimit=Math.min(24,(m.dist-43)/8),bend=Math.max(-bendLimit,Math.min(bendLimit,(ray.indexOf(m)-(ray.length-1)/2)*18));
    const sx=m.x1+m.dx*18,sy=m.y1+m.dy*18,ex=m.x2-m.dx*25,ey=m.y2-m.dy*25;
    const shape=arrowGeometry(sx,sy,(sx+ex)/2-m.dy*bend*2,(sy+ey)/2+m.dx*bend*2,ex,ey,13+3*weight);
    const group=svg('g',{'class':'move-arrow','data-move':m.uci,'data-game-count':m.count,opacity});
    const title=svg('title',{});title.textContent=`${notation(state,m.uci)} · ${m.uci} · ${m.count} 局记载`;group.append(title);
    group.append(
      svg('path',{d:shape.edge,class:'arrow-edge',fill:'none',stroke:'#f7dfb8','stroke-width':width+2.4,'stroke-linecap':'butt'}),
      svg('path',{d:shape.head,class:'arrow-head-edge',fill:'#f7dfb8',stroke:'#f7dfb8','stroke-width':1.2,'stroke-linejoin':'miter','stroke-miterlimit':2}),
      svg('path',{d:shape.shaft,class:'arrow-shaft',fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'butt'}),
      svg('path',{d:shape.head+' Z',class:'arrow-head',fill:color})
    );layer.append(group);
  });
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
  cancelOpen();
  if(!legal.includes(uci))return;const label=notation(state,uci);timeline=timeline.slice(0,cursor+1);state=apply(state,uci);timeline.push(state);cursor++;selected=null;syncLineIndex();refresh();const st=status(state,legal);message(`${label}。${st.ended?'本局结束：'+st.reason:st.check?'将军，请应将。':`轮到${state.turn==='w'?'红':'黑'}方。`}`);
}
function cancelOpen(){openSerial++;openRequest?.abort();$('comparison-entry-message').textContent='';}
function syncLineIndex(){
  if(!openedGame)return;const line=currentLine();
  if(timeline.slice(0,cursor+1).every((s,i)=>line.node_ids[i]&&positionKey(openedGame.nodes[line.node_ids[i]].fen)===positionKey(s))){lineIndex=cursor;sourceId=opened;pathId=line.node_ids[cursor];}
  else lineIndex=line.node_ids.findIndex(n=>positionKey(openedGame.nodes[n].fen)===positionKey(state));
}
function refresh(){legal=legalMoves(state);renderBoard();renderContext();renderHistory();void refreshMatches();}
function setAnnotationCue(present){$('annotation-cue').hidden=!present;$('annotation-cue').textContent=present?'有原注':'';}
function clearSource(){
  sourceRequest?.abort();sourceSerial++;setAnnotationCue(false);
  $('source-content').replaceChildren();$('source-content').setAttribute('aria-busy','false');
}
function clearMatches(){found=null;choice=null;clearSource();$('match-body').hidden=true;$('no-match').hidden=true;drawArrow();}
async function refreshMatches(){
  const ticket=++matchSerial,lib=library;
  matchRequest?.abort();sourceRequest?.abort();sourceSerial++;matchRequest=new AbortController();
  clearMatches();
  if(!lib?.catalogue){$('match-count').textContent=loading?'正在读取书目，自战棋盘已可使用。':'书目尚未加载。';return;}
  $('data-error').hidden=true;$('match-count').textContent='正在查找当前局面的全部来源…';
  try{
    const result=await lib.lookup(state,matchRequest.signal);
    if(ticket!==matchSerial||lib!==library)return;
    found=result;const count=found.sources.size;
    $('match-count').textContent=count?`找到 ${count} 局棋谱 · ${found.occurrences} 条匹配路径`:'已查找全部收录棋谱，本局面未命中';
    $('no-match').hidden=count>0;$('match-body').hidden=count===0;
    if(!count)return;
    choice=found.moves.keys().next().value||null;
    if(!found.sources.has(sourceId))sourceId=found.sources.has(opened)?opened:found.sources.keys().next().value;
    $('source-search').value='';renderSourceOptions();renderNext();drawArrow();
  }catch(error){if(ticket!==matchSerial||lib!==library||error.name==='AbortError')return;
    $('match-count').textContent='局面查找未完成';$('data-error').hidden=false;$('error-text').textContent=`查找当前局面时读取失败，尚不能判断是否有匹配。${error.userMessage||''} 自战仍可继续。`;
  }
}
function renderSourceOptions(){
  if(!found)return;const query=$('source-search').value.trim();
  const list=[...found.sources.values()].filter(({game})=>!query||`${game.title} ${library.bookNames(game)}`.includes(query));
  const source=found.sources.get(sourceId);if(source&&!source.paths.includes(pathId))pathId=source.paths[0];
  $('source-select').replaceChildren(...list.flatMap(({game,paths})=>paths.map(id=>{
    const o=el('option',`${paths.length>1?`${pathLabel(id)} · `:''}${library.bookNames(game)} · ${game.title}${game.status==='partial'?' · 部分可用':''}`);
    o.value=JSON.stringify([game.id,id]);o.dataset.game=game.id;o.dataset.path=id;return o;
  })));
  $('source-total').textContent=query?`筛选 ${list.length} / ${found.sources.size} 局`:`全部 ${found.sources.size} 局可选`;
  $('source-select').value=JSON.stringify([sourceId,pathId]);$('source-select').disabled=!list.length;
  if($('source-select').value)void renderSource();
  else{clearSource();$('source-content').append(el('p',list.length?'请选择筛选结果中的一局。':'没有符合筛选的来源；清空关键词可查看全部。','muted'));}
}
function renderNext(){
  $('next-moves').replaceChildren(...[...found.moves].map(([uci,refs])=>{
    const b=el('button',notation(state,uci));b.dataset.uci=uci;b.setAttribute('aria-pressed',String(choice===uci));
    b.append(el('span',`${uci} · ${new Set(refs.map(r=>r.gameId)).size} 局记载`));
    b.addEventListener('click',()=>{
      choice=uci;const matching=refs.filter(r=>r.gameId===sourceId);
      if(!matching.length){sourceId=refs[0].gameId;pathId=refs[0].nodeId;}else if(!matching.some(r=>r.nodeId===pathId))pathId=matching[0].nodeId;
      $('source-search').value='';renderSourceOptions();renderNext();drawArrow();
    });return b;
  }));
  $('next-note').textContent=choice?'选着法看出处与走后原注，点下方按钮落子。':'这些来源已到已核实内容的末尾，仍可继续自战。';
  $('play-choice').disabled=!choice||!legal.includes(choice);$('play-choice').textContent=choice?`走这一步 · ${notation(state,choice)}`:'没有谱中后续着法';
}
function annotationBlock(parent,game,node,label){
  const ann=annotations(game,node),block=el('section',undefined,`annotation-block${ann.length?' has-annotation':''}`);
  block.append(el('h4',label,'annotation-label'));parent.append(block);
  if(!ann.length){block.append(el('p','此处暂无可对应到这一步的原注。','empty-note'));return;}
  for(const a of ann)block.append(el('p',`${a.source_line_id==='0'?'主线':`分支 ${a.source_line_id}`} · 走后第 ${a.source_after_ply} 手`,'annotation-path'),el('p',a.text,'annotation'));
}
async function renderSource(){
  setAnnotationCue(false);
  const ticket=++sourceSerial,lib=library,gameId=sourceId,nodeId=pathId,moveChoice=choice,position=found?.key;
  sourceRequest?.abort();sourceRequest=new AbortController();const box=$('source-content');
  box.replaceChildren(el('p','正在读取所选棋谱原文…','muted'));box.setAttribute('aria-busy','true');
  try{
    const game=await lib.game(gameId,sourceRequest.signal);
    if(ticket!==sourceSerial||lib!==library||position!==found?.key||gameId!==sourceId||nodeId!==pathId||moveChoice!==choice)return;
    const node=game.nodes[nodeId];if(!node)throw new Error('Missing indexed node');
    box.replaceChildren();box.append(el('h3',game.title,'source-title'));
    const link=el('a','永乐象棋棋谱 · 查看原出处 ↗','source-link');if(/^https:\/\//.test(game.url))link.href=game.url;link.target='_blank';link.rel='noopener noreferrer';box.append(link);
    if(game.status==='partial')box.append(el('p',partialText(game),'partial-notice'));
    annotationBlock(box,game,node,'当前局面原注');
    if(moveChoice){const refs=(found.moves.get(moveChoice)||[]).filter(r=>r.gameId===gameId&&r.nodeId===nodeId);
      if(refs.length)for(const ref of refs)annotationBlock(box,game,game.nodes[ref.childId],`走后原注 · ${notation(state,moveChoice)} · ${pathLabel(ref.childId)}`);
      else box.append(el('p','所选路径未记录这一步；切换棋谱或路径可看其他出处。','empty-note'));
    }
    const ctx=game.page_context||{};
    if(ctx.summary_text?.trim()){const d=el('details',undefined,'summary');d.append(el('summary','整局说明 · 与当前步无关'),el('p',ctx.summary_text));box.append(d);}
    const legacy={meihua:'原著王再越；现代评注者及所据底本未确证。',zichudonglai:'古谱署纯阳道人，成书时间未考。',juzhongmi:'明朱晋桢辑；来源中的转录与增注署名不等于原著作者。'};
    const author=game.metadata?.DhtmlXQ_author?.filter(Boolean).join('、');
    box.append(el('p',`${legacy[game.book_id]||'原著与转录、评注的署名分别保留。'}${author?` 来源页署名：${author}，不据此判断评注者。`:''} 网页上传者：${ctx.uploader||'未注明'}。上传者不等于原作者或评注者。`,'source-meta'));
    const open=el('button','从这局的标准开局打开','quiet');open.addEventListener('click',()=>void openGame(gameId));box.append(open);
    setAnnotationCue(!!box.querySelector('.has-annotation'));
  }catch(error){
    if(ticket!==sourceSerial||lib!==library||error.name==='AbortError')return;
    setAnnotationCue(false);
    box.replaceChildren(el('p',`所选棋谱原文读取失败。${error.userMessage||''} 来源与箭头仍可查看，原注暂不可读。`,'body-error'));
    const retry=el('button','重试所选棋谱');retry.id='retry-body';retry.addEventListener('click',()=>void renderSource());
    const reload=el('button','重新读取书目','quiet');reload.addEventListener('click',()=>void loadData());box.append(retry,reload);
  }finally{if(ticket===sourceSerial)box.setAttribute('aria-busy','false');}
}
function renderLineOptions(g){
$('line-select').replaceChildren(...g.lines.filter(l=>l.node_ids.length).map(l=>{const o=el('option',`${l.id==='0'?'主线':`分支 ${l.id} · 从第 ${l.start_ply} 手变化`} · ${l.node_ids.length-1} 手${l.first_failure?' · 后续有缺损':''}`);o.value=l.id;return o;}));
  $('line-select').value=lineId;
}
function currentLine(){return openedGame?.lines.find(l=>l.id===lineId);}
function renderContext(){
  $('line-controls').hidden=!openedGame;$('game-warning').hidden=openedGame?.status!=='partial';
  if(!openedGame){$('game-title').textContent='自由自战 · 标准开局';$('game-note').textContent='红黑双方均由你走棋。';return;}
  const g=openedGame,line=currentLine();$('game-title').textContent=g.title;$('game-note').textContent=`${library.bookNames(g)} · 标准布子，红方先行`;
  $('game-warning').textContent=g.status==='partial'?partialText(g):'';
  $('line-prev').disabled=lineIndex<=0;$('line-next').disabled=lineIndex<0||lineIndex>=line.node_ids.length-1;
  $('line-status').textContent=lineIndex<0?'当前已离开所选线路，可继续自战或回到标准开局。':`${lineId==='0'?'主线':`分支 ${lineId}`} · ${lineIndex} / ${line.node_ids.length-1} 手${lineIndex===line.node_ids.length-1?(line.first_failure?' · 已到可核实内容的末尾':' · 已到谱中末尾'):''}`;
}
function renderHistory(){
  $('history-count').textContent=`${cursor} 手`;$('history').replaceChildren();for(let i=1;i<=cursor;i++){const u=findMove(timeline[i-1],timeline[i]);if(u)$('history').append(el('li',`${notation(timeline[i-1],u)} · ${u}`));}
}
function fresh(initial){state=parseFen(initial);timeline=[state];cursor=0;selected=null;choice=null;pathId=null;refresh();}
async function openGame(id){
  const ticket=++openSerial,lib=library;openRequest?.abort();openRequest=new AbortController();
  $('library-message').textContent='正在打开所选棋谱…';message('正在读取所选棋谱…');
  try{
    const g=await lib.game(id,openRequest.signal);if(ticket!==openSerial||lib!==library)return;
    opened=id;openedGame=g;lineId='0';lineIndex=0;sourceId=id;
    renderLineOptions(g);
    $('library-dialog').close();$('library-message').textContent='';fresh(g.root_fen);message('已从标准开局打开。可沿谱走，也可自行落子。');
  }catch(error){if(ticket!==openSerial||lib!==library||error.name==='AbortError')return;
    const text=`所选棋谱未能打开。${error.userMessage||''} 请再次选择以重试。`;$('library-message').textContent=text;message(text);
  }
}
function goLine(index){
  cancelOpen();const g=openedGame,line=currentLine();lineIndex=Math.max(0,Math.min(index,line.node_ids.length-1));timeline=line.node_ids.slice(0,lineIndex+1).map(n=>parseFen(g.nodes[n].fen));cursor=timeline.length-1;state=timeline[cursor];selected=null;choice=null;pathId=line.node_ids[lineIndex];sourceId=opened;refresh();message(`已到${lineId==='0'?'主线':'分支 '+lineId}第 ${lineIndex} 手。`);
}
function renderLibrary(){
  if(!library?.catalogue){$('library-count').textContent=loading?'书目正在加载…':'书目未能加载，请关闭后重试。';$('game-list').replaceChildren();$('more-games').hidden=true;return;}
  const book=$('book-filter').value,search=$('search').value.trim();
  const games=Object.values(library.catalogue.games).filter(g=>(!book||g.book_ids.includes(book))&&(!search||`${g.title} ${library.bookNames(g)}`.includes(search)));
  $('library-count').textContent=games.length?`${games.length} 局 · 当前显示 ${Math.min(libraryLimit,games.length)} 局`:'此目录暂无符合条件的标准红先棋谱，或未找到相符局名。';
  $('game-list').replaceChildren(...games.slice(0,libraryLimit).map(g=>{
    const b=el('button',undefined,'game-item');b.dataset.game=g.id;
    b.append(el('span',`${library.bookNames(g)} · ${g.summary.structured_branches} 个分支${g.status==='partial'?' · 部分可用':''}`),el('b',g.title));
    b.addEventListener('click',()=>void openGame(g.id));return b;
  }));$('more-games').hidden=games.length<=libraryLimit;
}
async function loadData(){
  const ticket=++session;loading=true;cancelOpen();resetComparisonSession();matchSerial++;sourceSerial++;
  matchRequest?.abort();sourceRequest?.abort();library?.dispose();library=new Library();const lib=library;
  opened=null;openedGame=null;sourceId=null;pathId=null;clearMatches();renderContext();
  $('data-error').hidden=true;$('match-count').textContent='正在读取书目，自战棋盘已可使用。';
  $('library-summary').textContent='名著棋谱目录 · 读取中';$('library-message').textContent='';$('book-filter').replaceChildren(el('option','目录读取中'));$('book-filter').disabled=true;
  $('browse-count').textContent='读取中';$('collection-summary').textContent='棋谱书目读取中';renderLibrary();
  try{
    await lib.open();if(ticket!==session)return;
    const m=lib.manifest,available=m.books.filter(b=>b.game_ids.length).length;
    $('browse-count').textContent=`${m.counts.runtime_games} 局 ↗`;
    $('collection-summary').textContent=`${m.books.length} 部目录 · ${available} 部含可用棋谱 · 共 ${m.counts.runtime_games} 局，其中 ${m.counts.game_statuses.partial||0} 局部分可用`;
    $('library-summary').textContent=`${m.books.length} 部目录 · ${m.counts.runtime_games} 局已纳入`;
    $('book-filter').replaceChildren(el('option','全部目录'),...m.books.map(b=>{const o=el('option',`${b.title} · ${b.game_ids.length} 局可用`);o.value=b.id;return o;}));$('book-filter').firstChild.value='';$('book-filter').disabled=false;
    loading=false;renderLibrary();await refreshMatches();if(comparisonMode&&fixedCondition)void queryComparison();
  }catch(error){if(ticket!==session||error.name==='AbortError')return;
    lib.dispose();clearMatches();$('data-error').hidden=false;$('error-text').textContent=`书目加载失败，尚未查找局面。${error.userMessage||''} 自战仍可继续。`;$('match-count').textContent='书目未加载';$('library-summary').textContent='棋谱书目暂不可读';$('browse-count').textContent='暂不可读';$('collection-summary').textContent='棋谱库暂不可读';if(comparisonMode)comparisonError('书目未加载，比较暂不可用。请重新读取书目。');
  }finally{if(ticket===session){loading=false;renderLibrary();}}
}
let comparisonMode=false,comparisonLoader=null,comparisonRequest=null,comparisonSerial=0,fixedCondition=null,comparisonResult=null,comparisonPage=0;
const comparisonPageSize=2,comparisonSelected=new Map();
function resetComparisonSession(){
  comparisonSerial++;comparisonRequest?.abort();comparisonLoader?.dispose();comparisonLoader=null;comparisonResult=null;comparisonSelected.clear();
  $('comparison-groups').replaceChildren();$('comparison-count').textContent='';$('comparison-error').hidden=true;$('comparison-entry-message').textContent='';
  $('comparison-status').textContent='书目正在读取，固定条件会保留。';$('comparison-search').disabled=true;comparisonPaging(0);
}
function comparisonPaging(total){
  const pages=Math.max(1,Math.ceil(total/comparisonPageSize));comparisonPage=Math.min(comparisonPage,pages-1);
  $('comparison-prev').disabled=!total||comparisonPage===0;$('comparison-next').disabled=!total||comparisonPage>=pages-1;
  $('comparison-page').textContent=total?`${comparisonPage+1} / ${pages} 页`:'';
}
function showComparison(active){
  comparisonMode=active;$('position-panel').hidden=active;$('comparison-panel').hidden=!active;
  $('mode-position').setAttribute('aria-pressed',String(!active));$('mode-comparison').setAttribute('aria-pressed',String(active));
  if(active&&!fixedCondition)freezeComparison();
  else if(active&&!comparisonResult&&!comparisonLoader)void queryComparison();
}
function freezeComparison(){
  cancelOpen();$('comparison-entry-message').textContent='';
  const side=document.querySelector('input[name=comparison-side]:checked').value;
  try{fixedCondition=conditionFromHistory(timeline,cursor,side);}catch(error){comparisonError(error.message);return;}
  const red=side==='w',count=fixedCondition.moves.length;
  $('comparison-fixed').textContent=`已固定${red?'红':'黑'}方 · ${count} 步${count?' · 展开走法':' · 尚未走子'}`;
  $('comparison-moves').replaceChildren(...fixedCondition.moves.map((u,i)=>el('li',`${fixedCondition.labels[i]} · ${u}`)));
  $('comparison-sequence').open=count>0&&count<=4;
  $('comparison-stage').textContent=red?(count?`比较黑方应完第 ${count} 步后、轮红方走的局面。`:'红方零步：标准开局，轮红方走。'):(count?`比较黑方走完第 ${count} 步、红方随后应完，轮黑方走的局面。`:'黑方零步：比较红方不同首着之后、轮黑方走的局面。');
  $('comparison-freeze').textContent='重新固定当前走法';$('comparison-search').value='';comparisonPage=0;comparisonSelected.clear();void queryComparison();
}
function comparisonError(text){
  $('comparison-status').textContent='比较未完成';$('comparison-error').hidden=false;$('comparison-error-text').textContent=text;
}
async function queryComparison(){
  const ticket=++comparisonSerial,lib=library,fixed=fixedCondition;comparisonRequest?.abort();comparisonRequest=new AbortController();
  comparisonResult=null;$('comparison-groups').replaceChildren();$('comparison-count').textContent='';$('comparison-error').hidden=true;$('comparison-search').disabled=true;comparisonPaging(0);
  if(!lib?.catalogue){comparisonError('请先完成书目读取，再重试比较。');return;}
  $('comparison-status').textContent='正在查找相同己方走法的不同应法…';
  const loader=comparisonLoader||(comparisonLoader=new Comparison({library:lib}));
  try{
    const result=await loader.lookup(fixed.side,fixed.moves,comparisonRequest.signal);
    if(ticket!==comparisonSerial||loader!==comparisonLoader||lib!==library||fixed!==fixedCondition)return;
    comparisonResult=result.condition;$('comparison-search').disabled=!comparisonResult;
    if(!comparisonResult){$('comparison-status').textContent='已查找全部收录棋谱，暂无相同顺序的己方走法。可以保留条件继续自战，或重新固定。';return;}
    $('comparison-status').textContent=`${comparisonResult.game_count} 局棋谱 · ${comparisonResult.group_count} 种局面 · ${comparisonResult.path_count} 条原谱路径`;
    renderComparisonGroups();
  }catch(error){if(ticket!==comparisonSerial||loader!==comparisonLoader||error.name==='AbortError')return;comparisonError(`比较资料读取失败，尚不能判断是否有结果。${error.userMessage||error.message}`);}
}
function miniBoard(key,lastUci,index){
  const position=parseFen(key),board=svg('svg',{viewBox:'0 0 270 310',class:'comparison-board',role:'img','aria-label':`局面 ${index+1}，完整双方布子，黑方在上，红方在下，轮${position.turn==='w'?'红':'黑'}方走`});
  const grid=svg('g',{stroke:'#94764f','stroke-width':.8,fill:'none'});board.append(grid);
  for(let y=0;y<10;y++)grid.append(svg('line',{x1:15,y1:20+y*30,x2:255,y2:20+y*30}));
  for(let x=0;x<9;x++)for(const [a,b]of (x===0||x===8?[[20,290]]:[[20,140],[170,290]]))grid.append(svg('line',{x1:15+x*30,y1:a,x2:15+x*30,y2:b}));
  for(const y of [20,230])for(const [a,b]of [[105,165],[165,105]])grid.append(svg('line',{x1:a,y1:y,x2:b,y2:y+60}));
  const river=svg('text',{x:135,y:159,'text-anchor':'middle',fill:'#80613b','font-size':12,'letter-spacing':12});river.textContent='楚河 漢界';board.append(river);
  if(lastUci){for(const i of coords(lastUci))board.append(svg('rect',{x:15+i%9*30-13,y:20+Math.floor(i/9)*30-13,width:26,height:26,rx:3,fill:'#d8e4d3',stroke:'#28636e','stroke-width':1.8}));}
  const description=[];
  position.board.forEach((p,i)=>{if(!p)return;const x=15+i%9*30,y=20+Math.floor(i/9)*30,red=side(p)==='w';description.push(`${red?'红':'黑'}${pieceName(p)} ${square(i)}`);
    board.append(svg('circle',{cx:x,cy:y,r:11.8,fill:'#fae4bd',stroke:red?'#9c3028':'#40382c','stroke-width':.8}),svg('circle',{cx:x,cy:y,r:10.1,fill:'none',stroke:red?'#9c3028':'#40382c','stroke-width':.5}));
    const text=svg('text',{x,y,'text-anchor':'middle','dominant-baseline':'central',dy:'-0.035em',class:'comparison-piece',color:red?'#9c3028':'#302d28',fill:'currentColor'});text.textContent=faceName(p);board.append(text);
  });
  const desc=svg('desc',{});desc.textContent=description.join('，');board.append(desc);return board;
}
function lastMoveText(key,uci){
  if(!uci)return '标准开局 · 尚无对方着法';
  const p=parseFen(key).board[coords(uci)[1]],parts=uci.match(/^([a-i](?:10|[1-9]))([a-i](?:10|[1-9]))$/);
  return `对方末着：${side(p)==='w'?'红':'黑'}${pieceName(p)} ${parts[1]} → ${parts[2]} · ${uci}`;
}
function renderComparisonGroups(){
  if(!comparisonResult)return;const query=$('comparison-search').value.trim(),matched=[];
  comparisonResult.groups.forEach((group,index)=>{
    const refs=group.refs.filter(([id])=>{const game=library.catalogue.games[id];return !query||`${game.title} ${library.bookNames(game)}`.includes(query);});
    if(refs.length)matched.push({group,index,refs});
  });
  comparisonPaging(matched.length);const first=comparisonPage*comparisonPageSize,list=matched.slice(first,first+comparisonPageSize),games=new Set(matched.flatMap(x=>x.refs.map(r=>r[0]))),paths=matched.reduce((n,g)=>n+g.refs.length,0);
  $('comparison-count').textContent=matched.length?`${query?`筛选 ${games.size} 局 · ${paths} 条路径；`:''}当前显示 ${first+1}–${first+list.length} / ${matched.length} 种局面。${query?'清空筛选可查看全部来源。':'各局面的全部来源均可选择。'}`:'没有符合筛选的来源，清空关键词可恢复全部结果。';
  $('comparison-groups').replaceChildren(...list.map(({group,index,refs})=>{
    const card=el('article',undefined,'comparison-card');card.dataset.group=index;
    card.append(el('h4',`局面 ${index+1} · ${query?`筛选 ${new Set(refs.map(r=>r[0])).size} 局 / ${refs.length} 路径`:`${group.game_count} 局 / ${group.path_count} 路径`}`));
    const boardBox=el('div'),last=el('p',undefined,'comparison-last'),title=el('p',undefined,'comparison-source-title'),notice=el('p','此谱部分可用；进入后只显示已核实内容。','comparison-partial');
    const label=el('label','选择此局面的来源','field-label'),select=el('select');select.id=`comparison-source-${index}`;label.htmlFor=select.id;
    const counts=new Map();for(const [id]of refs)counts.set(id,(counts.get(id)||0)+1);
    select.replaceChildren(...refs.map(([id,node])=>{const g=library.catalogue.games[id],o=el('option',`${counts.get(id)>1?pathLabel(node)+' · ':''}${library.bookNames(g)} · ${g.title}${g.status==='partial'?' · 部分可用':''}`);o.value=JSON.stringify([id,node]);return o;}));
    const kept=comparisonSelected.get(index);select.value=refs.some(r=>JSON.stringify(r.slice(0,2))===kept)?kept:JSON.stringify(refs[0].slice(0,2));
    const enter=el('button','进入此局面','comparison-enter');
    const update=()=>{const ref=refs.find(r=>JSON.stringify(r.slice(0,2))===select.value),g=library.catalogue.games[ref[0]];comparisonSelected.set(index,select.value);boardBox.replaceChildren(miniBoard(group.position_key,ref[2],index));last.textContent=lastMoveText(group.position_key,ref[2]);title.textContent=`${library.bookNames(g)} · ${g.title} · ${pathLabel(ref[1])}`;notice.hidden=g.status!=='partial';};
    select.addEventListener('change',()=>{cancelOpen();$('comparison-entry-message').textContent='';update();});
    enter.addEventListener('click',()=>void enterComparison(group,JSON.parse(select.value),enter));update();
    card.append(boardBox,el('p',`黑方在上 · 红方在下 · 轮${fixedCondition.side==='w'?'红':'黑'}方走`,'comparison-orientation'),last,label,select,title,notice,enter);return card;
  }));
}
async function enterComparison(group,[id,nodeId],button){
  const ticket=++openSerial,lib=library,fixed=fixedCondition;openRequest?.abort();openRequest=new AbortController();button.disabled=true;
  $('comparison-entry-message').textContent='正在读取所选路径，当前棋盘暂不改变…';
  try{
    const game=await lib.game(id,openRequest.signal);if(ticket!==openSerial||lib!==library||fixed!==fixedCondition)return;
    const path=originalPath(game,nodeId),condition=conditionFromHistory(path.states,path.states.length-1,fixed.side);
    if(positionKey(path.states.at(-1))!==group.position_key||JSON.stringify(condition.moves)!==JSON.stringify(fixed.moves))throw new Error('所选来源与固定条件不一致。');
    const compatible=l=>path.nodes.every((n,i)=>l.node_ids[i]===n.id);
    const line=game.lines.find(l=>l.id===game.nodes[nodeId].line_id&&compatible(l))||game.lines.find(compatible);
    if(!line)throw new Error('所选原谱路径缺少可继续的线路。');
    opened=id;openedGame=game;lineId=line.id;lineIndex=path.nodes.length-1;renderLineOptions(game);
    timeline=path.states;cursor=timeline.length-1;state=timeline[cursor];selected=null;choice=null;sourceId=id;pathId=nodeId;
    $('comparison-entry-message').textContent='';showComparison(false);refresh();message('已按这条原谱的完整走序进入。可继续、撤回，或回到保留条件选择另一种应法。');
    $('board').scrollIntoView({block:'start'});$('board').focus({preventScroll:true});
  }catch(error){if(ticket!==openSerial||lib!==library||error.name==='AbortError')return;$('comparison-entry-message').textContent=`此路径未能进入，当前棋盘未改变。${error.userMessage||error.message} 可再次点击重试。`;}
  finally{button.disabled=false;}
}
$('mode-position').addEventListener('click',()=>{cancelOpen();showComparison(false);});
$('mode-comparison').addEventListener('click',()=>{cancelOpen();showComparison(true);});
$('comparison-freeze').addEventListener('click',freezeComparison);
for(const input of document.querySelectorAll('input[name=comparison-side]'))input.addEventListener('change',freezeComparison);
$('comparison-search').addEventListener('input',()=>{cancelOpen();$('comparison-entry-message').textContent='';comparisonPage=0;renderComparisonGroups();});
for(const [id,step]of [['comparison-prev',-1],['comparison-next',1]])$(id).addEventListener('click',()=>{cancelOpen();$('comparison-entry-message').textContent='';comparisonPage+=step;renderComparisonGroups();});
$('comparison-retry').addEventListener('click',()=>{cancelOpen();comparisonLoader?.dispose();comparisonLoader=null;void queryComparison();});
$('comparison-reload').addEventListener('click',()=>void loadData());

$('undo').addEventListener('click',()=>{cancelOpen();if(!cursor)return;cursor--;state=timeline[cursor];selected=null;syncLineIndex();refresh();message('已撤回一步。');});
$('redo').addEventListener('click',()=>{cancelOpen();if(cursor>=timeline.length-1)return;cursor++;state=timeline[cursor];selected=null;syncLineIndex();refresh();message('已重走一步。');});
$('reset').addEventListener('click',()=>{cancelOpen();lineIndex=0;fresh(START);message('已重置到本局标准开局。');});
$('standard').addEventListener('click',()=>{cancelOpen();opened=null;openedGame=null;lineId='0';fresh(START);message('已回到标准开局。');});
$('show-arrow').addEventListener('change',drawArrow);$('play-choice').addEventListener('click',()=>choice&&move(choice));
$('source-search').addEventListener('input',renderSourceOptions);
$('source-select').addEventListener('change',e=>{if(!e.target.value)return;[sourceId,pathId]=JSON.parse(e.target.value);void renderSource();});
$('browse').addEventListener('click',()=>{libraryLimit=50;renderLibrary();$('library-dialog').showModal();});$('close-library').addEventListener('click',()=>$('library-dialog').close());
$('library-dialog').addEventListener('close',cancelOpen);
$('book-filter').addEventListener('change',()=>{libraryLimit=50;renderLibrary();});$('search').addEventListener('input',()=>{libraryLimit=50;renderLibrary();});
$('more-games').addEventListener('click',()=>{libraryLimit+=50;renderLibrary();});
$('line-select').addEventListener('change',e=>{lineId=e.target.value;const l=currentLine();goLine(l.id==='0'?0:l.start_ply-1);});
$('line-start').addEventListener('click',()=>goLine(0));$('line-prev').addEventListener('click',()=>goLine(lineIndex-1));$('line-next').addEventListener('click',()=>goLine(lineIndex+1));$('retry').addEventListener('click',()=>void loadData());
drawGrid();refresh();void loadData();
