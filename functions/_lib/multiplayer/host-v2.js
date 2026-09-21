import {callModel,ApiError} from '../fiction-service.js';
import {story} from './story.js';
import {createAdventure as legacyAdventure} from './host-v1.js';
import {emptyMemory,applyMemory,MEMORY_KINDS} from './memory.js';
import {buildContext,compactMemory} from './context.js';
import {checkCoordination} from './coordination.js';
import {RULES,REVIEW_RULES} from './rules.js';
const str={type:'string'},bool={type:'boolean'},integer={type:'integer'};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const list=(items,maxItems)=>({type:'array',items,maxItems});
const enumeration=values=>({type:'string',enum:values});
export const proposalSchema=object({destination:enumeration(Object.keys(story.places)),route:list(enumeration(Object.keys(story.places)),4),suspicionDelta:{type:'integer',minimum:-1,maximum:2},suspicionReason:str,keyCopied:bool,ended:bool,
 coordination:list(object({playerId:str,basis:enumeration(['current','standing','stay']),agreementId:str}),6),
 outcomes:list(object({playerId:str,kind:enumeration(['progress','observation','blocked','waiting','help']),text:str}),6),
 items:list(object({id:str,name:str,owner:str,condition:str}),8),removeItems:list(str,8),
 memoryUpdates:list(object({id:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,70}$'},kind:enumeration(MEMORY_KINDS),text:str,status:enumeration(['active','resolved','cancelled']),owner:str,places:list(str,8),knownBy:list(str,6),evidence:list(object({round:integer,kind:enumeration(['action','outcome']),playerId:str}),4)}),12),
 sceneSummary:object({place:str,text:str})});
const correctionsSchema=object(Object.fromEntries(Object.entries(proposalSchema.properties).map(([key,value])=>[key,{anyOf:[value,{type:'null'}]}])));
const reviewSchema=object({consistent:bool,reason:str,narration:str,corrections:correctionsSchema});
export function schemasFor(state){
 const ids=state.characters.map(c=>c.id),proposal=structuredClone(proposalSchema);
 // These are party inventory/identity fields, not arbitrary NPC names. Expose
 // the same constraint to both model passes instead of discovering it after
 // a long generation and rejecting an otherwise valid turn.
 proposal.properties.items.items.properties.owner=enumeration(ids);
 for(const key of ['coordination','outcomes'])proposal.properties[key].items.properties.playerId=enumeration(ids);
 const memory=proposal.properties.memoryUpdates.items.properties;
 memory.owner=enumeration(['',...ids]);memory.knownBy.items=enumeration(ids);
 memory.evidence.items.properties.playerId=enumeration(ids);
 const review=structuredClone(reviewSchema);
 review.properties.corrections=object(Object.fromEntries(Object.entries(proposal.properties).map(([key,value])=>[key,{anyOf:[value,{type:'null'}]}])));
 return {proposal,review};
}
export function createAdventure(members){const initial=legacyAdventure(members);initial.log[0].text=story.opening+'\n\n'+story.playMode;return {...initial,version:2,hostRevision:'cooperative-v2',storyRevision:'prisoner-13-cooperative-v2',memory:emptyMemory(),journal:[]};}
const fail=text=>{throw new ApiError(503,text,'ruling_invalid');};
export function applyCorrections(proposal,corrections={}){
 if(!corrections||Array.isArray(corrections)||typeof corrections!=='object'||Object.keys(corrections).some(k=>!Object.hasOwn(proposalSchema.properties,k)))fail('复核修订格式无效。');
 return {...structuredClone(proposal),...Object.fromEntries(Object.entries(structuredClone(corrections)).filter(([,value])=>value!==null))};
}
export function applyRuling(state,p,actions){
 const next=structuredClone(state),ids=new Set(state.characters.map(c=>c.id));
 if(!p||!Array.isArray(p.outcomes)||p.outcomes.length!==actions.length||new Set(p.outcomes.map(o=>o.playerId)).size!==actions.length||actions.some(a=>!p.outcomes.some(o=>o.playerId===a.playerId)))fail('主持遗漏或混淆了队员的行动。');
 if(p.outcomes.some(o=>!['progress','observation','blocked','waiting','help'].includes(o.kind)||typeof o.text!=='string'||!o.text.trim()||o.text.length>1500))fail('队员行动结果无效。');
 if(!Array.isArray(p.route)||!p.route.length||p.route.length>4||p.route[0]!==state.location||p.route.at(-1)!==p.destination||p.route.some((id,i)=>!story.places[id]||i>0&&!story.places[p.route[i-1]]?.[1].includes(id)))fail('主持路线缺少真实连通路径。');
 const coordination=checkCoordination(state,p,actions);
 if(!Number.isInteger(p.suspicionDelta)||p.suspicionDelta< -1||p.suspicionDelta>2||typeof p.suspicionReason!=='string'||p.suspicionReason.length>600||p.suspicionDelta!==0&&!p.suspicionReason.trim())fail('警戒变化缺少依据。');
 if(typeof p.keyCopied!=='boolean'||typeof p.ended!=='boolean')fail('故事状态无效。');
 if(!state.keyCopied&&p.keyCopied&&!['cells','yard','meeting'].includes(state.location)&&!['cells','yard','meeting'].includes(p.destination))fail('不在可接触目标的位置，不能直接取得钥匙纹样。');
 if(p.ended&&p.destination!=='escape')fail('尚未实际撤离，不能直接结局。');
 if(!Array.isArray(p.items)||p.items.length>8||!Array.isArray(p.removeItems)||p.removeItems.length>8||new Set(p.items.map(i=>i.id)).size!==p.items.length||p.removeItems.some(id=>!state.items.some(i=>i.id===id)))fail('物品更新无效。');
 next.items=next.items.filter(i=>!p.removeItems.includes(i.id));
 for(const item of p.items){if(!/^[a-zA-Z0-9_-]{1,90}$/.test(item.id)||!ids.has(item.owner)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||typeof item.condition!=='string'||item.condition.length>600)fail('物品归属或内容无效。');const i=next.items.findIndex(x=>x.id===item.id);if(i<0)next.items.push(item);else next.items[i]=structuredClone(item);}
 if(next.items.length>120)fail('本局物品记录已达到试玩容量。');
 next.round++;next.location=p.destination;next.suspicion=Math.max(1,Math.min(6,state.suspicion+p.suspicionDelta));next.keyCopied=state.keyCopied||p.keyCopied;next.ended=p.ended;
 applyMemory(state,next,p,actions);
 const event={round:next.round,from:state.location,location:next.location,route:[...p.route],outcomes:structuredClone(p.outcomes),suspicionReason:p.suspicionReason,memoryIds:p.memoryUpdates.map(m=>m.id),coordination};
 next.journal.push(event);next.recentEvents=next.journal.slice(-6);return next;
}
export async function resolveMultiplayer({env,db,state,actions,chat=[],fetchImpl=fetch}){
 const deadline=Date.now()+150000,trace=[],context=buildContext(state,actions,chat),schemas=schemasFor(state);
 const invoke=async(input,format,maxTokens)=>{const t={};trace.push(t);return callModel(env,db,fetchImpl,input,{format,maxTokens,timeoutMs:75000,requestTimeoutLimitMs:75000,deadlineAt:deadline,traceCall:t});};
 let issue=null;
 try{for(let attempt=0;attempt<2;attempt++){
  const raw=await invoke([{role:'developer',content:RULES},{role:'user',content:JSON.stringify({...context,...(issue?{correction:issue}:{})})}],{type:'json_schema',name:'cooperative_ruling_v2',strict:true,schema:schemas.proposal},4200);
  let p,next,draftIssue=null;try{p=JSON.parse(raw);}catch{if(attempt===0&&Date.now()+20000<deadline){issue='输出结构无效';continue;}throw new ApiError(503,'主持结算格式异常，本轮进度未改变。','ruling_invalid');}
  try{next=applyRuling(state,p,actions);}catch(e){draftIssue=e instanceof ApiError?e.message:'候选格式无效';}
  const reviewed=await invoke([{role:'developer',content:REVIEW_RULES},{role:'user',content:JSON.stringify({context,sceneConstraints:story.places,sceneOpportunities:story.opportunities,proposed:p,draftValidation:draftIssue||'程序检查通过；尚未提交',after:next?{location:next.location,items:next.items,keyCopied:next.keyCopied,ended:next.ended,changedMemory:next.memory.entries.filter(e=>e.updatedRound===next.round).map(compactMemory)}:null})}],{type:'json_schema',name:'cooperative_review_v2',strict:true,schema:schemas.review},3600);
  let r;try{r=JSON.parse(reviewed);}catch{r={consistent:false,reason:'复核格式异常'};}
  if(r.consistent!==true||typeof r.narration!=='string'||!r.narration.trim()||r.narration.length>5000){issue=r.reason||'叙述与结算不一致';if(attempt===0&&Date.now()+20000<deadline)continue;throw new ApiError(503,'主持复核发现矛盾，本轮进度未改变，可重试。','ruling_invalid');}
  // Both model outputs are drafts. The reviewer repairs the candidate once;
  // every corrected field then passes the same full checks before any commit.
  try{p=applyCorrections(p,r.corrections||{});next=applyRuling(state,p,actions);}catch(e){issue=e instanceof ApiError?e.message:'复核修订未通过程序验证';if(attempt===0&&Date.now()+20000<deadline)continue;throw new ApiError(503,'主持修订需要调整，本轮进度未改变。','ruling_invalid');}
  next.log.push(...actions.map(a=>({id:crypto.randomUUID(),round:next.round,role:'player',playerId:a.playerId,name:a.name,text:a.text})),{id:crypto.randomUUID(),round:next.round,role:'host',name:'主持',text:r.narration});next.drafts={};
  if(new TextEncoder().encode(JSON.stringify(next)).length>1500000)throw new ApiError(409,'本局记录已达到存档容量，请导出故事后结束。','story_limit');
  return {state:next,trace};
 }}catch(e){e.trace=trace;throw e;}
 throw new ApiError(503,'主持暂时无法完成本轮。','ruling_invalid');
}
