// Private, real-model integration test. Costs API credit; uses isolated local SQLite.
// Never points at production rooms or consumes a real visitor's save.
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {callModel} from '../functions/_lib/fiction-service.js';
import {createAdventure,resolveMultiplayer} from '../functions/_lib/multiplayer/host.js';
import {sqliteAdapter} from './fiction-preview.mjs';
import {schema} from '../functions/_lib/multiplayer/service.js';
import {story} from '../functions/_lib/multiplayer/story.js';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const out=path.resolve(args['--out']||'eval-output'),revision=args['--revision']||'cooperative-v2',suite=args['--suite']||'cooperation',maxRounds=Number(args['--rounds']||32);
await fs.mkdir(out,{recursive:true});const sql=new DatabaseSync(path.join(out,'model-budget.sqlite'));const db=sqliteAdapter(sql);await db.batch(schema.map(q=>db.prepare(q)));
const env={...process.env,FICTION_DAILY_BUDGET_USD:process.env.FICTION_EVAL_DAILY_BUDGET_USD||'20'};
const members=[{id:'Pgreen',name:'青禾'},{id:'Pink',name:'墨川'}];
let state;try{state=JSON.parse(await fs.readFile(path.join(out,'state.json'),'utf8'));}catch{state=createAdventure(members,revision);}
let playerMemory='';try{playerMemory=await fs.readFile(path.join(out,'player-memory.txt'),'utf8');}catch{}
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),str={type:'string'};
const playerSchema=object({memory:str,actions:{type:'array',minItems:2,maxItems:2,items:object({playerId:{type:'string',enum:members.map(m=>m.id)},text:str,hold:{type:'boolean'}})}});
const playerRules=`你扮演两位真实玩家，协力游玩一篇潜入互动小说。桌面公开规则：${story.playMode}只能依据给你的公开叙述与随身物品，不知道幕后设定。目标是实际取得委托需要的开锁方法、记录下来，再沿实际路线撤离并结束；不要满足于只知道方法在哪里。两人的说法要分别代表各自意愿。用简短自然语言，每人每轮最多220字，允许合理连贯行动，不用代码、不能命令主持修改字段。青禾擅长礼貌交涉，墨川偏观察、记笔记与提醒风险；每个人都应做有用的事。墨川初期会授权在指定普通路线跟随，授权有效时可专注观察，不必重复写跟随；进入新区域时再明确自己的意愿。不得替另一人同意交易。遇到前提未满足先满足条件，连续两轮受阻就明确求助要具体下一步，不无限试同一件事。这是潜入冒险，不限于申请行政许可。连续两次申请同类差事受拒就改换方法，依据已看见的人物、路线、地图能力和工具考虑谈判、借用、伪装、引开注意、潜行或实际解锁；可以承担合理风险，但不强迫同伴、不凭空成功。不要反复追问同一套文书审批流程。不凭空有钥匙、许可或武器；NPC不在场时请求合理安排。要主动推进真正目标，别因“先观察”耗尽所有轮次。得到关键物后尽早归还借用物并撤离；需要夜间接应可明确安全等到夜间并发出约定信号。只在明显合理时顺路收尾。memory保存你们从正文得到的重要线索、承诺、约定、路线与待办，<=5000字，不能添加未获知内容。`;
const judgeSchema=object({scores:object({agency:{type:'integer'},continuity:{type:'integer'},knowledge:{type:'integer'},pace:{type:'integer'},help:{type:'integer'},ending:{type:'integer'}}),completed:{type:'boolean'},criticalFailures:{type:'array',items:str},evidence:{type:'array',items:object({round:{type:'integer'},observation:str})},improvements:{type:'array',items:str}});
async function driver(){
 if(state.round===0)return {memory:playerMemory,actions:[{playerId:'Pgreen',text:'我先观察替班厨工跟谁走，向在场船员借一小截铅笔记事，答应本次委托结束回来登船时顺路归还。',hold:false},{playerId:'Pink',text:'我查看地图和掩护身份。接下来在码头、升降笼、入口警卫室、六边形走廊和厨房这段普通入职路线上，我同意跟着青禾移动；若出现危险或要付重要代价，先停下让我决定。',hold:false}]};
 if(state.round===1)return {memory:playerMemory,actions:[{playerId:'Pgreen',text:'我按刚才看到的换班流程跟厨工登上升降笼，不擅自离队。',hold:false},{playerId:'Pink',text:'我留意吊索和周围人的动作，记下入口检查要注意的事。',hold:false}]};
 if(suite==='friction'&&state.round===2)return {memory:playerMemory,actions:[{playerId:'Pgreen',text:'我想让大家直接去典狱长办公室，把可能有用的文件都拿出来，墨川也跟我走吧。',hold:false},{playerId:'Pink',text:'我先留在这里观察，不接受这个安排。',hold:true}]};
 if(suite==='friction'&&state.round===3)return {memory:playerMemory,actions:[{playerId:'Pgreen',text:'刚才想得太急了，我们有点卡住了，帮帮忙吧。按眼前线索，具体该怎么自然通过下一道检查？我先听建议。',hold:false},{playerId:'Pink',text:'我也想听一个明确可做的建议；先观察，不自动执行重要决定。',hold:true}]};
 const trace={};
 const raw=await callModel(env,db,fetch,[{role:'developer',content:playerRules},{role:'user',content:JSON.stringify({party:members,memory:playerMemory,opening:state.log[0].text,recentPublicLog:state.log.slice(-18),inventory:state.items.filter(i=>members.some(m=>m.id===i.owner)),round:state.round,reminder:state.round>24?'已经经历较长冒险，请积极收束，完成或明确放弃后实际撤离。':'推进委托，同时尊重同伴与承诺。'})}],{format:{type:'json_schema',name:'blind_players',strict:true,schema:playerSchema},maxTokens:2200,timeoutMs:60000,traceCall:trace}).catch(e=>{e.trace=[trace];throw e;});
 await fs.writeFile(path.join(out,`driver-${state.round+1}.json`),JSON.stringify(trace,null,2));const p=JSON.parse(raw);
 if(new Set(p.actions.map(a=>a.playerId)).size!==2||p.actions.some(a=>a.text.length>600))throw Error('invalid player driver');return p;
}
let errors=0;
while(state.round<maxRounds&&!state.ended){
 const round=state.round+1,turnFile=path.join(out,`input-${round}.json`);let p;try{p=JSON.parse(await fs.readFile(turnFile,'utf8'));}catch{try{p=await driver();await fs.writeFile(turnFile,JSON.stringify(p,null,2));}catch(e){errors++;await fs.writeFile(path.join(out,`driver-failure-${round}-${Date.now()}.json`),JSON.stringify({code:e.code,error:e.message,trace:e.trace||[]},null,2));console.log(JSON.stringify({suite,round,driverError:e.code||e.message,attempt:errors}));if(errors>=2)break;continue;}}
 playerMemory=p.memory;await fs.writeFile(path.join(out,'player-memory.txt'),playerMemory);
 const actions=p.actions.map(a=>({...a,name:members.find(m=>m.id===a.playerId).name}));state.activePlayers=members.map(m=>m.id);
 await fs.writeFile(path.join(out,`checkpoint-${state.round}.json`),JSON.stringify(state,null,2));
 const start=Date.now();try{
  const r=await resolveMultiplayer({env,db,state,actions,chat:[]});state=r.state;
  await fs.writeFile(path.join(out,`host-${round}.json`),JSON.stringify({durationMs:Date.now()-start,trace:r.trace},null,2));
  await fs.writeFile(path.join(out,'state.json'),JSON.stringify(state,null,2));
  await fs.writeFile(path.join(out,'playthrough.md'),'# 多人主持试玩记录\n\n'+state.log.map(x=>`## 第 ${x.round} 轮 · ${x.name}\n\n${x.text}\n`).join('\n'));
  console.log(JSON.stringify({suite,revision,round:state.round,location:state.location,keyCopied:state.progress?.keyCopied??state.keyCopied,ended:state.ended,seconds:Math.round((Date.now()-start)/1000),memory:state.memory?.entries.length}));errors=0;
 }catch(e){errors++;await fs.writeFile(path.join(out,`failure-${round}-${Date.now()}-${errors}.json`),JSON.stringify({code:e.code,error:e.message,trace:e.trace||[]},null,2));console.log(JSON.stringify({suite,round,error:e.code||e.message,attempt:errors}));if(errors>=2)break;}
}
const evaluationInput={publicLog:state.log,party:members,observedEnd:state.ended,round:state.round};
try{const t={};const raw=await callModel(env,db,fetch,[{role:'developer',content:'你是独立的跑团体验评分者，不知道实现版本。只依据给出的逐轮公开记录，按0—5分评分：agency角色自主与协作，continuity长程因果与承诺，knowledge不泄漏未探索信息，pace有效推进而非无限审批，help求助与合理通融，ending实际收束与告别体验。没演示某能力给中间分并明确证据不足，不得当作已通过。至少列5个具体轮次证据，指出严重问题及可执行改进。completed必须实际结束，不把测试停止当结局。不要因文笔漂亮忽略状态矛盾。'},{role:'user',content:JSON.stringify(evaluationInput)}],{format:{type:'json_schema',name:'experience_score',strict:true,schema:judgeSchema},maxTokens:2400,timeoutMs:60000,traceCall:t});await fs.writeFile(path.join(out,'judge.json'),JSON.stringify(JSON.parse(raw),null,2));await fs.writeFile(path.join(out,'judge-trace.json'),JSON.stringify(t,null,2));}catch(e){console.log('judge failed',e.code||e.message);}
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({revision,suite,round:state.round,ended:state.ended,keyCopied:state.progress?.keyCopied??state.keyCopied,location:state.location,errors,spentMicro:(await db.prepare('SELECT SUM(spent_micro) AS n FROM koa_fiction_budget').first()).n},null,2));sql.close();
