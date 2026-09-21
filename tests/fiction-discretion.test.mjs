import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventureEngine} from '../functions/_lib/adventures/engine.js';
import {createAdventureResolver} from '../functions/_lib/adventures/host.js';
import {latestMemories,commitmentLedger} from '../functions/_lib/fiction-lab-memory.js';
import {story,step,memory,proposal,promised} from './fixtures/fiction-discretion.mjs';
import * as lab from '../functions/_lib/fiction-lab-engine.js';
const engine=createAdventureEngine(story);
const giveBack=()=>step({attempt:'按先前委托顺手还牌',beat:'action',scope:'near',refs:['card','clerk'],updates:[{id:'card',place:'desk',integrity:'intact',facts:'已交还值班台。'}],outcome:'你把访客牌交还值班员。',observations:['访客牌已交还值班台。']});
test('lab interruption does not report a proposed exit as an executed ending',()=>{
 const leave=step({beat:'action',scope:'near',door:'unchanged',end:'leave'});
 const normal=lab.applyProposal(lab.createGame(),proposal([leave]),'离开墓口。');assert.equal(normal.outcomes[0].end,'leave');
 const interrupted=lab.applyProposal(lab.createGame(),proposal([{...leave,updates:[{id:'weight',place:'outside',integrity:'intact',facts:'移开石镇。'}]}]),'拿开石镇然后离开。');
 assert.equal(interrupted.state.hammerFallen,true);assert.equal(interrupted.state.status,'playing');assert.equal(interrupted.outcomes[0].end,'continue');
});
test('promised low-risk errand is actually settled before exit, with sourced fulfillment',()=>{
 const original=promised(engine),before=structuredClone(original),id=latestMemories(original)[0].id;
 const p=proposal([giveBack(),step({beat:'action',end:'leave',outcome:'你从渡口离开。'})],[memory('访客牌已交还值班台。',{id,status:'fulfilled',source:'observation',step:0})]);
 const {state,outcomes}=engine.applyProposal(original,p,'调查完了，我们就离开吧。');
 assert.deepEqual(original,before);assert.equal(state.status,'ended');assert.equal(state.entities.find(e=>e.id==='card').place,'desk');
 assert.equal(outcomes.at(-1).end,'leave');assert.equal(latestMemories(state)[0].status,'fulfilled');assert.equal(latestMemories(state)[0].statusSource.role,'observation');
});
test('player intention cannot be used as evidence of fulfillment, including at an ending',()=>{
 const original=promised(engine),saved=structuredClone(original),id=latestMemories(original)[0].id;
 const p=proposal([step({beat:'action',end:'leave'})],[memory('我准备还牌。',{id,status:'fulfilled'})]);
 assert.throws(()=>engine.applyProposal(original,p,'我准备还牌。'),/fulfillment evidence/);assert.deepEqual(original,saved);
});
test('fulfillment cannot cite an action after the ending that was never executed',()=>{
 const s=promised(engine),id=latestMemories(s)[0].id;
 const p=proposal([step({beat:'action',end:'leave'}),giveBack()],[memory('访客牌已交还值班台。',{id,status:'fulfilled',source:'observation',step:1})]);
 assert.throws(()=>engine.applyProposal(s,p,'离开'),/observation source/);
});
test('confirmation may report evidence of earlier completion without repeating the action',()=>{
 const s=promised(engine),id=latestMemories(s)[0].id;s.entities.find(e=>e.id==='card').place='desk';
 const p=proposal([step({observations:['访客牌已交还值班台。']})],[memory('访客牌已交还值班台。',{id,status:'fulfilled',source:'observation',step:0})]);
 assert.equal(latestMemories(engine.applyProposal(s,p,'确认一下还过了吗？').state)[0].status,'fulfilled');
});
test('ending context includes a cancelled commitment even without lexical overlap',()=>{
 const s=promised(engine,{cancel:true}),world=engine.hostContext(s,'离开。');
 assert.equal(world.commitmentLedger.complete,true);assert.equal(world.commitmentLedger.items[0].status,'superseded');
 assert.equal(world.commitmentLedger.items[0].statusSource.quote,'取消刚才还牌的约定。');assert.equal(world.recent.some(x=>x.text.includes('顺路')),false);
});
test('ledger stays bounded, reserves settled evidence and does not claim full coverage',()=>{
 let s=engine.createGame();for(let i=0;i<24;i++){const q=`第${i}项约定：离开时看看窗外。`;s=engine.applyProposal(s,proposal(undefined,[memory(q)]),q).state;}
 const id=latestMemories(s)[0].id;s=engine.applyProposal(s,proposal(undefined,[memory('取消第一条。',{id,status:'superseded'})]),'取消第一条。').state;
 const ledger=commitmentLedger(s);assert.equal(ledger.items.length,16);assert.equal(ledger.total,24);assert.equal(ledger.complete,false);assert.ok(ledger.items.some(m=>m.id===id&&m.status==='superseded'));
});
test('legacy saves gain a read-only empty ledger without requiring a database migration',()=>{
 const s=engine.createGame();delete s.memoryVersion;delete s.memoryJournal;delete s.observationHistory;const before=structuredClone(s);
 assert.equal(engine.hostContext(s).commitmentLedger.complete,true);assert.deepEqual(engine.hostContext(s).commitmentLedger.items,[]);assert.deepEqual(s,before);
});
test('reviewer receives actual ending steps and completion evidence; rejected narration commits nothing',async()=>{
 const s=promised(engine),saved=structuredClone(s),id=latestMemories(s)[0].id;let reviews=0;
 const p=proposal([giveBack(),step({beat:'action',end:'leave'})],[memory('访客牌已交还值班台。',{id,status:'fulfilled',source:'observation',step:0})]);
 await assert.rejects(createAdventureResolver(story,engine)({state:s,body:{action:'好了，离开吧。'},diagnostic:()=>{},call:async(input,opts)=>{
  if(opts.format.name==='adventure_ruling')return JSON.stringify(p);
  reviews++;const d=JSON.parse(input[1].content);assert.equal(d.before.commitmentLedger.items[0].status,'active');assert.equal(d.after.commitmentLedger.items[0].status,'fulfilled');assert.equal(d.confirmed_steps.at(-1).end,'leave');
  return JSON.stringify({consistent:false,issue:'测试强制拒绝',issue_code:'state',narration:''});
 }}),e=>e.code==='adjudication_failed');assert.equal(reviews,2);assert.deepEqual(s,saved);
});
