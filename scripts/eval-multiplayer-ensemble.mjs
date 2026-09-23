// One blind model simulates three distinct players, including inefficient choices and mischief.
// Local evaluation only; not human-user proof or a production save migration.
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {callModel} from '../functions/_lib/fiction-service.js';
import {createAdventure,resolveMultiplayer} from '../functions/_lib/multiplayer/host.js';
import {sqliteAdapter} from './fiction-preview.mjs';
import {schema} from '../functions/_lib/multiplayer/service.js';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const out=path.resolve(args['--out']),revision=args['--revision']||'cooperative-v4',maxRounds=Number(args['--rounds']||40);
await fs.mkdir(out,{recursive:true});const sql=new DatabaseSync(path.join(out,'model-budget.sqlite')),db=sqliteAdapter(sql);await db.batch(schema.map(q=>db.prepare(q)));
const env={...process.env,FICTION_DAILY_BUDGET_USD:'20'},members=[{id:'Pgreen',name:'青禾'},{id:'Pink',name:'墨川'},{id:'Pbell',name:'阿铃'}];
let state,memory='';try{state=JSON.parse(await fs.readFile(path.join(out,'state.json'),'utf8'));}catch{state=createAdventure(members,revision);}
if(state.hostRevision!==revision)throw Error('Cannot change a running evaluation host');
try{memory=await fs.readFile(path.join(out,'player-memory.txt'),'utf8');}catch{}
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),str={type:'string'};
const format={type:'json_schema',name:'blind_ensemble_players',strict:true,schema:object({memory:str,actions:{type:'array',minItems:3,maxItems:3,items:object({playerId:{type:'string',enum:members.map(m=>m.id)},text:str,hold:{type:'boolean'}})}})};
const hooks={3:'本轮至少一人想和在场的人或同伴闲聊开玩笑，内容可以对任务毫无帮助。其他两人继续各自真实意愿，不必全桌陪笑。',6:'阿铃想逞能或做一个轻率的小尝试：依据眼前已经出现的普通物品和条件，选择可能添点麻烦的行为。只声明尝试，不编造成功或失败，不把危险报警器当无害道具。',9:'本轮墨川或阿铃对同伴提出的下一步有一点真实犹豫或不同意，说明具体想法；其他人可商量但不能代替他答应。不要伪装成三个人实际都同意。',12:'本轮至少一人主动回忆前面真实发生的玩笑、关系或乌龙，看它是否仍有影响；没有这类事件就聊聊角色感受，不凭空造过去。',16:'若此刻安全，一人想缓一缓，聊点与委托无关的事。可以不推进任务。若眼前确有紧急危险，先处理危险，不强插笑话。'};
const rules=`你扮演同桌三位玩家，只能依据提供的公开叙述、各人随身物品及你们自己的记忆，不知道主持幕后设定。目标是体验这次冒险，并最终实际带成果撤离或明确放弃后离场，不要求最少轮数。青禾礼貌且在乎同伴，愿意绕一点路听人说话；墨川谨慎爱较真，有时不想冒险，但不是每轮都拒绝；阿铃好奇爱玩、偶尔逞能、会尴尬求助，也会认真帮忙，不是永久反派或专职破坏者。三个人不是任务优化器，也不是每轮固定一个逗哏一个捧哏。允许无用聊天、临时起意、笨办法、意见分歧和情感回应；别让每句话末尾都变成侦查线索。所有人有独立意愿，不能冒充另一人同意、交物或移动。角色可以尝试不聪明的事，不能自行指定主持必须判失败或NPC必须发怒。不要随意袭击队友或进行完全脱离冒险的无限破坏。结合眼前物品与NPC行动，不凭空长出工具、魔法和线索。
每人一段自然语言，一般60—180汉字，上限260字。一次可描述有条件的连贯动作与停止点；已授权普通行程不用人为一门一轮。需要同行请本人明确意愿，拒绝也明确。hold仅表示真的坚持原地，不能一面hold一面宣称跟随。受到具体阻碍后可以换方法或请求帮助，不永远重复审批或无意义试错；主持没回应某件事可自然追问，但别把所有闲聊都视为失败。
得到重要结果后记住自己的承诺、借物、外号、NPC态度和队友反应；同伴有过失可以生气或善后，不抹掉它，也不要求完美通关。玩家memory只能记录已见事实与本人计划，<=6000字。测试导演的本轮体验提示只决定你们想尝试什么，不是世界事实，不能写进角色行动、不能要求主持演出指定结果。若故事接近离场，自然告别与收尾，不为了凑轮数再加支线。`;
async function driver(round){
 if(round===1)return {memory,actions:[
 {playerId:'Pgreen',text:'我留在码头向卸货船员借一截铅笔记事，答应回来登船时顺路归还，顺便问问替班厨工跟谁走。',hold:false},
 {playerId:'Pink',text:'我查看掌心地图，记住入口与厨房方向；如果青禾跟正常替班队伍走，我同意沿码头、升降笼、入口警卫室、六边形走廊到厨房这一整段同行，有新危险或重要代价时先停下让我决定。',hold:false},
 {playerId:'Pbell',text:'我把外套领子立得像个贵族，故意一本正经向同伴自称“见习大厨”，请他们以后叫我铃大厨，然后笑着看看大家反应。我还留在码头，没有替自己决定出发。',hold:false}]};
 const trace={};const input=[{role:'developer',content:rules},{role:'user',content:JSON.stringify({party:members,opening:state.log[0].text,recentPublicLog:state.log.slice(-24),inventory:state.items.filter(i=>members.some(m=>m.id===i.owner)),memory,round,experienceCue:hooks[round]||'本轮按人物性格和已见情况自然行动；可以认真做事，也可以接住同伴的情绪或玩笑。不必每轮表演失误。'})}];
 try{const text=await callModel(env,db,fetch,input,{format,maxTokens:2600,timeoutMs:75000,requestTimeoutLimitMs:75000,traceCall:trace});await fs.writeFile(path.join(out,`driver-${round}.json`),JSON.stringify(trace,null,2));const p=JSON.parse(text);if(new Set(p.actions.map(a=>a.playerId)).size!==3||p.actions.some(a=>!members.some(m=>m.id===a.playerId)||a.text.length>600))throw Error('Invalid player output');return p;}catch(e){e.trace=[trace];throw e;}
}
let consecutiveFailures=0;
try{while(state.round<maxRounds&&!state.ended){
 const round=state.round+1,file=path.join(out,`input-${round}.json`);let p;
 try{p=JSON.parse(await fs.readFile(file,'utf8'));}catch{try{p=await driver(round);await fs.writeFile(file,JSON.stringify(p,null,2));}catch(e){await fs.writeFile(path.join(out,`driver-failure-${round}-${Date.now()}.json`),JSON.stringify({code:e.code,error:e.message,trace:e.trace||[]},null,2));throw e;}}
 memory=p.memory;await fs.writeFile(path.join(out,'player-memory.txt'),memory);await fs.writeFile(path.join(out,`checkpoint-${state.round}.json`),JSON.stringify(state,null,2));
 const actions=p.actions.map(a=>({...a,name:members.find(m=>m.id===a.playerId).name})),started=Date.now();
 try{const r=await resolveMultiplayer({env,db,state,actions,chat:[]});state=r.state;await fs.writeFile(path.join(out,`host-${round}.json`),JSON.stringify({durationMs:Date.now()-started,trace:r.trace},null,2));await fs.writeFile(path.join(out,'state.json'),JSON.stringify(state,null,2));await fs.writeFile(path.join(out,'playthrough.md'),'# 三人混合玩法 · 模型模拟记录\n\n'+state.log.map(x=>`## 第 ${x.round} 轮 · ${x.name}\n\n${x.text}\n`).join('\n'));consecutiveFailures=0;console.log(JSON.stringify({revision,round,location:state.location,keyCopied:state.progress.keyCopied,ended:state.ended,seconds:(Date.now()-started)/1000,turnEnd:state.journal.at(-1).turnEnd}));}
 catch(e){consecutiveFailures++;await fs.writeFile(path.join(out,`failure-${round}-${Date.now()}.json`),JSON.stringify({code:e.code,error:e.message,durationMs:Date.now()-started,trace:e.trace||[]},null,2));console.log(JSON.stringify({round,error:e.code||e.message,attempt:consecutiveFailures}));if(consecutiveFailures>=2)throw e;await new Promise(r=>setTimeout(r,10000));}
 }}catch(e){console.error(e.code||e.message);process.exitCode=1;}finally{const files=await fs.readdir(out);await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({revision,round:state.round,ended:state.ended,location:state.location,keyCopied:state.progress.keyCopied,totalFailureFiles:files.filter(f=>/^(driver-)?failure-/.test(f)).length,spentMicro:(await db.prepare('SELECT SUM(spent_micro) n FROM koa_fiction_budget').first()).n,scope:'Three model-simulated players. Experience cues predeclared, no GM secrets in player driver.'},null,2));sql.close();}
