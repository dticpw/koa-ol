import {ApiError} from '../../fiction-service.js';
const fail=text=>{throw new ApiError(409,text,'scene_conflict');};
export function sceneFor(state,playerId){
 const scene=Object.values(state.scenes).find(s=>s.participants.includes(playerId));
 if(!scene)fail('角色没有有效的场景。');return scene;
}
export function assertParticipants(state,sceneId,actions){
 const scene=state.scenes[sceneId],ids=actions.map(a=>a.playerId);
 if(!scene||scene.location!==state.location||scene.participants.some(id=>state.positions[id]!==scene.location))fail('场景位置与角色位置不一致。');
 if(!scene||ids.length!==scene.participants.length||new Set(ids).size!==ids.length||scene.participants.some(id=>!ids.includes(id)))fail('本场参与者与行动不一致。');
 return scene;
}
export function validateRoute(story,location,route){
 if(!Array.isArray(route)||!route.length||route.length>4||route[0]!==location||route.some((p,i)=>!story.places[p]||i>0&&!story.places[route[i-1]][1].includes(p)))fail('路线缺少真实连接。');
}
export function visibleLog(log,playerId){return log.filter(e=>e.audience?.includes(playerId));}
// Architecture probe / future mode boundary. Caller supplies authenticated,
// explicit decisions; this is not exposed as a production split-party endpoint.
export function regroup(state,groups,consents,story){
 const next=structuredClone(state),ids=state.characters.map(c=>c.id),members=groups.flatMap(g=>g.participants);
 if(members.length!==ids.length||new Set(members).size!==ids.length||ids.some(id=>!members.includes(id))||new Set(groups.map(g=>g.id)).size!==groups.length)fail('分组必须完整且不重复。');
 next.scenes={};
 for(const group of groups){
  if(!/^[a-zA-Z0-9_-]{1,50}$/.test(group.id)||!group.participants.length||!story.places[group.location])fail('场景无效。');
  for(const id of group.participants){const consent=consents.find(c=>c.playerId===id);if(!consent||consent.destination!==group.location||consent.hold&&state.positions[id]!==group.location)fail('缺少本人明确的分组授权。');validateRoute(story,state.positions[id],consent.route);if(consent.route.at(-1)!==group.location)fail('目的地不一致。');next.positions[id]=group.location;}
  next.scenes[group.id]=structuredClone(group);
 }next.sceneId=groups[0].id;next.location=groups[0].location;return next;
}
export function transferItem(state,itemId,holder,actorId){
 const next=structuredClone(state),item=next.items.find(i=>i.id===itemId);
 if(!item||item.owner!==actorId||!next.characters.some(c=>c.id===holder)||next.positions[holder]!==next.positions[actorId])fail('交接需要物品持有人在场并授权。');
 item.owner=holder;return next;
}

// Limit one scene's working context. Canon remains GM-only; other scene events
// cannot silently become this scene's narration or evidence.
export function projectScene(state){
 const scene=state.scenes[state.sceneId],party=new Set(scene.participants),audible=e=>e.audience?.some(id=>party.has(id));
 const known=e=>e.knownBy?.some(id=>party.has(id))||!e.knownBy?.length&&(e.places.includes(scene.location)||e.places.includes('global'));
 return {...state,location:scene.location,characters:state.characters.filter(c=>party.has(c.id)),activePlayers:[...party],
  items:state.items.filter(i=>party.has(i.owner)||i.owner==='place:'+scene.location||i.owner.startsWith('npc:')),
  log:state.log.filter(audible),journal:state.journal.filter(audible),recentEvents:state.recentEvents.filter(audible),
  memory:{...state.memory,entries:state.memory.entries.filter(known),scenes:state.memory.scenes.filter(audible)}};
}
