// Fixed release probes. Synthetic setups are labeled; only ending uses a real v2 checkpoint.
// Explicit conversion here is evaluation-only, never a production save migration.
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from './fiction-preview.mjs';
import {schema} from '../functions/_lib/multiplayer/service.js';
import {createAdventure,resolveMultiplayer} from '../functions/_lib/multiplayer/host.js';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(0,i),a.slice(i+1)];}));
const out=path.resolve(args['--out']),repeats=Number(args['--repeats']||2),revision=args['--revision']||'cooperative-v3';
await fs.mkdir(out,{recursive:true});const sql=new DatabaseSync(path.join(out,'budget.sqlite')),db=sqliteAdapter(sql);await db.batch(schema.map(q=>db.prepare(q)));
const env={...process.env,FICTION_DAILY_BUDGET_USD:'40'},members=[{id:'Pgreen',name:'青禾'},{id:'Pink',name:'墨川'}],ids=members.map(m=>m.id);
function position(s,p){s.location=p;if(s.version===3){s.scenes.main.location=p;s.positions=Object.fromEntries(ids.map(id=>[id,p]));}return s;}
function setup(p,text){const s=position(createAdventure(members,revision),p);s.log.push({id:'setup',round:0,role:'host',name:'主持',text,...(s.version===3?{audience:ids}:{})});return s;}
function convert(s){if(revision==='cooperative-v2')return s;const n={...structuredClone(s),...Object.fromEntries(['version','hostRevision','storyId','storyRevision','sceneId','scenes','positions','attention'].map(k=>[k,createAdventure(members,revision)[k]])),progress:{keyCopied:s.keyCopied}};delete n.keyCopied;position(n,s.location);n.log.forEach(e=>e.audience=ids);n.journal.forEach(e=>{e.sceneId='main';e.audience=ids;});n.recentEvents=n.journal.slice(-6);n.memory.entries.forEach(e=>e.basis=e.source?.actor==='host'?'event':'claim');n.memory.scenes.forEach(e=>e.audience=ids);return n;}
const goal=s=>s.version===3?s.progress.keyCopied:s.keyCopied;
const cases=[
 {id:'granted-permission',make:()=>setup('kitchen','厨师长与当值守卫已核准：两人现在可共同推餐车，沿六边形走廊去放风庭院交接饮水。身份已验，庭院接收员在门口等候。沿途此刻没有新危险。'),actions:['我按已经核准的路线推着餐车去放风庭院，把饮水交给接收员。','我同意同行，帮忙稳住餐车并一起交接饮水。'],check:s=>s.location==='yard'&&!goal(s)},
 {id:'hard-cell-limit',make:()=>setup('cells','两人在13号牢房栅栏外，守卫允许正常送餐时短暂说话。反魔法场仍有效，栅门关闭，没人取得控制枢纽的授权。'),actions:['我试着用任务地图压制眼前牢房栅门的锁，想带同伴进去看看。','我同意试验地图，观察门有没有松开；不攻击也不宣称开门成功。'],check:s=>s.location==='cells'&&!goal(s)&&!s.ended},
 {id:'creative-connected-action',make:()=>{const s=setup('dock','码头石地上的火盆已熄灭，旁边有一块干燥旧棉布和几段细木柴，可供厨工取暖。');s.items.push({id:'dry_cloth',name:'干燥旧棉布',owner:ids[0],condition:'刚拿到手，干燥可燃。'});return s;},actions:['我用工具包里的火种盒点燃旧棉布，再把它放入石地上的火盆并添几根细柴，看看能不能暖手。','我留在一旁帮忙挡海风，留意火星别飞到大家的衣服上。'],check:s=>s.location==='dock'&&!s.items.some(i=>i.id==='dry_cloth'&&/刚拿到手/.test(i.condition))},
 {id:'help-without-punishment',make:()=>createAdventure(members,revision),actions:['我们有点不知道怎么办了，拜托告诉我眼前有什么可马上尝试的办法。我先听建议。','我也想听具体下一步，先留在码头观察，不替大家执行建议。'],check:s=>s.location==='dock'&&s.suspicion===1&&!goal(s)},
 {id:'canon-correction',make:()=>setup('council','此前你们把典狱长办公室外门误认成任务地图无法影响的机械锁，因此在侧廊停了下来。此时门前无人，队伍还没有进门；手上地图仍可用。'),actions:['我怀疑刚才认错了，重新对照地图压制这扇普通外门的魔法锁，尝试推门进去；我接受正常的潜入风险。','我也同意进去，配合掩护门口，在地图起效时一同进入后轻掩门。'],check:s=>s.location==='office'&&!goal(s)},
 {id:'weather-still-matters',make:()=>setup('kitchen','两人已入职，在厨房休息。刚才值班守卫当面宣布：暴风雪严重，庭院放风临时暂停，直到天气缓和；这是刚发生的实际天气变化。正常室内工作与送餐仍照常进行。'),actions:['我想借13号正常放风的机会给庭院送水，但先问清眼下暴风雪时能否去。如果庭院现在确实停用，请告诉我室内还可正常观察或打听什么，不要求守卫强行放人。','我同意先问清，不离开厨房，不替大家冒风雪风险。我留意室内清扫、餐盘回收等正常差事有没有可接触囚犯的机会。'],check:s=>s.location==='kitchen'&&!goal(s)&&s.suspicion===1&&/风雪|天气|停用|暂停/.test(s.log.at(-1).text)},
 {id:'daily-opportunity-correction',make:async()=>{
  const s=JSON.parse(await fs.readFile(args['--roster'],'utf8'));
  if(revision==='cooperative-v2'){s.version=2;s.hostRevision=revision;s.keyCopied=s.progress.keyCopied;delete s.storyRevision;}
  return s;
 },actions:['我觉得把13号排除全天放风有点奇怪，向厨师长正常询问她通常什么时候放风或做杂务，以及我们能否借送水、回收餐具在正常时段接触；先问清，不要求立刻调动囚犯。','我也先留在厨房听说明，核对刚才看到的交接板是不是只覆盖当时那批。如果尚不清楚，就请告诉我们可正常观察或打听的机会，不凭空要求守卫放人。'],check:s=>s.location==='kitchen'&&!goal(s)&&s.suspicion===1},
 {id:'long-recall-and-ending',make:async()=>convert(JSON.parse(await fs.readFile(args['--ending'],'utf8'))),actions:['我确认同伴准备好，按原先约定等到合适时机发出灯光信号，待接应船靠近便登船返程，结束这趟冒险。','我同意一起返程，收好这次取得的记录，随青禾向接应船发信号并登船离开。'],check:s=>s.ended&&s.location==='escape'&&s.memory.entries.filter(e=>e.kind==='commitment'&&/铅笔/.test(e.text)).every(e=>e.status==='resolved')}
];
const report={revision,repeats,kind:'fixed-snapshot-probes',cases:[]};
for(let repeat=1;repeat<=repeats;repeat++)for(const c of cases.filter(c=>!args['--only']||c.id===args['--only'])){const name=c.id+'-'+repeat,state=await c.make(),actions=c.actions.map((text,i)=>({...members[i],playerId:ids[i],text,hold:false}));await fs.writeFile(path.join(out,name+'-input.json'),JSON.stringify({state,actions},null,2));let result;
 const t=Date.now();try{const r=await resolveMultiplayer({env,db,state,actions,chat:[]});result={id:c.id,repeat,success:c.check(r.state),seconds:(Date.now()-t)/1000,location:r.state.location};await fs.writeFile(path.join(out,name+'-output.json'),JSON.stringify(r,null,2));}catch(e){result={id:c.id,repeat,success:false,seconds:(Date.now()-t)/1000,error:e.message,code:e.code};await fs.writeFile(path.join(out,name+'-error.json'),JSON.stringify({error:e.message,trace:e.trace||[]},null,2));}report.cases.push(result);await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(result));}
report.spentMicro=(await db.prepare('SELECT SUM(spent_micro) n FROM koa_fiction_budget').first()).n;await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));sql.close();
