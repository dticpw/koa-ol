import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/fiction-preview.mjs';
import {createMultiplayerHandler} from '../functions/_lib/multiplayer/service.js';
import {createAdventure,resolveMultiplayer} from '../functions/_lib/multiplayer/host.js';
import {applyRuling} from '../functions/_lib/multiplayer/host-v1.js';
import {createFictionHandler} from '../functions/_lib/fiction-service.js';
import * as singleEngine from '../functions/_lib/fiction-engine.js';

function fixture(resolver){
 const sql=new DatabaseSync(':memory:'),env={DB:sqliteAdapter(sql)},calls=[];
 const handle=createMultiplayerHandler({resolver:resolver||(async({state,actions})=>{calls.push(actions);const next=structuredClone(state);next.round++;next.drafts={};next.facts.push({id:'private_secret',text:'SHOULD_NEVER_APPEAR'});next.log.push({id:'x'+next.round,round:next.round,role:'host',name:'主持',text:'队伍在码头交换了想法。'});return {state:next,trace:[]};})});
 function client(){let cookie='';return {get cookie(){return cookie;},async req(body,query='',headers={}){const r=await handle({env,request:new Request('https://game.test/api/fiction-rooms'+query,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:'https://game.test'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})})});if(r.headers.has('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];return {status:r.status,body:await r.json(),headers:r.headers};}};}
 return {sql,env,calls,client};
}
const op=(op,extra={})=>({op,table:20000,...extra});
const start=()=>op('start',{requestId:crypto.randomUUID()});
async function seated(f,n=2){const clients=[];for(let i=0;i<n;i++){const c=f.client();await c.req({op:'hello',name:'队员'+i});assert.equal((await c.req(op('join'))).status,200);clients.push(c);}return clients;}
async function ready(clients,round=0){for(const c of clients)assert.equal((await c.req(op('act',{round,text:'我与同伴在码头商量计划。',hold:false}))).status,200);}

test('four fixed tables start at 20000; identity uses secure HttpOnly server credentials',async()=>{
 const f=fixture(),c=f.client();const list=await c.req();assert.deepEqual(list.body.tables.map(t=>t.number),[20000,20001,20002,20003]);
 assert.equal(list.body.you,null);const result=await c.req({op:'hello',name:'小恶魔'});assert.match(result.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
 assert.match(result.body.you.id,/^P[a-f0-9]{10}$/);assert.notEqual(f.sql.prepare('SELECT token_hash FROM koa_fiction_multi_players').get().token_hash,c.cookie.split('=')[1]);
 assert.equal((await c.req()).body.you.name,'小恶魔');f.sql.close();
});
test('additive multiplayer setup and room lifecycle preserve existing single-player tables and saves',async()=>{
 const f=fixture(),single=createFictionHandler(singleEngine);
 const r=await single({env:f.env,request:new Request('https://game.test/api/fiction',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://game.test'},body:JSON.stringify({op:'start'})})});assert.equal(r.status,200);
 const before=f.sql.prepare('SELECT * FROM koa_fiction_sessions').all(),ddl=f.sql.prepare("SELECT sql FROM sqlite_master WHERE name='koa_fiction_sessions'").get().sql;
 const [a,b]=await seated(f);await a.req(start());await a.req(op('close'));
 assert.deepEqual(f.sql.prepare('SELECT * FROM koa_fiction_sessions').all(),before);assert.equal(f.sql.prepare("SELECT sql FROM sqlite_master WHERE name='koa_fiction_sessions'").get().sql,ddl);f.sql.close();
});
test('minimum count, host-only start, full roster and repeat start are enforced',async()=>{
 const f=fixture(),[a]=await seated(f,1);assert.equal((await a.req(start())).body.code,'not_enough_players');
 const b=f.client();await b.req({op:'hello',name:'朋友'});await b.req(op('join'));assert.equal((await b.req(start())).status,403);
 assert.equal((await a.req(start())).status,200);const g=(await a.req(null,'?table=20000')).body.table.game;
 assert.equal(g.characters.length,2);assert.equal(g.hostRevision,'cooperative-v2');await a.req(start());assert.equal((await a.req(null,'?table=20000')).body.table.game.runId,g.runId);f.sql.close();
});
test('six seats maximum and a player cannot join two tables',async()=>{
 const f=fixture(),cs=await seated(f,6);assert.equal((await cs[0].req(op('join',{table:20001}))).body.code,'already_seated');
 const c=f.client();await c.req({op:'hello',name:'第七人'});assert.equal((await c.req(op('join'))).body.code,'table_full');f.sql.close();
});
test('concurrent joins by the same identity cannot acquire two seats',async()=>{
 const f=fixture(),c=f.client();await c.req({op:'hello',name:'并发玩家'});
 const result=await Promise.all([c.req(op('join')),c.req(op('join',{table:20001}))]);assert.equal(result.filter(r=>r.status===200).length,1);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM koa_fiction_multi_players WHERE table_no IS NOT NULL').get().n,1);f.sql.close();
});
test('departure transfers host and last departure resets only its own table',async()=>{
 const f=fixture(),[a,b]=await seated(f);const id=(await b.req()).body.you.id;
 await a.req(op('leave'));assert.equal((await b.req(null,'?table=20000')).body.table.hostId,id);await b.req(op('leave'));
 const tables=(await b.req()).body.tables;assert.equal(tables[0].members.length,0);assert.equal(tables[1].status,'waiting');f.sql.close();
});
test('outsiders cannot read adventure logs or forge another player identity',async()=>{
 const f=fixture(),[a,b]=await seated(f);await a.req(start());const stranger=f.client();await stranger.req({op:'hello',name:'旁观者'});
 assert.equal((await stranger.req(null,'?table=20000')).body.table.game,undefined);
 assert.equal((await stranger.req(op('act',{round:0,text:'偷走物品',hold:false}))).status,403);
 assert.equal((await b.req({...start(),playerId:(await a.req()).body.you.id})).status,400);f.sql.close();
});
test('chat does not submit actions; every player must explicitly declare',async()=>{
 const f=fixture(),[a,b]=await seated(f);await a.req(start());await a.req(op('chat',{text:'我们走吧',requestId:crypto.randomUUID()}));
 await a.req(op('act',{round:0,text:'我观察码头',hold:false}));const before=await a.req(op('resolve',{round:0,requestId:crypto.randomUUID()}));assert.equal(before.body.code,'waiting_for_actions');
 await b.req(op('act',{round:0,hold:true}));assert.equal((await a.req(op('resolve',{round:0,requestId:crypto.randomUUID()}))).status,200);assert.equal(f.calls[0][1].hold,true);f.sql.close();
});
test('actions can be revised or withdrawn before resolution; stale actions are rejected',async()=>{
 const f=fixture(),cs=await seated(f);await cs[0].req(start());await ready(cs);await cs[1].req(op('withdraw',{round:0}));
 assert.equal(Object.keys((await cs[0].req(null,'?table=20000')).body.table.game.drafts).length,1);
 await cs[1].req(op('act',{round:0,hold:true}));await cs[0].req(op('resolve',{round:0,requestId:crypto.randomUUID()}));
 assert.equal((await cs[1].req(op('act',{round:0,text:'旧行动',hold:false}))).body.code,'round_changed');f.sql.close();
});
test('retrying a completed request never calls the host twice and secrets never appear in public state',async()=>{
 const f=fixture(),cs=await seated(f);await cs[0].req(start());await ready(cs);const body=op('resolve',{round:0,requestId:crypto.randomUUID()});
 await cs[0].req(body);assert.equal((await cs[0].req(body)).body.recovered,true);assert.equal(f.calls.length,1);
 const view=await cs[1].req(null,'?table=20000');assert.equal(view.body.table.game.round,1);assert.doesNotMatch(JSON.stringify(view.body),/SHOULD_NEVER_APPEAR|keyCopied|secrets|token_hash/);f.sql.close();
});
test('failed model call keeps declarations and world unchanged and releases lock',async()=>{
 const f=fixture(async()=>{throw Error('network');}),cs=await seated(f);await cs[0].req(start());await ready(cs);const r=await cs[0].req(op('resolve',{round:0,requestId:crypto.randomUUID()}));assert.equal(r.status,503);
 const t=(await cs[1].req(null,'?table=20000')).body.table;assert.equal(t.game.round,0);assert.equal(Object.keys(t.game.drafts).length,2);assert.equal(t.busy,false);f.sql.close();
});
test('chat is available while the host works; no simultaneous second settlement or leave',async()=>{
 let finish,started;const signal=new Promise(r=>started=r);const f=fixture(async({state})=>{started();await new Promise(r=>finish=r);const next=structuredClone(state);next.round++;next.drafts={};return {state:next};});
 const cs=await seated(f);await cs[0].req(start());await ready(cs);const pending=cs[0].req(op('resolve',{round:0,requestId:crypto.randomUUID()}));await signal;
 assert.equal((await cs[1].req(op('leave'))).body.code,'table_busy');assert.equal((await cs[0].req(op('resolve',{round:0,requestId:crypto.randomUUID()}))).body.code,'table_busy');
 assert.equal((await cs[1].req(op('chat',{text:'慢慢来',requestId:crypto.randomUUID()}))).status,200);finish();assert.equal((await pending).status,200);f.sql.close();
});
test('expired model lock cannot overwrite a new owner or create a false receipt',async()=>{
 let f;f=fixture(async({state})=>{f.sql.prepare('UPDATE koa_fiction_multi_tables SET lock_owner=?,lock_until=? WHERE table_no=20000').run('new-owner',Date.now()+150000);return {state:{...state,round:9}};});
 const cs=await seated(f);await cs[0].req(start());await ready(cs);const requestId=crypto.randomUUID();assert.equal((await cs[0].req(op('resolve',{round:0,requestId}))).body.code,'revision_conflict');
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM koa_fiction_multi_receipts WHERE request_id=?').get(requestId).n,0);
 assert.equal(JSON.parse(f.sql.prepare('SELECT state_json FROM koa_fiction_multi_tables WHERE table_no=20000').get().state_json).round,0);f.sql.close();
});
test('clearing a game archives the state, and nonhost cannot clear it',async()=>{
 const f=fixture(),cs=await seated(f);await cs[0].req(start());assert.equal((await cs[1].req(op('close'))).status,403);await cs[0].req(op('close'));
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM koa_fiction_multi_archives').get().n,1);assert.equal((await cs[1].req()).body.you.table,null);assert.equal((await cs[0].req()).body.tables[0].status,'waiting');f.sql.close();
});
test('cross-origin, excessive input and unknown table are rejected',async()=>{
 const f=fixture(),c=f.client();assert.equal((await c.req({op:'hello',name:'x'},'',{Origin:'https://evil.test'})).status,403);
 assert.equal((await c.req(op('join',{table:19999}))).status,404);assert.equal((await c.req({op:'hello',name:'x'.repeat(5000)})).status,413);f.sql.close();
});
test('waiting disconnected players expire without evicting active adventures',async()=>{
 const f=fixture(),cs=await seated(f);f.sql.prepare('UPDATE koa_fiction_multi_players SET last_seen=?').run(Date.now()-31*60000);const c=f.client();assert.equal((await c.req()).body.tables[0].members.length,0);
 for(const x of cs)await x.req(op('join'));await cs[0].req(start());f.sql.prepare('UPDATE koa_fiction_multi_players SET last_seen=?').run(Date.now()-31*60000);assert.equal((await c.req()).body.tables[0].members.length,2);f.sql.close();
});
test('program checks reject teleportation, omitted actors, unowned items and movement of a holding player',()=>{
 const state=createAdventure([{id:'P1',name:'甲'},{id:'P2',name:'乙'}]),actions=[{playerId:'P1',text:'观察',hold:false},{playerId:'P2',text:'观察',hold:false}];
 const proposal={destination:'dock',suspicionDelta:0,suspicionReason:'',keyCopied:false,ended:false,facts:[],items:[],removeItems:[],outcomes:actions.map(a=>({playerId:a.playerId,text:'观察码头'})),narration:'船员卸货。'};
 assert.equal(applyRuling(state,proposal,actions).round,1);
 assert.throws(()=>applyRuling(state,{...proposal,destination:'office'},actions));assert.throws(()=>applyRuling(state,{...proposal,outcomes:[proposal.outcomes[0]]},actions));
 assert.throws(()=>applyRuling(state,{...proposal,items:[{id:'key',name:'钥匙',owner:'stranger',condition:'完好'}]},actions));
 assert.throws(()=>applyRuling(state,{...proposal,destination:'lift'},[actions[0],{...actions[1],hold:true}]));
});
test('changing the default host affects new tables only; an existing game keeps its pinned revision',async()=>{
 const revisions=[];const f=fixture(async({state})=>{revisions.push(state.hostRevision);return {state:{...state,round:state.round+1,drafts:{}}};});
 f.env.FICTION_MULTIPLAYER_HOST_REVISION='cooperative-v1';const cs=await seated(f);await cs[0].req(start());
 f.env.FICTION_MULTIPLAYER_HOST_REVISION='cooperative-v2';await ready(cs);await cs[0].req(op('resolve',{round:0,requestId:crypto.randomUUID()}));assert.deepEqual(revisions,['cooperative-v1']);
 await cs[0].req(op('close'));for(const c of cs)await c.req(op('join'));await cs[0].req(start());await ready(cs);await cs[0].req(op('resolve',{round:0,requestId:crypto.randomUUID()}));assert.deepEqual(revisions,['cooperative-v1','cooperative-v2']);f.sql.close();
});
