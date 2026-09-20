// Persistent, source-linked narrative memory; no hidden evolution is copied into
// the player's history. Retrieval is bounded, while the source ledger is kept.
const validText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const check=(v,msg)=>{if(!v)throw Error(`LAB_INVALID:memory ${msg}`);};
export function initializeMemory(s){
 s.memoryVersion=1;
 s.memoryJournal ||= [];
 if(!s.observationHistory){
  s.observationHistory=(s.notes||[]).map((text,i)=>{
   const event=(s.events||[]).find(e=>(e.steps||[]).some(t=>t.observations?.includes(text))||e.evolution?.observations?.includes(text));
   return {id:`legacy_note_${i}`,revision:event?.revision??null,text,source:'legacy_observation',knowledge:'player',temporal:'historical'};
  });
 }
 return s;
}
export function recordObservations(s,texts,revision,source){
 for(const text of texts){
  s.observationHistory.push({id:`observation_${revision}_${s.observationHistory.length}`,revision,text,source,knowledge:'player',temporal:'historical'});
  if(!s.notes.includes(text))s.notes.push(text);
 }
 s.notes=s.notes.slice(-16);
}
export function latestMemories(s){
 return [...new Map((s.memoryJournal||[]).map(m=>[m.id,m])).values()];
}
export function applyMemories(s,updates,playerText,outcomes,revision){
 check(Array.isArray(updates)&&updates.length<=4,'updates');
 const changed=new Set();
 for(const u of updates){
  check(u&&['commitment','plan','naming','discovery'].includes(u.kind),'kind');
  check(['active','fulfilled','superseded'].includes(u.status),'status');
  check(typeof u.id==='string'&&validText(u.quote,400),'quote');
  check(['player','observation'].includes(u.source)&&Number.isInteger(u.step),'source');
  check(Array.isArray(u.entity_ids)&&u.entity_ids.length<=8&&u.entity_ids.every(id=>s.entities.some(e=>e.id===id)),'entities');
  check(Array.isArray(u.place_ids)&&u.place_ids.length<=3&&u.place_ids.every(id=>['outside','threshold','chamber'].includes(id)),'places');
  const previous=u.id?latestMemories(s).find(m=>m.id===u.id):null;
  if(u.source==='player')check(u.step===-1&&playerText.includes(u.quote)&&u.kind!=='discovery','player source');
  else check(u.step>=0&&u.step<outcomes.length&&outcomes[u.step].observations.some(text=>text.includes(u.quote))&&(u.kind==='discovery'||previous),'observation source');
  if(u.id)check(previous&&!changed.has(u.id)&&previous.kind===u.kind,'identity');
  else check(u.status==='active','new status');
  const evidence={revision,role:u.source,step:u.step,quote:u.quote};
  const id=previous?.id||`memory_${revision}_${s.memoryJournal.length}`;
  changed.add(id);
  // Updating validity never rewrites the original claim or its provenance.
  s.memoryJournal.push(previous?{...previous,status:u.status,updatedRevision:revision,statusSource:evidence}:{id,kind:u.kind,content:u.quote,source:evidence,revision,updatedRevision:revision,status:u.status,entityIds:u.entity_ids,placeIds:u.place_ids,knowledge:'player',authority:u.source==='player'?'player_statement':'observed'});
 }
}
const families=[
 ['commitment',/约定|承诺|规矩|规则|答应|发誓|保证|约好/],
 ['plan',/打算|计划|准备|待办|下次|以后|到时/],
 ['naming',/命名|起名|名字|称呼|叫作|叫做|代号/],
];
const tokens=text=>new Set((String(text).toLowerCase().match(/[a-z0-9_]+|[\p{Script=Han}]{2,}/gu)||[]).flatMap(x=>/^[a-z0-9_]+$/.test(x)?[x]:Array.from({length:x.length-1},(_,i)=>x.slice(i,i+2))));
const overlap=(a,b)=>[...a].reduce((n,t)=>n+(b.has(t)?1:0),0);
const mentions=(text,e)=>text.includes(e.id)||text.includes(e.name)||e.name.split('与').some(name=>name.length>1&&text.includes(name.slice(-1)))||overlap(tokens(text),tokens(e.name))>0;
export function retrieveHistory(s,action=''){
 const query=tokens(action);
 const entityIds=s.entities.filter(e=>mentions(action,e)).map(e=>e.id);
 const kinds=families.filter(([,re])=>re.test(action)).map(([kind])=>kind);
 const temporal=/最初|最早|第一次|起初|刚出发|先前|之前|后来|当时|还记得|原来|曾经|回忆/.test(action);
 const earliest=/最初|最早|第一次|起初|刚出发/.test(action);
 const memories=latestMemories(s);
 const rankMemory=m=>overlap(query,tokens(m.content))*2+(m.entityIds.some(id=>entityIds.includes(id))?5:0)+(kinds.includes(m.kind)?8:0);
 const relevant=memories.map(m=>({m,score:rankMemory(m)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.m.revision-b.m.revision).slice(0,6).map(x=>x.m);
 const active=memories.filter(m=>m.status==='active'&&['commitment','plan','naming'].includes(m.kind)).sort((a,b)=>rankMemory(b)-rankMemory(a)||b.updatedRevision-a.updatedRevision).slice(0,8);
 const selected=[...new Map([...relevant,...active].map(m=>[m.id,m])).values()].slice(0,12);
 // Pair original input with its accepted narration; player wishes alone are not
 // evidence that the world changed. Legacy saves can use this without re-summarizing.
 const groups=new Map();
 for(const entry of s.log||[]){
  if(entry.turn<=0)continue;
  if(!groups.has(entry.turn))groups.set(entry.turn,{revision:entry.turn,messages:[]});
  groups.get(entry.turn).messages.push({role:entry.role,text:entry.text});
 }
 const rows=[...groups.values()].map(row=>{
  const player=row.messages.filter(m=>m.role==='player').map(m=>m.text).join('\n');
  const text=row.messages.map(m=>m.text).join('\n');
  const ids=entityIds.filter(id=>{const e=s.entities.find(e=>e.id===id);return mentions(player,e);});
  const category=kinds.some(kind=>families.find(f=>f[0]===kind)[1].test(text));
  return {...row,score:overlap(query,tokens(player))*2+Math.min(4,overlap(query,tokens(text)))+ids.length*4+(category?8:0),category,entityMatch:ids.length>0};
 }).filter(row=>row.score>1);
 const ordered=rows.sort((a,b)=>a.revision-b.revision), chosen=[];
 const take=row=>{if(row&&!chosen.some(r=>r.revision===row.revision)&&chosen.length<6)chosen.push(row);};
 // Preserve the origin as well as a later state. Only select matching evidence,
 // not an arbitrary first turn; add relevance-ranked material for ordinary queries.
 if(temporal){const matching=ordered.filter(r=>r.entityMatch||r.category);take(matching[0]);take(matching.at(-1));if(earliest)take(matching[1]);}
 for(const row of [...rows].sort((a,b)=>b.score-a.score||(earliest?a.revision-b.revision:b.revision-a.revision)))take(row);
 const history=chosen.sort((a,b)=>a.revision-b.revision).map(({revision,messages})=>({id:`log_${revision}`,revision,temporal:'historical',knowledge:'player',messages:messages.map(m=>({...m,text:m.text.slice(0,1800),truncated:m.text.length>1800}))}));
 return {memories:selected,history,retrieval:{method:'lexical_entity_kind_revision',totalTurns:groups.size,selectedTurns:history.map(h=>h.revision),totalMemories:memories.length,selectedMemories:selected.length,complete:false,notice:'这是有界检索，不是全部历史。未取回不等于从未发生；玩家原话是意图或声明，已发生结果以当轮叙述和结算为准。'}};
}
