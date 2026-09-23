// Scores anonymized, caller-prepared public transcripts/cases. Output is an
// interpretation to audit, not an automatic release approval or human study.
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from './fiction-preview.mjs';
import {schema} from '../functions/_lib/multiplayer/service.js';
import {callModel} from '../functions/_lib/fiction-service.js';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const out=path.resolve(args['--out']),input=JSON.parse(await fs.readFile(args['--input'],'utf8')),label=args['--label']||'judge';
await fs.mkdir(out,{recursive:true});const sql=new DatabaseSync(path.join(out,'judge-budget.sqlite')),db=sqliteAdapter(sql);await db.batch(schema.map(q=>db.prepare(q)));
const str={type:'string'},score={anyOf:[{type:'integer',minimum:0,maximum:5},{type:'null'}]},obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const format={type:'json_schema',name:'ensemble_experience_judge',strict:true,schema:obj({samples:{type:'array',items:obj({id:str,scores:obj({pace:score,roleplay:score,proportionalConsequences:score,spotlight:score,agency:score,continuity:score}),issues:{type:'array',maxItems:5,items:obj({severity:{type:'string',enum:['blocker','improvement','uncertain']},evidence:str,reason:str})},memorableMoment:str,unobserved:str})},conclusion:str})};
const instructions=`你是独立的多人互动小说体验审阅者，不知道样本的实现版本。只根据给定原文和明确列出的审查标准评判，不把代码字段或样本数量当质量证据。0—5分，没展示的能力用null并说明；不要给统一满分替代逐项检查。
pace评估玩家真实意愿被承接的节奏，不等同于任务效率或越短越好。自愿聊天、演角色、争执或休息可以是好的节奏；重复要求已获授权、无新情况却停在普通门口才是问题。重要新风险、代价和不同意必须保留，不能为了提速删去。
roleplay检查无用动作/玩笑/情绪是否有具体贴切回应，是否被偷换为高效侦查或强塞线索；不要要求所有NPC搞笑或把笑话变成成功奖励。proportionalConsequences检查帮倒忙的实际因果：小错不自动全队被捕，实际报警也不轻描淡写抹掉；有条件的善后、求助可以得到温和回应，不强制惩罚证明风险。spotlight检查其他队员独立可执行的行动是否被一人抢戏吞掉，不要求同等字数。agency检查是否替同伴同意交物、移动、交易、反击或编造其过去/人格。continuity检查承诺、物品、外号、过失后果是否和原记录连续；前文不全时承认不确定。
逐个sample原样返回id。每个问题引用具体轮次或原句，区分已发生矛盾、可以更好以及证据不足。不给未展示的完整结局或长程能力背书；不能把测试停止当故事完结。memorableMoment只引已有的具体片段，没有就留空。输出简洁，避免所有样本套同一评论。`;
const trace={};try{const raw=await callModel({...process.env,FICTION_DAILY_BUDGET_USD:'20'},db,fetch,[{role:'developer',content:instructions},{role:'user',content:JSON.stringify(input)}],{format,maxTokens:3200,timeoutMs:120000,requestTimeoutLimitMs:120000,traceCall:trace});const result=JSON.parse(raw);if(result.samples.length!==input.samples.length||new Set(result.samples.map(s=>s.id)).size!==input.samples.length||result.samples.some(s=>!input.samples.some(x=>x.id===s.id)))throw Error('Judge omitted or invented a sample');await fs.writeFile(path.join(out,label+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}catch(e){await fs.writeFile(path.join(out,label+'-error.json'),JSON.stringify({code:e.code,error:e.message},null,2));process.exitCode=1;}finally{await fs.writeFile(path.join(out,label+'-trace.json'),JSON.stringify(trace,null,2));sql.close();}
