import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorizeClient, MODEL_EFFORTS } from '../functions/_lib/codex-access.js';
import { onRequestGet } from '../functions/ai/v1/models.js';
import { onRequestPost } from '../functions/ai/v1/responses.js';
import { onRequestPost as compact } from '../functions/ai/v1/responses/compact.js';

const digest = createHash('sha256').update('test-new-key').digest('hex');
const models = Object.keys(MODEL_EFFORTS);
const env = {
  CLIENT_API_KEYS: 'test-old-key,test-another-old-key',
  CODEX_CLIENT_POLICIES: JSON.stringify({ [digest]: { models } }),
  UPSTREAM_API_KEY: 'test-upstream-key', UPSTREAM_BASE_URL: 'https://upstream.invalid/v1/',
};
function context(key = 'test-new-key', body, overrides = {}) {
  return { env: { ...env, ...overrides }, request: new Request('https://test.invalid/ai/v1/responses', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), waitUntil(promise) { return promise; } };
}

test('models are isolated by key, legacy remains Sol only', async () => {
  for (const key of ['test-old-key', 'test-another-old-key']) {
    const r = await onRequestGet(context(key));
    assert.deepEqual((await r.json()).data.map(m => m.id), ['gpt-5.6-sol']);
  }
  const r = await onRequestGet(context());
  assert.deepEqual((await r.json()).data.map(m => m.id), models);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('missing, wrong, disabled and malformed credentials fail closed', async () => {
  assert.equal((await onRequestGet(context('wrong'))).status, 401);
  const c = context(); c.request.headers.delete('Authorization');
  assert.equal((await onRequestGet(c)).status, 401);
  c.request.headers.set('Authorization', 'test-old-key');
  assert.equal((await onRequestGet(c)).status, 401);
  assert.equal((await onRequestGet(context('test-new-key', undefined, {
    CODEX_CLIENT_POLICIES: JSON.stringify({ [digest]: { models, disabled: true } }),
  }))).status, 401);
  for (const value of ['broken', 'null', '[]', JSON.stringify({[digest]: {models:['unknown']}})]) {
    assert.equal((await onRequestGet(context('test-new-key', undefined, { CODEX_CLIENT_POLICIES: value }))).status, 500);
    assert.equal((await onRequestGet(context('test-old-key', undefined, { CODEX_CLIENT_POLICIES: value }))).status, 200);
  }
});

test('unauthorized model and invalid effort/tier never call upstream', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('must not call upstream'); });
  const invalid = [
    ['test-old-key', {model:'gpt-6-astra'}], ['test-new-key', {model:'gpt-5.4'}],
    ['test-new-key', {model:'gpt-5.5', reasoning:{effort:'max'}}],
    ['test-new-key', {model:'gpt-6-astra', reasoning:{effort:'ultra'}}],
    ['test-new-key', {model:null}], ['test-new-key', {reasoning:[]}],
    ['test-new-key', {reasoning:null}], ['test-new-key', {service_tier:'priority'}],
    ['test-new-key', []],
  ];
  for (const [key, body] of invalid) assert.equal((await onRequestPost(context(key, body))).status,400);
  assert.equal(globalThis.fetch.mock.callCount(),0);
});

test('all allowed efforts preserve model, tools and request fields; streams pass through', async t => {
  const sse = 'event: response.completed\ndata: {"type":"response.completed","response":{"model":"gpt-6-astra","usage":{"input_tokens":1,"output_tokens":1}}}\n\n';
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({url,options});
    return new Response(sse, {headers:{'Content-Type':'text/event-stream','x-request-id':'test-id'}});
  });
  for (const model of models) for (const effort of MODEL_EFFORTS[model]) {
    const body = { model, reasoning:{effort}, input:'test', stream:true, store:false,
      tools:[{type:'function',name:'test',parameters:{type:'object',properties:{}}}],
    };
    const r = await onRequestPost(context('test-new-key',body));
    assert.equal(r.status,200); assert.equal(await r.text(),sse);
    assert.equal(r.headers.get('x-request-id'),'test-id');
    const call = calls.at(-1);
    assert.equal(call.url,'https://upstream.invalid/v1/responses');
    assert.deepEqual(JSON.parse(call.options.body),body);
    assert.equal(call.options.headers.get('Authorization'),'Bearer test-upstream-key');
  }
});

test('compact uses the same permissions and forwards to exact upstream path', async t => {
  t.mock.method(globalThis,'fetch',async (url) => {
    assert.equal(url,'https://upstream.invalid/v1/responses/compact');
    return Response.json({object:'response.compaction',output:[]});
  });
  assert.equal((await compact(context('test-old-key',{model:'gpt-6-astra'}))).status,400);
  assert.equal((await compact(context('test-new-key',{model:'gpt-6-astra',input:[]}))).status,200);
});

test('upstream errors retain status and legacy missing-model default remains Sol', async t => {
  t.mock.method(globalThis,'fetch',async (_url, options) => {
    assert.equal(JSON.parse(options.body).model,'gpt-5.6-sol');
    return Response.json({error:{message:'Rate limited'}},{status:429});
  });
  const r=await onRequestPost(context('test-old-key',{input:'test'}));
  assert.equal(r.status,429); assert.equal((await r.json()).error.message,'Rate limited');
});

test('new key works with no legacy key configured', async () => {
  const c=context('test-new-key',undefined,{CLIENT_API_KEYS:''});
  assert.deepEqual((await authorizeClient(c.request,c.env)).models,models);
});
