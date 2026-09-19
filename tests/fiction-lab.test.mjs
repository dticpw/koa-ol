import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import * as engine from '../functions/_lib/fiction-lab-engine.js';
import * as classic from '../functions/_lib/fiction-engine.js';
import {createFictionHandler} from '../functions/_lib/fiction-service.js';
import {resolveLabTurn} from '../functions/_lib/fiction-lab-host.js';
const step=(over={})=>({attempt:'尝试',status:'completed',duration:1,requires_previous_success:false,scope:'near',refs:[],move_to:'stay',door:'unchanged',end:'continue',updates:[],creates:[],outcome:'发生了一次尝试。',observations:[],...over});
const update=(id,facts,place='carried',integrity='intact')=>({id,facts,place,integrity});
const plan=(...steps)=>({intent:'忠实执行玩家的尝试',steps});
const apply=(s,...steps)=>engine.applyProposal(s,plan(...steps),'测试动作');
test('connected preparation and remote throw preserve actor location and facts across turns',()=>{
 const original=engine.createGame();
 const r=apply(original,step({duration:0,updates:[update('lamp','灯罩已打开，正常燃烧。')]}),step({scope:'project',updates:[update('cloth','布角正在燃烧，布身尚完整。','threshold','damaged')]}));
 assert.equal(original.turn,0);assert.equal(r.state.turn,1);assert.equal(r.state.location,'outside');
 assert.equal(r.state.entities.find(e=>e.id==='cloth').place,'threshold');
 const next=apply(r.state,step({scope:'observe'})).state;
 assert.match(next.entities.find(e=>e.id==='cloth').facts,/正在燃烧/);
 assert.ok(!engine.getView(next).inventory.some(e=>e.id==='cloth'));
});
test('ordinary novel state is kept in facts without adding a per-object field',()=>{
 let s=apply(engine.createGame(),step({updates:[update('cloth','雨水浸透，拧出一些水后仍然潮湿。')]})).state;
 s=apply(s,step({updates:[update('cloth','仍湿，边角靠火烤出蒸汽，尚未点燃。')]})).state;
 assert.match(s.entities.find(e=>e.id==='cloth').facts,/仍湿/);assert.equal(s.clothWet,undefined);
});
test('dependent step does not run after failed attempt; partial always returns control',()=>{
 for(const status of ['failed','partial']){
 const r=apply(engine.createGame(),step({status}),step({requires_previous_success:true,updates:[update('cloth','被投出。','threshold')],scope:'project'}));
 assert.equal(r.outcomes.length,1);assert.equal(r.state.entities.find(e=>e.id==='cloth').place,'carried');
 }
});
test('time truncates a later long step without applying its proposed changes',()=>{
 const s=engine.createGame();s.turn=17;
 const r=apply(s,step(),step({duration:20,scope:'time',updates:[update('cloth','隔夜晾干。')]}));
 assert.equal(r.state.turn,20);assert.equal(r.state.status,'ended');assert.equal(r.outcomes[1].duration,2);
 assert.equal(r.state.entities.find(e=>e.id==='cloth').facts,'干燥、完好。');
});
test('closed boundary, remote pickup, fixed objects, resurrection and copying rejected atomically',()=>{
 const s=engine.createGame();s.doorOpen=false;
 assert.throws(()=>apply(s,step({scope:'project',updates:[update('cloth','投出。','threshold')]})),/reach/);
 assert.throws(()=>apply(s,step({move_to:'chamber',scope:'travel'})),/travel/);
 assert.throws(()=>apply(s,step({updates:[update('wall','拿走。')]})),/fixed/);
 const dead=apply(s,step({updates:[update('cloth','已烧尽。','consumed','consumed')]})).state;
 assert.throws(()=>apply(dead,step({updates:[update('cloth','完好。')]})),/resurrection/);
 assert.throws(()=>apply(s,step({creates:[{id:'copy_cloth',source:'cloth',name:'厚布副本',place:'carried',facts:'完整厚布'}]})),/source/);
 assert.equal(s.entities.find(e=>e.id==='cloth').place,'carried');
});
test('derived piece requires real source loss; damage and origin persist',()=>{
 const r=apply(engine.createGame(),step({updates:[update('cloth','撕去一角，余下厚布。','carried','damaged')],creates:[{id:'cloth_strip',source:'cloth',name:'厚布布条',place:'carried',facts:'撕下的一角。'}]}));
 assert.equal(r.state.entities.find(e=>e.id==='cloth_strip').source,'cloth');
 assert.equal(r.state.entities.find(e=>e.id==='cloth').integrity,'damaged');
});
test('taking support releases hammer once and interrupts rest of chain',()=>{
 const r=apply(engine.createGame(),step({updates:[update('weight','握在手中。')]}),step({move_to:'threshold',scope:'travel'}));
 assert.equal(r.state.hammerFallen,true);assert.equal(r.outcomes.length,1);assert.equal(r.state.location,'outside');
 const next=apply(r.state,step());assert.equal(next.state.resolve,3);assert.equal(next.state.hammerFallen,true);
});
test('physical mutations cost at least one tick even if all preparation steps are zero',()=>{
 const r=apply(engine.createGame(),step({duration:0,updates:[update('lamp','灯罩已打开。')]}));assert.equal(r.state.turn,1);
});
function database(){const sql=new DatabaseSync(':memory:');return {sql,prepare(q){let a=[];return {bind(...v){a=v;return this;},async run(){return {meta:{changes:Number(sql.prepare(q).run(...a).changes)}};},async first(){return sql.prepare(q).get(...a)||null;}};},async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
const response=text=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(text),usage:{input_tokens:100,output_tokens:100}}));
function fixture(){let approval=true,calls=0;const env={DB:database(),UPSTREAM_API_KEY:'test',UPSTREAM_BASE_URL:'https://model.invalid/v1'};
 const lab=createFictionHandler(engine,{gameKind:'lab',cookieName:'koa_fiction_lab',cookiePath:'/api/fiction-lab',resolveTurn:resolveLabTurn,fetchImpl:async(_,opts)=>{calls++;const p=JSON.parse(opts.body);return response(p.text.format.name==='host_ruling'?plan(step({updates:[update('cloth','已浸湿。')]})):{consistent:approval,issue:approval?'':'contradiction',narration:approval?'厚布浸湿，仍在手中。':''});}});
 const old=createFictionHandler(classic);let cookie='';
 return {env,get calls(){return calls;},reject(){approval=false;},accept(){approval=true;},async req(body,{handler=lab,rawCookie=cookie}={}){const r=await handler({env,request:new Request('https://test.invalid/api/fiction-lab',{method:body?'POST':'GET',headers:{Cookie:rawCookie,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.45'},...(body?{body:JSON.stringify(body)}:{})})});if(r.headers.has('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];return {status:r.status,body:await r.json(),cookie};},old};}
const turn=()=>({op:'turn',requestId:crypto.randomUUID(),expectedRevision:0,action:'用雨水浸湿布'});
test('lab receipt atomically commits reviewed facts; retry does not call model again',async()=>{const f=fixture();await f.req({op:'start'});const b=turn();const r=await f.req(b);assert.equal(r.status,200);assert.equal(r.body.game.turn,1);assert.equal(f.calls,2);assert.deepEqual((await f.req(b)).body,r.body);assert.equal(f.calls,2);assert.match((await f.req()).body.game.inventory.find(e=>e.id==='cloth').description,/浸湿/);});
test('review rejection leaves facts, revision, receipts unchanged and releases lock',async()=>{const f=fixture();await f.req({op:'start'});f.reject();const b=turn();assert.equal((await f.req(b)).body.code,'adjudication_failed');assert.equal((await f.req()).body.game.revision,0);assert.equal(f.env.DB.sql.prepare('SELECT count(*) AS n FROM koa_fiction_receipts').get().n,0);assert.equal(f.env.DB.sql.prepare('SELECT lock_owner FROM koa_fiction_sessions').get().lock_owner,null);f.accept();assert.equal((await f.req(b)).status,200);});
test('lab and classic sessions stay isolated even if cookie values are exchanged',async()=>{const f=fixture();const lab=await f.req({op:'start'});assert.match(lab.cookie,/^koa_fiction_lab=/);const wrong=await f.req(null,{handler:f.old,rawCookie:lab.cookie.replace('koa_fiction_lab=','koa_fiction=')});assert.equal(wrong.body.game,null);const old=await f.req({op:'start'},{handler:f.old,rawCookie:''});const cross=await f.req(null,{rawCookie:old.cookie.replace('koa_fiction=','koa_fiction_lab=')});assert.equal(cross.body.game,null);assert.equal((await f.req(null,{rawCookie:lab.cookie})).body.game.sessionId,lab.body.game.sessionId);});
test('zero budget leaves lab unchanged, including suggested actions',async()=>{const f=fixture();f.env.FICTION_DAILY_BUDGET_USD='0';await f.req({op:'start'});const r=await f.req({op:'turn',requestId:crypto.randomUUID(),expectedRevision:0,choiceId:'look'});assert.equal(r.body.code,'budget_exhausted');assert.doesNotMatch(r.body.error,/仍可/);assert.equal(f.calls,0);assert.equal((await f.req()).body.game.turn,0);});
test('support release cannot mix with travel and silently change the injury position',()=>{
 const outside=engine.createGame();
 assert.throws(()=>apply(outside,step({scope:'project',move_to:'threshold',updates:[update('weight','移开。','outside')]})),/split support/);
 const inside=engine.createGame();inside.location='threshold';
 assert.throws(()=>apply(inside,step({scope:'project',move_to:'outside',updates:[update('weight','移开。','threshold')]})),/split support/);
 const hit=apply(inside,step({scope:'project',updates:[update('weight','移开。','threshold')]}),step({move_to:'outside',scope:'travel'}));
 assert.equal(hit.state.location,'threshold');assert.equal(hit.state.resolve,2);assert.equal(hit.outcomes.length,1);
 const safe=apply(inside,step({move_to:'outside',scope:'travel'}),step({updates:[update('weight','移开。','outside')]}));
 assert.equal(safe.state.location,'outside');assert.equal(safe.state.resolve,3);assert.equal(safe.state.hammerFallen,true);
});
