import { ApiError } from './fiction-service.js';
export function createTurnResolver({engine,HOST,NARRATOR,proposalFormat,narrationFormat,deadlineMs=90000,callTimeoutMs=45000,reviewContext=x=>x}){
 const {hostContext,getActions,applyProposal}=engine;
// At most one corrected proposal. Every attempt starts from the same saved state.
// Diagnostics deliberately omit player text, narrative, credentials and cookie tokens.
return async function resolveTurn({state,body,call,diagnostic=entry=>console.warn('fiction_lab_adjudication',JSON.stringify(entry))}){
 const action=body.action?.trim()||getActions(state).find(a=>a.id===body.choiceId)?.label;
 if(!action)throw new ApiError(400,'这条建议已经过时，请刷新后再试。','invalid_choice');
 const before=hostContext(state,action),deadline=Date.now()+deadlineMs;
 let correction;
 const invoke=async(input,options)=>{
  const remaining=deadline-Date.now();
  if(remaining<1500)throw new ApiError(503,'主持暂时没有回应，进度未改变。请稍后重试。','model_unavailable');
  const result=await call(input,{...options,timeoutMs:Math.min(callTimeoutMs,remaining),deadlineAt:deadline});
  if(Date.now()>=deadline)throw new ApiError(503,'主持暂时没有回应，进度未改变。请稍后重试。','model_unavailable');
  return result;
 };
 const report=(attempt,phase,code)=>diagnostic({requestId:body.requestId,revision:state.revision,attempt:attempt+1,phase,code});
 try{
  for(let attempt=0;attempt<2;attempt++){
   const raw=await invoke([{role:'developer',content:HOST},{role:'user',content:JSON.stringify({world:before,player_action:action,...(correction?{correction:{instruction:'上次候选未提交。仅纠正指出的问题，从同一行动前世界重新裁定；不重复结算、不改变玩家目的，也不杜撰道具来迎合复核。',...correction}}:{})})}],{format:proposalFormat,maxTokens:4200});
   let proposal,applied;
   try{
    proposal=JSON.parse(raw);
    if(!proposal.decision)throw Error('LAB_INVALID:missing decision');
    if(!Array.isArray(proposal.memory_updates))throw Error('LAB_INVALID:missing memories');
    if(!proposal.evolution)throw Error('LAB_INVALID:missing evolution');
    applied=applyProposal(state,proposal,action);
   }catch(error){
    const code=/^LAB_INVALID:[a-z ]+$/.test(error.message)?error.message:'invalid proposal format';
    report(attempt,'proposal',code);
    correction={previous_proposal:proposal||null,issue:code,...(error.details?{details:error.details}:{})};
    if(attempt===0)continue;
    throw new ApiError(503,'主持本轮的行动记录仍未通过检查，进度未改变。请重试这次尝试。','adjudication_failed');
   }
   const memoryChanges=applied.state.memoryJournal.slice(state.memoryJournal?.length||0);
   const after=hostContext(applied.state,action);
   // The reviewer must see every change even when it is unrelated to the query.
   // Selected memory is not the entire ledger; keep the same bounded context.
   after.memories=[...new Map([...memoryChanges,...after.memories].map(m=>[m.id,m])).values()].slice(0,12);
   after.retrieval.selectedMemories=after.memories.length;
   const reviewInput=reviewContext({player_action:action,before,confirmed_steps:applied.outcomes,decision:applied.state.pendingDecision,memory_changes:memoryChanges,evolution:applied.evolution,after,ending:applied.state.ending});
   const rawNarrative=await invoke([{role:'developer',content:NARRATOR},{role:'user',content:JSON.stringify(reviewInput)}],{format:narrationFormat,maxTokens:2200});
   let result;try{result=JSON.parse(rawNarrative);}catch{result={consistent:false,issue:'复核响应不是完整JSON',issue_code:'other'};}
   if(!result||Array.isArray(result)||typeof result!=='object')result={consistent:false,issue:'复核响应不是有效对象',issue_code:'other'};
   if(result.consistent!==true||typeof result.narration!=='string'||!result.narration.trim()){
    const allowed=['intent','causality','time','state','agency','observation','other'];
    report(attempt,'review',allowed.includes(result.issue_code)?result.issue_code:'other');
    correction={previous_proposal:proposal,issue:typeof result.issue==='string'?result.issue.slice(0,1200):'复核缺少有效叙述'};
    if(attempt===0)continue;
    throw new ApiError(503,'主持对本轮后果的描述仍有矛盾，进度未改变，请重试。','adjudication_failed');
   }
   applied.state.log.push({role:'narrator',turn:applied.state.turn,text:result.narration.slice(0,2400)});
   if(Date.now()>=deadline)throw new ApiError(503,'主持暂时没有回应，进度未改变。请稍后重试。','model_unavailable');
   return {state:applied.state};
  }
 }catch(error){
  if(error.code==='budget_exhausted')throw new ApiError(429,'今日主持额度已用完，当前存档保留。请明天继续。','budget_exhausted');
  if(error.code==='model_unavailable')throw new ApiError(503,'主持暂时没有回应，进度未改变。请稍后重试。','model_unavailable');
  throw error;
 }
}

}
