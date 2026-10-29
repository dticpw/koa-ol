import {START,parseFen,fen,side,square,coords,legalMoves,apply,status,pieceName,notation,positionKey} from './engine.mjs';
import {Library,annotations,pathLabel,partialText} from './library.mjs';
import {Comparison,conditionFromHistory,originalPath} from './comparison.mjs?v=d0e0359847ba';
import {createBoardAudio} from './board-audio.mjs?v=7aba1a51d8b3';
import {createBoardMotion} from './board-motion.mjs?v=447f4abe6fc1';
import {ResearchScope,readScope,saveScope,allScope,emptyScope} from './research-scope.mjs?v=0cb409da1af4';
import {createScopePicker} from './scope-picker.mjs?v=e22779776713';
import {followupLines,lineConclusions,gameResult} from './followup.mjs?v=317d49d8736d';
import {createNoteReader,afterNotes} from './note-reader.mjs?v=92959c5479c8';
const $=id=>document.getElementById(id);
// Traditional forms are restricted to the two board faces; notation stays original.
const faceName=p=>({车:'車',马:'馬'}[pieceName(p)]||pieceName(p));
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let library=null, loading=false, openedGame=null, matchRequest=null, sourceRequest=null, openRequest=null, matchSerial=0, sourceSerial=0, openSerial=0, session=0, libraryLimit=50,  state=parseFen(START),timeline=[state],cursor=0,selected=null,legal=[],found=null,choice=null,sourceId=null,pathId=null,opened=null,lineId='0',lineIndex=0,focusIndex=85;
const squares=[];
// Per-move previews use catalogue titles and indexed paths; no extra body fetches.
const moveSources=new Map();
let closeFollowup=null;
const noteReader=createNoteReader($('note-reader'));
let researchScope=null,scopeRelation='';
function renderScope(){
  $('scope-summary').textContent=researchScope?.label||'书目读取后可选择';
  $('scope-notice').textContent=researchScope?.notice||'';
  $('scope-relation').textContent=scopeRelation;
  $('scope-edit').disabled=!researchScope||loading||!library?.catalogue;$('scope-restore').disabled=$('scope-edit').disabled;
  $('scope-restore').hidden=researchScope?.value.mode==='all';
  $('scope-return').hidden=!researchScope?.returnTo;$('scope-return').disabled=$('scope-edit').disabled;
  const origin=researchScope?.returnTo?new ResearchScope(researchScope.catalogue,researchScope.books,researchScope.returnTo).label:'';
  $('scope-return-summary').textContent=origin?`返回目标：${origin}`:'';
  $('scope-return').setAttribute('aria-label',origin?`返回原范围：${origin}`:'返回原范围');
  $('comparison-scope').textContent=researchScope?`研究范围：${researchScope.label}`:'';
  if(researchScope)$('browse-count').textContent=`${researchScope.ids.size} 局 ↗`;
}
function applyResearchScope(value,notice=''){
  if(!library?.catalogue)return;
  const previousSource=sourceId;
  researchScope=new ResearchScope(library.catalogue,library.manifest.books,value);
  researchScope.notice=[notice,researchScope.notice,saveScope(researchScope)].filter(Boolean).join(' ');
  cancelOpen();matchSerial++;sourceSerial++;comparisonSerial++;
  matchRequest?.abort();sourceRequest?.abort();comparisonRequest?.abort();
  boardAudio.stop();boardMotion.cancel();selected=null;renderBoard();
  scopeRelation=opened&&!researchScope.has(opened)?'当前阅读谱不在研究范围内；盘面与走子记录保留，沿谱操作已收起。':previousSource&&!researchScope.has(previousSource)?'原选来源已移出范围；盘面与走子记录保留，原注按新范围重新匹配。':'';
  if(!researchScope.has(sourceId)){sourceId=null;pathId=null;}
  if(openedGame&&researchScope.has(opened))syncLineIndex();
  comparisonResult=null;comparisonSelected.clear();comparisonPage=0;libraryLimit=50;
  $('comparison-groups').replaceChildren();$('comparison-count').textContent='';comparisonPaging(0);
  $('book-filter').value='';renderScope();renderContext();renderLibrary();void refreshMatches();
  if(fixedCondition)void queryComparison();
}
createScopePicker({getScope:()=>researchScope,apply:applyResearchScope,ResearchScope,allScope,emptyScope});
$('scope-return').addEventListener('click',()=>{if(!researchScope?.returnTo)return;applyResearchScope(researchScope.returnTo,researchScope.returnNotice);$('scope-edit').focus({preventScroll:true});});
const boardAudio=createBoardAudio({toggle:$('sound-toggle'),volume:$('sound-volume'),preview:$('sound-preview'),note:$('sound-note')});
const boardMotion=createBoardMotion($('board'),squares,boardAudio);let renderedState=null;
const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
function drawGrid(){
  const grid=$('board-lines');
  const boardGroup=svg('g',{transform:'translate(12 25)'});grid.append(boardGroup);
  const line=(x1,y1,x2,y2)=>boardGroup.append(svg('line',{x1,y1,x2,y2,stroke:'#876640','stroke-width':1.2}));
  for(let y=0;y<10;y++)line(30,30+y*60,510,30+y*60);
  for(let x=0;x<9;x++){if(x===0||x===8)line(30+x*60,30,30+x*60,570);else{line(30+x*60,30,30+x*60,270);line(30+x*60,330,30+x*60,570);}}
  for(const y of [30,450]){line(210,y,330,y+120);line(330,y,210,y+120);}
  for(let x=0;x<9;x++){for(const [y,t]of [[-1,String(x+1)],[614,'九八七六五四三二一'[x]]]){const tx=svg('text',{x:30+x*60,y,'text-anchor':'middle','font-size':11,fill:'#795936'});tx.textContent=t;boardGroup.append(tx);}}
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
function renderBoard(animate=false){
  const changed=renderedState!==state,uci=changed&&animate&&renderedState?findMove(renderedState,state):null;
  if(changed)boardMotion.cancel(animate);
  const visual=uci?boardMotion.prepare(...coords(uci)):null;
  const st=status(state,legal),dest=new Set(selected===null?[]:legal.filter(u=>coords(u)[0]===selected).map(u=>coords(u)[1]));
  const prev=cursor?findMove(timeline[cursor-1],state):null,last=prev?coords(prev):[];
  squares.forEach((b,i)=>{const p=state.board[i];b.className='square';b.classList.toggle('selected',selected===i);b.classList.toggle('legal',dest.has(i));b.classList.toggle('last',last.includes(i));b.classList.toggle('checked',st.check&&p===(state.turn==='w'?'K':'k'));b.setAttribute('aria-pressed',String(selected===i));b.setAttribute('aria-label',`${square(i)} ${p?(side(p)==='w'?'红':'黑')+pieceName(p):'空位'}${dest.has(i)?'，可落子':''}`);if(b.dataset.piece!==(p||'')){b.replaceChildren();b.dataset.piece=p||'';if(p){const disk=el('span',undefined,`piece ${side(p)==='w'?'red':'black'}`);disk.append(el('span',faceName(p),'piece-glyph'));b.append(disk);}}});
  renderedState=state;if(visual)boardMotion.play(visual,st.check);
  renderFocus();drawArrow();
  const turn=state.turn==='w'?'红':'黑';$('turn').textContent=st.ended?`${st.winner==='w'?'红':'黑'}方胜 · ${st.reason}`:`${turn}方行棋${st.check?' · 将军，须应将':''}`;
  $('turn-dot').classList.toggle('black',state.turn==='b');$('step').textContent=`第 ${cursor} 手`;
  $('undo').disabled=cursor===0;$('redo').disabled=cursor===timeline.length-1;
}
function arrowGeometry(sx,sy,cx,cy,ex,ey,headSize){
  const len=Math.hypot(ex-cx,ey-cy),ux=(ex-cx)/len,uy=(ey-cy)/len;
  const headLength=Math.min(headSize,len*.85,Math.hypot(ex-sx,ey-sy)*.4),bx=ex-ux*headLength,by=ey-uy*headLength;
  const tailLength=Math.hypot(bx-sx,by-sy),controlLength=Math.min(Math.max(len-headLength,tailLength*.2),tailLength*.5),tx=bx-ux*controlLength,ty=by-uy*controlLength;
  // The butt-ended shaft stops at the head base. A half-unit internal overlap
  // avoids raster seams; opacity is applied once to the entire arrow group.
  return {
    shaft:`M ${sx} ${sy} Q ${tx} ${ty} ${bx} ${by} L ${bx+ux*.5} ${by+uy*.5}`,
    edge:`M ${sx} ${sy} Q ${tx} ${ty} ${bx} ${by}`,
    head:`M ${bx-uy*headSize/2} ${by+ux*headSize/2} L ${ex} ${ey} L ${bx+uy*headSize/2} ${by-ux*headSize/2}`
  };
}
// All targets use the same rim/center rule. Short captures bend around the
// enlarged disks; choose the clearer side using actual occupied intersections.
function arrowRoute(x1,y1,x2,y2,occupied,width,bend,obstacles=[]){
  const dist=Math.hypot(x2-x1,y2-y1),ux=(x2-x1)/dist,uy=(y2-y1)/dist,nx=-uy,ny=ux;
  const headSize=13+3*(width-2.8)/4.2,detour=occupied?Math.max(0,88-dist)*1.6:0;
  const offsets=detour?[Math.max(detour,Math.abs(bend)*2),-Math.max(detour,Math.abs(bend)*2)]:[bend*2];
  const choices=offsets.map(offset=>{
    const cx=(x1+x2)/2+nx*offset,cy=(y1+y2)/2+ny*offset,len=Math.hypot(x2-cx,y2-cy),retreat=occupied?32:8;
    const shape=arrowGeometry(x1,y1,cx,cy,x2-(x2-cx)/len*retreat,y2-(y2-cy)/len*retreat,headSize);
    const q=shape.edge.match(/-?[\d.]+/g).map(Number);let score=0;
    for(let j=1;j<=20;j++){
      const t=j/20,x=(1-t)**2*q[0]+2*t*(1-t)*q[2]+t*t*q[4],y=(1-t)**2*q[1]+2*t*(1-t)*q[3]+t*t*q[5];
      score+=Math.max(0,12-x,x-552,12-y,y-638)*100;
      for(const [px,py]of obstacles){if(Math.hypot(px-x1,py-y1)<1||Math.hypot(px-x2,py-y2)<1)continue;score+=Math.max(0,30+width/2-Math.hypot(px-x,py-y))**2;}
    }
    // Stable tie break towards the interior of the board.
    score-=Math.sign(offset)*(nx*(282-(x1+x2)/2)+ny*(325-(y1+y2)/2))*.0001;
    return {shape,score};
  });
  return choices.sort((a,b)=>a.score-b.score)[0].shape;
}
function drawArrow(){
  const layer=$('arrows');layer.replaceChildren();$('arrow-count').textContent='';
  if(cursor===0&&positionKey(state)===positionKey(START)){$('arrow-count').textContent='红方首着不显示箭头。';return;}
  if(!$('show-arrow').checked){$('arrow-count').textContent='棋盘箭头已隐藏。';return;}
  if(!found||found.key!==positionKey(state))return;
  const moves=[...found.moves].filter(([uci])=>legal.includes(uci)).map(([uci,refs])=>{
    const [a,b]=coords(uci),x1=42+a%9*60,y1=55+Math.floor(a/9)*60,x2=42+b%9*60,y2=55+Math.floor(b/9)*60,dist=Math.hypot(x2-x1,y2-y1);
    return {uci,count:new Set(refs.map(r=>r.gameId)).size,a,b,x1,y1,x2,y2,dist,dx:(x2-x1)/dist,dy:(y2-y1)/dist};
  }).sort((a,b)=>b.count-a.count||a.uci.localeCompare(b.uci));
  if(!moves.length)return;
  $('arrow-count').textContent=`${moves.length} 种谱中着法。`;
  const min=Math.min(...moves.map(m=>m.count)),max=Math.max(...moves.map(m=>m.count));
  const obstacles=state.board.flatMap((p,i)=>p?[[42+i%9*60,55+Math.floor(i/9)*60]]:[]);
  moves.forEach(m=>{
    const weight=max===min?.5:(Math.log1p(m.count)-Math.log1p(min))/(Math.log1p(max)-Math.log1p(min));
    const width=2.8+4.2*weight,opacity=.72+.24*weight,color=`rgb(18 ${105-Math.round(36*weight)} ${124-Math.round(38*weight)})`;
    // Separate collinear moves from the same square; each still ends at its own real destination.
    const ray=moves.filter(n=>n.a===m.a&&Math.abs(n.dx-m.dx)<1e-6&&Math.abs(n.dy-m.dy)<1e-6).sort((a,b)=>a.dist-b.dist);
    const bendLimit=Math.min(24,(m.dist-43)/8),bend=Math.max(-bendLimit,Math.min(bendLimit,(ray.indexOf(m)-(ray.length-1)/2)*18));
    const shape=arrowRoute(m.x1,m.y1,m.x2,m.y2,Boolean(state.board[m.b]),width,bend,obstacles);
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
  if(side(state.board[i])===state.turn){boardAudio.stop();boardMotion.cancel(true);selected=selected===i?null:i;renderBoard();if(selected!==null)boardAudio.play('select');message(selected===null?'已取消选择。':`已选${state.turn==='w'?'红':'黑'}${pieceName(state.board[i])}（${square(i)}），圆点标出合法落点。`);}
  else if(selected!==null)message('这里不能落子：须符合棋子走法，且走后不能使己方将帅被将军。');
  else message(`现在轮到${state.turn==='w'?'红':'黑'}方，请先选择这一方的棋子。`);
}
function findMove(before,after){let a=-1,b=-1;for(let i=0;i<90;i++)if(before.board[i]!==after.board[i]){if(!after.board[i])a=i;else b=i;}return a>=0&&b>=0?square(a)+square(b):null;}
function move(uci){
  cancelOpen();
  if(!legal.includes(uci))return;boardAudio.stop();const label=notation(state,uci);timeline=timeline.slice(0,cursor+1);state=apply(state,uci);timeline.push(state);cursor++;selected=null;syncLineIndex();refresh(true);const st=status(state,legal);message(`${label}。${st.ended?'本局结束：'+st.reason:st.check?'将军，请应将。':`轮到${state.turn==='w'?'红':'黑'}方。`}`);
}
function cancelOpen(){closeFollowup?.();openSerial++;openRequest?.abort();$('comparison-entry-message').textContent='';}
function syncLineIndex(){
  if(!openedGame||!researchScope?.has(opened))return;const line=currentLine();
  if(timeline.slice(0,cursor+1).every((s,i)=>line.node_ids[i]&&positionKey(openedGame.nodes[line.node_ids[i]].fen)===positionKey(s))){lineIndex=cursor;sourceId=opened;pathId=line.node_ids[cursor];}
  else lineIndex=line.node_ids.findIndex(n=>positionKey(openedGame.nodes[n].fen)===positionKey(state));
}
function refresh(animate=false){boardAudio.stop();legal=legalMoves(state);renderBoard(animate);renderContext();renderHistory();renderComparisonProgress();void refreshMatches();}
function setAnnotationCue(present){$('annotation-cue').hidden=!present;$('annotation-cue').textContent=present?'有原注':'';}
function clearSource(){
  closeFollowup?.();
  sourceRequest?.abort();sourceSerial++;setAnnotationCue(false);noteReader.clear();
  $('source-content').replaceChildren();$('source-content').setAttribute('aria-busy','false');
}
function clearMatches(){found=null;choice=null;moveSources.clear();$('next-moves').replaceChildren();$('source-select').replaceChildren();$('source-total').textContent='';clearSource();$('match-body').hidden=true;$('no-match').hidden=true;drawArrow();}
async function refreshMatches(){
  const ticket=++matchSerial,lib=library;
  matchRequest?.abort();sourceRequest?.abort();sourceSerial++;matchRequest=new AbortController();
  clearMatches();
  if(!lib?.catalogue){$('match-count').textContent=loading?'正在读取书目，自战棋盘已可使用。':'书目尚未加载。';if(!loading)noteReader.clear('书目未加载，原注尚不能确定。','error');return;}
  $('data-error').hidden=true;$('match-count').textContent='正在研究范围内查找当前局面…';
  if(!researchScope?.ids.size){noteReader.clear('研究范围为空，请选择棋谱。','empty-scope');$('match-count').textContent='研究范围为空，尚未选择棋谱。';$('no-match').hidden=false;$('no-match-title').textContent='空范围 · 尚未选择棋谱';return;}
  try{
    const result=await lib.lookup(state,matchRequest.signal);
    if(ticket!==matchSerial||lib!==library)return;
    found=researchScope.position(result);const count=found.sources.size;
    $('match-count').textContent=count?`找到 ${count} 局棋谱 · ${found.occurrences} 条匹配路径`:'已查找当前研究范围，本局面未命中';
    $('no-match-title').textContent='当前研究范围内暂无相同局面';
    $('no-match').hidden=count>0;$('match-body').hidden=count===0;
    if(!count){noteReader.clear('当前研究范围内未找到对应棋谱。','unmatched');return;}
    choice=found.moves.keys().next().value||null;
    if(!found.sources.has(sourceId))sourceId=found.sources.has(opened)?opened:found.sources.keys().next().value;
    alignChoiceToSource();$('source-search').value='';renderSourceOptions();renderNext();drawArrow();void renderSource();
  }catch(error){if(ticket!==matchSerial||lib!==library||error.name==='AbortError')return;
    noteReader.clear('局面查找未完成，原注尚不能确定。','error');$('match-count').textContent='局面查找未完成';$('data-error').hidden=false;$('error-text').textContent=`查找当前局面时读取失败，尚不能判断是否有匹配。${error.userMessage||''} 自战仍可继续。`;
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
  $('source-filter-status').textContent=!list.length?'没有符合搜索的棋谱，清空关键词可恢复。':query&&!$('source-select').value?'请选择搜索结果；下方仍为当前所选来源的原注。':'';
}
function alignChoiceToSource(){
  const source=found.sources.get(sourceId);if(!source)return;
  if(!source.paths.includes(pathId))pathId=source.paths[0];
  const matches=ref=>ref.gameId===sourceId&&ref.nodeId===pathId;
  if(!(found.moves.get(choice)||[]).some(matches))choice=[...found.moves].find(([,refs])=>refs.some(matches))?.[0]||null;
  if(choice)moveSources.set(choice,(found.moves.get(choice)).find(matches));
}
function chooseMoveSource(uci,ref,readAfter=false){
  choice=uci;sourceId=ref.gameId;pathId=ref.nodeId;moveSources.set(uci,ref);
  $('source-search').value='';renderSourceOptions();renderNext();drawArrow();void renderSource(readAfter?'after':undefined);
}
function renderNext(){
  const container=$('next-moves'),active=document.activeElement,focusRow=active?.closest('.move-row'),focused=focusRow?{uci:focusRow.dataset.move,kind:active.dataset.control}:null,scroll=container.scrollTop;
  const panels=new Map([...container.querySelectorAll('.move-row')].map(n=>[n.dataset.move,{open:n.querySelector('[data-control=expand]')?.getAttribute('aria-expanded')==='true',query:n.querySelector('input')?.value||''}]));
  $('next-moves').replaceChildren(...[...found.moves].map(([uci,refs])=>{
    const ref=moveSources.get(uci)||refs[0],game=library.catalogue.games[ref.gameId];
    const label=notation(state,uci),count=new Set(refs.map(r=>r.gameId)).size,row=el('div',undefined,'move-row'),b=el('button',undefined,'move-choice');row.dataset.move=uci;row.dataset.selected=String(choice===uci);
    b.dataset.uci=uci;b.dataset.control='choose';b.dataset.game=ref.gameId;b.dataset.path=ref.nodeId;b.setAttribute('aria-pressed',String(choice===uci));b.setAttribute('aria-label',`${label}，${count} 局棋谱记载，${game.title}，${uci}`);
    const head=el('div',undefined,'move-row-heading'),badge=el('span',String(count),`move-count${count>=100?' capsule':''}`);badge.setAttribute('aria-hidden','true');b.append(el('span',label,'move-name'),badge);
    b.addEventListener('click',()=>chooseMoveSource(uci,ref));head.append(b);
    const sourceLine=el('div',undefined,'move-source-line'),title=el('span',game.title,'move-source-title');sourceLine.append(title);
    let fields=null,toggle=null;
    const paths=[...new Map(refs.map(r=>[JSON.stringify([r.gameId,r.nodeId]),r])).values()];
    if(paths.length>1){
      fields=el('div',undefined,'move-source-fields');fields.id=`move-fields-${uci}`;fields.hidden=!panels.get(uci)?.open;
      toggle=el('button',fields.hidden?'换谱 ▾':'换谱 ▴','quiet move-source-toggle');toggle.dataset.control='expand';toggle.setAttribute('aria-label',`${label}：更换棋谱与来源路径`);toggle.setAttribute('aria-expanded',String(!fields.hidden));toggle.setAttribute('aria-controls',fields.id);
      const search=el('input'),select=el('select'),status=el('p',undefined,'move-source-status');search.type='search';search.id=`move-search-${uci}`;search.dataset.control='search';search.placeholder='搜索此着法的棋谱';search.value=panels.get(uci)?.query||'';
      const searchLabel=el('label','搜索此着法的棋谱','sr-only');searchLabel.htmlFor=search.id;select.dataset.control='source';select.setAttribute('aria-label',`${label}的棋谱与路径`);status.setAttribute('role','status');
      const filter=()=>{
        const query=search.value.trim(),filtered=paths.filter(r=>{const g=library.catalogue.games[r.gameId];return !query||`${g.title} ${library.bookNames(g)}`.includes(query);});
        select.replaceChildren(...filtered.map(r=>{const g=library.catalogue.games[r.gameId],o=el('option',`${g.title} · ${pathLabel(r.nodeId)}${g.status==='partial'?' · 部分可用':''}`);o.value=JSON.stringify([r.gameId,r.nodeId]);return o;}));
        select.value=JSON.stringify([ref.gameId,ref.nodeId]);select.disabled=!filtered.length;
        status.textContent=filtered.length?`${new Set(filtered.map(r=>r.gameId)).size} 局 · ${filtered.length} 条路径${!select.value?' · 请选择，当前原注不变':''}`:'没有符合搜索的棋谱，清空关键词可恢复。';
      };
      search.addEventListener('input',filter);select.addEventListener('change',()=>{const [id,path]=JSON.parse(select.value);chooseMoveSource(uci,paths.find(r=>r.gameId===id&&r.nodeId===path));});filter();
      toggle.addEventListener('click',()=>{fields.hidden=!fields.hidden;toggle.setAttribute('aria-expanded',String(!fields.hidden));toggle.textContent=fields.hidden?'换谱 ▾':'换谱 ▴';if(fields.hidden)return;const box=container.getBoundingClientRect(),bounds=row.getBoundingClientRect();if(bounds.bottom>box.bottom)container.scrollTop+=bounds.bottom-box.bottom;if(bounds.height<=box.height&&row.getBoundingClientRect().top<box.top)container.scrollTop-=box.top-row.getBoundingClientRect().top;});
      fields.append(el('p','此着法的棋谱与来源路径','move-source-label'),searchLabel,search,select,status);
    }
    const only=el('button','只看本谱','quiet move-only');only.dataset.control='only';only.dataset.game=ref.gameId;only.setAttribute('aria-label','只看本谱：'+game.title);
    only.addEventListener('click',()=>{sourceId=ref.gameId;pathId=ref.nodeId;applyResearchScope(researchScope.onlyGame(ref.gameId).preference);$('scope-return').focus({preventScroll:true});});sourceLine.append(only);
    const cached=library.bodies.get(ref.gameId);
    if(cached&&afterNotes(cached,ref,uci).length){const read=el('button','走后原注','quiet move-read-note');read.dataset.control='read-note';read.setAttribute('aria-label',`阅读走后原注：${game.title} · ${pathLabel(ref.childId)}`);read.addEventListener('click',()=>chooseMoveSource(uci,ref,true));head.append(read);}
    if(toggle)head.append(toggle);row.append(head,sourceLine);if(fields)row.append(fields);return row;
  }));
  container.scrollTop=scroll;if(focused)container.querySelector(`[data-move="${focused.uci}"] [data-control="${focused.kind}"]`)?.focus({preventScroll:true});
  $('next-note').textContent=choice?'选着法只预览，确认后落子。':'所选来源已无后续着法，可继续自战。';
  $('play-choice').disabled=!choice||!legal.includes(choice);$('play-choice').textContent=choice?`走这一步 · ${notation(state,choice)}`:'没有谱中后续着法';
}
async function renderSource(preferred){
  closeFollowup?.();
  setAnnotationCue(false);noteReader.clear('正在读取所选棋谱原注…');
  const ticket=++sourceSerial,lib=library,gameId=sourceId,nodeId=pathId,moveChoice=choice,position=found?.key;
  sourceRequest?.abort();sourceRequest=new AbortController();const box=$('source-content');
  box.replaceChildren(el('p','正在读取所选棋谱原文…','muted'));box.setAttribute('aria-busy','true');
  try{
    const game=await lib.game(gameId,sourceRequest.signal);
    if(ticket!==sourceSerial||lib!==library||position!==found?.key||gameId!==sourceId||nodeId!==pathId||moveChoice!==choice)return;
    const node=game.nodes[nodeId];if(!node)throw new Error('Missing indexed node');
    box.replaceChildren();box.append(el('h3',game.title,'source-title'));
    box.append(el('p',`${lib.bookNames(game)} · ${pathLabel(nodeId)}`,'source-path'));
    if(game.status==='partial')box.append(el('p',partialText(game),'partial-notice'));
    const followupHost=el('div',undefined,'followup-host');box.append(followupHost);
    const refs=moveChoice?(found.moves.get(moveChoice)||[]).filter(r=>r.gameId===gameId&&r.nodeId===nodeId):[];
    const after=[...new Set(refs.map(r=>r.childId))].map(id=>game.nodes[id]);
    noteReader.show({game,node,after,preferred,book:lib.bookNames(game)});
    const ctx=game.page_context||{};
    if(ctx.summary_text?.trim()){const d=el('details',undefined,'summary');d.append(el('summary','整局说明 · 与当前步无关'),el('p',ctx.summary_text));box.append(d);}
    const unlocated=game.annotations.filter(a=>a.status==='unresolved'&&a.text.trim());
    if(unlocated.length){const d=el('details',undefined,'summary unlocated-notes');d.append(el('summary',`未定位原注 · ${unlocated.length} 条，不作为当前步结论`));for(const a of unlocated)d.append(el('p',a.text));box.append(d);}
    const open=el('button','从此谱开局推演','quiet source-open');open.addEventListener('click',()=>void openGame(gameId));box.append(open);
    if(moveChoice){const refs=(found.moves.get(moveChoice)||[]).filter(r=>r.gameId===gameId&&r.nodeId===nodeId);appendFollowup(followupHost,game,node,moveChoice,refs.map(r=>r.childId));}
    setAnnotationCue([node,...after].some(n=>annotations(game,n).length));renderNext();if(preferred==='after')noteReader.focus();
  }catch(error){
    if(ticket!==sourceSerial||lib!==library||error.name==='AbortError')return;
    setAnnotationCue(false);noteReader.error('所选棋谱原注读取失败，尚不能判断有无原注。',()=>void renderSource());
    box.replaceChildren(el('p',`所选棋谱原文读取失败。${error.userMessage||''} 来源与箭头仍可查看，原注暂不可读。`,'body-error'));
    const retry=el('button','重试所选棋谱');retry.id='retry-body';retry.addEventListener('click',()=>void renderSource());
    const reload=el('button','重新读取书目','quiet');reload.addEventListener('click',()=>void loadData());box.append(retry,reload);
  }finally{if(ticket===sourceSerial)box.setAttribute('aria-busy','false');}
}
function appendFollowup(parent,game,start,uci,childIds){
  const routes=followupLines(game,start.id,uci,childIds);if(!routes.length)return;
  const sourceBox=parent.closest('#source-content');
  const preferred=routes.find(r=>opened===game.id&&r.line.id===lineId)||routes.find(r=>r.line.id===start.line_id);
  let route=preferred||routes.find(r=>r.line.id===game.nodes[r.ids[1]].line_id)||routes[0],index=0,page=0,validated=null,validatedLine=null,claims=[],whole=null;
  const defaultId=route.line.id,lineName=id=>id==='0'?'主线':'分支 '+id;
  const section=el('section',undefined,'followup'),label=el('label',notation(parseFen(start.fen),uci)+'之后 · '+routes.length+' 条线路','field-label'),select=el('select');
  section.dataset.game=game.id;section.dataset.start=start.id;section.dataset.choice=uci;
  label.htmlFor='followup-line';select.id='followup-line';
  for(const r of routes){const o=el('option',lineName(r.line.id)+' · 后续 '+(r.ids.length-1)+' 手'+(r.line.id===defaultId?(preferred?' · 默认续接':' · 默认可达线路'):'')+(r.line.first_failure?' · 后续缺损':''));o.value=r.line.id;select.append(o);}
  const summary=el('div',undefined,'followup-summary');summary.id='followup-summary';summary.tabIndex=-1;
  const result=el('p',undefined,'followup-result'),claim=el('div',undefined,'followup-conclusion'),claimLabel=el('p',undefined,'followup-claim-label'),quote=el('p',undefined,'followup-quote'),claimPath=el('p',undefined,'annotation-path'),locate=el('button','看结论位置','quiet');
  const reference=el('button','阅读这段原注','quiet reader-reference');reference.hidden=true;reference.addEventListener('click',()=>readOriginal(claims.at(-1).annotationId));
  claim.append(claimLabel,quote,reference,claimPath,locate);summary.append(result,claim);
  const toggle=el('button','展开线路预览','followup-toggle');toggle.id='followup-toggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','followup-panel');
  const panel=el('div',undefined,'followup-panel');panel.id='followup-panel';panel.hidden=true;
  const head=el('div',undefined,'followup-head'),title=el('h4','线路预览'),close=el('button','收起','quiet');close.id='followup-close';head.append(title,close);
  const other=el('details',undefined,'followup-other'),otherTitle=el('summary'),otherList=el('div');other.append(otherTitle,otherList);
  const reading=el('div',undefined,'followup-reading'),visual=el('div',undefined,'followup-visual'),sequence=el('div',undefined,'followup-sequence');
  const board=el('div',undefined,'mini-board-box followup-board'),position=el('p',undefined,'followup-position');position.id='followup-position';position.tabIndex=-1;position.setAttribute('role','status');
  const nav=el('div',undefined,'followup-nav');
  const buttons=[['start','回起点',()=>0],['prev','← 前一步',()=>index-1],['next','后一步 →',()=>index+1],['end','看末端',()=>route.ids.length-1]].map(([id,text,target])=>{const b=el('button',text,'quiet');b.id='followup-'+id;b.addEventListener('click',()=>go(target()));nav.append(b);return b;});
  const moves=el('ol',undefined,'followup-moves'),paging=el('div',undefined,'followup-pages'),prevPage=el('button','前10步','quiet'),pageText=el('span'),nextPage=el('button','后10步','quiet');paging.append(prevPage,pageText,nextPage);
  const note=el('div',undefined,'followup-note'),end=el('p',undefined,'followup-end'),errorBox=el('p',undefined,'body-error');errorBox.hidden=true;
  const validate=()=>{if(validatedLine===route.line)return;validated=originalPath(game,route.ids.at(-1));if(validated.nodes.length!==route.line.node_ids.length||validated.nodes.some((n,i)=>n.id!==route.line.node_ids[i]))throw new Error('线路与父子路径不一致');validatedLine=route.line;};
  const readOriginal=id=>noteReader.reveal(id,()=>{if(!section.isConnected)return;const target=panel.hidden?toggle:position;target.scrollIntoView({block:'center'});target.focus({preventScroll:true});});
  const fail=error=>{errorBox.hidden=false;errorBox.textContent='此线路暂不能可靠还原：'+error.message+'。可重新选择线路；主盘未改变。';reading.hidden=note.hidden=true;};
  function synchronizeOriginals(){
    const c=claims.at(-1),owned=noteReader.visibleIds();
    quote.hidden=!c||owned.has(c.annotationId);
    reference.hidden=!c||!owned.has(c.annotationId);
  }
  function summarize(){
    claims=lineConclusions(game,route);whole=gameResult(library.manifest.library_id,game,route);
    section.dataset.line=route.line.id;section.dataset.node=route.ids[index];select.value=route.line.id;
    const c=claims.at(-1),same=whole&&c?.kind==='result'&&whole.value===c.label;
    result.hidden=!whole||same;result.dataset.result=whole?.value||'';result.textContent=whole?'本谱对局结果：'+whole.value+' · 仅属主线整局':'';summary.dataset.gameResult=whole?.value||'';
    if(c){claim.dataset.node=c.nodeId;claim.dataset.kind=c.kind;claimLabel.textContent=(claims.length>1?'本线末处明确谱注':'本线谱注')+(c.nodeId===route.ids[1]?' · 所选着法走后':'')+(same?' · 与本谱对局结果一致':'');quote.textContent=c.text;quote.hidden=false;quote.dataset.annotation=c.annotationId;claimPath.textContent=pathLabel(c.nodeId)+' · 距当前源节点 '+c.distance+' 手'+(c.kind==='material'&&!/[红黑]/.test(c.text)?' · 原注未指明红黑':'');locate.hidden=false;}
    else{delete claim.dataset.node;delete claim.dataset.kind;claimLabel.textContent='本线后续暂无可直接确认的谱注结论';quote.textContent='';quote.hidden=true;claimPath.textContent=lineName(route.line.id)+' · 后续 '+(route.ids.length-1)+' 手'+(route.line.first_failure?' · 后续有缺损':'');locate.hidden=true;}
    other.hidden=claims.length<=1;otherTitle.textContent='本线其他 '+Math.max(0,claims.length-1)+' 处谱注';otherList.replaceChildren(...claims.slice(0,-1).map(c=>{const b=el('button',pathLabel(c.nodeId)+' · '+c.text,'quiet');b.addEventListener('click',()=>jump(c.nodeId));return b;}));
    synchronizeOriginals();
  }
  function drawMoves(){
    const first=page*10,last=Math.min(route.ids.length,first+10);moves.start=start.ply+first;
    moves.replaceChildren(...route.ids.slice(first,last).map((id,j)=>{const i=first+j,n=game.nodes[id],li=el('li'),b=el('button',i===0?'第 '+n.ply+' 手 · 起点':'第 '+n.ply+' 手 · '+notation(validated.states[n.ply-1],n.move.uci),'quiet');b.dataset.node=id;b.dataset.index=i;b.setAttribute('aria-current',i===index?'step':'false');b.addEventListener('click',()=>go(i));li.append(b);return li;}));
    prevPage.disabled=page===0;nextPage.disabled=last===route.ids.length;pageText.textContent=(page+1)+' / '+Math.ceil(route.ids.length/10)+' 页';
  }
  function draw(){
    const node=game.nodes[route.ids[index]],anns=annotations(game,node),c=claims.at(-1);section.dataset.node=node.id;reading.hidden=false;errorBox.hidden=true;
    const miniature=miniBoard(node.fen,index?node.move.uci:null,'followup');miniature.setAttribute('aria-label','后续预览，'+pathLabel(node.id)+'，黑方在上，红方在下，轮'+(parseFen(node.fen).turn==='w'?'红':'黑')+'方走');board.replaceChildren(miniature);
    position.textContent=pathLabel(node.id)+' · 后续 '+index+' / '+(route.ids.length-1)+' 手'+(index===0?' · 起点':' · '+notation(validated.states[node.ply-1],node.move.uci));
    buttons[0].disabled=buttons[1].disabled=index===0;buttons[2].disabled=buttons[3].disabled=index===route.ids.length-1;
    note.replaceChildren();const owned=noteReader.visibleIds(),remaining=anns.filter(a=>a.id!==c?.annotationId&&!owned.has(a.id));note.hidden=!remaining.length;
    const context=node.id===start.id?'当前源局面':node.parent_id===start.id?'所选着法走后':'小盘当前节点';
    if(remaining.length){note.append(el('h5',context+'原注 · '+pathLabel(node.id)));for(const a of remaining){const p=el('p',a.text,'followup-original');p.dataset.annotation=a.id;note.append(p);}}
    else if(!anns.length)position.textContent+=' · 无原注';
    else if(anns.some(a=>owned.has(a.id))){note.hidden=false;for(const a of anns.filter(a=>owned.has(a.id))){const read=el('button','阅读这段原注','quiet reader-reference');read.addEventListener('click',()=>readOriginal(a.id));note.append(read);}}
    end.textContent=index===route.ids.length-1?(route.line.first_failure?'已到可核实内容末尾，后续有缺损；不推断终局。':'已到本线谱中末尾；末尾不等于终局。'):'';
    drawMoves();synchronizeOriginals();
  }
  function go(target){const focused=document.activeElement?.closest('.followup-moves')?document.activeElement.dataset.node:null;index=Math.max(0,Math.min(route.ids.length-1,target));page=Math.floor(index/10);try{validate();draw();if(focused)moves.querySelector('[data-node="'+focused+'"]')?.focus({preventScroll:true});}catch(e){fail(e);synchronizeOriginals();}}
  function expand(){closeFollowup?.();closeFollowup=collapse;panel.hidden=false;toggle.textContent='收起线路预览';toggle.setAttribute('aria-expanded','true');go(index);}
  function jump(id){index=route.ids.indexOf(id);if(panel.hidden)expand();else go(index);position.scrollIntoView({block:'nearest'});position.focus({preventScroll:true});}
  function collapse(focus=false){panel.hidden=true;toggle.textContent='展开线路预览';toggle.setAttribute('aria-expanded','false');synchronizeOriginals();if(focus)toggle.focus({preventScroll:true});if(closeFollowup===collapse)closeFollowup=null;}
  locate.addEventListener('click',()=>jump(claims.at(-1).nodeId));
  prevPage.addEventListener('click',()=>{page--;drawMoves();});nextPage.addEventListener('click',()=>{page++;drawMoves();});
  select.addEventListener('change',()=>{route=routes.find(r=>r.line.id===select.value);index=0;page=0;summarize();if(!panel.hidden)go(0);});
  toggle.addEventListener('click',()=>panel.hidden?expand():collapse());close.addEventListener('click',()=>collapse(true));
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();collapse(true);}});
  visual.append(board,position,nav);sequence.append(moves,paging);reading.append(visual,sequence);
  panel.append(head,other,errorBox,reading,note,end);section.append(label,select,summary,toggle,panel);parent.append(section);summarize();noteReader.onChange=()=>{if(panel.hidden)synchronizeOriginals();else draw();};
}
function renderLineOptions(g){
$('line-select').replaceChildren(...g.lines.filter(l=>l.node_ids.length).map(l=>{const o=el('option',`${l.id==='0'?'主线':`分支 ${l.id} · 从第 ${l.start_ply} 手变化`} · ${l.node_ids.length-1} 手${l.first_failure?' · 后续有缺损':''}`);o.value=l.id;return o;}));
  $('line-select').value=lineId;
}
function currentLine(){return openedGame?.lines.find(l=>l.id===lineId);}
function renderContext(){
  const excluded=openedGame&&!researchScope?.has(opened);
  $('line-controls').hidden=!openedGame||excluded;$('game-warning').hidden=openedGame?.status!=='partial';
  if(!openedGame){$('game-title').textContent='自由自战 · 标准开局';$('game-note').textContent='红黑双方均由你走棋。';return;}
  const g=openedGame,line=currentLine();$('game-title').textContent=g.title;$('game-note').textContent=`${library.bookNames(g)} · ${excluded?'范围外阅读谱 · 仅保留当前盘面与历史':'标准布子，红方先行'}`;
  $('game-warning').textContent=g.status==='partial'?partialText(g):'';
  $('line-prev').disabled=lineIndex<=0;$('line-next').disabled=lineIndex<0||lineIndex>=line.node_ids.length-1;
  $('line-status').textContent=lineIndex<0?'当前已离开所选线路，可继续自战或回到标准开局。':`${lineId==='0'?'主线':`分支 ${lineId}`} · ${lineIndex} / ${line.node_ids.length-1} 手${lineIndex===line.node_ids.length-1?(line.first_failure?' · 已到可核实内容的末尾':' · 已到谱中末尾'):''}`;
}
function renderHistory(){
  $('history-count').textContent=`${cursor} 手`;$('history').replaceChildren();for(let i=1;i<=cursor;i++){const u=findMove(timeline[i-1],timeline[i]);if(u)$('history').append(el('li',`${notation(timeline[i-1],u)} · ${u}`));}
}
function fresh(initial){state=parseFen(initial);timeline=[state];cursor=0;selected=null;choice=null;pathId=null;refresh();}
async function openGame(id){
  if(!researchScope?.has(id))return;
  closeFollowup?.();
  const ticket=++openSerial,lib=library;openRequest?.abort();openRequest=new AbortController();
  $('library-message').textContent='正在打开所选棋谱…';message('正在读取所选棋谱…');
  try{
    const g=await lib.game(id,openRequest.signal);if(ticket!==openSerial||lib!==library||!researchScope.has(id))return;
    opened=id;openedGame=g;lineId='0';lineIndex=0;sourceId=id;scopeRelation='';renderScope();
    renderLineOptions(g);
    $('library-dialog').close();$('library-message').textContent='';fresh(g.root_fen);message('已从标准开局打开。可沿谱走，也可自行落子。');
  }catch(error){if(ticket!==openSerial||lib!==library||error.name==='AbortError')return;
    const text=`所选棋谱未能打开。${error.userMessage||''} 请再次选择以重试。`;$('library-message').textContent=text;message(text);
  }
}
function goLine(index){
  if(!researchScope?.has(opened))return;
  cancelOpen();const animate=Math.abs(index-lineIndex)===1,g=openedGame,line=currentLine();lineIndex=Math.max(0,Math.min(index,line.node_ids.length-1));timeline=line.node_ids.slice(0,lineIndex+1).map(n=>parseFen(g.nodes[n].fen));cursor=timeline.length-1;state=timeline[cursor];selected=null;choice=null;pathId=line.node_ids[lineIndex];sourceId=opened;refresh(animate);message(`已到${lineId==='0'?'主线':'分支 '+lineId}第 ${lineIndex} 手。`);
}
function renderLibrary(){
  if(!library?.catalogue){$('library-count').textContent=loading?'书目正在加载…':'书目未能加载，请关闭后重试。';$('game-list').replaceChildren();$('more-games').hidden=true;return;}
  const previousBook=$('book-filter').value,search=$('search').value.trim(),within=Object.values(library.catalogue.games).filter(g=>researchScope?.has(g.id));
  const availableBooks=library.manifest.books.map(b=>({...b,count:within.filter(g=>g.book_ids.includes(b.id)).length})).filter(b=>b.count);
  $('book-filter').replaceChildren(el('option','范围内全部作品'),...availableBooks.map(b=>{const o=el('option',`${b.title} · ${b.count} 局在范围内`);o.value=b.id;return o;}));$('book-filter').firstChild.value='';
  $('book-filter').value=availableBooks.some(b=>b.id===previousBook)?previousBook:'';const book=$('book-filter').value;
  const games=Object.values(library.catalogue.games).filter(g=>researchScope?.has(g.id)&&(!book||g.book_ids.includes(book))&&(!search||`${g.title} ${library.bookNames(g)}`.includes(search)));
  $('library-scope').textContent=`研究范围：${researchScope?.label||'读取中'}`;
  $('library-count').textContent=games.length?`${games.length} 局 · 当前显示 ${Math.min(libraryLimit,games.length)} 局`:!researchScope?.ids.size?'研究范围为空，请关闭书架后选择研究范围或恢复全部。':'范围内未找到相符棋谱，可清空局部搜索或修改研究范围。';
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
  $('browse-count').textContent='读取中';$('collection-summary').textContent='棋谱书目读取中';renderLibrary();renderScope();
  try{
    await lib.open();if(ticket!==session)return;
    researchScope=researchScope?new ResearchScope(lib.catalogue,lib.manifest.books,researchScope.preference):readScope(lib.catalogue,lib.manifest.books);
    const m=lib.manifest,available=m.books.filter(b=>b.game_ids.length).length;
    $('browse-count').textContent=`${m.counts.runtime_games} 局 ↗`;
    $('collection-summary').textContent=`${m.books.length} 部目录 · ${available} 部含可用棋谱 · 共 ${m.counts.runtime_games} 局，其中 ${m.counts.game_statuses.partial||0} 局部分可用`;
    $('library-summary').textContent=`${m.books.length} 部目录 · ${m.counts.runtime_games} 局已纳入`;
    $('book-filter').replaceChildren(el('option','全部目录'),...m.books.map(b=>{const o=el('option',`${b.title} · ${b.game_ids.length} 局可用`);o.value=b.id;return o;}));$('book-filter').firstChild.value='';$('book-filter').disabled=false;
    loading=false;renderScope();renderLibrary();await refreshMatches();if(fixedCondition)void queryComparison();
  }catch(error){if(ticket!==session||error.name==='AbortError')return;
    lib.dispose();clearMatches();noteReader.clear('书目读取失败，原注尚不能确定。','error');$('data-error').hidden=false;$('error-text').textContent=`书目加载失败，尚未查找局面。${error.userMessage||''} 自战仍可继续。`;$('match-count').textContent='书目未加载';$('library-summary').textContent='棋谱书目暂不可读';$('browse-count').textContent='暂不可读';$('collection-summary').textContent='棋谱库暂不可读';if(comparisonMode)comparisonError('书目未加载，比较暂不可用。请重新读取书目。');
  }finally{if(ticket===session){loading=false;renderLibrary();renderScope();}}
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
  renderComparisonProgress();
}
function renderComparisonProgress(){
  if(!fixedCondition)return;
  const name=fixedCondition.side==='w'?'红':'黑',fixed=fixedCondition.moves;let current;
  try{current=conditionFromHistory(timeline,cursor,fixedCondition.side).moves;}catch{$('comparison-progress').textContent='当前推演起点不同；仍按已固定走法比较。';$('comparison-progress').dataset.different='true';return;}
  const common=fixed.slice(0,Math.min(fixed.length,current.length)).every((u,i)=>u===current[i]),same=common&&fixed.length===current.length;
  $('comparison-progress').dataset.different=String(!same);
  $('comparison-progress').textContent=same?`当前${name}方走法与条件一致 · 推演第 ${cursor} 手`:`当前${name}方已走 ${current.length} 步${common?'':'，走序已不同'}；结果仍按固定的 ${fixed.length} 步。`;
}
function freezeComparison(){
  cancelOpen();$('comparison-entry-message').textContent='';
  const side=document.querySelector('input[name=comparison-side]:checked').value;
  try{fixedCondition=conditionFromHistory(timeline,cursor,side);}catch(error){comparisonError(error.message);return;}
  const red=side==='w',count=fixedCondition.moves.length;
  $('comparison-fixed').textContent=`已固定${red?'红':'黑'}方 · ${count} 步${count?' · 查看走序':' · 尚未走子'}`;
  $('comparison-moves').replaceChildren(...fixedCondition.moves.map((u,i)=>el('li',`${fixedCondition.labels[i]} · ${u}`)));
  $('comparison-sequence').open=false;
  $('comparison-stage').textContent=red?(count?`比较黑方应完第 ${count} 步后、轮红方走的局面。`:'红方零步：标准开局，轮红方走。'):(count?`比较黑方走完第 ${count} 步、红方随后应完，轮黑方走的局面。`:'黑方零步：比较红方不同首着之后、轮黑方走的局面。');
  $('comparison-freeze').textContent='用当前走法更新';$('comparison-search').value='';comparisonPage=0;comparisonSelected.clear();renderComparisonProgress();void queryComparison();
}
function comparisonError(text){
  $('comparison-status').textContent='比较未完成';$('comparison-error').hidden=false;$('comparison-error-text').textContent=text;
}
async function queryComparison(){
  const ticket=++comparisonSerial,lib=library,fixed=fixedCondition;comparisonRequest?.abort();comparisonRequest=new AbortController();
  comparisonResult=null;$('comparison-groups').replaceChildren();$('comparison-count').textContent='';$('comparison-error').hidden=true;$('comparison-search').disabled=true;comparisonPaging(0);
  if(!lib?.catalogue){comparisonError('请先完成书目读取，再重试比较。');return;}
  $('comparison-status').textContent='正在研究范围内查找相同己方走法…';renderScope();
  if(!researchScope?.ids.size){$('comparison-status').textContent='研究范围为空；固定走法已保留，请选择棋谱或恢复全部。';return;}
  const loader=comparisonLoader||(comparisonLoader=new Comparison({library:lib}));
  try{
    const result=await loader.lookup(fixed.side,fixed.moves,comparisonRequest.signal);
    if(ticket!==comparisonSerial||loader!==comparisonLoader||lib!==library||fixed!==fixedCondition)return;
    comparisonResult=researchScope.comparison(result.condition);$('comparison-search').disabled=!comparisonResult?.groups.length;
    if(!comparisonResult?.groups.length){$('comparison-status').textContent='当前研究范围内暂无相同顺序的己方走法。固定条件已保留，可修改研究范围或继续自战。';return;}
    $('comparison-status').textContent=`${comparisonResult.game_count} 局棋谱 · ${comparisonResult.group_count} 种局面 · ${comparisonResult.path_count} 条原谱路径`;
    renderComparisonGroups();
  }catch(error){if(ticket!==comparisonSerial||loader!==comparisonLoader||error.name==='AbortError')return;comparisonError(`比较资料读取失败，尚不能判断是否有结果。${error.userMessage||error.message}`);}
}
function miniBoard(key,lastUci,index){
  const position=parseFen(key),board=svg('svg',{viewBox:'0 0 270 310',class:'comparison-board',role:'img','aria-label':`局面 ${index+1}，完整双方布子，黑方在上，红方在下，轮${position.turn==='w'?'红':'黑'}方走`});
  const paintId=`mini-face-${index}`,defs=svg('defs',{}),paint=svg('linearGradient',{id:paintId,x1:'0',y1:'0',x2:'.25',y2:'1'});
  for(const [offset,color]of [['0','#fae5bc'],['.72','#ead0a0'],['1','#c8a170']])paint.append(svg('stop',{offset,'stop-color':color}));defs.append(paint);board.append(defs);
  const grid=svg('g',{stroke:'#94764f','stroke-width':.8,fill:'none'});board.append(grid);
  for(let y=0;y<10;y++)grid.append(svg('line',{x1:15,y1:20+y*30,x2:255,y2:20+y*30}));
  for(let x=0;x<9;x++)for(const [a,b]of (x===0||x===8?[[20,290]]:[[20,140],[170,290]]))grid.append(svg('line',{x1:15+x*30,y1:a,x2:15+x*30,y2:b}));
  for(const y of [20,230])for(const [a,b]of [[105,165],[165,105]])grid.append(svg('line',{x1:a,y1:y,x2:b,y2:y+60}));
  const river=svg('text',{x:135,y:159,'text-anchor':'middle',fill:'#80613b','font-size':12,'letter-spacing':12});river.textContent='楚河 漢界';board.append(river);
  if(lastUci){for(const i of coords(lastUci))board.append(svg('rect',{x:15+i%9*30-14.2,y:20+Math.floor(i/9)*30-14.2,width:28.4,height:28.4,rx:3,fill:'#d8e4d3',stroke:'#28636e','stroke-width':1.2}));}
  const description=[];
  position.board.forEach((p,i)=>{if(!p)return;const x=15+i%9*30,y=20+Math.floor(i/9)*30,red=side(p)==='w';description.push(`${red?'红':'黑'}${pieceName(p)} ${square(i)}`);
    board.append(svg('ellipse',{cx:x+.4,cy:y+1.8,rx:13.8,ry:13.2,fill:'#634423',opacity:.23}),svg('circle',{cx:x,cy:y+.9,r:13.8,fill:'#a47b4c'}),svg('circle',{cx:x,cy:y,r:13.8,fill:`url(#${paintId})`,stroke:'#9e7a50','stroke-width':.9}),svg('circle',{cx:x,cy:y-.2,r:12.9,fill:'none',stroke:'#fff0ce','stroke-width':.65}),svg('circle',{cx:x,cy:y,r:11.8,fill:'none',stroke:red?'#9c3028':'#40382c','stroke-width':.6}));
    const text=svg('text',{x,y,'text-anchor':'middle','dominant-baseline':'central',dy:'-0.075em',class:'comparison-piece',color:red?'#9c3028':'#302d28',fill:'currentColor'});text.textContent=faceName(p);board.append(text);
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
  $('comparison-count').textContent=matched.length?`${query?`筛选 ${games.size} 局 · ${paths} 条路径；`:''}显示 ${first+1}–${first+list.length} / ${matched.length} 种局面。预览不会落子。`:'没有符合筛选的来源，清空关键词可恢复全部结果。';
  $('comparison-groups').replaceChildren(...list.map(({group,index,refs})=>{
    const card=el('article',undefined,'comparison-card');card.dataset.group=index;
    card.append(el('h4',`局面 ${index+1} · ${query?`筛选 ${new Set(refs.map(r=>r[0])).size} 局 / ${refs.length} 路径`:`${group.game_count} 局 / ${group.path_count} 路径`}`));
    const boardBox=el('div',undefined,'mini-board-box'),last=el('p',undefined,'comparison-last'),title=el('p',undefined,'comparison-source-title'),notice=el('p','此谱部分可用；进入后只显示已核实内容。','comparison-partial');
    const picker=el('details',undefined,'comparison-source-picker');picker.append(el('summary',`更换来源 · ${refs.length} 条路径`));
    const label=el('label','选择此局面的来源','field-label'),select=el('select');select.id=`comparison-source-${index}`;label.htmlFor=select.id;
    const counts=new Map();for(const [id]of refs)counts.set(id,(counts.get(id)||0)+1);
    select.replaceChildren(...refs.map(([id,node])=>{const g=library.catalogue.games[id],o=el('option',`${counts.get(id)>1?pathLabel(node)+' · ':''}${library.bookNames(g)} · ${g.title}${g.status==='partial'?' · 部分可用':''}`);o.value=JSON.stringify([id,node]);return o;}));
    const kept=comparisonSelected.get(index);select.value=refs.some(r=>JSON.stringify(r.slice(0,2))===kept)?kept:JSON.stringify(refs[0].slice(0,2));
    const enter=el('button','进入此局面','comparison-enter');
    const update=()=>{const ref=refs.find(r=>JSON.stringify(r.slice(0,2))===select.value),g=library.catalogue.games[ref[0]];comparisonSelected.set(index,select.value);boardBox.replaceChildren(miniBoard(group.position_key,ref[2],index));last.textContent=lastMoveText(group.position_key,ref[2]);title.textContent=`${library.bookNames(g)} · ${g.title} · ${pathLabel(ref[1])}`;notice.hidden=g.status!=='partial';};
    select.addEventListener('change',()=>{cancelOpen();$('comparison-entry-message').textContent='';update();});
    enter.addEventListener('click',()=>void enterComparison(group,JSON.parse(select.value),enter));update();
    picker.append(label,select);card.append(boardBox,el('p',`黑方在上 · 红方在下 · 轮${fixedCondition.side==='w'?'红':'黑'}方走`,'comparison-orientation'),last,title,picker,notice,enter);return card;
  }));
}
async function enterComparison(group,[id,nodeId],button){
  if(!researchScope?.has(id))return;
  const ticket=++openSerial,lib=library,fixed=fixedCondition;openRequest?.abort();openRequest=new AbortController();button.disabled=true;
  $('comparison-entry-message').textContent='正在读取所选路径，当前棋盘暂不改变…';
  try{
    const game=await lib.game(id,openRequest.signal);if(ticket!==openSerial||lib!==library||fixed!==fixedCondition||!researchScope.has(id))return;
    const path=originalPath(game,nodeId),condition=conditionFromHistory(path.states,path.states.length-1,fixed.side);
    if(positionKey(path.states.at(-1))!==group.position_key||JSON.stringify(condition.moves)!==JSON.stringify(fixed.moves))throw new Error('所选来源与固定条件不一致。');
    const compatible=l=>path.nodes.every((n,i)=>l.node_ids[i]===n.id);
    const line=game.lines.find(l=>l.id===game.nodes[nodeId].line_id&&compatible(l))||game.lines.find(compatible);
    if(!line)throw new Error('所选原谱路径缺少可继续的线路。');
    opened=id;openedGame=game;lineId=line.id;lineIndex=path.nodes.length-1;scopeRelation='';renderScope();renderLineOptions(game);
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

$('undo').addEventListener('click',()=>{cancelOpen();if(!cursor)return;cursor--;state=timeline[cursor];selected=null;syncLineIndex();refresh(true);message('已撤回一步。');});
$('redo').addEventListener('click',()=>{cancelOpen();if(cursor>=timeline.length-1)return;cursor++;state=timeline[cursor];selected=null;syncLineIndex();refresh(true);message('已重走一步。');});
$('reset').addEventListener('click',()=>{cancelOpen();lineIndex=0;fresh(START);message('已重置到本局标准开局。');});
$('standard').addEventListener('click',()=>{cancelOpen();opened=null;openedGame=null;lineId='0';scopeRelation='';renderScope();fresh(START);message('已回到标准开局。');});
$('show-arrow').addEventListener('change',drawArrow);$('play-choice').addEventListener('click',()=>choice&&move(choice));
$('source-search').addEventListener('input',renderSourceOptions);
$('source-select').addEventListener('change',e=>{if(!e.target.value)return;[sourceId,pathId]=JSON.parse(e.target.value);alignChoiceToSource();renderNext();drawArrow();void renderSource();});
$('browse').addEventListener('click',()=>{libraryLimit=50;renderLibrary();$('library-dialog').showModal();});$('close-library').addEventListener('click',()=>$('library-dialog').close());
$('library-dialog').addEventListener('close',cancelOpen);
$('book-filter').addEventListener('change',()=>{libraryLimit=50;renderLibrary();});$('search').addEventListener('input',()=>{libraryLimit=50;renderLibrary();});
$('more-games').addEventListener('click',()=>{libraryLimit+=50;renderLibrary();});
$('line-select').addEventListener('change',e=>{lineId=e.target.value;const l=currentLine();goLine(l.id==='0'?0:l.start_ply-1);});
$('line-start').addEventListener('click',()=>goLine(0));$('line-prev').addEventListener('click',()=>goLine(lineIndex-1));$('line-next').addEventListener('click',()=>goLine(lineIndex+1));$('retry').addEventListener('click',()=>void loadData());
// Only lettering changes when the shared subset is ready; disks/hit areas stay fixed.
void document.fonts.load('16px "Xiangqi Piece Kai"','帅仕相馬車炮兵将士象卒').then(faces=>{if(faces.length)document.documentElement.classList.add('piece-font-ready');}).catch(()=>{});
drawGrid();refresh();void loadData();
