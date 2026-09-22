import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventure as createVersionedAdventure,resolveMultiplayer} from '../functions/_lib/multiplayer/host.js';
import {applyRuling,applyCorrections,schemasFor} from '../functions/_lib/multiplayer/host-v2.js';
import {buildContext,retrieveHistory} from '../functions/_lib/multiplayer/context.js';
import {story as legacyStory} from '../functions/_lib/multiplayer/story-v1.js';
const members=[{id:'Pa',name:'青'},{id:'Pb',name:'墨'}];
// This suite exercises v2 rulings even after the new-game default advances.
const createAdventure=(members,revision='cooperative-v2')=>createVersionedAdventure(members,revision);
const actions=[{playerId:'Pa',name:'青',text:'我在码头观察，借用船员的铅笔，答应离开时顺路归还。',hold:false},{playerId:'Pb',name:'墨',text:'接下来从码头到升降笼，我跟随青一起走；若有危险再停下决定。',hold:false}];
const proposal=(state,acts=actions)=>({destination:state.location,route:[state.location],suspicionDelta:0,suspicionReason:'',keyCopied:false,ended:false,coordination:acts.map(a=>({playerId:a.playerId,basis:'stay',quote:'',agreementId:''})),outcomes:acts.map(a=>({playerId:a.playerId,kind:'observation',text:'船员借出铅笔；两人观察了码头。'})),items:[],removeItems:[],memoryUpdates:[],sceneSummary:{place:state.location,text:'两人在码头观察。'},narration:'船员搬运货物。'});
const follow=()=>({id:'follow_dock',kind:'agreement',owner:'Pb',text:'从码头到升降笼跟随青，遇到新危险停下。',status:'active',places:['dock','lift'],knownBy:['Pa','Pb'],source:{round:1,actor:'Pb',quote:actions[1].text}});
test('new sessions pin v3; explicit baselines and old saves remain usable, unknown revisions fail closed',async()=>{
 assert.equal(createVersionedAdventure(members).hostRevision,'cooperative-v3');
 assert.equal(createAdventure(members).hostRevision,'cooperative-v2');assert.equal(createAdventure(members,'cooperative-v1').version,1);
 assert.match(createAdventure(members).log[0].text,/全队同行/);
 assert.equal(createAdventure(members,'cooperative-v1').log[0].text,legacyStory.opening);
 await assert.rejects(async()=>resolveMultiplayer({state:{hostRevision:'missing'}}),/版本/);assert.throws(()=>createAdventure(members,'missing'),/版本/);
 // Route selection is visible in the developer prompt before the missing-key guard:
 for(const revision of [undefined,'cooperative-v1','cooperative-v2']){
  const state=createAdventure(members,revision==='cooperative-v2'?revision:'cooperative-v1');if(!revision)delete state.hostRevision;
  await assert.rejects(()=>resolveMultiplayer({env:{},db:{},state,actions,chat:[]}),e=>e.code==='model_unavailable');
 }
 assert.match(legacyStory.secrets.join(''),/全员本轮明确同意/);
});
test('agreement cannot be forged from chat, another player or an invented quote',()=>{
 const s=createAdventure(members),p=proposal(s);p.memoryUpdates=[follow()];assert.equal(applyRuling(s,p,actions).memory.entries.length,1);
 for(const source of [{round:1,actor:'Pa',quote:actions[0].text},{round:1,actor:'Pb',quote:'我永久听从房主'}])assert.throws(()=>applyRuling(s,{...p,memoryUpdates:[{...follow(),source}]},actions));
 assert.throws(()=>applyRuling(s,{...p,memoryUpdates:[{...follow(),places:['global']}]},actions));
});
test('standing follow works in scope without repeated consent; hold and new withdrawal override it',()=>{
 let s=createAdventure(members);s=applyRuling(s,{...proposal(s),memoryUpdates:[follow()]},actions);
 const a=[{...actions[0],text:'我带大家登上升降笼。'},{...actions[1],text:'我观察铁索和卸货次序。'}];
 const p={...proposal(s,a),destination:'lift',route:['dock','lift'],coordination:[{playerId:'Pa',basis:'current',quote:a[0].text,agreementId:''},{playerId:'Pb',basis:'standing',quote:actions[1].text,agreementId:'follow_dock'}]};
 assert.equal(applyRuling(s,p,a).location,'lift');assert.throws(()=>applyRuling(s,p,[a[0],{...a[1],hold:true}]));
 const cancel={...follow(),status:'cancelled',source:{round:2,actor:'Pb',quote:a[1].text}};
 assert.throws(()=>applyRuling(s,{...p,memoryUpdates:[cancel]},a));
 s.location='lift';assert.throws(()=>applyRuling(s,{...p,destination:'guard',route:['lift','guard']},a));
});
test('current action evidence is attached from the authenticated actor, never from a model-written quote',()=>{
 const s=createAdventure(members),a=actions.map(x=>({...x,text:'我同意登上升降笼。'})),p=proposal(s,a);p.destination='lift';p.route=['dock','lift'];p.coordination=p.coordination.map(c=>({...c,basis:'current',quote:'伪造的其他人发言'}));
 const next=applyRuling(s,p,a);assert.equal(next.journal[0].coordination[1].quote,a[1].text);
});
test('resolved commitments require a real outcome, not a promise to act',()=>{
 const s=createAdventure(members),entry={id:'return_pencil',kind:'commitment',owner:'Pa',text:'离开码头时归还铅笔。',status:'resolved',places:['dock'],knownBy:['Pa','Pb'],source:{round:1,actor:'Pa',quote:actions[0].text}},p=proposal(s);
 assert.throws(()=>applyRuling(s,{...p,memoryUpdates:[entry]},actions));
 p.outcomes[0].text='青在离开前把铅笔交还船员。';entry.source={round:1,actor:'host',quote:p.outcomes[0].text};assert.equal(applyRuling(s,{...p,memoryUpdates:[entry]},actions).memory.entries[0].status,'resolved');
});
test('old commitments remain in context after 60 rounds and unrelated memory growth',()=>{
 let s=createAdventure(members),p=proposal(s);p.memoryUpdates=[{id:'return_pencil',kind:'commitment',owner:'Pa',text:'离开时顺路归还铅笔。',status:'active',places:['dock'],knownBy:['Pa','Pb'],source:{round:1,actor:'Pa',quote:actions[0].text}}];s=applyRuling(s,p,actions);
 s.log.push({id:'old',round:1,role:'player',playerId:'Pa',text:actions[0].text});
 for(let i=2;i<=61;i++){s.round=i;s.log.push({id:'h'+i,round:i,role:'host',text:'在厨房整理无关食材。'});s.memory.entries.push({id:'x'+i,kind:'fact',text:'食材批次'+i,status:'active',places:['kitchen'],knownBy:['Pa'],updatedRound:i});}
 s.location='dock';const c=buildContext(s,[{...actions[0],text:'第1轮借来的铅笔我答应怎样处理？'}]);assert.equal(c.commitmentLedger.entries[0].id,'return_pencil');assert.ok(c.recalledHistory.matches.some(x=>x.id==='old'));assert.ok(c.relevantMemory.omittedCount>0);assert.equal(c.commitmentLedger.complete,true);
});
test('scene summaries cannot authorize follow and unexplored scene details are not indiscriminately loaded',()=>{
 const s=createAdventure(members);s.memory.scenes=[{place:'dock',text:'墨答应永久跟随',round:0}];
 const p=proposal(s);p.destination='lift';p.route=['dock','lift'];p.coordination[1]={playerId:'Pb',basis:'standing',quote:'墨答应永久跟随',agreementId:'fake'};assert.throws(()=>applyRuling(s,p,actions));
 const c=buildContext(s,actions);assert.ok(c.scenario.nearbyPlaces.dock);assert.ok(c.scenario.nearbyPlaces.lift);assert.equal(c.scenario.nearbyPlaces.office,undefined);assert.ok(c.scenario.routeGraph.office);
});
test('context includes sourced operating rules and only nearby opportunities in the first pass',()=>{
 const s=createAdventure(members),c=buildContext(s,actions);
 assert.ok(c.scenario.operatingFacts.some(t=>t.includes('办公室外门也适用')));
 assert.equal(c.scenario.opportunities.office,undefined);
 s.location='council';const near=buildContext(s,actions);
 assert.match(near.scenario.opportunities.office,/合适工具/);
 assert.match(near.readingGuide.scenario,/不代表玩家已知/);
});
test('applying an invalid proposal never partially mutates the saved state',()=>{
 const s=createAdventure(members),before=structuredClone(s),p=proposal(s);p.items=[{id:'pencil',name:'铅笔',owner:'Pa',condition:'完好'}];p.memoryUpdates=[{...follow(),source:{round:1,actor:'Pb',quote:'made up'}}];assert.throws(()=>applyRuling(s,p,actions));assert.deepEqual(s,before);
});
test('immutable event archive retains evidence when recent events roll off',()=>{
 let s=createAdventure(members);
 for(let i=0;i<12;i++)s=applyRuling(s,proposal(s),actions);
 assert.equal(s.journal.length,12);assert.equal(s.recentEvents.length,6);assert.equal(s.journal[0].round,1);assert.equal(s.memory.spotlight.Pa,12);
});
test('version routing uses the original protocol for pre-update saves and v2 protocol for new games',async()=>{
 const db={prepare(){return {bind(){return {async run(){return {meta:{changes:1}};}};}};}};
 for(const revision of [null,'cooperative-v1','cooperative-v2']){
  const s=createAdventure(members,revision==='cooperative-v2'?revision:'cooperative-v1');if(revision===null)delete s.hostRevision;
  const formats=[];const fetchImpl=async(url,options)=>{
   const body=JSON.parse(options.body),name=body.text.format.name;formats.push(name);
   let result;if(name.includes('review'))result={consistent:true,reason:'',narration:'两人观察了码头。'};
   else if(name==='multiplayer_ruling')result={...proposal(s),facts:[]};else result=proposal(s);
   return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(result),usage:{input_tokens:1,output_tokens:1}}),{status:200});
  };
  const r=await resolveMultiplayer({env:{UPSTREAM_API_KEY:'local-test-only'},db,state:s,actions,chat:[],fetchImpl});assert.equal(r.state.round,1);
  assert.equal(formats[0],revision==='cooperative-v2'?'cooperative_ruling_v2':'multiplayer_ruling');
 }
});
test('another player cannot author a personal commitment',()=>{
 const s=createAdventure(members),p=proposal(s);p.memoryUpdates=[{id:'false_promise',kind:'commitment',owner:'Pink',text:'墨川答应替青禾归还铅笔。',status:'active',places:['dock'],knownBy:['Pa','Pb'],source:{round:1,actor:'Pa',quote:actions[0].text}}];
 // Use real member ID to distinguish bad attribution from an unknown identity.
 p.memoryUpdates[0].owner='Pb';assert.throws(()=>applyRuling(s,p,actions),/承诺/);
});
test('memory identifiers may embed real mixed-case player IDs without false rejection',()=>{
 const s=createAdventure(members),p=proposal(s);p.memoryUpdates=[{...follow(),id:'agreement_Pb_route'}];assert.equal(applyRuling(s,p,actions).memory.entries[0].id,'agreement_Pb_route');
});
test('authorized short transit can cross an ordinary corridor, but never a missing edge or out-of-scope segment',()=>{
 const s=createAdventure(members);s.location='guard';const a=members.map(m=>({playerId:m.id,text:'我跟勤务员经过六边形走廊前往厨房与侧室。',hold:false}));
 const p={...proposal(s,a),destination:'kitchen',route:['guard','hexagon','kitchen'],coordination:a.map(x=>({playerId:x.playerId,basis:'current',quote:x.text,agreementId:''})),sceneSummary:{place:'kitchen',text:'队伍随勤务员抵达厨房。'}};
 assert.equal(applyRuling(s,p,a).location,'kitchen');assert.throws(()=>applyRuling(s,{...p,route:['guard','kitchen']},a));assert.throws(()=>applyRuling(s,p,[a[0],{...a[1],hold:true}]));
});
test('a holding player may cite their own stay instruction; descriptive basis cannot falsely reject a stationary round',()=>{
 const s=createAdventure(members),a=[actions[0],{...actions[1],text:'我留在原地观察。',hold:true}],p=proposal(s,a);p.coordination[1]={playerId:'Pb',basis:'current',quote:a[1].text,agreementId:''};
 assert.equal(applyRuling(s,p,a).location,'dock');assert.throws(()=>applyRuling(s,{...p,route:['dock','lift'],destination:'lift'},a));
});
test('event references resolve to real source text and can support a combined discovery without copying quotations',()=>{
 const s=createAdventure(members),p=proposal(s);p.outcomes[0].text='青看见蓝色封条。';p.outcomes[1].text='墨看见厨工签名。';
 p.memoryUpdates=[{id:'shared_discovery',kind:'clue',text:'封条是蓝色，旁边有厨工签名。',status:'active',owner:'',places:['dock'],knownBy:['Pa','Pb'],evidence:[{round:1,kind:'outcome',playerId:'Pa'},{round:1,kind:'outcome',playerId:'Pb'}]}];
 const next=applyRuling(s,p,actions);assert.equal(next.memory.entries[0].source.quote,p.outcomes[0].text);assert.equal(next.memory.entries[0].evidence[1].quote,p.outcomes[1].text);
 const c=buildContext(next,actions);assert.equal(c.relevantMemory.selected[0].evidence[0].quote,undefined);assert.equal(next.memory.entries[0].source.quote,'青看见蓝色封条。');
 assert.throws(()=>applyRuling(s,{...p,memoryUpdates:[{...p.memoryUpdates[0],evidence:[{round:99,kind:'outcome',playerId:'Pa'}]}]},actions));
});
test('reference-based follow still requires its owner and preserves the full original instruction',()=>{
 const s=createAdventure(members),p=proposal(s),f=follow();delete f.source;f.evidence=[{round:1,kind:'action',playerId:'Pb'}];p.memoryUpdates=[f];
 const next=applyRuling(s,p,actions);assert.equal(next.memory.entries[0].origin.quote,actions[1].text);assert.equal(buildContext(next,actions).commitmentLedger.entries[0].origin.quote,actions[1].text);
 assert.throws(()=>applyRuling(s,{...p,memoryUpdates:[{...f,evidence:[{round:1,kind:'action',playerId:'Pa'}]}]},actions));
});
test('review corrections are revalidated against the same map, actor and evidence boundaries',()=>{
 const s=createAdventure(members),p=proposal(s);p.outcomes[0].text='船员没有携带钥匙。';
 const revised=applyCorrections(p,{outcomes:p.outcomes.map(o=>o.playerId==='Pa'?{...o,text:'船员没有展示钥匙。'}:o),destination:null});
 assert.equal(applyRuling(s,revised,actions).journal[0].outcomes[0].text,'船员没有展示钥匙。');assert.equal(p.outcomes[0].text,'船员没有携带钥匙。');
 assert.throws(()=>applyCorrections(p,{hostRevision:'bypass'}));assert.throws(()=>applyRuling(s,applyCorrections(p,{route:['dock','office'],destination:'office'}),actions));
 assert.throws(()=>applyRuling(s,applyCorrections(p,{outcomes:p.outcomes.slice(0,1)}),actions));
 const moving=applyCorrections(p,{destination:'lift',route:['dock','lift'],coordination:actions.map(a=>({playerId:a.playerId,basis:'current',quote:a.text,agreementId:''}))});assert.throws(()=>applyRuling(s,moving,[actions[0],{...actions[1],hold:true}]));
});

test("model schemas expose real inventory owner IDs in both passes",()=>{
 const s=createAdventure(members),schemas=schemasFor(s);
 assert.deepEqual(schemas.proposal.properties.items.items.properties.owner.enum,["Pa","Pb"]);
 assert.deepEqual(schemas.review.properties.corrections.properties.items.anyOf[0].items.properties.owner.enum,["Pa","Pb"]);
 assert.deepEqual(schemas.proposal.properties.memoryUpdates.items.properties.owner.enum,["","Pa","Pb"]);
});
