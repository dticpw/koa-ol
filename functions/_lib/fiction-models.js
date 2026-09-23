// Public IDs are an allowlist. A saved adventure pins one complete host profile.
export const DEFAULT_HOST_MODEL = 'gpt-5.6-sol';
const profiles = Object.freeze({
  'gpt-5.6-sol': {id:'gpt-5.6-sol', model:'gpt-5.6-sol', label:'GPT-5.6 Sol', effort:'low', protocol:'responses', key:'UPSTREAM_API_KEY'},
  'deepseek-flash': {id:'deepseek-flash', model:'deepseek-flash', label:'DeepSeek V4.1 Flash · High（试用）', effort:'high', protocol:'chat', key:'DEEPSEEK_API_KEY'},
});
export const knownHostModel = id => typeof id === 'string' && Object.hasOwn(profiles,id);
export function hostProfile(id = DEFAULT_HOST_MODEL) {
  if (!knownHostModel(id)) throw Error('Unknown fiction host model');
  return profiles[id];
}
export function hostView(state) {
  const p = hostProfile(state.hostModel || DEFAULT_HOST_MODEL);
  return {hostModel:p.id, model:p.model, modelLabel:p.label, reasoningEffort:p.effort};
}
export const hostOptions = env => Object.values(profiles).map(p=>({id:p.id,label:p.label,available:Boolean(env[p.key])}));

export function prepareHostRequest(env,input,{modelId=DEFAULT_HOST_MODEL,format,maxTokens=700}={}) {
  const profile=hostProfile(modelId),key=env[profile.key];
  if(profile.protocol==='responses'){
    const payload={model:profile.model,store:false,stream:false,reasoning:{effort:profile.effort},input,max_output_tokens:maxTokens};
    if(format)payload.text={format};
    return {profile,key,payload,url:`${(env.UPSTREAM_BASE_URL||'https://api.openai.com/v1').replace(/\/+$/,'')}/responses`,outputLimit:maxTokens};
  }
  // DeepSeek JSON mode does not enforce our schema. Supply the SAME schema as
  // serialization instructions, then validate locally before any state commit.
  const messages=input.map(m=>({role:m.role==='developer'?'system':m.role,content:m.content}));
  if(format){
    messages.unshift({role:'system',content:'只返回一个完整 JSON 对象，不用 Markdown 代码围栏。以下 JSON Schema 仅规定输出格式；遵守后续主持规则，不增加或改变剧情裁定。所有 required 字段都必须出现；空列表使用 []，不能省略；不得输出额外字段。JSON Schema：\n'+JSON.stringify(format.schema)+(format.schema.properties?.memoryUpdates||format.schema.properties?.corrections?'\n多人记忆字段说明：本轮同行先在 coordination 用 current 表达，agreementId 为空。只有明确需要跨轮沿用的持续授权才建立 agreement 记忆，不能把一次已完成的同行写成全队共用的长期授权。agreement 必须每位授权者单独一条，owner 是该玩家 ID，places 是具体地点 ID；active 时 evidence 恰好一项，引用本人本轮 action。resolved 的既有约定仍保留原 owner，第一项证据用本轮 outcome。普通共同经历可记 fact，不强行记 agreement。sceneSummary.place 使用地点 ID。复核如收到 draftValidation 错误，必须实际修正对应字段，不能只改叙述或把状态改 resolved 来绕过字段要求。只记录有后续意义的变化，不要求每轮每人都新增永久记忆。':'')});
  }
  if(['adventure_ruling','reviewed_narration'].includes(format?.name))messages[0].content+='\n剧本边界提醒：先对照 world（或 before）里的剧本 laws、milestones、实体 nature 与最新 facts，再裁定和复核。可补无关紧要的感官细节，但不能把临时装饰编成新人物、新案情、关键线索或新的解谜前提；玩家追问不存在的线索时给具体可见反馈并指回已有可行动依据。难以做到不等于剧本禁止，不能凭空增加魔法阻力、封锁或交易条件把可行方案堵死。NPC原有态度不等于每次拒答；根据真实知情范围和本次互动回应。复核发现新增关键事实缺乏原剧本或已确认事件依据时，应要求修正，不能因为草案已经写出就接受。';
  if(format?.name==='adventure_ruling')messages[0].content+='\n字段约束提醒：scope=communicate 的 updates 只能更新 kind=npc 的实体。边谈话边记笔记是允许的连贯行动，但应把记笔记单列为同轮 near 或 observe 步骤，再更新手记等记录载体；不能在 communicate 步骤更新手记。LAB_INVALID:communication target 指的是 updates 中混入了非NPC物件，并非仅 refs 错误；只删 refs 不能修复它。';
  if(format)messages[0].content+='\n以下只是 JSON 形状示例，值不代表本轮结论，不可照抄占位文字。具体动作、状态、ID和列表长度必须依据输入；不需要的列表用[]，不得仅为填表示例增加事件：\n'+JSON.stringify(schemaExample(format.schema));
  // Use one system message rather than relying on consecutive system-message
  // handling. Preserve every rule, including any retry instruction.
  const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n');
  const chatMessages=[...(system?[{role:'system',content:system}]:[]),...messages.filter(m=>m.role!=='system')];
  // max_tokens includes reasoning. Preserve the host's answer allowance and
  // add a bounded thinking allowance; do not silently truncate the JSON answer.
  const outputLimit=Math.min(24000,maxTokens+16384);
  const payload={model:profile.model,messages:chatMessages,stream:false,thinking:{type:'enabled'},reasoning_effort:profile.effort,max_tokens:outputLimit};
  if(format)payload.response_format={type:'json_object'};
  return {profile,key,payload,url:`${(env.DEEPSEEK_BASE_URL||'https://api.deepseek.com').replace(/\/+$/,'')}/chat/completions`,outputLimit};
}

function schemaExample(schema,key=''){
  if(schema.anyOf)return schemaExample(schema.anyOf.find(s=>s.type==='null')||schema.anyOf[0],key);
  if(Object.hasOwn(schema,'const'))return schema.const;
  if(schema.enum)return schema.enum[0];
  const type=Array.isArray(schema.type)?schema.type[0]:schema.type;
  if(type==='object')return Object.fromEntries((schema.required||Object.keys(schema.properties||{})).map(k=>[k,schemaExample(schema.properties[k],k)]));
  if(type==='array')return key==='steps'||schema.minItems>0?Array.from({length:Math.max(1,schema.minItems||0)},()=>schemaExample(schema.items)):[];
  if(type==='null')return null;
  if(type==='boolean')return false;
  if(type==='number'||type==='integer')return schema.minimum??0;
  return '按本轮实际填写';
}

const tokenCount=v=>Number.isSafeInteger(v)&&v>=0?v:null;
export function hostResponse(data,profile){
  const chat=profile.protocol==='chat',u=data.usage;
  const input=tokenCount(chat?u?.prompt_tokens:u?.input_tokens),output=tokenCount(chat?u?.completion_tokens:u?.output_tokens);
  const cached=tokenCount(chat?(u?.prompt_cache_hit_tokens??u?.prompt_tokens_details?.cached_tokens):u?.input_tokens_details?.cached_tokens);
  const reasoning=tokenCount(chat?u?.completion_tokens_details?.reasoning_tokens:u?.output_tokens_details?.reasoning_tokens);
  const usage=input!==null&&output!==null?{input_tokens:input,output_tokens:output,...(cached!==null&&cached<=input?{cached_input_tokens:cached}:{}),...(reasoning!==null?{reasoning_tokens:reasoning}:{})}:null;
  const text=chat?data.choices?.[0]?.message?.content:(typeof data.output_text==='string'?data.output_text:(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n'));
  return {text:typeof text==='string'?text:'',usage,incomplete:chat?data.choices?.[0]?.finish_reason!=='stop':data.status==='incomplete',error:Boolean(data.error)};
}

export function hostRates(profile,date=new Date(),reservation=false){
  if(profile.id===DEFAULT_HOST_MODEL)return {input:4,cached:4,output:20,basis:'reference-gpt-5.6-sol-uncached; upstream bill may differ'};
  const h=date.getUTCHours(),weekday=date.getUTCDay();
  const peak=reservation||weekday>=1&&weekday<=5&&(h>=1&&h<4||h>=6&&h<10);
  // Holiday discounts can only lower this estimate. Never invent billed cost.
  return peak?{input:0.30,cached:0.006,output:1.20,basis:'deepseek-official-peak-upper-bound; holidays may be half-price'}:{input:0.15,cached:0.003,output:0.60,basis:'deepseek-official-off-peak-estimate'};
}
export function estimateHostCost(usage,rates){
  const cached=usage.cached_input_tokens||0;
  return Math.ceil((usage.input_tokens-cached)*rates.input+cached*rates.cached+usage.output_tokens*rates.output);
}

// Covers the JSON Schema subset used by the fiction hosts. Fail closed for new
// unsupported keywords rather than pretending JSON mode enforces them.
export function validateHostJSON(value,schema,path='$'){
  const supported=new Set(['type','properties','required','additionalProperties','items','minItems','maxItems','enum','const','minLength','maxLength','minimum','maximum','description','title','anyOf','pattern']);
  if(Object.keys(schema).some(k=>!supported.has(k)))throw Error('Unsupported host schema keyword');
  if(schema.anyOf&&!schema.anyOf.some(s=>{try{validateHostJSON(value,s,path);return true;}catch{return false;}}))throw Error(path+': union');
  const types=Array.isArray(schema.type)?schema.type:[schema.type];
  const matches=t=>t===undefined||t==='null'&&value===null||t==='array'&&Array.isArray(value)||t==='object'&&value!==null&&typeof value==='object'&&!Array.isArray(value)||t==='integer'&&Number.isSafeInteger(value)||t==='number'&&typeof value==='number'&&Number.isFinite(value)||t==='string'&&typeof value==='string'||t==='boolean'&&typeof value==='boolean';
  if(!types.some(matches))throw Error(path+': type');
  if(schema.enum&&!schema.enum.some(v=>JSON.stringify(v)===JSON.stringify(value)))throw Error(path+': enum');
  if(Object.hasOwn(schema,'const')&&JSON.stringify(value)!==JSON.stringify(schema.const))throw Error(path+': const');
  if(typeof value==='string'&&(schema.minLength!==undefined&&[...value].length<schema.minLength||schema.maxLength!==undefined&&[...value].length>schema.maxLength))throw Error(path+': length');
  if(typeof value==='string'&&schema.pattern&&!new RegExp(schema.pattern,'u').test(value))throw Error(path+': pattern');
  if(typeof value==='number'&&(schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum))throw Error(path+': range');
  if(Array.isArray(value)){
    if(schema.minItems!==undefined&&value.length<schema.minItems||schema.maxItems!==undefined&&value.length>schema.maxItems)throw Error(path+': items');
    if(schema.items)value.forEach((v,i)=>validateHostJSON(v,schema.items,path+'['+i+']'));
  }else if(value!==null&&typeof value==='object'){
    if((schema.required||[]).some(k=>!Object.hasOwn(value,k)))throw Error(path+': missing required field');
    for(const [k,v]of Object.entries(value)){
      if(Object.hasOwn(schema.properties||{},k))validateHostJSON(v,schema.properties[k],path+'.'+k);
      else if(schema.additionalProperties===false)throw Error(path+': extra field');
      else if(schema.additionalProperties&&typeof schema.additionalProperties==='object')validateHostJSON(v,schema.additionalProperties,path+'.'+k);
    }
  }
  return value;
}
