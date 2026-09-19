import { getView, normalizeGame } from './fiction-lab-engine.js';
import { ApiError } from './fiction-service.js';

const COOKIE='koa_fiction_collection';
const COOKIE_PATH='/api/fiction-lab/archives';
const schema=[
  `CREATE TABLE IF NOT EXISTS koa_fiction_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS koa_fiction_archives (id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, session_id TEXT NOT NULL, revision INTEGER NOT NULL, title TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(owner_hash,session_id,revision))`,
  `CREATE INDEX IF NOT EXISTS koa_fiction_archives_owner ON koa_fiction_archives(owner_hash,created_at)`
];
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const cookie=(request,name)=>(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
const validToken=value=>/^[a-f0-9]{64}$/.test(value||'');
const newToken=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
const tokenHeader=token=>`${COOKIE}=${token}; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
const reply=(data,status=200,token)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(token?{'Set-Cookie':tokenHeader(token)}:{})}});
const first=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const pack=row=>({id:row.id,title:row.title,createdAt:row.created_at,updatedAt:row.updated_at,game:JSON.parse(row.snapshot_json)});
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
async function bodyOf(request){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))throw new ApiError(415,'请使用 JSON 请求。','invalid_request');
  const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'缺少收藏参数。','invalid_request');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new ApiError(413,'收藏参数过长。','invalid_request');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError(400,'收藏参数无效。','invalid_request');}
  if(!body||Array.isArray(body)||typeof body!=='object')throw new ApiError(400,'收藏参数无效。','invalid_request');
  const fields={save:['op','title','sessionId','expectedRevision'],rename:['op','id','title'],delete:['op','id']}[body.op];
  if(!fields||Object.keys(body).some(k=>!fields.includes(k)))throw new ApiError(400,'收藏操作无效。','invalid_request');
  if(body.op!=='delete'){
    if(typeof body.title!=='string'||![...body.title.trim()].length||[...body.title.trim()].length>60||/[\x00-\x1f\x7f]/.test(body.title))throw new ApiError(400,'请填写 1—60 字的冒险名字。','invalid_title');
    body.title=body.title.trim();
  }
  if(body.op==='save'){
    if(!validId(body.sessionId)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw new ApiError(400,'存档位置无效。','invalid_request');
  }else if(!validId(body.id))throw new ApiError(400,'收藏编号无效。','invalid_request');
  return body;
}

export async function onArchiveRequest({request,env}){
  try{
    if(!['GET','POST'].includes(request.method))return reply({error:'不支持的请求方式。'},405);
    if(!env.DB)throw new ApiError(503,'收藏服务暂时不可用。','storage_unavailable');
    let body;
    if(request.method==='POST'){
      const origin=request.headers.get('Origin');
      if((origin&&origin!==new URL(request.url).origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new ApiError(403,'请从本站游戏页面操作。','invalid_origin');
      body=await bodyOf(request);
    }
    const db=env.DB;await db.batch(schema.map(sql=>db.prepare(sql)));
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10),ip=await hash(`archive:${request.headers.get('CF-Connecting-IP')||'unknown'}`);
    const allowance=request.method==='POST'?100:600;
    const quota=await db.prepare(`INSERT INTO koa_fiction_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<?`).bind(`archives:${request.method}:${day}:${ip}`,now+2*86400000,allowance).run();
    if(!quota.meta?.changes)throw new ApiError(429,'今天的收藏操作次数已达上限，请明天再来。','rate_limited');
    let token=cookie(request,COOKIE);
    if(!validToken(token)){
      if(request.method==='POST')throw new ApiError(401,'请先打开“冒险收藏”，再保存这段冒险。','collection_required');
      if(new URL(request.url).searchParams.has('id'))throw new ApiError(401,'请使用保存这段冒险的浏览器打开收藏。','collection_required');
      // Establish a separate browser collection; starting a game never replaces it.
      token=newToken();return reply({entries:[]},200,token);
    }
    const owner=await hash(token);
    if(request.method==='GET'){
      const id=new URL(request.url).searchParams.get('id');
      if(id){
        if(!validId(id))throw new ApiError(400,'收藏编号无效。','invalid_request');
        const row=await first(db,'SELECT * FROM koa_fiction_archives WHERE owner_hash=? AND id=?',owner,id);
        if(!row)throw new ApiError(404,'没有找到这段冒险。','archive_not_found');
        return reply({archive:pack(row)},200,token);
      }
      const row=await first(db,`SELECT json_group_array(json_object('id',id,'title',title,'revision',revision,'status',json_extract(snapshot_json,'$.status'),'createdAt',created_at)) AS entries FROM (SELECT * FROM koa_fiction_archives WHERE owner_hash=? ORDER BY created_at DESC,id DESC LIMIT 100)`,owner);
      return reply({entries:JSON.parse(row?.entries||'[]')},200,token);
    }
    if(body.op==='save'){
      const gameToken=cookie(request,'koa_fiction_lab');
      if(!validToken(gameToken))throw new ApiError(401,'当前冒险已过期，请先读取存档。','session_expired');
      const session=await first(db,'SELECT * FROM koa_fiction_sessions WHERE token_hash=? AND expires_at>?',await hash(gameToken),now);
      if(!session)throw new ApiError(401,'当前冒险已过期，请先读取存档。','session_expired');
      const saved=JSON.parse(session.state_json);
      if(saved.gameKind!=='lab'||saved.sessionId!==body.sessionId||saved.revision!==body.expectedRevision)throw new ApiError(409,'冒险进度已变化，请刷新后保存。','revision_conflict');
      if(session.lock_until>now)throw new ApiError(409,'主持仍在处理行动，请等回复完成再保存。','turn_busy');
      const view=getView(normalizeGame(saved)),id=crypto.randomUUID();
      // Snapshot only the server's saved public view. No supplied story/state is trusted.
      // Natural-key upsert makes retries save one copy at the same point in a game.
      const result=await db.prepare(`INSERT INTO koa_fiction_archives(id,owner_hash,session_id,revision,title,snapshot_json,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE ((SELECT COUNT(*) FROM koa_fiction_archives WHERE owner_hash=?)<100 OR EXISTS(SELECT 1 FROM koa_fiction_archives WHERE owner_hash=? AND session_id=? AND revision=?)) AND EXISTS(SELECT 1 FROM koa_fiction_sessions WHERE token_hash=? AND revision=? AND lock_until<=? AND expires_at>?) ON CONFLICT(owner_hash,session_id,revision) DO UPDATE SET title=excluded.title,updated_at=excluded.updated_at`).bind(id,owner,view.sessionId,view.revision,body.title,JSON.stringify(view),now,now,owner,owner,view.sessionId,view.revision,await hash(gameToken),view.revision,Date.now(),Date.now()).run();
      if(!result.meta?.changes){
        const count=await first(db,'SELECT COUNT(*) AS n FROM koa_fiction_archives WHERE owner_hash=?',owner);
        if(count.n>=100)throw new ApiError(409,'收藏已达 100 份，请先导出并整理旧收藏。','collection_full');
        throw new ApiError(409,'行动正在进行或进度已变化，请等回复完成后再保存。','revision_conflict');
      }
      const row=await first(db,'SELECT * FROM koa_fiction_archives WHERE owner_hash=? AND session_id=? AND revision=?',owner,view.sessionId,view.revision);
      return reply({archive:pack(row)},200,token);
    }
    const row=await first(db,'SELECT * FROM koa_fiction_archives WHERE owner_hash=? AND id=?',owner,body.id);
    if(!row)throw new ApiError(404,'没有找到这段冒险。','archive_not_found');
    if(body.op==='delete'){
      await db.prepare('DELETE FROM koa_fiction_archives WHERE owner_hash=? AND id=?').bind(owner,body.id).run();
      return reply({deleted:true},200,token);
    }
    await db.prepare('UPDATE koa_fiction_archives SET title=?,updated_at=? WHERE owner_hash=? AND id=?').bind(body.title,now,owner,body.id).run();
    return reply({archive:pack({...row,title:body.title,updated_at:now})},200,token);
  }catch(error){return error instanceof ApiError?reply({error:error.message,code:error.code},error.status):reply({error:'收藏服务暂时不可用，请稍后重试。',code:'storage_unavailable'},503);}
}
