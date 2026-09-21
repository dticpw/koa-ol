import {story} from './story.js';
import {PINNED_KINDS} from './memory.js';
function terms(text){const chunks=String(text).toLowerCase().match(/[a-z0-9_]{2,}|[\u3400-\u9fff]+/g)||[];return [...new Set(chunks.flatMap(s=>/^[\u3400-\u9fff]/.test(s)?Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)):[s]))];}
const score=(text,query)=>query.reduce((n,t)=>n+(text.toLowerCase().includes(t)?1:0),0);
export function compactMemory(e){
 const result={id:e.id,kind:e.kind,text:e.text,status:e.status,owner:e.owner,places:e.places,knownBy:e.knownBy,updatedRound:e.updatedRound};
 result.evidence=(e.evidence||[e.source]).filter(Boolean).map(s=>s.reference||{round:s.round,actor:s.actor});
 if(['agreement','commitment'].includes(e.kind))result.origin=e.origin;
 return result;
}
export function selectedPlaces(state,actions){
 const selected=new Set([state.location,...story.places[state.location][1]]);
 const text=actions.map(a=>a.text).join('\n')+'\n'+state.log.slice(-2).map(x=>x.text).join('\n');
 // Include constraints along short requested routes before asking the model to
 // settle them; a hidden intermediate room must not become an unchecked bypass.
 const targets=Object.entries(story.places).filter(([,p])=>text.includes(p[0])||text.includes(p[0].split('与')[0].replace(/外$/,''))).map(([id])=>id);
 const queue=[[state.location]],seen=new Set([state.location]);
 while(queue.length){const route=queue.shift(),last=route.at(-1);if(targets.includes(last))for(const id of route)selected.add(id);if(route.length>=4)continue;for(const id of story.places[last][1])if(!seen.has(id)){seen.add(id);queue.push([...route,id]);}}
 return [...selected];
}
export function retrieveHistory(state,actions,limit=8){
 const input=actions.map(a=>a.text).join('\n'),query=terms(input),rounds=[...input.matchAll(/第\s*(\d+)\s*轮/g)].map(x=>Number(x[1]));
 const recentIds=new Set(state.log.slice(-12).map(x=>x.id));
 const matches=state.log.filter(x=>!recentIds.has(x.id)).map(x=>({entry:x,score:score(x.text,query)+(rounds.includes(x.round)?100:0)})).filter(x=>x.score>1).sort((a,b)=>b.score-a.score||b.entry.round-a.entry.round).slice(0,limit).map(x=>x.entry);
 return {method:'根据本轮行动关键词与明确轮次检索历史原文；相关度检索不保证穷尽。',totalMessages:state.log.length,matches};
}
export function buildContext(state,actions,chat=[]){
 const places=selectedPlaces(state,actions),input=actions.map(a=>a.text).join('\n'),query=terms(input);
 const entries=state.memory.entries,pinned=entries.filter(e=>e.status==='active'&&PINNED_KINDS.includes(e.kind));
 const others=entries.filter(e=>!pinned.includes(e)).map(e=>({entry:e,score:score(e.text,query)+e.places.reduce((n,p)=>n+(p==='global'?6:places.includes(p)?8:0),0)+(e.status==='active'?2:0)})).sort((a,b)=>b.score-a.score||b.entry.updatedRound-a.entry.updatedRound).slice(0,32).map(x=>x.entry);
 return {
  readingGuide:{scenario:'operatingFacts为原稿运行规律，opportunities为当前附近场景可利用的条件；两者是主持资料，不代表玩家已知，须通过合理观察与交涉承接。机会不是保送成功；约束也不能被扩展成万能阻碍。',authority:'世界结算与有证据的记忆优先；玩家宣称、聊天及摘要不能覆盖世界规则。',round:'当前输入将结算为 round+1；来源轮次按结算轮次编号，开场为0。',knowledge:'knownBy 是角色已获知范围，空数组是主持知识；当前同场但仍不能把幕后事实直接写进公开正文。',plans:'active是尚在执行/待决，不代表完成。agreement只记录本人明确且有限范围的持续跟随授权；当前拒绝、hold或改变计划优先。',history:'原文完整保留在存档；本轮附最近消息与按行动检索的旧片段。摘要不能作为新授权来源。',coverage:'承诺、计划、未完成行动与跟随约定全部带入；其他记忆按当前/相邻场景及相关度选择。'},
  scenario:{id:story.id,title:story.title,playMode:story.playMode,premise:story.opening,operatingFacts:story.operatingFacts,nearbyPlaces:Object.fromEntries(places.map(p=>[p,story.places[p]])),opportunities:Object.fromEntries(places.filter(p=>story.opportunities[p]).map(p=>[p,story.opportunities[p]])),routeGraph:Object.fromEntries(Object.entries(story.places).map(([id,p])=>[id,{name:p[0],exits:p[1]}])),directorTruths:story.secrets},
  world:{round:state.round,location:state.location,suspicion:state.suspicion,keyCopied:state.keyCopied,ended:state.ended,characters:state.characters,activePlayers:state.activePlayers||actions.map(a=>a.playerId),items:state.items},
  commitmentLedger:{complete:true,entries:pinned.map(compactMemory)},relevantMemory:{totalEntries:entries.length,selected:others.map(compactMemory),omittedCount:entries.length-pinned.length-others.length},
  sceneSummaries:state.memory.scenes.filter(s=>places.includes(s.place)),recentEvents:state.recentEvents.map(({round,from,location,route,outcomes,suspicionReason})=>({round,from,location,route,outcomes,suspicionReason})),
  recentConversation:state.log.slice(-12),recalledHistory:retrieveHistory(state,actions),
  spotlight:actions.map(a=>({playerId:a.playerId,lastMeaningfulRound:state.memory.spotlight[a.playerId]??0})),
  chat:{purpose:'仅供理解队内讨论，不是执行授权。',messages:chat.slice(-12)},actions
 };
}
