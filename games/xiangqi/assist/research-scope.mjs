// One current preference, one membership set. Raw library/comparison caches stay untouched.
export const SCOPE_KEY='xiangqi-research-scope-v1';
export const allScope=()=>({version:1,mode:'all'});
export const emptyScope=()=>({version:1,mode:'books',bookIds:[]});
export function normalizeScope(value,catalogue,books){
  const bad=()=>({value:emptyScope(),notice:'保存的研究范围无法识别，现为空范围。请重新选择或主动恢复全部。'});
  if(!value||value.version!==1)return bad();
  if(value.mode==='all')return {value:allScope(),notice:''};
  if(value.mode==='game'){
    if(typeof value.gameId!=='string')return bad();
    if(!Object.hasOwn(catalogue.games,value.gameId))return {value:emptyScope(),notice:'保存的棋局已不可用，现为空范围。请重新选择或恢复全部。'};
    return {value:{version:1,mode:'game',gameId:value.gameId},notice:''};
  }
  if(value.mode!=='books'||!Array.isArray(value.bookIds)||value.bookIds.some(id=>typeof id!=='string'))return bad();
  const valid=new Set(books.filter(b=>b.game_ids.length).map(b=>b.id)),ids=[...new Set(value.bookIds)],kept=ids.filter(id=>valid.has(id));
  return {value:{version:1,mode:'books',bookIds:kept},notice:kept.length===ids.length?'':`保存的 ${ids.length-kept.length} 部目录已不可用；${kept.length?'仅保留仍有效的选择':'现为空范围'}，未扩大到全部。请核对研究范围。`};
}
export class ResearchScope {
  constructor(catalogue,books,value=allScope()){
    this.catalogue=catalogue;this.books=books;
    const normalized=normalizeScope(value,catalogue,books);this.value=normalized.value;this.notice=normalized.notice;
    const v=this.value,selected=new Set(v.bookIds||[]);
    this.ids=new Set(Object.values(catalogue.games).filter(g=>v.mode==='all'||(v.mode==='game'?g.id===v.gameId:g.book_ids.some(id=>selected.has(id)))).map(g=>g.id));
    this.identity=JSON.stringify(v.mode==='books'?{...v,bookIds:[...selected].sort()}:v);
  }
  has(id){return this.ids.has(id);}
  get label(){
    const v=this.value;
    if(v.mode==='all')return `全部可用 · ${this.ids.size} 局`;
    if(v.mode==='game')return `单局精读 · ${this.catalogue.games[v.gameId].title}`;
    if(!this.ids.size)return '空范围 · 0 局';
    const names=this.books.filter(b=>v.bookIds.includes(b.id)).map(b=>b.title);
    return `${names.length>3?`${names.slice(0,2).join('、')}等 ${names.length} 部`:names.join('、')} · ${this.ids.size} 局`;
  }
  position(raw){
    const sources=new Map([...raw.sources].filter(([id])=>this.has(id))),moves=new Map();
    for(const [uci,refs]of raw.moves){const kept=refs.filter(r=>this.has(r.gameId));if(kept.length)moves.set(uci,kept);}
    return {...raw,sources,moves,occurrences:[...sources.values()].reduce((n,s)=>n+s.paths.length,0)};
  }
  comparison(raw){
    if(!raw)return null;
    const groups=raw.groups.flatMap(g=>{const refs=g.refs.filter(r=>this.has(r[0]));return refs.length?[{...g,refs,game_count:new Set(refs.map(r=>r[0])).size,path_count:refs.length}]:[];});
    return {...raw,groups,game_count:new Set(groups.flatMap(g=>g.refs.map(r=>r[0]))).size,group_count:groups.length,path_count:groups.reduce((n,g)=>n+g.refs.length,0)};
  }
}
export function readScope(catalogue,books){
  try{const raw=localStorage.getItem(SCOPE_KEY);return new ResearchScope(catalogue,books,raw===null?allScope():JSON.parse(raw));}
  catch{const scope=new ResearchScope(catalogue,books,emptyScope());scope.notice='无法读取本机范围偏好，现为空范围。请重新选择或恢复全部；本次选择仍可使用。';return scope;}
}
export function saveScope(scope){
  try{localStorage.setItem(SCOPE_KEY,JSON.stringify(scope.value));return '';}
  catch{return '本机无法保存范围偏好；本页选择已生效，刷新后需重新选择。';}
}
