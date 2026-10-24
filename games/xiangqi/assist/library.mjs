import {positionKey} from './engine.mjs';

// Release trust anchor: update with the manifest when publishing a new dataset.
export const RELEASE = Object.freeze({
  library_id: 'ad7cff72236ec6f609d474645ef3725d33f7e6e89736a627c913b64b5369d6b9',
  sha256: '99b67efa9708a50c8b409b7576a757a0a21d26513939b092f3296a06d661cc94',
  bytes: 228707,
});
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export class LibraryError extends Error {
  constructor(code,path='') {
    super(`${code}: ${path}`);this.code=code;
    this.userMessage=({http:'文件暂时无法取得。',size:'下载的内容不完整。',hash:'下载内容未通过完整性检查。',version:'棋谱版本不一致，请刷新页面后重试。',schema:'棋谱内容无法识别。',timeout:'读取超时，请重试。',network:'连接中断，请重试。'})[code]||'棋谱读取失败。';
  }
}
class LRU {
  constructor(limit,maxBytes){this.limit=limit;this.maxBytes=maxBytes;this.items=new Map();this.bytes=0;}
  get(key){const v=this.items.get(key);if(v){this.items.delete(key);this.items.set(key,v);}return v?.value;}
  put(key,value,bytes){if(this.items.has(key)){this.bytes-=this.items.get(key).bytes;this.items.delete(key);}this.items.set(key,{value,bytes});this.bytes+=bytes;
    while(this.items.size>this.limit||this.bytes>this.maxBytes){const k=this.items.keys().next().value;this.bytes-=this.items.get(k).bytes;this.items.delete(k);}}
  clear(){this.items.clear();this.bytes=0;}
}
export class Library {
  constructor({base=new URL('../data/library/',globalThis.location?.href||'http://localhost/app/'),fetcher=globalThis.fetch.bind(globalThis),release=RELEASE,timeout=15000}={}) {
    this.base=new URL(base);this.fetcher=fetcher;this.release=release;this.timeout=timeout;
    this.shards=new LRU(12,2*1024*1024);this.bodies=new LRU(6,4*1024*1024);
    this.controllers=new Set();this.disposed=false;this.manifest=null;this.catalogue=null;
  }
  dispose(){this.disposed=true;for(const c of this.controllers)c.abort();this.controllers.clear();this.shards.clear();this.bodies.clear();this.catalogue=null;this.manifest=null;}
  async read(path,descriptor,signal){
    if(this.disposed||signal?.aborted)throw new DOMException('Cancelled','AbortError');
    if(!/^(manifest\.json|catalogue\.json|positions\/[a-f0-9]{2}\.json|games\/yl-\d+\.json)$/.test(path))throw new LibraryError('schema',path);
    const controller=new AbortController();this.controllers.add(controller);let timedOut=false;
    const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},this.timeout);
    try{
      const url=new URL(path,this.base);url.searchParams.set('v',this.release.library_id);
      const response=await this.fetcher(url,{signal:controller.signal,cache:'no-cache'});
      if(!response.ok)throw new LibraryError('http',path);
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength!==descriptor.bytes)throw new LibraryError('size',path);
      if(await digest(bytes)!==descriptor.sha256)throw new LibraryError('hash',path);
      let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new LibraryError('schema',path);}
      if(value.schema_version!==2)throw new LibraryError('schema',path);
      if(value.library_id!==this.release.library_id)throw new LibraryError('version',path);
      if(this.disposed||controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
      return value;
    }catch(error){
      if(timedOut)throw new LibraryError('timeout',path);
      if(controller.signal.aborted||error.name==='AbortError')throw new DOMException('Cancelled','AbortError');
      if(error instanceof LibraryError)throw error;
      throw new LibraryError('network',path);
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);this.controllers.delete(controller);}
  }
  async open(){
    const m=await this.read('manifest.json',this.release);
    if(m.variant!=='xiangqi'||!Array.isArray(m.books)||!Array.isArray(m.resources)||m.index?.algorithm!=='sha256-utf8-first-2-hex')throw new LibraryError('schema','manifest.json');
    this.resources=new Map(m.resources.map(r=>[r.path,r]));
    this.manifest=m;
    const c=await this.read(m.catalogue_path,this.descriptor(m.catalogue_path));
    if(!c.games||Object.keys(c.games).length!==m.counts.runtime_games)throw new LibraryError('schema','catalogue.json');
    this.catalogue=c;return this;
  }
  descriptor(path){const d=this.resources.get(path);if(!d||!Number.isSafeInteger(d.bytes)||! /^[a-f0-9]{64}$/.test(d.sha256))throw new LibraryError('schema',path);return d;}
  bookTitle(id){return this.manifest.books.find(b=>b.id===id)?.title||id;}
  bookNames(game){return game.book_ids.map(id=>this.bookTitle(id)).join(' / ');}
  async lookup(state,signal){
    const key=positionKey(state),bucket=(await digest(new TextEncoder().encode(key))).slice(0,2),path=`positions/${bucket}.json`;
    if(signal?.aborted||this.disposed)throw new DOMException('Cancelled','AbortError');
    let shard=this.shards.get(path);
    if(!shard){const descriptor=this.descriptor(path);shard=await this.read(path,descriptor,signal);
      if(shard.bucket!==bucket||!shard.positions)throw new LibraryError('schema',path);
      this.shards.put(path,shard,descriptor.bytes);}
    const entry=shard.positions[key]||{refs:[],next:{}},sources=new Map(),moves=new Map();
    for(const [gameId,nodeId] of entry.refs){
      const game=this.catalogue.games[gameId];if(!game)throw new LibraryError('schema',path);
      if(!sources.has(gameId))sources.set(gameId,{game,paths:[]});sources.get(gameId).paths.push(nodeId);
    }
    for(const [uci,refs]of Object.entries(entry.next))moves.set(uci,refs.map(([gameId,nodeId,childId])=>({gameId,nodeId,childId})));
    return {key,sources,moves,occurrences:entry.refs.length};
  }
  async game(id,signal){
    const summary=this.catalogue?.games[id];if(!summary)throw new LibraryError('schema',id);
    const cached=this.bodies.get(id);if(cached)return cached;
    const descriptor=this.descriptor(summary.body_path),body=await this.read(summary.body_path,descriptor,signal);
    const g=body.game;
    if(g?.id!==id||!g.nodes||!Array.isArray(g.lines)||!Array.isArray(g.annotations)||positionKey(g.root_fen)!==this.manifest.standard_key)throw new LibraryError('schema',summary.body_path);
    this.bodies.put(id,g,descriptor.bytes);return g;
  }
  cacheStats(){return {shards:this.shards.items.size,shardBytes:this.shards.bytes,bodies:this.bodies.items.size,bodyBytes:this.bodies.bytes,pending:this.controllers.size};}
}
export function annotations(game,node){const ids=new Set(node?.annotation_ids||[]);return game.annotations.filter(a=>ids.has(a.id)&&a.status==='attached'&&a.text.trim());}
export function pathLabel(node){if(typeof node==='string'){const [line,ply]=node==='root'?['0','0']:node.split(':');return `${line==='0'?'主线':`分支 ${line}`} · 第 ${ply} 手`;}return `${node.line_id==='0'?'主线':`分支 ${node.line_id}`} · 第 ${node.ply} 手`;}
export function partialText(game){
  const unresolved=game.summary.annotation_statuses?.unresolved||0,truncated=game.summary.line_statuses?.truncated_illegal||0,blocked=game.summary.line_statuses?.blocked_by_parent||0;
  return `此谱部分可用，只显示已核实内容。${truncated?`有 ${truncated} 条线路在错误着法前停止。`:''}${blocked?`另有 ${blocked} 条相关分支无法继续。`:''}${unresolved?`${unresolved} 条原注无法确定对应位置，未作为局面评注展示。`:''}`;
}
