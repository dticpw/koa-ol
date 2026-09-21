// A sample compatibility gate, not a claim of universal save compatibility.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';

const protectedFields=['storyId','sessionId','revision','turn','location','visited','status','ending','resolve','flags','memoryOffers','pendingDecision','entities','knownEntities','log','events'];
const evidenceFields=['memoryJournal','observationHistory'];
const core=s=>Object.fromEntries([...protectedFields,...evidenceFields].map(k=>[k,s[k]]));
async function load(root){
 const base=pathToFileURL(resolve(root)+'/');
 const {createAdventureEngine}=await import(new URL('functions/_lib/adventures/engine.js',base));
 const {stories}=await import(new URL('functions/_lib/adventures/stories.js',base));
 const meta=JSON.parse(await readFile(new URL('.fiction-source.json',base),'utf8'));
 assert.ok(meta.commit&&meta.files,'Expected a release-tool snapshot');
 for(const [path,oid] of Object.entries(meta.files)){
  const bytes=await readFile(new URL(path,base));
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),oid,`Snapshot modified: ${path}`);
 }
 return {stories,engine:id=>createAdventureEngine(stories[id]),commit:meta.commit,files:meta.files};
}
function validateShape(s,story,fresh){
 assert.equal(s.version,fresh.version,'unsupported save version');
 if(s.memoryVersion!==undefined)assert.equal(s.memoryVersion,fresh.memoryVersion,'unsupported memory version');
 assert.ok(story.places[s.location],'unknown current place');
 assert.ok(s.visited.every(p=>story.places[p]),'unknown visited place');
 assert.ok(s.flags.every(f=>story.milestones[f]),'unknown milestone');
 assert.ok(s.entities.every(e=>['carried','consumed'].includes(e.place)||story.places[e.place]),'unknown entity position');
 if(s.status==='ended')assert.ok(story.endings[s.ending?.id],'unknown ending');
}
function readCheck(engine,state){
 const input=structuredClone(state),old=structuredClone(input);
 const normal=engine.normalizeGame(input);engine.getView(normal);engine.hostContext(normal,'回顾已经做过的安排');
 for(const k of protectedFields)assert.deepEqual(normal[k],old[k],`read changed ${k}`);
 return JSON.parse(JSON.stringify(normal));
}
function continueCheck(engine,s){
 if(s.status!=='playing')return s;
 const decision=s.pendingDecision?{...s.pendingDecision,disposition:'keep',needed:true}:{disposition:'none',needed:false,question:'',pending_action:'',reason:''};
 const p={intent:'只询问当前情况，不改变现场。',steps:[{attempt:'只询问当前情况。',status:'completed',beat:'confirmation',requires_previous_success:false,scope:'observe',refs:[],move_to:'stay',end:'continue',updates:[],creates:[],outcome:'没有采取新行动。',observations:[],achievements:[],memory_offer:''}],decision,evolution:{basis:'none',updates:[],observations:[]},memory_updates:[]};
 const after=engine.applyProposal(s,p,'只询问当前情况，不行动。').state;
 for(const k of ['entities','location','flags','resolve','status','ending'])assert.deepEqual(after[k],s[k],`continuation changed ${k}`);
 assert.equal(after.revision,s.revision+1);return after;
}
export async function checkCompatibility({baselineRoot,candidateRoot,saves=[],out}){
 const baseline=await load(baselineRoot),candidate=await load(candidateRoot),cases=[];
 for(const id of Object.keys(baseline.stories)){
  const initial=baseline.engine(id).createGame();cases.push({name:`initial:${id}`,state:initial});
  const legacy=structuredClone(initial);delete legacy.memoryVersion;delete legacy.memoryJournal;delete legacy.observationHistory;
  cases.push({name:`legacy:${id}`,state:legacy});
 }
 cases.push(...saves.map((s,i)=>({name:`provided:${i}`,state:s.state||s})));
 const results=[];
 for(const item of cases){
  try{
   const s=item.state;assert.ok(s.entities&&s.storyId,'Expected authoritative state, not public game export');
   assert.ok(baseline.stories[s.storyId]&&candidate.stories[s.storyId],'Story missing in one version');
   const be=baseline.engine(s.storyId),ce=candidate.engine(s.storyId);
   validateShape(s,baseline.stories[s.storyId],be.createGame());validateShape(s,candidate.stories[s.storyId],ce.createGame());
   const old=readCheck(be,s),next=readCheck(ce,s),back=readCheck(be,next);
   assert.deepEqual(core(next),core(old),'upgrade changed saved facts');assert.deepEqual(core(back),core(next),'rollback changed saved facts');
   continueCheck(be,back);
   const candidateWritten=JSON.parse(JSON.stringify(continueCheck(ce,next)));
   validateShape(candidateWritten,baseline.stories[s.storyId],be.createGame());
   const returned=readCheck(be,candidateWritten);
   assert.deepEqual(core(returned),core(candidateWritten),'old version changed a candidate-written save');
   continueCheck(be,returned);
   results.push({name:item.name,story:s.storyId,revision:s.revision,status:s.status,passed:true});
  }catch(e){results.push({name:item.name,passed:false,error:e.message.slice(0,240)});}
 }
 const report={baselineCommit:baseline.commit,candidateCommit:candidate.commit,baselineFiles:baseline.files,candidateFiles:candidate.files,passed:results.every(r=>r.passed),providedStates:saves.length,progressedStates:saves.filter(x=>(x.state||x).revision>0).length,results,scope:'Formal adventure authoritative saves; initial/legacy, JSON persistence, bidirectional reads and candidate-written no-effect continuation. Does not prove all migrations, all outcomes, legacy lab/classic saves, or actual production database schema compatibility.'};
 if(out)await writeFile(out,JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const {values:v}=parseArgs({options:{baseline:{type:'string'},candidate:{type:'string'},saves:{type:'string'},db:{type:'string'},out:{type:'string'}}});
 if(!v.baseline||!v.candidate||!v.out)throw Error('--baseline --candidate --out required');
 let saves=[];
 if(v.saves){const data=JSON.parse(await readFile(v.saves,'utf8'));saves=Array.isArray(data)?data:data.states;}
 if(v.db){const db=new DatabaseSync(v.db,{readOnly:true});saves.push(...db.prepare('SELECT state_json FROM koa_fiction_sessions').all().map(x=>JSON.parse(x.state_json)));db.close();}
 const report=await checkCompatibility({baselineRoot:v.baseline,candidateRoot:v.candidate,saves,out:v.out});console.log(JSON.stringify({passed:report.passed,cases:report.results.length,progressed:report.progressedStates,out:v.out}));if(!report.passed)process.exitCode=1;
}
