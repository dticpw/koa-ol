// A separate, session-scoped learning record. Never fed back into model context.
export const traceSchema = [
  `CREATE TABLE IF NOT EXISTS koa_fiction_traces (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, revision INTEGER NOT NULL, action TEXT NOT NULL, status TEXT NOT NULL, trace_json TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS koa_fiction_traces_session ON koa_fiction_traces(session_id,id)`,
  `CREATE INDEX IF NOT EXISTS koa_fiction_traces_expiry ON koa_fiction_traces(expires_at)`
];
export async function traceList(db, sessionId, before, now) {
  const row = await db.prepare(`SELECT json_group_array(json_object('id',id,'revision',revision,'action',action,'status',status,'createdAt',created_at)) AS entries FROM (SELECT id,revision,action,status,created_at FROM koa_fiction_traces WHERE session_id=? AND id<? AND expires_at>? ORDER BY id DESC LIMIT 21)`).bind(sessionId,before,now).first();
  const entries=JSON.parse(row?.entries||'[]');
  return {entries:entries.slice(0,20),nextBefore:entries.length>20?entries[19].id:null};
}
export async function traceDetail(db, sessionId, id, now) {
  const row=await db.prepare(`SELECT trace_json FROM koa_fiction_traces WHERE session_id=? AND id=? AND expires_at>?`).bind(sessionId,id,now).first();
  return row?JSON.parse(row.trace_json):null;
}
export async function saveTrace(db, sessionId, trace) {
  const now=Date.now();
  // Failure here must never undo a committed game turn or mask its error.
  try {
    await db.prepare(`DELETE FROM koa_fiction_traces WHERE id IN (SELECT id FROM koa_fiction_traces WHERE expires_at<=? LIMIT 100)`).bind(now).run();
    await db.prepare(`INSERT INTO koa_fiction_traces(session_id,revision,action,status,trace_json,created_at,expires_at) VALUES (?,?,?,?,?,?,?)`).bind(sessionId,trace.revision,trace.action,trace.status,JSON.stringify(trace),trace.createdAt,now+7*86400000).run();
  } catch { console.warn('fiction_trace_storage_unavailable'); }
}
