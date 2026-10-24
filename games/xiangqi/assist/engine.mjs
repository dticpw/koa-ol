// Pure Xiangqi rules. No AI, persistence, network or competition repetition policy.
export const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
export const side = p => p ? (p === p.toUpperCase() ? 'w' : 'b') : null;
export const opposite = s => s === 'w' ? 'b' : 'w';
const inside = (x,y) => x>=0 && x<9 && y>=0 && y<10;
export const square = i => 'abcdefghi'[i%9]+(10-Math.floor(i/9));
export function coords(uci) {
  const m = /^([a-i])(10|[1-9])([a-i])(10|[1-9])$/.exec(uci);
  if (!m) throw new Error('Invalid move');
  return [(10-Number(m[2]))*9+m[1].charCodeAt(0)-97, (10-Number(m[4]))*9+m[3].charCodeAt(0)-97];
}
export function parseFen(fen) {
  const [ranks,turn,,,,full] = fen.trim().split(/\s+/);
  const board=[];
  for(const c of ranks) { if(c==='/') continue; if(/[1-9]/.test(c)) board.push(...Array(Number(c)).fill(null)); else board.push(c); }
  if(board.length!==90 || !['w','b'].includes(turn)) throw new Error('Invalid position');
  return {board,turn,half:Number(fen.split(' ')[4])||0,full:Number(full)||1};
}
export function fen(s) {
  const rows=[];
  for(let y=0;y<10;y++) { let row='',empty=0; for(let x=0;x<9;x++){ const p=s.board[y*9+x]; if(!p)empty++; else {if(empty)row+=empty;empty=0;row+=p;} } if(empty)row+=empty;rows.push(row); }
  return `${rows.join('/')} ${s.turn} - - ${s.half} ${s.full}`;
}
export const positionKey = s => (typeof s==='string'?s:fen(s)).split(' ').slice(0,2).join(' ');
function palace(x,y,s){return x>=3&&x<=5&&(s==='w'?y>=7&&y<=9:y>=0&&y<=2);}
function targets(board,i) {
  const p=board[i], s=side(p), type=p.toLowerCase(), x=i%9,y=Math.floor(i/9), out=[];
  const add=(a,b)=>{if(inside(a,b)&&side(board[b*9+a])!==s)out.push(b*9+a);};
  if(type==='r'||type==='c') {
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      let screen=false;
      for(let a=x+dx,b=y+dy;inside(a,b);a+=dx,b+=dy){
        const q=board[b*9+a];
        if(type==='r'){ if(!q)add(a,b);else{add(a,b);break;} }
        else if(!screen){if(!q)add(a,b);else screen=true;} else if(q){add(a,b);break;}
      }
    }
  } else if(type==='n'||type==='h') {
    for(const [dx,dy] of [[1,2],[-1,2],[1,-2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]]){
      const lx=x+(Math.abs(dx)===2?Math.sign(dx):0),ly=y+(Math.abs(dy)===2?Math.sign(dy):0);
      if(inside(lx,ly)&&!board[ly*9+lx])add(x+dx,y+dy);
    }
  } else if(type==='b'||type==='e') {
    for(const dx of [-2,2])for(const dy of [-2,2]){
      const a=x+dx,b=y+dy;
      if(inside(a,b)&&(s==='w'?b>=5:b<=4)&&!board[(y+dy/2)*9+x+dx/2])add(a,b);
    }
  } else if(type==='a') {
    for(const dx of [-1,1])for(const dy of [-1,1])if(palace(x+dx,y+dy,s))add(x+dx,y+dy);
  } else if(type==='k') {
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(palace(x+dx,y+dy,s))add(x+dx,y+dy);
    for(const dy of [-1,1])for(let b=y+dy;inside(x,b);b+=dy){const q=board[b*9+x];if(q){if(q.toLowerCase()==='k')add(x,b);break;}}
  } else if(type==='p') {
    add(x,y+(s==='w'?-1:1)); if(s==='w'?y<=4:y>=5){add(x-1,y);add(x+1,y);}
  }
  return out;
}
export function inCheck(s,who=s.turn) {
  const king=s.board.indexOf(who==='w'?'K':'k');
  if(king<0)return true;
  for(let i=0;i<90;i++)if(side(s.board[i])===opposite(who)&&targets(s.board,i).includes(king))return true;
  return false;
}
export function apply(s,uci) {
  const [from,to]=coords(uci),board=s.board.slice(),p=board[from],capture=board[to];
  board[to]=p;board[from]=null;
  return {board,turn:opposite(s.turn),half:capture||p?.toLowerCase()==='p'?0:s.half+1,full:s.full+(s.turn==='b'?1:0)};
}
export function legalMoves(s) {
  const out=[];
  if(!s.board.includes('K')||!s.board.includes('k'))return out;
  for(let i=0;i<90;i++)if(side(s.board[i])===s.turn)for(const j of targets(s.board,i)){
    if(s.board[j]?.toLowerCase()==='k')continue;
    const uci=square(i)+square(j); if(!inCheck(apply(s,uci),s.turn))out.push(uci);
  }
  return out;
}
export function status(s,moves=legalMoves(s)) {
  const check=inCheck(s);
  return {check,ended:moves.length===0,winner:moves.length===0?opposite(s.turn):null,reason:moves.length===0?(check?'将死':'无合法着法，困毙'):check?'将军':''};
}
const names={K:'帅',A:'仕',B:'相',N:'马',R:'车',C:'炮',P:'兵',k:'将',a:'士',b:'象',n:'马',r:'车',c:'炮',p:'卒'};
export const pieceName = p => names[p]||'';
export function notation(s,uci){
  const [a,b]=coords(uci),p=s.board[a],red=side(p)==='w',ax=a%9,bx=b%9,ay=Math.floor(a/9),by=Math.floor(b/9);
  const num=n=>red?'一二三四五六七八九'[n-1]:String(n),file=x=>num(red?9-x:x+1);
  const action=ay===by?'平':(red?by<ay:by>ay)?'进':'退';
  const end=ay===by||'nba'.includes(p.toLowerCase())?file(bx):num(Math.abs(by-ay));
  return pieceName(p)+file(ax)+action+end;
}
