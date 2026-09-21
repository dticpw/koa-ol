// Node 22+: node --test scripts/test-stats-location.mjs (no network/model calls).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import { onRequestGet } from '../functions/api/stats.js';
import { onRequestPost as chat } from '../functions/api/chat.js';
import { onRequestPost as proxy } from '../functions/ai/v1/responses.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE chat_logs (
    ts INTEGER, ip TEXT, country TEXT, user_agent TEXT, model TEXT,
    input_tokens INTEGER, output_tokens INTEGER, elapsed_ms INTEGER,
    history_len INTEGER, stage TEXT, error TEXT
  );`);
  // A pre-migration record and old-style inserts must both remain valid.
  db.exec("INSERT INTO chat_logs (ts, ip, country, stage) VALUES (1, '192.0.2.1', 'CN', 'success')");
  db.exec(read('../migrations/20260922-chat-log-location.sql'));
  const DB = { prepare(sql) {
    let params = [];
    return {
      bind(...values) { params = values; return this; },
      async run() { return db.prepare(sql).run(...params); },
      async first() { return db.prepare(sql).get(...params); },
      async all() { return { results: db.prepare(sql).all(...params) }; },
    };
  } };
  return { db, DB };
}

test('migration preserves history; aggregates retain totals and use latest location', async () => {
  const {db, DB} = database();
  try {
    db.exec(`INSERT INTO chat_logs (ts, ip, country, city, region, input_tokens, stage) VALUES
      (2, '192.0.2.1', 'CN', 'Hangzhou', 'Zhejiang', 10, 'success'),
      (3, '192.0.2.1', 'CN', 'Shanghai', 'Shanghai', 20, 'parse'),
      (4, '192.0.2.2', 'JP', NULL, NULL, 30, 'success');`);
    const response = await onRequestGet({request: new Request('https://test/api/stats?key=test'), env: {DB, STATS_PASSWORD:'test'}});
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.overall.total_requests, 4);
    assert.equal(data.overall.total_input_tokens, 60);
    assert.equal(data.per_ip[0].requests, 3);
    assert.equal(data.per_ip[0].errors, 1);
    assert.equal(data.per_ip[0].city, 'Shanghai');
    assert.equal(data.per_ip[0].region, 'Shanghai');
    assert.equal(data.recent.find(r => r.ts === 1).city, null);
    assert.equal(data.recent.find(r => r.ts === 2).city, 'Hangzhou');
    db.exec("INSERT INTO chat_logs (ts, ip, country) VALUES (5, '192.0.2.1', 'CN')");
    const updated = await (await onRequestGet({request: new Request('https://test/api/stats?key=test'), env: {DB, STATS_PASSWORD:'test'}})).json();
    assert.equal(updated.per_ip[0].city, null, 'do not reuse stale location for a newer unknown request');
  } finally { db.close(); }
});

test('stats authentication still precedes database access', async () => {
  const response = await onRequestGet({request:new Request('https://test/api/stats?key=wrong'), env:{STATS_PASSWORD:'test', DB:{prepare(){throw Error('must not query');}}}});
  assert.equal(response.status,401);
});

for (const [name, handler] of [['chat', chat], ['proxy', proxy]]) {
  for (const cf of [{city:'Hangzhou',region:'Zhejiang'}, undefined]) {
    test(`${name} logs ${cf ? 'trusted city/region' : 'missing metadata as null'} on errors`, async () => {
      const {db, DB} = database();
      try {
        const request = new Request('https://test/api', {method:'POST', headers:{Authorization:'Bearer test','CF-Connecting-IP':'192.0.2.99','CF-IPCountry':'CN','CF-IPCity':'spoofed'}, body:'invalid-json'});
        if (cf) Object.defineProperty(request,'cf',{value:cf});
        const pending=[];
        const response = await handler({request, env:{DB,CLIENT_API_KEYS:'test',UPSTREAM_API_KEY:'test'},waitUntil(p){pending.push(p);}});
        await Promise.all(pending);
        assert.equal(response.status,400);
        const row = db.prepare("SELECT * FROM chat_logs WHERE ip = '192.0.2.99'").get();
        assert.equal(row.city, cf?.city || null);
        assert.equal(row.region, cf?.region || null);
        assert.equal(row.stage,'parse');
      } finally { db.close(); }
    });
  }
}

test('location display escapes data, deduplicates regions, and labels missing cities', () => {
  const source=read('../assets/conversation/stats.js');
  const context=vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('        function escape'),source.indexOf('        // ===== 密码门')),context);
  assert.equal(context.formatLocation({country:'CN',region:'Shanghai',city:'Shanghai'}),'CN · Shanghai');
  assert.equal(context.formatLocation({country:'CN'}),'CN · 城市未记录');
  assert.equal(context.formatLocation({country:'XX'}),'城市未记录');
  assert.equal(context.formatLocation({country:'JP',city:'<img onerror="x">'}),'JP · &lt;img onerror=&quot;x&quot;&gt;');
});
