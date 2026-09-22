// Real-model release probes, isolated from production. Run with credential launcher.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from './fiction-preview.mjs';
import {schema} from '../functions/_lib/multiplayer/service.js';
import {createAdventure,resolveMultiplayer} from '../functions/_lib/multiplayer/host.js';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(0,i),a.slice(i+1)];}));
const out=path.resolve(args['--out']);await fs.mkdir(out,{recursive:true});
const sql=new DatabaseSync(path.join(out,'budget.sqlite')),db=sqliteAdapter(sql);await db.batch(schema.map(q=>db.prepare(q)));
const env={...process.env,FICTION_DAILY_BUDGET_USD:'20'},members=[{id:'Pgreen',name:'青禾'},{id:'Pink',name:'墨川'}];
let state=args['--checkpoint']?JSON.parse(await fs.readFile(args['--checkpoint'],'utf8')):createAdventure(members,'cooperative-v2');
const report={kind:args['--checkpoint']?'ending-replay':'new-game-and-semantic-veto',checks:[],source:args['--checkpoint']||'new session',revision:state.hostRevision};
async function run(label,texts,verify){
 const actions=texts.map((text,i)=>({...members[i],playerId:members[i].id,text,hold:false}));
 await fs.writeFile(path.join(out,label+'-before.json'),JSON.stringify(state,null,2));
 await fs.writeFile(path.join(out,label+'-input.json'),JSON.stringify(actions,null,2));
 for(let attempt=1;attempt<=2;attempt++){
  try{const started=Date.now(),r=await resolveMultiplayer({env,db,state,actions,chat:[]});
   await fs.writeFile(path.join(out,label+'-host.json'),JSON.stringify({durationMs:Date.now()-started,trace:r.trace},null,2));
   await fs.writeFile(path.join(out,label+'-state.json'),JSON.stringify(r.state,null,2));
   verify(r.state);state=r.state;report.checks.push(label);console.log(label,'passed');return;
  }catch(e){await fs.writeFile(path.join(out,`${label}-failure-${Date.now()}-${attempt}.json`),JSON.stringify({error:e.message,code:e.code,trace:e.trace||[]},null,2));if(e instanceof assert.AssertionError||attempt===2)throw e;}
 }
}
try{
 if(args['--checkpoint']){
  assert.ok(['dock','lift','guard'].includes(state.location));assert.equal(state.ended,false);
  const promises=state.memory.entries.filter(e=>e.kind==='commitment'&&e.status==='active'&&/铅笔/.test(e.text));assert.ok(promises.length,'fixture must contain the unfulfilled original pencil promise');
  const targetBefore=state.keyCopied;
  await run('return-without-reminder',['我确认同伴准备好后，沿已获准的返程路线前往码头，按原先约定发出灯光信号，待接应船靠近便登船返程，结束这趟冒险。','我同意一起返程，收好这次取得的记录，随青禾沿已获准的返程路线到码头，向接应船发信号并登船离开。'],next=>{
   assert.equal(next.ended,true);assert.equal(next.location,'escape');assert.equal(next.keyCopied,targetBefore);
   for(const e of promises)assert.equal(next.memory.entries.find(x=>x.id===e.id)?.status,'resolved');
   assert.match(next.log.at(-1).text,/铅笔/);
  });
 }else{
  await run('opening',['我在码头向船员借一截铅笔记录路线，答应这次任务结束返船时顺路归还；先观察厨工队伍，不急着出发。','接下来在码头、升降笼、入口警卫室、六边形走廊和厨房这段入职路线上，我同意跟随青禾；有新危险或重要选择先停下让我决定。'],next=>{
   assert.equal(next.location,'dock');assert.ok(next.memory.entries.some(e=>e.kind==='agreement'&&e.owner==='Pink'&&e.status==='active'));
   assert.ok(next.memory.entries.some(e=>e.kind==='commitment'&&e.owner==='Pgreen'&&/铅笔/.test(e.text)));
  });
  await run('semantic-veto',['我带着墨川一起登上升降笼，按换班路线去厨房。','我改变主意了：这一轮先留在码头检查制服，撤回刚才的跟随安排。请不要带我走，也不要替我作决定。'],next=>{
   assert.equal(next.location,'dock');assert.equal(next.ended,false);assert.equal(next.keyCopied,false);
   assert.ok(!next.memory.entries.some(e=>e.kind==='agreement'&&e.owner==='Pink'&&e.status==='active'));
  });
  await run('help',['我们有点卡住了，拜托给个根据眼前线索可以立刻尝试的办法吧。这轮我先听，不替同伴决定。','我也想听具体下一步，先留在原地核对身份，不自动执行建议。'],next=>{
   assert.equal(next.location,'dock');assert.equal(next.suspicion,1);assert.equal(next.keyCopied,false);
   assert.ok(next.journal.at(-1).outcomes.every(o=>o.text.trim()));
  });
  // Separate controlled scene, not presented as continuation of the long run.
  state=createAdventure(members,'cooperative-v2');state.location='council';
  state.log.push({id:'door-fixture',round:0,role:'host',name:'主持',text:'两人站在议事厅侧廊的典狱长办公室外。普通铁门上的魔法锁仍在，门前此刻无人，室内没有可听见的人声。任务地图可暂时压制附近一扇普通门的魔法锁；是否进去由你们决定。'});
  await run('source-door-fixture',['我明确同意现在试着潜入办公室。我使用任务地图短暂压制眼前普通铁门的魔法锁，轻推开门，和墨川一起进去后掩好门。愿承担正常潜入风险，不要求绝对安全。','我同意这次潜入，配合青禾留意侧廊动静，在地图压制门锁时一同进入并轻掩门。进屋后只观察柜子位置，不宣称已经打开柜子或拿到账册。'],next=>{
   assert.equal(next.location,'office');assert.equal(next.keyCopied,false);assert.equal(next.ended,false);
  });
  await run('unsupported-split',['我同意墨川独自去典狱长居室探查，我留在办公室不走，为他接应。我们都同意这个分队安排。','我同意分头行动，独自穿过议事厅深入典狱长居室搜寻，青禾留在办公室；等搜完我再返回与他会合。'],next=>{
   assert.equal(next.location,'office');assert.equal(next.keyCopied,false);
   assert.match(next.log.at(-1).text,/试玩|本版|不支持|不能分队/);
  });
 }
 report.passed=true;
}catch(e){report.passed=false;report.error=e.stack;process.exitCode=1;console.error(e.message);}
finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));sql.close();}
