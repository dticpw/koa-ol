// v1/v2 saves remain self-contained. v3 separates immutable history from hot state.
export const historySchema=`CREATE TABLE IF NOT EXISTS koa_fiction_multi_events (run_id TEXT NOT NULL, kind TEXT NOT NULL, seq INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(run_id,kind,seq))`;
export function prepareHistory(db,state){
 if(!state||state.version!==3)return {state,statements:[]};
 const hot=structuredClone(state),statements=[];let nextSeq=hot.logCount||0;
 const persisted=hot.historyCursor||{log:-1,journal:-1};
 for(const entry of hot.log){if(!Number.isInteger(entry.seq))entry.seq=nextSeq++;else nextSeq=Math.max(nextSeq,entry.seq+1);if(entry.seq>persisted.log)statements.push(db.prepare('INSERT INTO koa_fiction_multi_events(run_id,kind,seq,body) VALUES (?,?,?,?)').bind(hot.runId,'log',entry.seq,JSON.stringify(entry)));}
 for(const event of hot.journal)if(event.round>persisted.journal)statements.push(db.prepare('INSERT INTO koa_fiction_multi_events(run_id,kind,seq,body) VALUES (?,?,?,?)').bind(hot.runId,'journal',event.round,JSON.stringify(event)));
 hot.historyCursor={log:nextSeq-1,journal:Math.max(persisted.journal,...hot.journal.map(e=>e.round))};hot.logCount=nextSeq;hot.historyExternal=true;hot.log=hot.log.slice(-12);hot.journal=hot.journal.slice(-6);return {state:hot,statements};
}
export async function hydrateHistory(db,state){
 if(!state?.historyExternal)return state;
 const rows=(await db.prepare('SELECT kind,body FROM koa_fiction_multi_events WHERE run_id=? ORDER BY seq').bind(state.runId).all()).results||[];
 return {...state,log:rows.filter(r=>r.kind==='log').map(r=>JSON.parse(r.body)),journal:rows.filter(r=>r.kind==='journal').map(r=>JSON.parse(r.body))};
}
export async function historyPage(db,state,playerId,url){
 const paged=url.searchParams.get('window')==='1',before=Number(url.searchParams.get('before')),after=Number(url.searchParams.get('after'));
 const upper=url.searchParams.has('before')&&Number.isSafeInteger(before)&&before>=0?before:Infinity;
 const lower=url.searchParams.has('after')&&Number.isSafeInteger(after)&&after>=-1?after:-1;
 let log,total=state.logCount||state.log.length,hasOlder=false;
 if(state.historyExternal){
  const scope=state.version===3?" AND EXISTS (SELECT 1 FROM json_each(body,'$.audience') WHERE value=?)":"";
  const bounds=[state.runId,lower,Number.isFinite(upper)?upper:2147483647,...(state.version===3?[playerId]:[])];
  const ascending=!paged||url.searchParams.has('after');
  const rows=(await db.prepare("SELECT seq,body FROM koa_fiction_multi_events WHERE run_id=? AND kind='log' AND seq>? AND seq<?"+scope+' ORDER BY seq '+(ascending?'ASC':'DESC')+(paged?' LIMIT 41':'')).bind(...bounds).all()).results||[];
  hasOlder=paged&&rows.length>40;
  log=(paged?rows.slice(0,40):rows).map(r=>JSON.parse(r.body));if(!ascending)log.reverse();
  if(state.version===3)total=(await db.prepare("SELECT count(*) n FROM koa_fiction_multi_events WHERE run_id=? AND kind='log'"+scope).bind(state.runId,playerId).first()).n;
 }else{
  log=state.log.map((e,seq)=>({...e,seq})).filter(e=>e.seq>lower&&e.seq<upper);
  if(state.version===3)log=log.filter(e=>e.audience?.includes(playerId));
  hasOlder=paged&&log.length>40;
  if(paged)log=url.searchParams.has('after')?log.slice(0,40):log.slice(-40);
 }
 return {log,history:{total,hasOlder,first:log[0]?.seq??null,last:log.at(-1)?.seq??null}};
}
