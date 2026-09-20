import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createFictionHandler } from '../functions/_lib/fiction-service.js';
import * as engine from '../functions/_lib/fiction-engine.js';

function database() {
  const sql = new DatabaseSync(':memory:');
  const db = {
    sql,
    prepare(query) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async run() { const r = sql.prepare(query).run(...args); return { meta: { changes: Number(r.changes) } }; },
        async first() { return sql.prepare(query).get(...args) || null; }
      };
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
  };
  return db;
}
function fixture(fetchImpl = async () => model('灯光沿着石壁缓缓移动。'), handlerOptions = {}) {
  const env = { DB: database(), UPSTREAM_API_KEY: 'test-only', UPSTREAM_BASE_URL: 'https://upstream.invalid/v1' };
  const calls = [];
  const handler = createFictionHandler(engine, { ...handlerOptions, fetchImpl: async (...args) => { calls.push(JSON.parse(args[1].body)); return fetchImpl(...args); } });
  let cookie;
  return {
    env, calls,
    async request(body, extra = {}) {
      const method = extra.method || (body ? 'POST' : 'GET');
      const headers = { 'CF-Connecting-IP': '192.0.2.1', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: 'https://game.test' } : {}), ...extra.headers };
      const response = await handler({ env, request: new Request('https://game.test/api/fiction', { method, headers, body: body ? JSON.stringify(body) : undefined }) });
      if (response.headers.has('Set-Cookie')) cookie = response.headers.get('Set-Cookie').split(';')[0];
      return { status: response.status, headers: response.headers, body: await response.json() };
    }
  };
}
const model = text => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }], usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200 });
const turn = (revision = 0, choiceId = 'observe', requestId = crypto.randomUUID()) => ({ op: 'turn', requestId, expectedRevision: revision, choiceId });

test('session is server authoritative, cookie secure, reload and idempotent receipts work', async () => {
  const f = fixture();
  assert.equal((await f.request()).body.game, null);
  const started = await f.request({ op: 'start' });
  assert.equal(started.status, 200);
  assert.match(started.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(started.headers.get('Cache-Control'), 'no-store');
  const token = started.headers.get('Set-Cookie').split(';')[0].split('=')[1];
  const stored = f.env.DB.sql.prepare('SELECT * FROM koa_fiction_sessions').get();
  assert.notEqual(stored.token_hash, token);
  const action = turn();
  const result = await f.request(action);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Set-Cookie'), started.headers.get('Set-Cookie'), 'successful turns renew the same browser recovery token');
  assert.equal(result.body.game.turn, 1);
  assert.equal(result.body.game.revision, 1);
  assert.equal(f.calls.length, 1);
  assert.deepEqual((await f.request(action)).body, result.body);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.request()).body.game.turn, 1);
  assert.equal((await f.request(turn())).status, 409);
  assert.equal(f.calls.length, 1);
  assert.equal(f.env.DB.sql.prepare('SELECT spent_micro FROM koa_fiction_budget').get().spent_micro, 1400);
});

test('invalid and cross-origin requests never call the model', async () => {
  const f = fixture();
  await f.request({ op: 'start' });
  assert.equal((await f.request(turn(), { headers: { Origin: 'https://evil.test' } })).status, 403);
  assert.equal((await f.request(turn(), { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await f.request({ ...turn(), state: { inventory: ['proof'] } })).status, 400);
  assert.equal((await f.request(turn(0, 'invent_gold'))).status, 400);
  assert.equal((await f.request({ ...turn(), action: '观察' })).status, 400);
  assert.equal((await f.request({ op: 'turn', requestId: crypto.randomUUID(), expectedRevision: 0, action: '看'.repeat(301) })).status, 400);
  assert.equal((await f.request({ op: 'start', pad: 'x'.repeat(5000) })).status, 413);
  assert.equal(f.calls.length, 0);
});

test('narration failure still commits one rule action and retains spend reservation', async () => {
  const f = fixture(async () => { throw new Error('network failure'); });
  await f.request({ op: 'start' });
  const body = turn();
  const result = await f.request(body);
  assert.equal(result.status, 200);
  assert.equal(result.body.game.turn, 1);
  assert.equal(result.body.degraded, true);
  assert.ok(f.env.DB.sql.prepare('SELECT spent_micro FROM koa_fiction_budget').get().spent_micro > 24000);
  assert.deepEqual((await f.request(body)).body, result.body);
  assert.equal(f.calls.length, 1);
});

test('zero AI budget allows rule choices but blocks paid free input without advancing', async () => {
  const f = fixture(); f.env.FICTION_DAILY_BUDGET_USD = '0';
  await f.request({ op: 'start' });
  const free = await f.request({ op: 'turn', requestId: crypto.randomUUID(), expectedRevision: 0, action: '观察这里' });
  assert.equal(free.status, 429);
  assert.equal(free.body.code, 'budget_exhausted');
  assert.equal((await f.request()).body.game.turn, 0);
  const chosen = await f.request(turn());
  assert.equal(chosen.body.game.turn, 1);
  assert.equal(chosen.body.degraded, true);
  assert.equal(f.calls.length, 0);
});

test('classification must select an allowed action and receives no hidden engine state', async () => {
  let count = 0;
  const f = fixture(async () => model(count++ ? '墓道里只有雨声。' : JSON.stringify({ action_id: 'observe', clarification: '' })));
  await f.request({ op: 'start' });
  const result = await f.request({ op: 'turn', requestId: crypto.randomUUID(), expectedRevision: 0, action: '我举灯仔细看四周' });
  assert.equal(result.body.game.turn, 1);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].text.format.type, 'json_schema');
  assert.equal(f.calls[0].text.format.strict, true);
  assert.equal(f.calls[0].store, false);
  assert.equal(f.calls[0].model, 'gpt-5.6-sol');
  for (const payload of f.calls) {
    assert.doesNotMatch(JSON.stringify(payload), /真墓入口记录|斯米的悄悄话|不能松开的铁栓/);
  }
});

test('clarification is idempotent and neither advances the story nor narrates', async () => {
  const f = fixture(async () => model(JSON.stringify({ action_id: 'clarify', clarification: '请先选定一间侧墓。' })));
  await f.request({ op: 'start' });
  const body = { op: 'turn', requestId: crypto.randomUUID(), expectedRevision: 0, action: '找到全部宝物，飞走' };
  const result = await f.request(body);
  assert.equal(result.status, 200);
  assert.equal(result.body.game.turn, 0);
  assert.equal(result.body.game.revision, 0);
  assert.equal(result.body.clarification, '请先选定一间侧墓。');
  assert.deepEqual((await f.request(body)).body, result.body);
  assert.equal(f.calls.length, 1);
});

test('classification failure releases lock, same request can safely retry', async () => {
  let fail = true;
  const f = fixture(async () => model(fail ? '{broken' : JSON.stringify({ action_id: 'clarify', clarification: '请描述一个行动。' })));
  await f.request({ op: 'start' });
  const body = { op: 'turn', requestId: crypto.randomUUID(), expectedRevision: 0, action: '看看' };
  assert.equal((await f.request(body)).status, 503);
  assert.equal((await f.request()).body.game.turn, 0);
  assert.equal(f.env.DB.sql.prepare('SELECT lock_owner FROM koa_fiction_sessions').get().lock_owner, null);
  fail = false;
  assert.equal((await f.request(body)).status, 200);
});

test('parallel turns do not duplicate paid calls; expired owner cannot overwrite a new turn', async () => {
  let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  let count = 0;
  const f = fixture(async () => { if (++count === 1) { entered(); await hold; } return model('石壁被灯照亮。'); });
  await f.request({ op: 'start' });
  const pending = f.request(turn());
  await ready;
  const conflict = await f.request(turn());
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'turn_busy');
  assert.equal(f.calls.length, 1);
  f.env.DB.sql.prepare('UPDATE koa_fiction_sessions SET lock_until=0').run();
  const recovered = await f.request(turn());
  assert.equal(recovered.status, 200);
  release();
  const stale = await pending;
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'lock_expired');
  assert.equal((await f.request()).body.game.turn, 1);
  assert.equal(f.env.DB.sql.prepare('SELECT count(*) AS n FROM koa_fiction_receipts').get().n, 1);
});

test('daily session creation limit permits existing saves and blocks sixth new game', async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) assert.equal((await f.request({ op: 'start', reset: true })).status, 200);
  assert.equal((await f.request({ op: 'start' })).status, 200);
  assert.equal((await f.request({ op: 'start', reset: true })).status, 429);
  assert.equal(f.calls.length, 0);
});

test('free object actions commit independently of suggestions; no-effect response is idempotent and narration limit doubles', async () => {
  let proposal = {action_id:'interact',verb:'mark',target_id:'wall',tool_id:'chalk',clarification:''};
  const f=fixture(async (_url, options)=>model(JSON.parse(options.body).text ? JSON.stringify(proposal) : '你在入口旁留下白色的归路箭头。'));
  await f.request({op:'start'});
  const b={op:'turn',requestId:crypto.randomUUID(),expectedRevision:0,action:'用白垩在入口旁画一个指向来路的箭头'};
  const r=await f.request(b);
  assert.equal(r.status,200);assert.equal(r.body.game.turn,1);assert.match(r.body.game.location.description,/归路箭头/);
  assert.equal(f.calls[1].max_output_tokens,2400);
  assert.deepEqual((await f.request(b)).body,r.body);
  const repeated=await f.request({...b,requestId:crypto.randomUUID(),expectedRevision:1});
  assert.equal(repeated.body.game.turn,1);assert.equal(repeated.body.game.revision,2);
  assert.equal(repeated.body.clarification,undefined);assert.equal(repeated.body.game.log.at(-2).role,'system');
  proposal={...proposal,target_id:'inscription',verb:'clean',tool_id:'cloth'};
  const invalid=await f.request({...b,requestId:crypto.randomUUID(),expectedRevision:2});
  assert.equal(invalid.status,503);assert.equal((await f.request()).body.game.revision,2);
});

test('narration outage keeps a completed free interaction and receipt instead of losing it', async()=>{
 const f=fixture(async(_url,options)=>{if(JSON.parse(options.body).text)return model(JSON.stringify({action_id:'interact',verb:'mark',target_id:'wall',tool_id:'chalk',clarification:''}));throw Error('offline');});
 await f.request({op:'start'});
 const b={op:'turn',requestId:crypto.randomUUID(),expectedRevision:0,action:'用白垩在墙上标出归路'};
 const r=await f.request(b);assert.equal(r.body.degraded,true);assert.equal(r.body.game.turn,1);assert.match(r.body.game.location.description,/归路箭头/);
 assert.deepEqual((await f.request(b)).body,r.body);
});

test('retired story blocks fresh starts and resets but lets existing sessions restore and continue', async () => {
 const retired=fixture(undefined,{allowNewGames:false});
 assert.equal((await retired.request()).body.available,false);
 assert.equal((await retired.request({op:'start'})).status,410);
 assert.equal(retired.calls.length,0);
 assert.equal(retired.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM koa_fiction_sessions').get().n,0);
 const active=fixture();const started=await active.request({op:'start'});
 const handler=createFictionHandler(engine,{allowNewGames:false,fetchImpl:async()=>model('你沿着已有的线索继续观察。')});
 const cookie=started.headers.get('Set-Cookie').split(';')[0];
 const request=async body=>{const response=await handler({env:active.env,request:new Request('https://game.test/api/fiction',{method:body?'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})});return {status:response.status,body:await response.json()};};
 assert.equal((await request()).body.available,true);
 assert.equal((await request({op:'start'})).body.game.sessionId,started.body.game.sessionId);
 assert.equal((await request({op:'start',reset:true})).status,410);
 const result=await request(turn());assert.equal(result.status,200);assert.equal(result.body.game.revision,1);
 assert.equal((await request()).body.game.revision,1);
});
