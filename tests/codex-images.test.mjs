import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequestPost as generate, onRequestOptions } from '../functions/ai/v1/images/generations.js';
import { onRequestPost as edit } from '../functions/ai/v1/images/edits.js';
import { onRequestGet as models } from '../functions/ai/v1/models.js';
import { onRequestPost as respond } from '../functions/ai/v1/responses.js';

const digest = createHash('sha256').update('test-image-key').digest('hex');
const policy = { models: ['gpt-6-astra'], image_models: ['gpt-image-2'] };
const env = { CLIENT_API_KEYS: 'test-legacy', UPSTREAM_API_KEY: 'test-upstream', UPSTREAM_BASE_URL: 'https://upstream.invalid/v1', CODEX_CLIENT_POLICIES: JSON.stringify({ [digest]: policy }) };
const png = new Uint8Array([137,80,78,71,13,10,26,10]);
function context(body = {model:'gpt-image-2',prompt:'A cup'}, key = 'test-image-key', overrides = {}) {
  const form = body instanceof FormData;
  return { env: {...env,...overrides}, request: new Request('https://test.invalid/ai/v1/images/generations', {
    method:'POST', headers:{Authorization:`Bearer ${key}`, ...(!form?{'Content-Type':'application/json'}:{})}, body:form?body:JSON.stringify(body),
  }), waitUntil(p){return p;} };
}
function editForm() {
  const form=new FormData();form.set('model','gpt-image-2');form.set('prompt','Make the cup red');
  form.set('image',new Blob([png],{type:'image/png'}),'cup.png');return form;
}

test('only the separately granted image key can call images', async t => {
  t.mock.method(globalThis,'fetch',()=>{throw new Error('not expected');});
  assert.equal((await generate(context(undefined,'wrong'))).status,401);
  assert.equal((await generate(context(undefined,'test-legacy'))).status,403);
  assert.equal((await generate(context(undefined,'test-image-key',{CODEX_CLIENT_POLICIES:JSON.stringify({[digest]:{models:['gpt-6-astra']}})}))).status,403);
  assert.equal((await generate(context({model:'gpt-image-2.5',prompt:'test'}))).status,403);
  assert.equal((await generate(context(undefined,'test-image-key',{CODEX_CLIENT_POLICIES:JSON.stringify({[digest]:{...policy,disabled:true}})}))).status,401);
  assert.equal((await generate(context(undefined,'test-image-key',{CODEX_CLIENT_POLICIES:JSON.stringify({[digest]:{...policy,image_models:['unknown']}})}))).status,500);
  assert.equal(globalThis.fetch.mock.callCount(),0);
});

test('models lists image capability without allowing image model as a chat model',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw new Error('not expected');});
  const r=await models(context());assert.deepEqual((await r.json()).data.map(m=>m.id),['gpt-6-astra','gpt-image-2']);
  assert.equal((await respond(context({model:'gpt-image-2',input:'hello'}))).status,400);
});

test('generation forwards exact model and returns image bytes and metadata unchanged',async t=>{
  const upstream={created:1,data:[{b64_json:Buffer.from(png).toString('base64')}],usage:{input_tokens:2,output_tokens:4}};
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://upstream.invalid/v1/images/generations');
    assert.equal(options.headers.get('Authorization'),'Bearer test-upstream');
    assert.deepEqual(JSON.parse(options.body),{model:'gpt-image-2',prompt:'A cup',quality:'low',size:'1024x1024',n:1});
    return Response.json(upstream,{headers:{'x-request-id':'image-123'}});
  });
  const r=await generate(context({model:'gpt-image-2',prompt:'A cup',quality:'low',size:'1024x1024',n:1}));
  assert.equal(r.status,200);assert.deepEqual(await r.json(),upstream);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal(r.headers.get('x-request-id'),'image-123');
});

test('bad shapes, sizes, batch counts, unsupported fields and oversized prompts are rejected before upstream',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw new Error('not expected');});
  for(const body of [null,[],{prompt:''},{prompt:3},{prompt:'x'.repeat(32001)},{prompt:'x',n:2},{prompt:'x',size:'1x1'},{prompt:'x',quality:'invalid'},{prompt:'x',output_format:'svg'},{prompt:'x',background:'transparent'},{prompt:'x',stream:true}]){
    assert.equal((await generate(context(body))).status,400);
  }
  assert.equal((await generate(context({prompt:'x'.repeat(140000)}))).status,413);
  assert.equal(globalThis.fetch.mock.callCount(),0);
});

test('multipart edits preserve file bytes and let fetch choose a new boundary',async t=>{
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://upstream.invalid/v1/images/edits');
    assert.equal(options.headers.has('Content-Type'),false);
    assert.equal(options.body.get('model'),'gpt-image-2');
    assert.deepEqual(new Uint8Array(await options.body.get('image').arrayBuffer()),png);
    return Response.json({data:[{b64_json:'test'}]});
  });
  assert.equal((await edit(context(editForm()))).status,200);
});

test('invalid edit uploads never reach upstream',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw new Error('not expected');});
  const missing=editForm();missing.delete('image');
  const text=editForm();text.set('image','not-a-file');
  const type=editForm();type.set('image',new Blob(['bad'],{type:'text/plain'}),'bad.txt');
  const duplicate=editForm();duplicate.append('model','gpt-image-2');
  const large=editForm();large.set('image',new Blob([new Uint8Array(16*1024*1024+1)],{type:'image/png'}),'large.png');
  for(const form of [missing,text,type,duplicate,large])assert.equal((await edit(context(form))).status,400);
  assert.equal((await edit(context())).status,415);
  assert.equal(globalThis.fetch.mock.callCount(),0);
});

test('errors retain upstream status; logging never includes prompt or image content',async t=>{
  const rows=[];const DB={prepare(){return {bind(...values){rows.push(values);return this;},async run(){}};}};
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:{message:'quota'}},{status:429,headers:{'retry-after':'10'}}));
  const r=await generate(context({prompt:'private test prompt'},'test-image-key',{DB}));
  assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'10');
  assert.equal(rows.length,1);assert.equal(JSON.stringify(rows).includes('private test prompt'),false);
  assert.equal(JSON.stringify(rows).includes('test-image-key'),false);
  assert.equal((await onRequestOptions()).status,204);
});
