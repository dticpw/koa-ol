import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import http from 'node:http';
import {startPreview} from '../scripts/fiction-preview.mjs';
import {checkCompatibility} from '../scripts/fiction-compat.mjs';
import {createAdventureEngine} from '../functions/_lib/adventures/engine.js';
import {stories} from '../functions/_lib/adventures/stories.js';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const artifacts=process.env.FICTION_TEST_ARTIFACTS||resolve(repo,'../agent-artifacts/fiction-release-tests');
await mkdir(artifacts,{recursive:true});
const root=await mkdtemp(resolve(artifacts,'run-')),source=resolve(root,'source');
const py=process.env.FICTION_PYTHON;if(!py)throw Error('Set FICTION_PYTHON to your Python interpreter');
execFileSync(py,[resolve(repo,'scripts/fiction_release.py'),'snapshot','--ref','HEAD','--out',source]);
const path='/api/adventures/library-delve';
async function call(port,url=path,body,cookies='',headers={}){
 const response=await fetch(`http://127.0.0.1:${port}${url}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookies,...headers},...(body?{body:JSON.stringify(body)}:{})});
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 return {status:response.status,data,cookies:response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};
}
test('local previews isolate cookies and databases; persist games/archives; reject unsafe requests and absent model',async()=>{
 let a=await startPreview({source,data:resolve(root,'a'),port:0,modelMode:'offline'});
 const b=await startPreview({source,data:resolve(root,'b'),port:0,modelMode:'offline'});
 try{
  const health=await call(a.port,'/__preview/health');assert.equal(health.data.productionDatabase,false);assert.equal(health.data.modelReady,false);
  assert.match((await call(a.port,'/games/fiction/library-delve/play/')).data,/本机测试/);
  const start=await call(a.port,path,{op:'start'});assert.equal(start.status,200);
  assert.match(start.cookies,new RegExp(`^fiction_preview_${a.port}_`));
  assert.equal((await call(b.port,path,undefined,start.cookies)).data.game,null);
  const second=await call(b.port,path,{op:'start'},start.cookies);assert.equal(second.status,200);
  assert.notEqual(second.data.game.sessionId,start.data.game.sessionId);
  const jar=start.cookies+'; '+second.cookies;
  assert.equal((await call(a.port,path,undefined,jar)).data.game.sessionId,start.data.game.sessionId);
  assert.equal((await call(b.port,path,undefined,jar)).data.game.sessionId,second.data.game.sessionId);
  const missing=await call(a.port,path,{op:'turn',action:'看看四周',expectedRevision:0,requestId:crypto.randomUUID()},jar);
  assert.equal(missing.status,503);assert.equal((await call(a.port,path,undefined,jar)).data.game.revision,0);
  const foreign=await call(a.port,path,{op:'start'},jar,{Origin:'https://untrusted.invalid'});assert.equal(foreign.status,403);
  assert.equal((await call(a.port,'/functions/_lib/adventures/stories.js')).status,404);
  assert.equal((await call(a.port,'/games/fiction/%2e%2e%2ffunctions%2f_lib%2fadventures%2fstories.js')).status,404);
  const hostile=await new Promise((ok,fail)=>http.get({hostname:'127.0.0.1',port:a.port,path:'/__preview/health',headers:{Host:'evil.invalid'}},r=>{r.resume();ok(r.statusCode);}).on('error',fail));
  assert.equal(hostile,403);
  const collection=await call(a.port,path+'/archives',undefined,jar);
  const fullJar=jar+'; '+collection.cookies;
  const saved=await call(a.port,path+'/archives',{op:'save',title:'本机隔离测试',sessionId:start.data.game.sessionId,expectedRevision:0},fullJar);
  assert.equal(saved.status,200);
  const port=a.port;await a.close();a=null;
  a=await startPreview({source,data:resolve(root,'a'),port,modelMode:'offline'});
  assert.equal((await call(a.port,path,undefined,fullJar)).data.game.sessionId,start.data.game.sessionId);
  assert.equal((await call(a.port,path+'/archives',undefined,fullJar)).data.entries.length,1);
  assert.equal((await call(b.port,path+'/archives',undefined,fullJar)).data.entries.length,0);
 }finally{if(a)await a.close();await b.close();}
});
test('compatibility accepts progressed/pending/ended states and rejects invalid saved facts or changed snapshot',async()=>{
 const e=createAdventureEngine(stories['library-delve']);
 const s=e.createGame();s.revision=4;s.turn=4;
 s.pendingDecision={disposition:'replace',needed:true,question:'继续吗？',pending_action:'继续查看',reason:'等玩家确认'};
 const good=await checkCompatibility({baselineRoot:source,candidateRoot:source,saves:[s]});assert.equal(good.passed,true);assert.equal(good.progressedStates,1);
 for(const change of [{version:99},{location:'removed-place'},{flags:['removed-flag']},{entities:[]}]){
  // Empty inventory is valid in principle, so use an invalid entity location for that case.
  const bad={...s,...change};if(change.entities)bad.entities=[{...s.entities[0],place:'missing-room'}];
  const report=await checkCompatibility({baselineRoot:source,candidateRoot:source,saves:[bad]});assert.equal(report.passed,false);
 }
 const ended={...s,status:'ended',ending:{id:'leave'},pendingDecision:null};
 assert.equal((await checkCompatibility({baselineRoot:source,candidateRoot:source,saves:[ended]})).passed,true);
 const file=resolve(source,'functions/_lib/adventures/engine.js');const content=await readFile(file);
 await writeFile(file,Buffer.concat([content,Buffer.from('\n// modified\n')]));
 await assert.rejects(checkCompatibility({baselineRoot:source,candidateRoot:source}),/Snapshot modified/);
 await writeFile(file,content);
});
