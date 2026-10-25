import {RELEASE as SOURCE_RELEASE,digest,LibraryError} from './library.mjs';
import {START,parseFen,positionKey,legalMoves,apply,notation,square} from './engine.mjs';

export const RELEASE=Object.freeze({comparison_id:'bccd2dc4f1e3e897701b9a2d39fb357e8ab001f7b6d9c9b75d25b53fad5118bd',library_id:SOURCE_RELEASE.library_id,bytes:43127,sha256:'772e8be040877b9bb248d000859f924ae8f16644d4eacc4af1474b0c7ce7b5d1'});
export class Comparison {
  constructor({library,base=new URL('../data/comparison/',globalThis.location?.href||'http://localhost/app/'),fetcher=globalThis.fetch.bind(globalThis),release=RELEASE,timeout=15000}={}){
    this.library=library;this.base=new URL(base);this.fetcher=fetcher;this.release=release;this.timeout=timeout;
    this.manifest=null;this.controllers=new Set();this.cache=new Map();this.bytes=0;this.disposed=false;
  }
  dispose(){this.disposed=true;for(const c of this.controllers)c.abort();this.controllers.clear();this.cache.clear();this.bytes=0;this.manifest=null;}
  async read(path,descriptor,signal){
    if(this.disposed||signal?.aborted)throw new DOMException('Cancelled','AbortError');
    if(!/^(manifest\.json|shards\/[a-f0-9]{2}\.json)$/.test(path))throw new LibraryError('schema',path);
    const controller=new AbortController(),cancel=()=>controller.abort();this.controllers.add(controller);signal?.addEventListener('abort',cancel,{once:true});let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},this.timeout);
    try{
      const url=new URL(path,this.base);url.searchParams.set('v',this.release.comparison_id);
      const response=await this.fetcher(url,{signal:controller.signal,cache:'no-cache'});
      if(!response.ok)throw new LibraryError('http',path);
      const bytes=await response.arrayBuffer();if(bytes.byteLength!==descriptor.bytes)throw new LibraryError('size',path);
      if(await digest(bytes)!==descriptor.sha256)throw new LibraryError('hash',path);
      let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new LibraryError('schema',path);}
      if(value.schema_version!==1)throw new LibraryError('schema',path);
      if(value.comparison_id!==this.release.comparison_id||value.library_id!==this.release.library_id)throw new LibraryError('version',path);
      if(this.disposed||controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
      return value;
    }catch(error){if(timedOut)throw new LibraryError('timeout',path);if(controller.signal.aborted||error.name==='AbortError')throw new DOMException('Cancelled','AbortError');if(error instanceof LibraryError)throw error;throw new LibraryError('network',path);}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);this.controllers.delete(controller);}
  }
  async open(signal){
    const m=await this.read('manifest.json',this.release,signal),lib=this.library;
    if(m.format!=='xiangqi-own-move-prefix'||!Array.isArray(m.resources)||m.resources.length!==256)throw new LibraryError('schema','manifest.json');
    if(!lib?.catalogue||lib.disposed||lib.release.sha256!==SOURCE_RELEASE.sha256||lib.release.bytes!==SOURCE_RELEASE.bytes||lib.manifest.library_id!==m.library_id||m.library_id!==SOURCE_RELEASE.library_id||m.source_manifest_sha256!==SOURCE_RELEASE.sha256||m.source_manifest_bytes!==SOURCE_RELEASE.bytes||m.source_schema_version!==2||m.standard_key!==lib.manifest.standard_key)throw new LibraryError('version','source manifest');
    const catalogue=lib.descriptor(lib.manifest.catalogue_path);
    if(m.source_catalogue?.sha256!==catalogue.sha256||m.source_catalogue?.bytes!==catalogue.bytes)throw new LibraryError('version','source catalogue');
    this.resources=new Map(m.resources.map(r=>[r.path,r]));
    if(this.resources.size!==256||m.resources.some(r=>!/^shards\/[a-f0-9]{2}\.json$/.test(r.path)||r.bucket!==r.path.slice(7,9)||!Number.isSafeInteger(r.bytes)||! /^[a-f0-9]{64}$/.test(r.sha256)))throw new LibraryError('schema','resources');
    this.manifest=m;return this;
  }
  async lookup(side,ownUci,signal){
    if(!['w','b'].includes(side)||!Array.isArray(ownUci)||ownUci.some(u=>!/^([a-i](?:10|[1-9])){2}$/.test(u)))throw new LibraryError('schema','condition');
    if(!this.manifest)await this.open(signal);
    const id=await digest(new TextEncoder().encode(JSON.stringify([side,...ownUci]))),bucket=id.slice(0,2),path=`shards/${bucket}.json`;
    if(this.disposed||this.library.disposed||signal?.aborted)throw new DOMException('Cancelled','AbortError');
    let entry=this.cache.get(path);
    if(entry){this.cache.delete(path);this.cache.set(path,entry);}
    else{
      const descriptor=this.resources.get(path),shard=await this.read(path,descriptor,signal);
      if(shard.bucket!==bucket||!shard.conditions||typeof shard.conditions!=='object')throw new LibraryError('schema',path);
      entry={value:shard,bytes:descriptor.bytes};if(this.cache.has(path))this.bytes-=this.cache.get(path).bytes;this.cache.set(path,entry);this.bytes+=entry.bytes;
      while(this.cache.size>4||this.bytes>640000){const oldest=this.cache.keys().next().value;this.bytes-=this.cache.get(oldest).bytes;this.cache.delete(oldest);}
    }
    const condition=entry.value.conditions[id]||null;
    if(condition&&(condition.side!==side||condition.own_plies!==ownUci.length||condition.ply!==ownUci.length*2+(side==='b'?1:0)||!Array.isArray(condition.groups)||condition.group_count!==condition.groups.length||condition.groups.some(g=>g.position_key.split(' ')[1]!==side||!Array.isArray(g.refs)||g.refs.some(r=>!this.library.catalogue.games[r[0]])))){
      if(this.cache.has(path)){this.bytes-=this.cache.get(path).bytes;this.cache.delete(path);}throw new LibraryError('schema',path);
    }
    return {id,condition};
  }
  cacheStats(){return {shards:this.cache.size,rawBytes:this.bytes,pending:this.controllers.size};}
}

// The ordered prefix comes from real history, never inferred from final piece squares.
export function conditionFromHistory(timeline,cursor,side){
  if(!['w','b'].includes(side)||!timeline[0]||positionKey(timeline[0])!==positionKey(START))throw new Error('需要从标准开局开始的完整走棋记录。');
  const moves=[],labels=[];
  for(let step=1;step<=cursor;step++){
    const before=timeline[step-1],after=timeline[step];let from=-1,to=-1;
    for(let i=0;i<90;i++)if(before.board[i]!==after.board[i]){if(!after.board[i])from=i;else to=i;}
    if(from<0||to<0)throw new Error('走棋记录不完整，无法固定条件。');
    const uci=square(from)+square(to);
    if(before.turn===side){moves.push(uci);labels.push(notation(before,uci));}
  }
  return Object.freeze({side,moves:Object.freeze(moves),labels:Object.freeze(labels)});
}
export function originalPath(game,nodeId){
  const nodes=[],seen=new Set();let id=nodeId;
  while(id!=null){const node=game.nodes[id];if(!node||seen.has(id))throw new Error('原谱路径无法还原。');seen.add(id);nodes.push(node);id=node.parent_id;}
  nodes.reverse();if(nodes[0]?.id!=='root'||positionKey(nodes[0].fen)!==positionKey(START))throw new Error('原谱缺少标准开局。');
  const states=[parseFen(nodes[0].fen)];
  for(let i=1;i<nodes.length;i++){
    const before=states.at(-1),uci=nodes[i].move?.uci;
    if(!legalMoves(before).includes(uci))throw new Error('原谱此路径无法合法继续。');
    const after=apply(before,uci);if(positionKey(after)!==positionKey(nodes[i].fen))throw new Error('原谱走法与局面不符。');states.push(after);
  }
  return {nodes,states};
}
