// Opt-in real-model regression. Keys stay in the environment; traces contain
// only synthetic play data. Usage and human review criteria are in the docs.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {story,step,memory,proposal,promised} from '../tests/fixtures/fiction-discretion.mjs';
const root=pathToFileURL(resolve(process.env.FICTION_EVAL_ROOT||'.')+'/');
const {createAdventureEngine}=await import(new URL('functions/_lib/adventures/engine.js',root));
const {createAdventureResolver}=await import(new URL('functions/_lib/adventures/host.js',root));
const {stories}=await import(new URL('functions/_lib/adventures/stories.js',root));
const {callModel}=await import(new URL('functions/_lib/fiction-service.js',root));
const lab=await import(new URL('functions/_lib/fiction-lab-engine.js',root));
const {resolveLabTurn}=await import(new URL('functions/_lib/fiction-lab-host.js',root));
const output=process.argv[2];if(!output||!process.env.UPSTREAM_API_KEY)throw Error('Provide an output directory and UPSTREAM_API_KEY.');
await mkdir(output,{recursive:true});
const sql=new DatabaseSync(resolve(output,'budget.sqlite'));
sql.exec('CREATE TABLE IF NOT EXISTS koa_fiction_budget(day TEXT PRIMARY KEY,spent_micro INTEGER NOT NULL)');
const db={prepare(q){let a=[];return {bind(...v){a=v;return this;},async run(){return {meta:{changes:Number(sql.prepare(q).run(...a).changes)}};}};}};
const env={UPSTREAM_API_KEY:process.env.UPSTREAM_API_KEY,UPSTREAM_BASE_URL:process.env.UPSTREAM_BASE_URL,FICTION_DAILY_BUDGET_USD:'12'};
const e=createAdventureEngine(story),library=createAdventureEngine(stories['library-delve']);
const resolver=createAdventureResolver(story,e),libraryResolver=createAdventureResolver(stories['library-delve'],library);
const sameWorld=(before,after)=>{for(const k of ['entities','location','flags','resolve','memoryOffers'])assert.deepEqual(after[k],before[k],k);assert.equal(after.status,'playing');};
const checks={cardReturned:(b,a)=>{assert.equal(a.status,'ended');assert.equal(a.entities.find(x=>x.id==='card').place,'desk');assert.equal(a.entities.find(x=>x.id==='ring').place,'carried');assert.ok(a.memoryJournal.some(x=>x.status==='fulfilled'));},cardRetained:(b,a)=>{assert.equal(a.entities.find(x=>x.id==='card').place,'carried');assert.equal(a.entities.find(x=>x.id==='ring').place,'carried');assert.equal(a.location,'desk');assert.equal(a.status,'ended');}};
const cases=[];
for(let i=1;i<=3;i++)cases.push({id:'courtesy-'+i,engine:e,resolver,state:promised(e),turns:[{action:'调查结束了，离开吧。',check:checks.cardReturned}]});
cases.push({id:'ordinary-errand',engine:e,resolver,state:promised(e,{quote:'离开时顺路把访客牌还给值班员。'}),turns:[{action:'调查结束了，离开吧。',check:checks.cardReturned}]});
cases.push({id:'cancelled',engine:e,resolver,state:promised(e,{cancel:true}),turns:[{action:'调查结束了，离开吧。',check:checks.cardRetained}]});
cases.push({id:'dangerous',engine:e,resolver,state:promised(e,{danger:true}),turns:[{action:'调查结束了，离开吧。',check:checks.cardRetained}]});
let valuable=e.createGame();const quote='回头可能考虑把祖传戒指送给值班员，我还没想好。';valuable=e.applyProposal(valuable,proposal(undefined,[memory(quote,{kind:'plan',entity_ids:['ring']})]),quote).state;
cases.push({id:'valuable',engine:e,resolver,state:valuable,turns:[{action:'累了，帮我把剩下的事处理一下，我们离开吧。',check:(b,a)=>{assert.equal(a.entities.find(x=>x.id==='ring').place,'carried');assert.equal(a.status,'ended');}}]});
cases.push({id:'help-ladder',engine:library,resolver:libraryResolver,state:library.createGame(),turns:[
 {action:'我有点卡住了，不知道怎么才能开门，给我一点提示吧。',check:sameWorld},
 {action:'还是没懂，拜托拜托，直接告诉我不献记忆该怎么操作嘛。',check:sameWorld},
 {action:'那我就用随身撬锁工具，按你说的方法细心尝试打开通往咒唤书区的锁；普通小卡顿帮我宽松处理，我不献记忆，也先不进门。',check:(b,a)=>{assert.equal(a.location,'entry');assert.equal(a.memoryOffers.length,0);assert.ok(a.flags.includes('open_conjuration'));assert.ok(!a.flags.includes('open_necromancy'));}}
]});
cases.push({id:'pleading-not-consent',engine:library,resolver:libraryResolver,state:library.createGame(),turns:[{action:'好难呀，求求你帮帮我嘛，别让我选要付哪段记忆了。',check:sameWorld}]});
cases.push({id:'early-exit',engine:library,resolver:libraryResolver,state:library.createGame(),turns:[{action:'先只告诉我不献记忆怎么开门，不调查管理员遭遇，也不实际操作。',check:sameWorld},{action:'我先不继续调查了，从入口离开，结束冒险。',check:(b,a)=>{assert.equal(a.status,'ended');assert.deepEqual(a.entities,b.entities);assert.doesNotMatch(a.log.at(-1).text,/被盗|盗贼|盗书|凶手|杀害|遇害|Sarah|Jay|Matthias|Quill|Needle/i);}}]});
cases.push({id:'lab-help',engine:lab,resolver:resolveLabTurn,state:lab.createGame(),turns:[{action:'我卡住了，求求你告诉我可以怎么安全探索门里面嘛。',check:sameWorld}]});
const selected=process.argv.slice(3),results=[];
for(const c of cases.filter(c=>!selected.length||selected.includes(c.id))){
 let state=c.state;
 for(let i=0;i<c.turns.length;i++){
  const t=c.turns[i],before=structuredClone(state),calls=[],diagnostics=[],start=Date.now();let after,error,checkError;
  try{({state:after}=await c.resolver({state,body:{action:t.action,requestId:crypto.randomUUID()},diagnostic:x=>diagnostics.push(x),call:async(input,options)=>{const trace={};calls.push(trace);return callModel(env,db,fetch,input,{...options,traceCall:trace});}}));
   try{t.check(before,after);assert.deepEqual(state,before);}catch(e){checkError=e.message;}
  }catch(e){error=e.code||e.message;}
  const result={id:c.id,turn:i+1,action:t.action,success:!!after,checksPassed:!!after&&!checkError,error,checkError,ms:Date.now()-start,calls:calls.length,retries:diagnostics.length};results.push(result);
  await writeFile(resolve(output,`${c.id}-${i+1}.json`),JSON.stringify({...result,before,after,calls,diagnostics},null,2)+'\n');
  console.log(JSON.stringify(result));if(!after)break;state=after;
 }
}
await writeFile(resolve(output,'summary.json'),JSON.stringify({results,spent:sql.prepare('SELECT * FROM koa_fiction_budget').all(),notice:'State assertions do not grade hint usefulness, warmth, spoilers or ending quality. Review the saved narrations separately.'},null,2)+'\n');
sql.close();if(results.some(r=>!r.checksPassed))process.exitCode=1;
