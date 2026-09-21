import {ApiError} from '../fiction-service.js';
export function checkCoordination(state,proposal,actions){
 const fail=text=>{throw new ApiError(503,text,'ruling_invalid');};
 if(!Array.isArray(proposal.coordination)||proposal.coordination.length!==actions.length||new Set(proposal.coordination.map(c=>c.playerId)).size!==actions.length)fail('主持未核对每位队员的意图。');
 const moving=proposal.route.length>1,normalized=[];
 for(const action of actions){
  const c=proposal.coordination.find(c=>c.playerId===action.playerId);
  if(!c||!['current','standing','stay'].includes(c.basis))fail('队员授权记录无效。');
  if(action.hold&&moving)fail('原地观察的队员不能被整队带走。');
  let quote=action.text;
  if(c.basis==='standing'){
   const e=state.memory.entries.find(e=>e.id===c.agreementId&&e.kind==='agreement'&&e.status==='active'&&e.owner===action.playerId);
   if(!e||e.origin.actor!==action.playerId||proposal.route.some(id=>!e.places.includes(id)))fail('持续跟随授权缺失、过期或超出范围。');
   quote=e.origin.quote;
   if(proposal.memoryUpdates?.some(u=>u.id===e.id&&u.status!=='active'))fail('本轮已撤销或结束的约定不能继续授权移动。');
  }
  if(moving&&c.basis==='stay')fail('尚未取得全员移动授权，应留在当前场景承接可执行的行动。');
  normalized.push({playerId:action.playerId,basis:c.basis,agreementId:c.basis==='standing'?c.agreementId:'',quote});
 }
 return normalized;
}
