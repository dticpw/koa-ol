import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {stories} from '../functions/_lib/adventures/stories.js';
import {createAdventureEngine} from '../functions/_lib/adventures/engine.js';
const step=(extra={})=>({attempt:'实际行动',status:'completed',beat:'action',requires_previous_success:false,scope:'near',refs:[],move_to:'stay',end:'continue',updates:[],creates:[],outcome:'已按实际行动完成。',observations:[],achievements:[],memory_offer:'',...extra});
const proposal=(...steps)=>({intent:'测试实际行动',steps,decision:{needed:false,disposition:'none',question:'',pending_action:'',reason:''},evolution:{basis:'none',updates:[],observations:[]},memory_updates:[]});
const setup=id=>{const e=createAdventureEngine(stories[id]);return [e,e.createGame()];};
const apply=(e,s,...steps)=>e.applyProposal(s,proposal(...steps),'测试实际行动');

test('new starts have grounded openings, author attribution, no secret-room label or fake leave-home action',()=>{
 for(const id of ['bindi-shang','downtown-island']){const [e,s]=setup(id),v=e.getView(s);assert.equal(v.credits.author,'梅姐');assert.equal(v.credits.license,null);assert.ok(v.log[0].text.length>450);assert.equal(v.log[0].text.split('\n\n').length,4);assert.ok(!v.choices.some(x=>x.id==='leave'));}
 const [e,s]=setup('bindi-shang');s.location='study';s.visited.push('study');assert.ok(!e.getView(s).map.some(x=>x.id==='cellar'));assert.ok(!e.getActions(s).some(x=>x.id==='go_cellar'));assert.throws(()=>apply(e,s,step({scope:'travel',move_to:'cellar'})),/travel/);
 const unlocked=apply(e,s,step({refs:['computer','hatch'],achievements:['cellar_access']})).state;assert.ok(e.getView(unlocked).map.some(x=>x.id==='cellar'));
});

test('authored separation moves the actual NPC but preserves last-seen knowledge and audit evidence',()=>{
 const [e,s]=setup('bindi-shang');s.flags=['partner','first_evidence'];const remembered=structuredClone(s.knownEntities.haiming);
 const r=apply(e,s,step({refs:['haiming'],achievements:['separated']}));assert.equal(r.state.entities.find(x=>x.id==='haiming').place,'cellar');assert.deepEqual(r.state.knownEntities.haiming,remembered);assert.equal(r.outcomes[0].scriptedChanges.length,1);assert.equal(s.entities.find(x=>x.id==='haiming').place,'hotel');assert.equal(e.getView(JSON.parse(JSON.stringify(r.state))).revision,1);
 const d=apply(e,r.state,step({refs:['phone'],achievements:['disguise']})).state;assert.equal(d.entities.find(x=>x.id==='tianning').name,'自称海茗的黑发姑娘');assert.doesNotMatch(JSON.stringify(e.getView(d)),/假扮|雇凶|被束缚|杀死虐待/);
});

test('rescued sisters cannot be killed by a later original-script event, and flags roll back atomically',()=>{
 const [e,s]=setup('bindi-shang');s.location='cellar';s.flags=['partner','first_evidence','separated','murder_window','sisters_safe'];
 assert.throws(()=>apply(e,s,step({refs:['assassin'],achievements:['tragedy']})),/milestone prerequisite/);assert.ok(!s.flags.includes('tragedy'));
 s.flags=s.flags.filter(x=>x!=='sisters_safe');const dead=apply(e,s,step({refs:['assassin'],achievements:['tragedy']})).state;
 assert.throws(()=>apply(e,dead,step({refs:['tianning'],achievements:['sisters_safe']})),/milestone prerequisite/);
});

test('explicit overnight wait advances only the authored next-day encounter, not ordinary action milestones',()=>{
 const [e,s]=setup('bindi-shang');s.flags=['partner','first_evidence','separated'];
 const morning=apply(e,s,step({beat:'wait',scope:'wait',refs:['phone'],achievements:['disguise']})).state;
 assert.ok(morning.flags.includes('disguise'));assert.equal(morning.entities.find(x=>x.id==='tianning').place,'hotel');
 assert.throws(()=>apply(e,s,step({beat:'wait',scope:'wait',refs:['haiming'],achievements:['partner']})),/milestone id/);
 const [ie,is]=setup('downtown-island');is.location='garage';assert.throws(()=>apply(ie,is,step({beat:'wait',scope:'wait',refs:['car'],achievements:['car_ready']})),/milestone place/);
});

test('willing companion follows adjacent travel, never teleports from another room or follows after parting',()=>{
 const [e,s]=setup('downtown-island');s.location='pit';s.flags=['companion'];
 const next=apply(e,s,step({scope:'travel',move_to:'street'}));assert.equal(next.state.entities.find(x=>x.id==='lingyi').place,'street');assert.equal(next.outcomes[0].companionMoves[0].id,'lingyi');
 const separated=structuredClone(next.state);separated.entities.find(x=>x.id==='lingyi').place='pit';assert.equal(apply(e,separated,step({scope:'travel',move_to:'garage'})).state.entities.find(x=>x.id==='lingyi').place,'pit');
 next.state.flags.push('parted');assert.equal(apply(e,next.state,step({scope:'travel',move_to:'garage'})).state.entities.find(x=>x.id==='lingyi').place,'street');
});

test('permission levels, voluntary amplifier, real cure and fuel remain required for milestones',()=>{
 const [e,s]=setup('downtown-island');s.location='lab_b';assert.throws(()=>apply(e,s,step({refs:['researcher'],achievements:['level_three']})),/milestone prerequisite/);
 s.location='omega';s.flags=['level_one','level_two','level_three','companion'];assert.throws(()=>apply(e,s,step({refs:['lingyi','amplifier'],achievements:['amplified']})),/milestone evidence/);
 s.location='garage';assert.throws(()=>apply(e,s,step({refs:['car','fuel'],achievements:['car_ready']})),/milestone evidence/);
 const ready=apply(e,s,step({refs:['car','fuel'],updates:[{id:'fuel',place:'consumed',integrity:'consumed',facts:'汽油已实际加注进越野车。'}],achievements:['car_ready']})).state;
 assert.equal(apply(e,ready,step({end:'road'})).state.ending.id,'road');assert.ok(!ready.flags.includes('government_truth'));
 s.location='government_three';assert.throws(()=>apply(e,s,step({refs:['cure'],achievements:['cured']})),/milestone evidence/);
});

test('both-together and informed-flight endings require companion presence or actual retained evidence',()=>{
 const [e,s]=setup('downtown-island');s.location='garage';s.flags=['car_ready','trust'];assert.throws(()=>apply(e,s,step({end:'together'})),/ending evidence/);
 s.entities.find(x=>x.id==='lingyi').place='garage';assert.equal(apply(e,s,step({end:'together'})).state.ending.id,'together');
 s.flags.push('parted');assert.throws(()=>apply(e,s,step({end:'together'})),/ending prerequisites/);
 s.location='helipad';s.flags=['flight_ready','government_truth'];s.entities.find(x=>x.id==='phone').place='home';assert.throws(()=>apply(e,s,step({end:'informed_flight'})),/ending evidence/);
});

test('clarification causes no stage movement, food loss or companion relocation',()=>{
 const [e,s]=setup('downtown-island');const a=apply(e,s,step({beat:'confirmation',scope:'observe',status:'clarify'})).state;
 assert.deepEqual(a.entities,s.entities);assert.deepEqual(a.flags,s.flags);assert.equal(a.location,s.location);
});

test('published pages credit 梅姐 and do not grant CC rights or offer raw script downloads',async()=>{
 for(const id of ['bindi-shang','downtown-island']){const credits=await readFile(new URL('../games/fiction/'+id+'/credits.html',import.meta.url),'utf8');assert.match(credits,/梅姐/);assert.match(credits,/经作者许可/);assert.doesNotMatch(credits,/CC BY|creativecommons|href="null"|QQ|120946/);await assert.rejects(access(new URL('../games/fiction/'+id+'/scenario.json',import.meta.url)));}
});
