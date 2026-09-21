import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createAdventureEngine} from '../functions/_lib/adventures/engine.js';
import {stories} from '../functions/_lib/adventures/stories.js';
import {compactReviewContext} from '../functions/_lib/adventures/review-context.js';
import {createAdventureResolver} from '../functions/_lib/adventures/host.js';
import {createFictionHandler} from '../functions/_lib/fiction-service.js';
import {step,proposal} from './fixtures/fiction-discretion.mjs';
import {sqliteAdapter} from '../scripts/fiction-preview.mjs';
const engine=createAdventureEngine(stories['library-delve']);
test('open-door dialogue changes NPC conversation without moving anyone or granting remote hands',()=>{
 const s=engine.createGame();s.location='necromancy';s.visited.push('necromancy');s.flags=['open_necromancy'];
 const npc=s.entities.find(e=>e.id==='spirits');
 const talk=step({beat:'action',scope:'communicate',refs:[npc.id],updates:[{id:npc.id,place:npc.place,integrity:npc.integrity,facts:'隔着敞开的门答应允许同行者安全通过。'}]});
 assert.throws(()=>engine.applyProposal(s,proposal([{...talk,achievements:['open_conjuration']}]),'说话'),/communication effects/);
 const next=engine.applyProposal(s,proposal([talk]),'留在这里隔门请求通行。').state;
 const investigated=engine.applyProposal(s,proposal([{...talk,achievements:['investigated']}]),'询问管理员死因与守书的原因').state;assert.ok(investigated.flags.includes('investigated'));
 assert.equal(next.location,s.location);assert.equal(next.entities.find(e=>e.id===npc.id).place,npc.place);
 assert.match(next.entities.find(e=>e.id===npc.id).facts,/答应/);
 assert.throws(()=>engine.applyProposal({...s,flags:[]},proposal([talk]),'说话'),/source reach/);
 assert.throws(()=>engine.applyProposal(s,proposal([{...talk,updates:[{...talk.updates[0],place:'necromancy'}]}]),'说话'),/remote effects/);
 assert.throws(()=>engine.applyProposal(s,proposal([{...talk,move_to:'entry'}]),'说话'),/communication effects/);
 assert.throws(()=>engine.applyProposal(s,proposal([{...talk,updates:[{id:'picks',place:'carried',integrity:'damaged',facts:'毁坏工具'}]}]),'说话'),/communication target/);
 assert.throws(()=>engine.applyProposal(s,proposal([{...talk,updates:[{...talk.updates[0],integrity:'damaged'}]}]),'说话'),/remote effects/);
});
test('review diff retains all world changes including unreferenced entities and immutable facts only once',()=>{
 const s=engine.createGame(),before=engine.hostContext(s,'观察');
 const next=structuredClone(s);next.entities[0].facts+=' 新状态';next.entities[1].place='consumed';
 next.entities.push({id:'new_piece',source:next.entities[0].id,name:'碎片',facts:'真实拆下',place:'carried'});
 next.knownEntities[next.entities[0].id]=structuredClone(next.entities[0]);
 const after=engine.hostContext(next,'观察'),c=compactReviewContext({before,after,confirmed_steps:[],memory_changes:[]});
 assert.equal(c.after.places,undefined);assert.equal(c.after.laws,undefined);
 for(const key of ['entities','knownEntities']){
  const reconstructed=new Map(before[key].map(e=>[e.id,structuredClone(e)]));
  for(const e of c.entity_changes[key]?.upsert||[])reconstructed.set(e.id,{...reconstructed.get(e.id),...e});
  for(const id of c.entity_changes[key]?.removed||[])reconstructed.delete(id);
  assert.deepEqual([...reconstructed.values()],after[key]);
 }
 assert.ok(JSON.stringify(c).length<JSON.stringify({before,after}).length*.7);
});
test('unknown place names stay out of public map and buttons until actually learned',()=>{
 const story={...stories['library-delve'],opening:'你在入口。',places:structuredClone(stories['library-delve'].places)};
 story.places.conjuration.name='禁止泄露的真实名';
 const e=createAdventureEngine(story),s=e.createGame(),view=e.getView(s);
 assert.doesNotMatch(JSON.stringify(view.map)+JSON.stringify(view.choices),/禁止泄露/);
 s.log.push({role:'player',text:'是不是禁止泄露的真实名？'});
 assert.doesNotMatch(JSON.stringify(e.getView(s).map),/禁止泄露/);
 s.log.push({role:'narrator',text:'门牌上写着禁止泄露的真实名。'});
 assert.match(JSON.stringify(e.getView(s).map),/禁止泄露的真实名/);
});
test('stage stop persists remaining authorization and exposes contextual continue/cancel choices',async()=>{
 const s=engine.createGame();const p=proposal([step({status:'partial',beat:'action',outcome:'先完成入口检查，等待继续。'})]);
 p.decision={disposition:'replace',needed:true,question:'继续查看门上的刻字吗？',pending_action:'查看门上的刻字',reason:'在入口完成检查后停下'};
 let received;
 const resolve=createAdventureResolver(stories['library-delve'],engine);
 const result=await resolve({state:s,body:{action:'查看入口，然后看门上刻字'},call:async(input,options)=>{
  if(options.format.name==='adventure_ruling'){
   const props=options.format.schema.properties;
   assert.equal(props.intent.enum,undefined);assert.equal(props.steps.items.properties.outcome.enum,undefined);
   assert.equal(props.steps.items.properties.refs.items.enum,undefined);
   assert.deepEqual(props.memory_updates.items.properties.place_ids.items.enum,Object.keys(stories['library-delve'].places));
   return JSON.stringify(p);
  }
  received=JSON.parse(input[1].content);return JSON.stringify({consistent:true,issue:'',issue_code:'none',narration:'你先检查了入口。接下来继续查看门上的刻字吗？'});
 }});
 assert.equal(received.context_format,'world_delta_v1');assert.equal(received.after.places,undefined);
 assert.equal(result.state.pendingDecision.pending_action,'查看门上的刻字');
 assert.equal(engine.getActions(result.state)[0].id,'continue_pending');assert.equal(s.pendingDecision,null);
});
test('receipt lookup reports active work, committed work and current view without re-execution or cross-session access',async()=>{
 const sql=new DatabaseSync(':memory:'),db=sqliteAdapter(sql);let release,entered;
 const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let calls=0;
 const handler=createFictionHandler(engine,{gameKind:'adventure:library-delve',resolveTurn:async({state,body})=>{calls++;entered();await gate;return {state:engine.applyProposal(state,proposal(),body.action).state};}});
 let cookie='';
 const req=async(body,query='',auth=cookie)=>{
  const r=await handler({env:{DB:db},request:new Request('https://game.test/api/fiction'+query,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:auth},...(body?{body:JSON.stringify(body)}:{})})});
  if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};
 };
 try{
  await req({op:'start'});const body={op:'turn',requestId:crypto.randomUUID(),expectedRevision:0,action:'看看'};
  const work=req(body);await started;
  const waiting=await req(null,'?receipt='+body.requestId);assert.equal(waiting.body.requestStatus,'processing');assert.equal(waiting.body.game.revision,0);
  assert.equal((await req(body)).body.code,'turn_busy');assert.equal(calls,1);
  release();assert.equal((await work).status,200);
  assert.equal((await req(null,'?receipt='+body.requestId)).body.requestStatus,'committed');
  assert.equal((await req(null,'?receipt='+body.requestId,'')).status,401);
  assert.equal((await req(null,'?receipt=bad')).status,400);
  assert.equal((await req(null,'?receipt='+crypto.randomUUID())).body.requestStatus,'uncommitted');
  await req(body);assert.equal(calls,1);
  await req({...body,requestId:crypto.randomUUID(),expectedRevision:1});
  assert.equal((await req(null,'?receipt='+body.requestId)).body.game.revision,2);
 }finally{release();sql.close();}
});

test('public navigation never promotes an unrevealed hidden exit to player knowledge',()=>{
 const e=createAdventureEngine(stories['bindi-shang']),s=e.createGame();s.location='study';s.visited.push('study');
 assert.equal(e.getView(s).map.some(p=>p.id==='cellar'),false);
 assert.equal(Object.hasOwn(e.hostContext(s).publicNavigation,'cellar'),false);
});

test('bounded execution carries an explicit review contract only at an actual six-step partial boundary',()=>{
 const before=engine.hostContext(engine.createGame());
 const steps=Array.from({length:6},(_,i)=>step({status:i===5?'partial':'completed'}));
 const input={before,after:before,confirmed_steps:steps,decision:{needed:true,pending_action:'收好物资'}};
 const result=compactReviewContext(input);assert.equal(result.stage_boundary.kind,'execution_limit');assert.equal(result.stage_boundary.remaining_action,'收好物资');
 assert.equal(compactReviewContext({...input,confirmed_steps:steps.slice(1)}).stage_boundary,undefined);
 assert.equal(compactReviewContext({...input,decision:null}).stage_boundary,undefined);
});
