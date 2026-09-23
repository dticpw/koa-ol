// Blind, adaptive solo play. The player sees only the same public view as the
// browser. Hidden scenario data and host traces never enter its prompt.
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from './fiction-preview.mjs';
import {schema} from '../functions/_lib/multiplayer/service.js';
import {callModel} from '../functions/_lib/fiction-service.js';
import {stories} from '../functions/_lib/adventures/stories.js';
import {createAdventureEngine} from '../functions/_lib/adventures/engine.js';
import {createAdventureResolver} from '../functions/_lib/adventures/host.js';
import {hostProfile} from '../functions/_lib/fiction-models.js';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const out=path.resolve(args['--out']),story=stories[args['--story']||'library-delve'],model=args['--host-model']||'deepseek-flash',limit=Number(args['--rounds']||20);
if(!story)throw Error('Unknown story');hostProfile(model);
await fs.mkdir(out,{recursive:true});
const sql=new DatabaseSync(path.join(out,'budget.sqlite')),db=sqliteAdapter(sql);await db.batch(schema.map(q=>db.prepare(q)));
const env={...process.env,FICTION_DAILY_BUDGET_USD:'20'},engine=createAdventureEngine(story),resolve=createAdventureResolver(story,engine);
let state;try{state=JSON.parse(await fs.readFile(path.join(out,'state.json'),'utf8'));}catch{state=engine.createGame();state.hostModel=model;state.sessionId=crypto.randomUUID();}
if(state.hostModel!==model)throw Error('Cannot change an evaluation model midway');
let memory='';try{memory=await fs.readFile(path.join(out,'player-memory.txt'),'utf8');}catch{}
const rules='你是一位中文互动小说玩家，只知道开场和公开可见资料，不知道隐藏规则。认真体验探索、人物互动与解谜，最后依据冒险目标完成或自主放弃后实际离场。行为可以好奇、笨拙、幽默和带情绪，不是每轮都最高效。只能声明自己的尝试，不替主持决定结果，不凭空生成工具、线索、过去经历或NPC回应。卡住时换方法或自然求助，别无限重复。记住自己的借物、承诺和对话。每轮 action 为一段自然语言，最多260汉字；memory 只写亲见事实、未完成目的和重要关系，最多900汉字。输入的experienceCue只是测试玩家玩法的建议，不是世界事实，不要在角色行动中提测试。已有成果后可自然收尾，不为凑轮数强加支线。';
const format={type:'json_schema',name:'solo_player',strict:true,schema:{type:'object',properties:{action:{type:'string'},memory:{type:'string'}},required:['action','memory'],additionalProperties:false}};
const cues={3:'尝试和已在场的人轻松聊一句，内容不必推进任务。',6:'依据已见物品做一个可能不太聪明但不恶意破坏的尝试，只声明行动，不预定失败。',10:'自然回忆前面确实发生过的承诺、外号或失误；不要编造过去。',14:'如果卡住，直接向主持请求一个不过度剧透的提示；如果顺利，则照常行动。'};
let failures=0;
try{while(state.revision<limit&&state.status==='playing'){
 const n=state.revision+1;let player;
 try{player=JSON.parse(await fs.readFile(path.join(out,`input-${n}.json`),'utf8'));}catch{
  const view=engine.getView(state),trace={};
  try{const raw=await callModel(env,db,fetch,[{role:'developer',content:rules},{role:'user',content:JSON.stringify({opening:state.log[0]?.text,view:{...view,log:view.log.slice(-12)},memory,experienceCue:cues[n]||'按人物意愿和已见情况自然行动。'})}],{format,maxTokens:2200,timeoutMs:75000,requestTimeoutLimitMs:75000,traceCall:trace});player=JSON.parse(raw);if(typeof player.action!=='string'||[...player.action].length>300||!player.action.trim())throw Error('Invalid player action');await fs.writeFile(path.join(out,`driver-${n}.json`),JSON.stringify(trace,null,2));await fs.writeFile(path.join(out,`input-${n}.json`),JSON.stringify(player,null,2));}
  catch(e){await fs.writeFile(path.join(out,`driver-failure-${n}-${Date.now()}.json`),JSON.stringify({error:e.message,trace},null,2));throw e;}
 }
 memory=player.memory;await fs.writeFile(path.join(out,'player-memory.txt'),memory);await fs.writeFile(path.join(out,`checkpoint-${state.revision}.json`),JSON.stringify(state,null,2));
 const trace=[],checks=[],started=Date.now();
 try{
  const r=await resolve({state,body:{action:player.action,requestId:crypto.randomUUID()},diagnostic:x=>checks.push(x),call:async(input,options)=>{const t={phase:options.format?.name==='adventure_ruling'?'ruling':'review'};trace.push(t);return callModel(env,db,fetch,input,{...options,modelId:model,traceCall:t});}});
  state=r.state;failures=0;await fs.writeFile(path.join(out,`host-${n}.json`),JSON.stringify({durationMs:Date.now()-started,trace,checks},null,2));await fs.writeFile(path.join(out,'state.json'),JSON.stringify(state,null,2));await fs.writeFile(path.join(out,'playthrough.md'),'# 单人盲玩 · '+story.title+' · '+hostProfile(model).label+'\n\n'+state.log.map(e=>`## 第 ${e.turn} 段 · ${e.role}\n\n${e.text}\n`).join('\n'));console.log(JSON.stringify({round:state.revision,location:state.location,status:state.status,seconds:(Date.now()-started)/1000}));
 }catch(e){failures++;await fs.writeFile(path.join(out,`failure-${n}-${Date.now()}.json`),JSON.stringify({error:e.message,code:e.code,durationMs:Date.now()-started,trace,checks},null,2));console.log(JSON.stringify({round:n,error:e.code||e.message,attempt:failures}));if(failures>=2)throw e;}
}}catch(e){console.error(e.code||e.message);process.exitCode=1;}finally{await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({model,story:story.id,round:state.revision,status:state.status,location:state.location,ending:state.ending,spentMicro:sql.prepare('SELECT SUM(spent_micro) n FROM koa_fiction_budget').get().n,scope:'One model-simulated player; public view only. Spend includes the GPT player and failed reservations; see traces for host-only estimates.'},null,2));sql.close();}
