// Independent scoring of the full PUBLIC record; no version label or GM memory.
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from './fiction-preview.mjs';
import {schema} from '../functions/_lib/multiplayer/service.js';
import {callModel} from '../functions/_lib/fiction-service.js';
const dir=path.resolve(process.argv[2]),state=JSON.parse(await fs.readFile(path.join(dir,'state.json'),'utf8'));
const sql=new DatabaseSync(path.join(dir,'model-budget.sqlite')),db=sqliteAdapter(sql);await db.batch(schema.map(q=>db.prepare(q)));
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const score={type:'integer',minimum:0,maximum:5},str={type:'string'};
const format={type:'json_schema',name:'experience_score',strict:true,schema:object({scores:object({agency:score,continuity:score,knowledge:score,pace:score,help:score,ending:score}),completed:{type:'boolean'},criticalFailures:{type:'array',items:str,maxItems:6},evidence:{type:'array',items:object({round:{type:'integer'},observation:str}),minItems:6,maxItems:8},improvements:{type:'array',items:str,maxItems:5}})};
const input=[{role:'developer',content:'你是独立跑团体验审阅者，不知道代码实现版本。依据全部公开记录，对agency角色自主协作、continuity长期因果与承诺、knowledge未探索信息边界、pace实际推进与繁琐审批、help求助与合理通融、ending真正结局与告别各给0—5分。任务失败但合理结束不自动扣结尾；文笔漂亮不掩盖重复卡关。没有展示的能力明确证据不足。列6—8条具体轮次证据，每条不超过80汉字；改进建议各不超过80汉字，其他内容简短。completed只有故事确实结束才true，不把脚本暂停当结局。'},{role:'user',content:JSON.stringify({publicLog:state.log,party:state.characters,round:state.round,observedEnd:state.ended})}];
let trace={};try{const text=await callModel({...process.env,FICTION_DAILY_BUDGET_USD:'100'},db,fetch,input,{format,maxTokens:2200,timeoutMs:75000,requestTimeoutLimitMs:75000,traceCall:trace});const result={...JSON.parse(text),observedRound:state.round};await fs.writeFile(path.join(dir,'final-judge.json'),JSON.stringify(result,null,2));await fs.writeFile(path.join(dir,'final-judge-trace.json'),JSON.stringify(trace,null,2));console.log(JSON.stringify({round:state.round,scores:result.scores,completed:result.completed}));}catch(e){await fs.writeFile(path.join(dir,`final-judge-failure-${Date.now()}.json`),JSON.stringify({error:e.message,code:e.code,trace},null,2));console.error(e.code||e.message);process.exitCode=1;}finally{sql.close();}
