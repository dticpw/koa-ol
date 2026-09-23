import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/fiction-preview.mjs';
import {callModel,createFictionHandler} from '../functions/_lib/fiction-service.js';
import {hostProfile,hostRates,estimateHostCost,validateHostJSON} from '../functions/_lib/fiction-models.js';
import {createMultiplayerHandler,schema} from '../functions/_lib/multiplayer/service.js';
import * as engine from '../functions/_lib/fiction-engine.js';

const format={type:'json_schema',name:'answer',strict:true,schema:{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false}};
async function database(){const sql=new DatabaseSync(':memory:'),db=sqliteAdapter(sql);await db.batch(schema.map(s=>db.prepare(s)));return {sql,db};}
const deepResponse=(text='{"answer":"火焰没有点燃白垩，等待玩家决定是否仍然投掷。"}',finish='stop')=>new Response(JSON.stringify({choices:[{finish_reason:finish,message:{content:text,reasoning_content:'PRIVATE_REASONING'}}],usage:{prompt_tokens:1000,completion_tokens:200,prompt_cache_hit_tokens:400,prompt_cache_miss_tokens:600,completion_tokens_details:{reasoning_tokens:80}}}));

test('DeepSeek transport keeps the existing rules, uses high and allows reasoning without leaking it',async()=>{
 const {sql,db}=await database(),trace={};let payload,url;
 const text=await callModel({DEEPSEEK_API_KEY:'SECRET_TEST_ONLY'},db,async(u,o)=>{url=u;payload=JSON.parse(o.body);assert.equal(o.headers.Authorization,'Bearer SECRET_TEST_ONLY');return deepResponse();},[{role:'developer',content:'EXISTING_HOST_RULES'},{role:'user',content:'ACTION'}],{modelId:'deepseek-flash',format,maxTokens:3400,traceCall:trace});
 assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(payload.model,'deepseek-flash');assert.equal(payload.reasoning_effort,'high');assert.deepEqual(payload.thinking,{type:'enabled'});assert.match(payload.messages[0].content,/EXISTING_HOST_RULES/);assert.equal(payload.messages[0].role,'system');assert.equal(payload.messages[1].content,'ACTION');assert.equal(payload.messages.filter(m=>m.role==='system').length,1);assert.match(payload.messages[0].content,/JSON Schema/);assert.equal(payload.max_tokens,19784);assert.equal(payload.response_format.type,'json_object');
 assert.equal(JSON.parse(text).answer.startsWith('火焰'),true);assert.equal(trace.response.usage.cached_input_tokens,400);assert.equal(trace.response.usage.reasoning_tokens,80);assert.equal(trace.response.usage.output_tokens,200);
 assert.doesNotMatch(JSON.stringify(trace),/SECRET_TEST_ONLY|PRIVATE_REASONING|Authorization|https:\/\//);assert.equal(trace.cost.estimatedUsd*1e6,sql.prepare('SELECT spent_micro FROM koa_fiction_budget').get().spent_micro);sql.close();
});
test('DeepSeek cache and reasoning are billed once; off-peak and conservative peak rates are explicit',()=>{
 const profile=hostProfile('deepseek-flash'),peak=hostRates(profile,new Date('2026-09-23T07:00:00Z')),night=hostRates(profile,new Date('2026-09-23T12:00:00Z'));
 assert.equal(peak.input,.3);assert.equal(night.input,.15);assert.equal(hostRates(profile,new Date('2026-09-26T07:00:00Z')).input,.15);
 assert.equal(estimateHostCost({input_tokens:1000,cached_input_tokens:400,output_tokens:200,reasoning_tokens:80},peak),423);
 assert.equal(hostRates(profile,new Date('2026-09-26T07:00:00Z'),true).input,.3);
});
test('malformed, schema-invalid and truncated DeepSeek output fail closed while usage is retained',async()=>{
 for(const [text,finish]of [['not JSON','stop'],['{"answer":9}','stop'],['{"answer":"x","extra":true}','stop'],['{"answer":"x"}','length']]){
  const {sql,db}=await database(),trace={};await assert.rejects(callModel({DEEPSEEK_API_KEY:'test'},db,async()=>deepResponse(text,finish),[],{modelId:'deepseek-flash',format,traceCall:trace}),e=>e.code==='model_unavailable');assert.equal(trace.status,'failed');assert.ok(trace.cost.estimatedUsd>0);assert.ok(sql.prepare('SELECT spent_micro FROM koa_fiction_budget').get().spent_micro>0);sql.close();
 }
});
test('schema validator protects nested nullable corrections, identifiers, arrays and enum boundaries',()=>{
 const schema={type:'object',properties:{items:{anyOf:[{type:'array',maxItems:1,items:{type:'string',pattern:'^[a-z]+$'}},{type:'null'}]},result:{type:'string',enum:['keep','stop']}},required:['items','result'],additionalProperties:false};
 validateHostJSON({items:null,result:'keep'},schema);validateHostJSON({items:['rope'],result:'stop'},schema);
 for(const v of [{items:['BAD ID'],result:'keep'},{items:[],result:'invent'},{result:'keep'},{items:['a','b'],result:'keep'}])assert.throws(()=>validateHostJSON(v,schema));
 assert.throws(()=>validateHostJSON('x',{type:'string',unimplementedConstraint:true}),/Unsupported/);
});
test('one bounded DeepSeek format retry preserves both costs and hides leaked reasoning delimiters',async()=>{
 const {sql,db}=await database(),trace={};let count=0;
 const result=await callModel({DEEPSEEK_API_KEY:'test'},db,async(u,o)=>{count++;if(count===2){const p=JSON.parse(o.body);assert.match(p.messages[0].content,/未执行也未提交/);assert.doesNotMatch(JSON.stringify(p),/PRIVATE_LEAK/);}return deepResponse(count===1?'PRIVATE_LEAK<｜end▁of▁thinking｜>{"answer":"x"}':'{"answer":"ok"}');},[],{modelId:'deepseek-flash',format,traceCall:trace});
 assert.equal(JSON.parse(result).answer,'ok');assert.equal(count,2);assert.equal(trace.status,'failed');assert.equal(trace.formatRepair.status,'received');assert.ok(trace.response.redacted);assert.doesNotMatch(JSON.stringify(trace),/PRIVATE_LEAK/);
 assert.equal(sql.prepare('SELECT spent_micro FROM koa_fiction_budget').get().spent_micro,Math.round((trace.cost.estimatedUsd+trace.formatRepair.cost.estimatedUsd)*1e6));sql.close();
});
test('DeepSeek format retry is limited to two requests and does not retry truncation or network failures',async()=>{
 for(const mode of ['invalid','length','network']){
  const {sql,db}=await database();let count=0;
  await assert.rejects(callModel({DEEPSEEK_API_KEY:'test'},db,async()=>{count++;if(mode==='network')throw Error('connection failed');return deepResponse('bad',mode==='length'?'length':'stop');},[],{modelId:'deepseek-flash',format}),e=>e.code==='model_unavailable');
  assert.equal(count,mode==='invalid'?2:1);sql.close();
 }
});
test('DeepSeek high respects the remaining whole-turn deadline even with a 90-second call allowance',async()=>{
 const {sql,db}=await database(),nativeTimer=globalThis.setTimeout,delays=[];
 try{
  globalThis.setTimeout=(fn,ms,...args)=>{delays.push(ms);return nativeTimer(fn,ms,...args);};
  await callModel({DEEPSEEK_API_KEY:'test'},db,async()=>deepResponse(),[],{modelId:'deepseek-flash',format,deadlineAt:Date.now()+5000});
  assert.equal(delays.length,1);assert.ok(delays[0]>0&&delays[0]<=5000);
 }finally{globalThis.setTimeout=nativeTimer;sql.close();}
});
test('missing DeepSeek credential never falls back to GPT or spends its budget',async()=>{
 const {sql,db}=await database();let called=false;
 await assert.rejects(callModel({UPSTREAM_API_KEY:'test'},db,async()=>{called=true;},[],{modelId:'deepseek-flash'}),e=>e.code==='model_unavailable');assert.equal(called,false);assert.equal(sql.prepare('SELECT COUNT(*) n FROM koa_fiction_budget').get().n,0);sql.close();
});

function client(handler,env,path){let cookie='';return async(body,query='')=>{const r=await handler({env,request:new Request('https://game.test'+path+query,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:'https://game.test'}:{})},...(body?{body:JSON.stringify(body)}:{})})});if(r.headers.has('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];return {status:r.status,body:await r.json()};};}
test('solo host is pinned at start, visible after reload and cannot be changed in a turn',async()=>{
 const {sql,db}=await database(),env={DB:db,DEEPSEEK_API_KEY:'test'},req=client(createFictionHandler(engine),env,'/api/fiction');
 assert.equal((await req()).body.hosts.find(h=>h.id==='deepseek-flash').available,true);
 assert.equal((await req({op:'start',hostModel:'arbitrary-model'})).status,400);
 assert.equal((await req({op:'start',hostModel:'deepseek-flash'})).body.game.reasoningEffort,'high');
 assert.equal((await req()).body.game.hostModel,'deepseek-flash');
 assert.equal((await req({op:'start',hostModel:'gpt-5.6-sol'})).body.game.hostModel,'deepseek-flash');
 assert.equal((await req({op:'turn',hostModel:'gpt-5.6-sol',requestId:crypto.randomUUID(),expectedRevision:0,action:'观察'})).status,400);
 assert.equal(JSON.parse(sql.prepare('SELECT state_json FROM koa_fiction_sessions').get().state_json).hostModel,'deepseek-flash');sql.close();
});
test('only the multiplayer room owner selects a model and both players see the pinned host',async()=>{
 const {sql,db}=await database(),env={DB:db,DEEPSEEK_API_KEY:'test'},handler=createMultiplayerHandler();const a=client(handler,env,'/api/fiction-rooms'),b=client(handler,env,'/api/fiction-rooms');
 for(const [i,c]of [a,b].entries()){await c({op:'hello',name:'玩家'+i});assert.equal((await c({op:'join',table:20000})).status,200);}
 const start={op:'start',table:20000,requestId:crypto.randomUUID(),hostModel:'deepseek-flash'};
 assert.equal((await b(start)).status,403);assert.equal((await a(start)).status,200);
 for(const c of [a,b]){const g=(await c(null,'?table=20000')).body.table.game;assert.equal(g.hostModel,'deepseek-flash');assert.equal(g.hostRevision,'cooperative-v4');}
 assert.equal((await a({...start,hostModel:'gpt-5.6-sol'})).status,200);assert.equal((await a(null,'?table=20000')).body.table.game.hostModel,'deepseek-flash');sql.close();
});
