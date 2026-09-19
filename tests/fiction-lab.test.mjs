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
 const lab=createFictionHandler(engine,{gameKind:'lab',cookieName:'koa_fiction_lab',cookiePath:'/api/fiction-lab',resolveTurn:resolveLabTurn,fetchImpl:async(_,opts)=>{calls++;const p=JSON.parse(opts.body);return response(p.text.format.name==='host_ruling'?{...plan(step({updates:[update('cloth','已浸湿。')]})),evolution:{elapsed:1,updates:[],observations:[]}}:{consistent:approval,issue:approval?'':'contradiction',narration:approval?'厚布浸湿，仍在手中。':''});}});
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
const withEvolution=(steps,elapsed,updates=[],observations=[])=>({...plan(...steps),evolution:{elapsed,updates,observations}});
test('passive fire can progress beyond actor reach and persist without giving the player remote control',()=>{
 const s=engine.createGame();s.doorOpen=false;
 Object.assign(s.entities.find(e=>e.id==='cloth'),{place:'threshold',integrity:'damaged',facts:'布已持续燃烧，火势正沿布身蔓延。'});
 const p=withEvolution([step({duration:3,scope:'time'})],3,[{id:'cloth',facts:'布料烧尽，只剩不可回收的灰烬。',integrity:'consumed',reason:'先前点燃的普通布经过三刻继续燃烧，材料耗尽。'}]);
 const r=engine.applyProposal(s,p,'留在门外等三刻');
 assert.equal(r.state.location,'outside');assert.equal(r.state.turn,3);assert.equal(r.state.entities.find(e=>e.id==='cloth').place,'consumed');
 assert.equal(s.entities.find(e=>e.id==='cloth').place,'threshold');
 assert.equal(r.state.events.at(-1).evolution.updates[0].id,'cloth');
});
test('zero time, wrong elapsed, fabricated entities, resurrection and passive repair are rejected',()=>{
 const s=engine.createGame();const change={id:'cloth',facts:'烧成灰。',integrity:'consumed',reason:'火焰继续燃烧。'};
 assert.throws(()=>engine.applyProposal(s,withEvolution([step({duration:0})],0,[change]),'询问'),/zero time/);
 assert.throws(()=>engine.applyProposal(s,withEvolution([step()],2,[change]),'等'),/elapsed/);
 assert.throws(()=>engine.applyProposal(s,withEvolution([step()],1,[{...change,id:'new_stick'}]),'等'),/evolution id/);
 const dead=engine.applyProposal(s,withEvolution([step()],1,[change]),'等').state;
 assert.throws(()=>engine.applyProposal(dead,withEvolution([step()],1,[{...change,integrity:'intact'}]),'等'),/resurrection/);
 const damaged=engine.createGame();damaged.entities.find(e=>e.id==='cloth').integrity='damaged';
 assert.throws(()=>engine.applyProposal(damaged,withEvolution([step()],1,[{...change,integrity:'intact'}]),'等'),/repair/);
 assert.throws(()=>engine.applyProposal(s,withEvolution([step()],1,[{...change,id:'weight'}]),'等'),/protected/);
});
test('passive effects use time actually elapsed before interruption, not a skipped later step',()=>{
 const s=engine.createGame();s.turn=18;
 const steps=[step(),step({duration:10,scope:'time'})];
 const r=engine.applyProposal(s,withEvolution(steps,2,[]),'等到明天');assert.equal(r.state.turn,20);assert.equal(r.evolution.elapsed,2);
 assert.throws(()=>engine.applyProposal(s,withEvolution(steps,11,[]),'等到明天'),/elapsed/);
});
const reviewed=(consistent=true)=>JSON.stringify({consistent,issue:consistent?'':'不得把未执行的投掷写为已完成',issue_code:consistent?'none':'state',narration:consistent?'布已浸湿，仍在手边。':''});
test('one rejected review is corrected from original state and committed once, then receipt skips all calls',async()=>{
 const db=database(),env={DB:db,UPSTREAM_API_KEY:'test',UPSTREAM_BASE_URL:'https://model.invalid/v1'};let calls=0;const inputs=[],diagnostics=[];
 const resolve=args=>resolveLabTurn({...args,diagnostic:x=>diagnostics.push(x)});
 const handler=createFictionHandler(engine,{gameKind:'lab',cookieName:'koa_fiction_lab',cookiePath:'/api/fiction-lab',resolveTurn:resolve,fetchImpl:async(_,opts)=>{calls++;const p=JSON.parse(opts.body);inputs.push(p.input);const value=calls%2?JSON.stringify(withEvolution([step({updates:[update('cloth','已经浸湿。')]})],1)):reviewed(calls!==2);return new Response(JSON.stringify({status:'completed',output_text:value,usage:{input_tokens:100,output_tokens:100}}));}});
 let cookie='';const req=async body=>{const r=await handler({env,request:new Request('https://test.invalid/api/fiction-lab',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'CF-Connecting-IP':'192.0.2.80'},body:JSON.stringify(body)})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};};
 await req({op:'start'});const b=turn();const r=await req(b);assert.equal(r.status,200);assert.equal(calls,4);assert.equal(r.body.game.turn,1);assert.equal(r.body.game.revision,1);
 const secondHost=JSON.parse(inputs[2][1].content);assert.equal(secondHost.world.time,0);assert.match(secondHost.correction.issue,/投掷/);
 assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].code,'state');assert.ok(!JSON.stringify(diagnostics).includes(b.action));
 assert.deepEqual((await req(b)).body,r.body);assert.equal(calls,4);assert.equal(db.sql.prepare('SELECT count(*) AS n FROM koa_fiction_receipts').get().n,1);
});
test('invalid proposal gets one correction; repeated rejection is bounded and input state remains intact',async()=>{
 const s=engine.createGame(),before=structuredClone(s),events=[];let calls=0;
 await assert.rejects(resolveLabTurn({state:s,body:{action:'等候',requestId:'test_request_123456'},diagnostic:e=>events.push(e),call:async()=>{calls++;return JSON.stringify(withEvolution([step()],9));}}),e=>e.code==='adjudication_failed');
 assert.equal(calls,2);assert.deepEqual(s,before);assert.equal(events.length,2);
});
test('transport and budget errors are not semantic retries',async()=>{
 for(const code of ['budget_exhausted','model_unavailable']){let calls=0;const s=engine.createGame();await assert.rejects(resolveLabTurn({state:s,body:{action:'观察'},call:async()=>{calls++;throw Object.assign(new Error('unavailable'),{code});}}),e=>e.code===code);assert.equal(calls,1);assert.equal(s.turn,0);}
});
test('off-screen natural changes stay out of public notes until the player can see them again',()=>{
 let s=apply(engine.createGame(),step({scope:'project',updates:[update('cloth','布角仍在燃烧。','threshold','damaged')]}),step({door:'closed'})).state;
 const p=withEvolution([step({duration:3,scope:'time'})],3,[{id:'cloth',facts:'布已烧尽，只剩冷灰。',integrity:'consumed',reason:'封闭门后的布持续燃烧至材料耗尽。'}]);
 const r=engine.applyProposal(s,p,'留在门外等三刻');
 assert.equal(r.state.entities.find(e=>e.id==='cloth').integrity,'consumed');
 const known=engine.getView(r.state).clues.find(e=>e.id==='cloth');assert.match(known.title,/上次所见/);assert.match(known.text,/仍在燃烧/);assert.doesNotMatch(known.text,/烧尽|冷灰/);
 const reopened=apply(r.state,step({door:'open'})).state;
 const seen=engine.getView(reopened).clues.find(e=>e.id==='cloth');assert.match(seen.text,/烧尽/);assert.doesNotMatch(seen.title,/上次所见/);
});
test('a late final review cannot return a committable state after the shared deadline',async()=>{
 const realNow=Date.now;let now=1000,calls=0;Date.now=()=>now;
 try{await assert.rejects(resolveLabTurn({state:engine.createGame(),body:{action:'观察'},diagnostic:()=>{},call:async(_input,options)=>{calls++;assert.equal(options.deadlineAt,91000);if(calls===1)return JSON.stringify(withEvolution([step()],1));now=91001;return reviewed();}}),e=>e.code==='model_unavailable');assert.equal(calls,2);}finally{Date.now=realNow;}
});
test('malformed review object is eligible for one internal correction',async()=>{
 let calls=0;const result=await resolveLabTurn({state:engine.createGame(),body:{action:'观察'},diagnostic:()=>{},call:async()=>{calls++;if(calls%2)return JSON.stringify(withEvolution([step()],1));return calls===2?'null':reviewed();}});assert.equal(calls,4);assert.equal(result.state.turn,1);
});
test('an unchanged zero-time confirmation does not consume time merely by updating metadata',()=>{
 const s=engine.createGame(),lamp=s.entities.find(e=>e.id==='lamp');
 const p=withEvolution([step({duration:0,updates:[update(lamp.id,lamp.facts,lamp.place,lamp.integrity)]})],0);
 const r=engine.applyProposal(s,p,'确认灯罩当前情况');assert.equal(r.state.turn,0);assert.equal(r.state.entities.find(e=>e.id==='lamp').updatedAt,undefined);
});
