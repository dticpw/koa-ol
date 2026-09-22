import {ApiError} from '../../fiction-service.js';
export const MEMORY_KINDS=['fact','clue','relationship','commitment','plan','pending','agreement'];
export const PINNED_KINDS=['commitment','plan','pending','agreement'];
const fail=text=>{throw new ApiError(503,text,'ruling_invalid');};
export const emptyMemory=()=>({entries:[],scenes:[],spotlight:{}});
// Evidence points to exact submitted speech or an adjudicated outcome. Summaries
// and chat can never manufacture a player's authorization.
export function evidenceExists(state,actions,proposal,source){
 if(!source||!Number.isInteger(source.round)||source.round<0||typeof source.quote!=='string'||!source.quote.trim()||source.quote.length>1500)return false;
 if(source.round===state.round+1){
  const texts=source.actor==='host'?proposal.outcomes.map(o=>o.text):actions.filter(a=>a.playerId===source.actor).map(a=>a.text);
  return texts.some(t=>t.includes(source.quote));
 }
 return state.log.some(x=>x.round===source.round&&(source.actor==='host'?x.role==='host':x.role==='player'&&x.playerId===source.actor)&&x.text.includes(source.quote))
  ||(state.journal||[]).some(e=>e.round===source.round&&source.actor==='host'&&e.outcomes.some(o=>o.text.includes(source.quote)));
}
export function resolveEvidence(state,actions,proposal,ref){
 const party=state.scenes[state.sceneId].participants;
 if(!party.includes(ref?.playerId))fail('不能引用另一场景的未共享行动或事件。');
 if(!ref||!Number.isInteger(ref.round)||ref.round<1||!['action','outcome'].includes(ref.kind)||!state.characters.some(p=>p.id===ref.playerId))fail('记忆引用了不存在的行动或事件。');
 let quote;
 if(ref.kind==='action')quote=ref.round===state.round+1?actions.find(a=>a.playerId===ref.playerId)?.text:state.log.find(x=>x.round===ref.round&&x.role==='player'&&x.playerId===ref.playerId)?.text;
 else quote=ref.round===state.round+1?proposal.outcomes.find(o=>o.playerId===ref.playerId)?.text:state.journal?.find(e=>e.round===ref.round)?.outcomes.find(o=>o.playerId===ref.playerId)?.text;
 if(!quote)fail('记忆引用了不存在的行动或事件。');
 return {round:ref.round,actor:ref.kind==='action'?ref.playerId:'host',quote,reference:{...ref}};
}
export function applyMemory(state,next,proposal,actions,story){
 const memory=structuredClone(state.memory||emptyMemory()),ids=new Set(state.characters.map(p=>p.id));
 if(!Array.isArray(proposal.memoryUpdates)||proposal.memoryUpdates.length>12)fail('主持记忆更新格式无效。');
 const seen=new Set();
 for(const raw of proposal.memoryUpdates){
  const update=structuredClone(raw);
  // New proposals cite existing records. Keep exact-quote decoding for replay
  // of earlier candidate traces; both formats are checked against real records.
  let sources;
  if(Array.isArray(update.evidence)){
   if(!update.evidence.length||update.evidence.length>4)fail('记忆需要1至4项明确事件引用。');
   sources=update.evidence.map(ref=>resolveEvidence(state,actions,proposal,ref));update.source=sources[0];delete update.evidence;
  }else sources=[update.source];
  if(!update||!/^[a-zA-Z0-9_-]{1,70}$/.test(update.id)||seen.has(update.id)||!MEMORY_KINDS.includes(update.kind)||typeof update.text!=='string'||!update.text.trim()||update.text.length>1000||!['active','resolved','cancelled'].includes(update.status))fail('主持记忆条目无效。');
  seen.add(update.id);
  if(!Array.isArray(update.places)||update.places.length>8||update.places.some(p=>p!=='global'&&!story.places[p])||!Array.isArray(update.knownBy)||update.knownBy.some(id=>!ids.has(id))||!['',...ids].includes(update.owner))fail('主持记忆范围或归属无效。');
  if(!evidenceExists(state,actions,proposal,update.source))fail('记忆缺少可核对的原话或事件依据。');
  const previous=memory.entries.find(e=>e.id===update.id);
  if(previous&&(previous.kind!==update.kind||previous.owner!==update.owner))fail('不能用同一记忆编号改写条目归属或类型。');
  if(update.kind==='commitment'&&update.status==='active'&&update.owner&&update.source.actor!=='host'&&update.source.actor!==update.owner)fail('不能把别人的提议记成本人的承诺。');
  if(update.kind==='agreement'){
   if(update.status==='active'&&sources.length!==1)fail('跟随授权只能来自本人一项明确声明。');
   if(!ids.has(update.owner)||!update.places.length||update.places.includes('global'))fail('持续跟随约定必须有本人和具体场景范围。');
   if(update.status==='active'&&(update.source.actor!==update.owner||update.source.round!==state.round+1))fail('新增或重新授权的约定必须来自本人本轮声明。');
   if(update.status==='cancelled'&&update.source.actor!==update.owner)fail('不能代替其他队员撤销约定。');
  }
  if(update.status==='resolved'&&(update.source.actor!=='host'||update.source.round!==state.round+1))fail('已完成事项必须有本轮实际结果，意图不等于完成。');
  if(!['event','claim','inference'].includes(update.basis))fail('记忆需要区分事实、人物说法与推测。');
  if(update.basis==='event'&&sources.some(s=>s.actor!=='host'))fail('已发生事件需要结算依据，不能只引用行动意图。');
  const entry={...structuredClone(update),origin:previous?.origin||structuredClone(update.source),updatedRound:state.round+1};
  if(update.kind==='agreement'&&update.status==='active')entry.origin=structuredClone(update.source);
  entry.evidence=[...(previous?.evidence||[]),...structuredClone(sources)].slice(-4);
  const index=memory.entries.findIndex(e=>e.id===entry.id);if(index<0)memory.entries.push(entry);else memory.entries[index]=entry;
 }
 if(memory.entries.length>600)fail('本局记忆已达到试玩容量，请先保存故事。');
 const summary=proposal.sceneSummary;
 if(!summary||![state.location,next.location].includes(summary.place)||typeof summary.text!=='string'||summary.text.length>1000||!summary.text.trim())fail('场景摘要无效。');
 const record={...summary,round:next.round,audience:[...state.scenes[state.sceneId].participants]},index=memory.scenes.findIndex(s=>s.place===summary.place);
 if(index<0)memory.scenes.push(record);else memory.scenes[index]=record;
 for(const outcome of proposal.outcomes)if(['progress','observation','help'].includes(outcome.kind))memory.spotlight[outcome.playerId]=next.round;
 // Scope expiry is deterministic. A stale follow instruction cannot carry its
 // owner out of the agreed area on a later turn.
 for(const e of memory.entries)if(e.kind==='agreement'&&e.status==='active'&&!e.places.includes(next.positions[e.owner]))e.status='expired';
 next.memory=memory;
}
