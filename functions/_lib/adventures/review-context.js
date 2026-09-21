// Lossless at the world-field level: unchanged fields inherit from before.
// Never choose evidence by the model's refs alone: authored/evolution changes count too.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function compactReviewContext(input){
 const {before,after}=input,patch={},entityChanges={};
 for(const [key,value] of Object.entries(after)){
  if(equal(value,before[key]))continue;
  if(['entities','knownEntities'].includes(key)){
   const old=new Map(before[key].map(e=>[e.id,e]));
   entityChanges[key]={upsert:value.filter(e=>!equal(e,old.get(e.id))).map(e=>{
    const prior=old.get(e.id);return prior?Object.fromEntries(Object.entries(e).filter(([k,v])=>k==='id'||!equal(v,prior[k]))):e;
   }),removed:before[key].filter(e=>!value.some(x=>x.id===e.id)).map(e=>e.id)};
  }else if(['recent','recentEvents','notes','history'].includes(key)){
   // Before already contains prior excerpts; current action, settled steps and
   // observations are supplied separately. Include any newly retrieved evidence.
   const additions=value.filter(v=>!(before[key]||[]).some(old=>equal(old,v)));
   if(additions.length)patch[key]=additions;
  }else patch[key]=value;
 }
 const steps=input.confirmed_steps||[];
 const stage=steps.length===6&&steps.at(-1).status==='partial'&&input.decision?.needed
  ? {kind:'execution_limit',executed_steps:6,remaining_action:input.decision.pending_action,
     review_rule:'执行预算已用完。允许在自然场景节点保存真实前缀和未执行尾段；这是一轮阶段性结果，不以尾段尚未执行、没有新增危险或再次邀请继续本身判为intent/agency错误。仍检查前缀与授权是否一致、停点是否自然、是否虚报完成或漏掉此前必要操作。叙述不提技术预算。'}
  :null;
 return {...input,context_format:'world_delta_v1',after:patch,entity_changes:entityChanges,...(stage?{stage_boundary:stage}:{})};
}
