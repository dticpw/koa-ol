import {ApiError} from '../fiction-service.js';
import {storyFor,defaultStory as story} from './stories/registry.js';
import {historySchema,prepareHistory,hydrateHistory,historyPage} from './history-store.js';
import {sceneFor} from './v3/scenes.js';
import {createAdventure,resolveMultiplayer} from './host.js';

const COOKIE='koa_fiction_player',TTL=30*86400000,LOCK=180000;
export const schema=[
 historySchema,
 `CREATE TABLE IF NOT EXISTS koa_fiction_multi_commit_guard (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1))`,
 `CREATE TABLE IF NOT EXISTS koa_fiction_multi_saves (run_id TEXT PRIMARY KEY, story_id TEXT NOT NULL, state_json TEXT NOT NULL, title TEXT NOT NULL, saved_at INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS koa_fiction_multi_save_members (run_id TEXT NOT NULL, player_id TEXT NOT NULL, PRIMARY KEY(run_id,player_id))`,
 `CREATE TABLE IF NOT EXISTS koa_fiction_multi_players (token_hash TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, table_no INTEGER, join_order INTEGER, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS koa_fiction_multi_seats ON koa_fiction_multi_players(table_no,join_order)`,
 `CREATE TABLE IF NOT EXISTS koa_fiction_multi_tables (table_no INTEGER PRIMARY KEY, story_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting', revision INTEGER NOT NULL DEFAULT 0, state_json TEXT, lock_owner TEXT, lock_until INTEGER NOT NULL DEFAULT 0)`,
 `CREATE TABLE IF NOT EXISTS koa_fiction_multi_chat (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, player_id TEXT NOT NULL, name TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS koa_fiction_multi_chat_run ON koa_fiction_multi_chat(run_id,id)`,
 `CREATE TABLE IF NOT EXISTS koa_fiction_multi_receipts (run_id TEXT NOT NULL, request_id TEXT NOT NULL, player_id TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(run_id,request_id))`,
 `CREATE TABLE IF NOT EXISTS koa_fiction_multi_archives (run_id TEXT PRIMARY KEY, table_no INTEGER NOT NULL, state_json TEXT NOT NULL, archived_at INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS koa_fiction_budget (day TEXT PRIMARY KEY, spent_micro INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS koa_fiction_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)`
];
const responseJSON=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const one=(db,q,...args)=>db.prepare(q).bind(...args).first();
const run=(db,q,...args)=>db.prepare(q).bind(...args).run();
const all=async(db,q,...args)=>(await db.prepare(q).bind(...args).all()).results||[];
const changed=r=>Number(r.meta?.changes||0)>0;
const error=(status,message,code)=>{throw new ApiError(status,message,code);};
const validTable=n=>Number.isSafeInteger(n)&&n>=20000&&n<=20003;
const publicPlayer=p=>({id:p.player_id,name:p.name});
const roomPlayers=(db,no)=>all(db,'SELECT * FROM koa_fiction_multi_players WHERE table_no=? ORDER BY join_order,player_id',no);
const readRoom=(db,no)=>one(db,'SELECT * FROM koa_fiction_multi_tables WHERE table_no=?',no);
const normalizeName=n=>typeof n==='string'?n.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,20):'';
async function bodyOf(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))error(415,'请使用 JSON 请求。','invalid_request');
 const reader=request.body?.getReader();if(!reader)error(400,'缺少操作。','invalid_request');
 const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();error(413,'内容太长。','invalid_request');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{error(400,'请求格式无效。','invalid_request');}
 if(!body||Array.isArray(body)||typeof body!=='object')error(400,'请求格式无效。','invalid_request');
 const fields={hello:['name'],join:['table'],leave:['table'],start:['table','requestId'],chat:['table','text','requestId'],act:['table','text','hold','round'],withdraw:['table','round'],resolve:['table','requestId','round'],close:['table'],pause:['table','title'],restore:['table','runId'],resume:['table']}[body.op];
 if(!fields||Object.keys(body).some(k=>k!=='op'&&!fields.includes(k)))error(400,'操作参数无效。','invalid_request');
 if(body.op!=='hello'&&!validTable(body.table))error(404,'没有这个桌号。','not_found');
 if(['start','resolve','chat'].includes(body.op)&&!/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId||''))error(400,'缺少请求标识。','invalid_request');
 if(['act','withdraw','resolve'].includes(body.op)&&(!Number.isSafeInteger(body.round)||body.round<0))error(400,'轮次无效。','invalid_request');
 if(body.op==='pause'&&(typeof body.title!=='string'||body.title.length>80))error(400,'冒险名称最多80字。','invalid_request');
 if(body.op==='restore'&&!/^[a-zA-Z0-9-]{1,80}$/.test(body.runId||''))error(400,'存档标识无效。','invalid_request');
 if(body.op==='chat'&&(typeof body.text!=='string'||!body.text.trim()||body.text.length>500))error(400,'聊天内容需要在1—500字之间。','invalid_request');
 if(body.op==='act'&&(typeof body.hold!=='boolean'||!body.hold&&(typeof body.text!=='string'||!body.text.trim()||body.text.length>600)))error(400,'行动需要在1—600字之间。','invalid_request');
 return body;
}
async function view(db,row,player,url=new URL('https://local/')){
 const seats=await roomPlayers(db,row.table_no),host=seats[0]?.player_id||null,you=player?publicPlayer(player):null;
 const result={number:row.table_no,storyId:row.story_id,status:row.status,revision:row.revision,busy:row.lock_until>Date.now(),hostId:host,members:seats.map(publicPlayer),minPlayers:story.minPlayers,maxPlayers:story.maxPlayers};
 if(row.state_json&&player)result.canRejoin=JSON.parse(row.state_json).characters.some(c=>c.id===player.player_id);
 if(!seats.some(x=>x.player_id===player?.player_id)||!row.state_json)return result;
 const state=JSON.parse(row.state_json),pack=storyFor(state),scene=state.version===3?sceneFor(state,you.id):null;
 const page=await historyPage(db,state,you.id,url);
 result.game={runId:state.runId,hostRevision:state.hostRevision||'cooperative-v1',round:state.round,location:pack.places[scene?.location||state.location][0],ended:state.ended,...page,
  participants:scene?.participants||state.characters.map(c=>c.id),
  inventory:state.items.filter(x=>x.owner===you.id),drafts:Object.fromEntries(Object.entries(state.drafts).filter(([id])=>!scene||scene.participants.includes(id)).map(([id,a])=>[id,{text:a.text,hold:a.hold}])),
  characters:state.characters,chat:await all(db,'SELECT id,player_id AS playerId,name,message AS text,created_at AS createdAt FROM (SELECT * FROM koa_fiction_multi_chat WHERE run_id=? ORDER BY id DESC LIMIT 80) ORDER BY id',state.runId)};
 return result;
}
export function createMultiplayerHandler({resolver=resolveMultiplayer}={}){
 return async({request,env})=>{
  let release=null,cookieHeader=null;const db=env.DB;
  const json=(data,status=200,headers={})=>responseJSON(data,status,{...(cookieHeader?{'Set-Cookie':cookieHeader}:{}),...headers});
  try{
   if(!db)error(503,'多人存档服务尚未配置。','storage_unavailable');
   if(!['GET','POST'].includes(request.method))return json({error:'不支持的请求方式。'},405,{Allow:'GET, POST'});
   const url=new URL(request.url);
   if(url.searchParams.has('story')&&url.searchParams.get('story')!==story.id)error(404,'没有找到这个多人剧本。','not_found');
   if(request.method==='POST'&&((request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)||request.headers.get('Sec-Fetch-Site')==='cross-site'))error(403,'请从本站操作。','invalid_origin');
   const body=request.method==='POST'?await bodyOf(request):null;
   await db.batch(schema.map(q=>db.prepare(q)));
   await db.batch([20000,20001,20002,20003].map(n=>db.prepare('INSERT OR IGNORE INTO koa_fiction_multi_tables(table_no,story_id) VALUES (?,?)').bind(n,story.id)));
   const now=Date.now(),token=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
   let tokenHash=/^[a-f0-9]{64}$/.test(token||'')?await hash(token):null;
   let player=tokenHash?await one(db,'SELECT * FROM koa_fiction_multi_players WHERE token_hash=? AND expires_at>?',tokenHash,now):null;
   // Waiting seats only: a closed browser eventually frees a seat. Running adventures are retained.
   await run(db,"UPDATE koa_fiction_multi_players SET table_no=NULL,join_order=NULL WHERE table_no IN (SELECT table_no FROM koa_fiction_multi_tables WHERE status='waiting' AND lock_until<?) AND last_seen<?",now,now-30*60000);
   if(player){cookieHeader=`${COOKIE}=${token}; Path=/api/fiction-rooms; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL/1000}`;await run(db,'UPDATE koa_fiction_multi_players SET last_seen=?,expires_at=? WHERE token_hash=? AND last_seen<?',now,now+TTL,tokenHash,now-30000);player=await one(db,'SELECT * FROM koa_fiction_multi_players WHERE token_hash=?',tokenHash);}
   if(!body){
    const n=url.searchParams.has('table')?Number(url.searchParams.get('table')):null;
    if(n!==null&&!validTable(n))error(404,'没有这个桌号。','not_found');
    const saves=player?(await all(db,'SELECT s.run_id AS runId,s.title,s.saved_at AS savedAt FROM koa_fiction_multi_saves s JOIN koa_fiction_multi_save_members m ON m.run_id=s.run_id WHERE m.player_id=? ORDER BY s.saved_at DESC LIMIT 30',player.player_id)):[];
    const base={saves,you:player?{...publicPlayer(player),table:player.table_no}:null,story:{id:story.id,title:story.title,minPlayers:story.minPlayers,maxPlayers:story.maxPlayers}};
    if(n!==null)return json({...base,table:await view(db,await readRoom(db,n),player,url)});
    const rows=await all(db,'SELECT * FROM koa_fiction_multi_tables ORDER BY table_no');
    const tables=[];for(const row of rows){const seats=await roomPlayers(db,row.table_no);const saved=row.state_json?JSON.parse(row.state_json):null;tables.push({number:row.table_no,storyId:row.story_id,status:row.status,revision:row.revision,busy:row.lock_until>Date.now(),hostId:seats[0]?.player_id||null,members:seats.map(publicPlayer),minPlayers:story.minPlayers,maxPlayers:story.maxPlayers,canRejoin:!!saved?.characters.some(c=>c.id===player?.player_id)});}return json({...base,tables});
   }
   const ip=request.headers.get('CF-Connecting-IP')||'local',bucket='multi:'+await hash(ip)+':'+Math.floor(now/60000);
   if(!changed(await run(db,'INSERT INTO koa_fiction_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<100',bucket,now+120000)))error(429,'操作有些频繁，请稍后再试。','rate_limited');
   if(body.op==='hello'){
    const name=normalizeName(body.name);if(!name)error(400,'请填写1—20字的玩家名。','invalid_name');
    if(player){if(player.table_no!==null&&name!==player.name)error(409,'请先离桌再修改名字。','already_seated');await run(db,'UPDATE koa_fiction_multi_players SET name=? WHERE token_hash=?',name,tokenHash);return json({you:{id:player.player_id,name,table:player.table_no}});}
    const newToken=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),id='P'+crypto.randomUUID().replaceAll('-','').slice(0,10);
    await run(db,'INSERT INTO koa_fiction_multi_players(token_hash,player_id,name,last_seen,expires_at) VALUES (?,?,?,?,?)',await hash(newToken),id,name,now,now+TTL);
    return json({you:{id,name,table:null}},200,{'Set-Cookie':`${COOKIE}=${newToken}; Path=/api/fiction-rooms; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL/1000}`});
   }
   if(!player)error(401,'请先设置玩家名。','identity_required');
   if(body.op==='chat'){
    const row=await readRoom(db,body.table);if(player.table_no!==body.table||!row.state_json)error(403,'只有本桌成员可以发送消息。','not_member');
    const state=JSON.parse(row.state_json);
    // Atomic idempotency with a namespaced receipt; chat does not alter game revision or take the model lock.
    const rid='chat:'+body.requestId;
    await db.batch([db.prepare('INSERT INTO koa_fiction_multi_chat(run_id,player_id,name,message,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM koa_fiction_multi_receipts WHERE run_id=? AND request_id=?) AND EXISTS(SELECT 1 FROM koa_fiction_multi_players WHERE player_id=? AND table_no=?)').bind(state.runId,player.player_id,player.name,body.text.trim(),now,state.runId,rid,player.player_id,body.table),db.prepare('INSERT OR IGNORE INTO koa_fiction_multi_receipts(run_id,request_id,player_id,revision) VALUES (?,?,?,?)').bind(state.runId,rid,player.player_id,row.revision)]);
    return json({ok:true});
   }
   const owner=crypto.randomUUID();
   if(!changed(await run(db,'UPDATE koa_fiction_multi_tables SET lock_owner=?,lock_until=? WHERE table_no=? AND lock_until<?',owner,now+LOCK,body.table,now)))error(409,'主持或其他队员正在处理操作，请稍后刷新。','table_busy');
   release={number:body.table,owner};
   let row=await readRoom(db,body.table),seats=await roomPlayers(db,body.table),state=row.state_json?JSON.parse(row.state_json):null;
   const hostId=seats[0]?.player_id;
   const commit=async(next,status=row.status,requestId=null,extra=[])=>{
    const commitTime=Date.now(),prepared=prepareHistory(db,next),statements=[...prepared.statements,...extra];next=prepared.state;
    const live=await readRoom(db,body.table);if(live.lock_owner!==owner||live.lock_until<=commitTime)error(409,'本次操作锁已过期。','revision_conflict');
    statements.unshift(db.prepare('INSERT INTO koa_fiction_multi_commit_guard(id,ok) VALUES (?,CASE WHEN EXISTS(SELECT 1 FROM koa_fiction_multi_tables WHERE table_no=? AND lock_owner=? AND lock_until>?) THEN 1 ELSE 0 END)').bind(owner,body.table,owner,commitTime));
    if(requestId)statements.push(db.prepare('INSERT OR IGNORE INTO koa_fiction_multi_receipts(run_id,request_id,player_id,revision) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM koa_fiction_multi_tables WHERE table_no=? AND lock_owner=? AND lock_until>?)').bind(next.runId,requestId,player.player_id,row.revision+1,body.table,owner,commitTime));
    statements.push(db.prepare('UPDATE koa_fiction_multi_tables SET state_json=?,status=?,revision=revision+1,lock_owner=NULL,lock_until=0 WHERE table_no=? AND lock_owner=? AND lock_until>?').bind(next?JSON.stringify(next):null,status,body.table,owner,commitTime));
    statements.push(db.prepare('DELETE FROM koa_fiction_multi_commit_guard WHERE id=?').bind(owner));const results=await db.batch(statements);if(!changed(results.at(-2)))error(409,'本次操作的锁已过期，请刷新查看进度。','revision_conflict');release=null;
   };
   const saveStatements=(saved,title)=>{
    const packed=prepareHistory(db,{...saved,drafts:{}}),label=title?.trim()||saved.adventureTitle||'冰海中的同路人';
    return [...packed.statements,db.prepare('INSERT OR REPLACE INTO koa_fiction_multi_saves(run_id,story_id,state_json,title,saved_at) VALUES (?,?,?,?,?)').bind(saved.runId,storyFor(saved).id,JSON.stringify({...packed.state,adventureTitle:label}),label,now),...saved.characters.map(c=>db.prepare('INSERT OR IGNORE INTO koa_fiction_multi_save_members(run_id,player_id) VALUES (?,?)').bind(saved.runId,c.id))];
   };
   if(body.op==='restore'){
    if(player.table_no!==null||row.status!=='waiting'||seats.length)error(409,'请选择无人空桌恢复。','table_unavailable');
    const saved=await one(db,'SELECT s.* FROM koa_fiction_multi_saves s JOIN koa_fiction_multi_save_members m ON s.run_id=m.run_id WHERE s.run_id=? AND m.player_id=?',body.runId,player.player_id);
    if(!saved)error(404,'找不到你参与的存档。','save_not_found');
    if(await one(db,"SELECT table_no FROM koa_fiction_multi_tables WHERE json_extract(state_json,'$.runId')=?",body.runId))error(409,'这段冒险已在另一桌恢复。','already_restored');
    const restored=JSON.parse(saved.state_json);storyFor(restored);
    const restoreGuard=owner+':restore';
    await commit({...restored,drafts:{}},'paused',null,[
     db.prepare("INSERT INTO koa_fiction_multi_commit_guard(id,ok) VALUES (?,CASE WHEN EXISTS(SELECT 1 FROM koa_fiction_multi_saves WHERE run_id=?) AND EXISTS(SELECT 1 FROM koa_fiction_multi_players WHERE token_hash=? AND table_no IS NULL) AND NOT EXISTS(SELECT 1 FROM koa_fiction_multi_players WHERE table_no=?) AND NOT EXISTS(SELECT 1 FROM koa_fiction_multi_tables WHERE json_extract(state_json,'$.runId')=?) THEN 1 ELSE 0 END)").bind(restoreGuard,body.runId,tokenHash,body.table,body.runId),
     db.prepare('UPDATE koa_fiction_multi_players SET table_no=?,join_order=1,last_seen=? WHERE token_hash=?').bind(body.table,now,tokenHash),
     db.prepare('DELETE FROM koa_fiction_multi_saves WHERE run_id=?').bind(body.runId),
     db.prepare('DELETE FROM koa_fiction_multi_commit_guard WHERE id=?').bind(restoreGuard)
    ]);
    return json({ok:true,table:body.table});
   }
   if(body.op==='join'){
    if(player.table_no===body.table)return json({ok:true,table:body.table});
    if(player.table_no!==null)error(409,'你已在另一桌，请先离桌。','already_seated');
    if(row.status!=='waiting'&&!state?.characters.some(c=>c.id===player.player_id))error(409,'这桌仅允许原队员返回。','already_started');
    if(seats.length>=story.maxPlayers)error(409,'这桌已经满员。','table_full');
    const seatGuard=owner+':seat';
    await commit(state,row.status,null,[
     db.prepare('INSERT INTO koa_fiction_multi_commit_guard(id,ok) VALUES (?,CASE WHEN EXISTS(SELECT 1 FROM koa_fiction_multi_players WHERE token_hash=? AND table_no IS NULL) THEN 1 ELSE 0 END)').bind(seatGuard,tokenHash),
     db.prepare('UPDATE koa_fiction_multi_players SET table_no=?,join_order=?,last_seen=? WHERE token_hash=? AND table_no IS NULL').bind(body.table,(seats.at(-1)?.join_order||0)+1,now,tokenHash),
     db.prepare('DELETE FROM koa_fiction_multi_commit_guard WHERE id=?').bind(seatGuard)
    ]);return json({ok:true,table:body.table});
   }
   if(!seats.some(p=>p.player_id===player.player_id)){
    if(body.op==='leave')return json({ok:true});error(403,'只有本桌成员可以操作。','not_member');
   }
   if(['start','resolve','close','pause','resume'].includes(body.op)&&hostId!==player.player_id)error(403,'只有房主可以执行这项操作。','host_required');
   if(body.op==='pause'){
   if(!state||state.ended)error(409,'当前没有可休局的冒险。','not_playing');
    const extras=saveStatements(state,body.title);extras.push(db.prepare('UPDATE koa_fiction_multi_players SET table_no=NULL,join_order=NULL WHERE table_no=?').bind(body.table));
    await commit(null,'waiting',null,extras);return json({ok:true,saved:true,runId:state.runId});
   }
   if(body.op==='resume'){
    if(!state||row.status!=='paused')error(409,'这桌没有暂停中的冒险。','not_paused');
    if(state.characters.some(c=>!seats.some(p=>p.player_id===c.id)))error(409,'请等待原队员全部返回；不会替缺席者决定行动。','waiting_for_party');
    await commit(state,'playing');return json({ok:true});
   }
   if(body.op==='leave'||body.op==='close'){
    const emptied=body.op==='close'||seats.length===1,extras=[];
    if(emptied&&state){if(body.op==='leave'&&!state.ended)extras.push(...saveStatements(state));else extras.push(db.prepare('INSERT OR REPLACE INTO koa_fiction_multi_archives(run_id,table_no,state_json,archived_at) VALUES (?,?,?,?)').bind(state.runId,body.table,JSON.stringify(state),now));}
    extras.push(db.prepare('UPDATE koa_fiction_multi_players SET table_no=NULL,join_order=NULL WHERE '+(body.op==='close'?'table_no=?':'player_id=?')).bind(body.op==='close'?body.table:player.player_id));
    if(state){state.drafts={};state.activePlayers=seats.filter(p=>p.player_id!==player.player_id).map(p=>p.player_id);}
    await commit(emptied?null:state,emptied?'waiting':state&&!state.ended?'paused':row.status,null,extras);return json({ok:true});
   }
   if(body.op==='start'){
    if(state)return json({ok:true,table:body.table,started:true});
    if(seats.length<story.minPlayers)error(409,`至少需要${story.minPlayers}人才能开局。`,'not_enough_players');
    state=createAdventure(seats.map(publicPlayer),env.FICTION_MULTIPLAYER_HOST_REVISION||'cooperative-v4');await commit(state,'playing',body.requestId);return json({ok:true,table:body.table,started:true});
   }
   if(row.status==='paused')error(409,'冒险已暂停，等待队员返回后由房主继续。','game_paused');
   if(!state||state.ended)error(409,'当前没有正在进行的冒险。','not_playing');
   if(body.op==='resolve'){
    const receipt=await one(db,'SELECT player_id FROM koa_fiction_multi_receipts WHERE run_id=? AND request_id=?',state.runId,body.requestId);
    if(receipt)return json({ok:true,recovered:true});
   }
   if(body.round!==state.round)error(409,'故事已经推进，请刷新后重新声明行动。','round_changed');
   if(body.op==='act'){state.drafts[player.player_id]={text:body.hold?'本阶段留在原地观察。':body.text.trim(),hold:body.hold};await commit(state);return json({ok:true});}
   if(body.op==='withdraw'){delete state.drafts[player.player_id];await commit(state);return json({ok:true});}
   if(body.op==='resolve'){
    if(seats.some(p=>!state.drafts[p.player_id]))error(409,'请等待每位队员提交行动或选择本阶段观察。','waiting_for_actions');
    const actions=seats.map(p=>({playerId:p.player_id,name:p.name,...state.drafts[p.player_id]}));state.activePlayers=seats.map(p=>p.player_id);
    const chat=await all(db,'SELECT player_id AS playerId,name,message AS text FROM (SELECT * FROM koa_fiction_multi_chat WHERE run_id=? ORDER BY id DESC LIMIT 12) ORDER BY id',state.runId);
    state=await hydrateHistory(db,state);const result=await resolver({env,db,state,actions,chat});await commit(result.state,result.state.ended?'ended':'playing',body.requestId);return json({ok:true,round:result.state.round});
   }
   error(400,'不支持的操作。','invalid_request');
  }catch(e){return json({error:e instanceof ApiError?e.message:'房间服务暂时不可用，请稍后再试。',code:e instanceof ApiError?e.code:'service_unavailable'},e instanceof ApiError?e.status:503);}
  finally{if(release)await run(db,'UPDATE koa_fiction_multi_tables SET lock_owner=NULL,lock_until=0 WHERE table_no=? AND lock_owner=?',release.number,release.owner).catch(()=>{});}
 };
}
