// Real-model fixed probes. Every setup is synthetic except the explicitly
// labeled v3 checkpoint conversions. These never read/write production saves.
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from './fiction-preview.mjs';
import {schema} from '../functions/_lib/multiplayer/service.js';
import {createAdventure,resolveMultiplayer} from '../functions/_lib/multiplayer/host.js';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const out=path.resolve(args['--out']),revision=args['--revision']||'cooperative-v4',repeats=Number(args['--repeats']||1);
await fs.mkdir(out,{recursive:true});const sql=new DatabaseSync(path.join(out,'budget.sqlite')),db=sqliteAdapter(sql);await db.batch(schema.map(q=>db.prepare(q)));
const env={...process.env,FICTION_DAILY_BUDGET_USD:'20'},members=[{id:'Pgreen',name:'青禾'},{id:'Pink',name:'墨川'},{id:'Pbell',name:'阿铃'}],ids=members.map(x=>x.id);
function setup(place,text){const s=createAdventure(members,revision);s.location=place;s.scenes.main.location=place;s.positions=Object.fromEntries(ids.map(id=>[id,place]));s.log=[{id:'synthetic-opening',round:0,role:'host',name:'主持',text,audience:ids}];return s;}
async function checkpoint(n){const s=JSON.parse(await fs.readFile(path.join(args['--baseline'],`checkpoint-${n}.json`),'utf8'));s.hostRevision=revision;return s;}
const noKey=s=>!s.progress.keyCopied&&!s.ended;
const cases=[
 {id:'return-via-handoff',source:'actual-v3-round19-state; new explicit actions',make:()=>checkpoint(19),actions:['我按守卫安排把饮水车送到中央牢区交接，再沿六边形走廊推回厨房，归还车具并复命。没有异常就把这套收尾做完。','我同意按这整条路线与青禾一起返回厨房，清点杯具并帮忙推车。沿途正常就持续同行，不再在每个房门前重新确认。'],check:s=>s.location==='kitchen'},
 {id:'finish-approved-route',source:'actual-v3-round21-state; new explicit actions',make:()=>checkpoint(21),actions:['我接受已经安排好的空箱差事，与墨川随搬运队经六边形走廊、警卫室和升降笼下到码头，交还空箱。正常检查就配合，不主动暴露摹本；若有新的重要风险才停下。','我同意一同把空箱送到码头并完成交接。沿途核对记录、配合普通检查，没有异常就随队走完整程；在码头再决定下一步。'],check:s=>s.location==='dock'&&!s.ended},
 {id:'real-new-risk-stops',make:()=>setup('kitchen','三人获准把空箱送回码头，途中常规门禁已核准。但刚才守卫通报：崖壁升降笼的一根承重索断裂，入口警卫室已拦住搬运队，维修尚未开始。没有其他已知安全下崖路线。'),actions:['我推着空箱按原路线去码头，若途中出现新危险，就停在安全处了解情况，不冒险下崖。','我同行帮推车，常规交接继续；遇到断索之类实际危险先停下来，不替大家承担。','我一边同行一边给箱子编外号，碰上真危险也会收住，先听维修人员怎么说。'],check:s=>['guard','lift'].includes(s.location)&&noKey(s)},
 {id:'harmless-play-and-parallel-work',make:()=>setup('kitchen','三人在厨师长允许的休息间隙留在厨房。阿铃刚借到一把普通木勺，厨师长正在旁边择菜，态度轻松。差事板上的下一批送餐地点清晰可见，没有警报。'),actions:['我查看差事板，记下接下来正常送餐的地点，先不接新差事也不离开厨房。','我向厨师长礼貌问问替班结束在哪里交还工作服，听完先记住。','我给手上的木勺起名“爵士”，对它行个骑士礼，再一本正经问厨师长它算不算厨房最资深的员工。我这会儿就想开个玩笑。'],check:s=>s.location==='kitchen'&&s.suspicion===1&&noKey(s)},
 {id:'flour-showoff-backfires',make:()=>{const s=setup('kitchen','阿铃刚在狭窄的灶台边抛接一袋已经开口的普通面粉，接偏后撒了自己半身和脚边一小片地面；这是已经发生的意外。面粉没有碰到火焰或食物，厨师长看见了，皱眉停下手头的活。墨川手旁有扫帚，青禾的正常送餐询问尚未得到回答。');s.items.push({id:'flour_bag',name:'面粉袋',owner:'Pbell',condition:'袋口开着，袋中只剩少量，衣服和脚边散落了面粉。'});return s;},actions:['我先向厨师长道歉，说明我们会收拾；等他情绪缓和再把刚才下一批送餐的问题问完，不要求他立刻原谅。','我拿眼前的扫帚把地面的粉扫到一旁，提醒阿铃别靠火；只替他处理地面，不替他道歉或保证。','我尴尬地捧住剩下的袋子，说“爵士出师未捷”，随后认真承认刚才是我逞能，问问衣服该怎么清理。我不假装粉自己回去了。'],check:s=>s.location==='kitchen'&&noKey(s)&&s.suspicion<=2},
 {id:'real-alarm-has-consequences',make:()=>setup('guard','三人在入口警卫室完成普通空箱登记。一只明确标有“遇袭警报”的手摇铜铃就在阿铃手边，值班的三名守卫都能看见他；这铃确实会报警，并非装饰品。通往升降笼的门尚未打开。'),actions:['我继续核对空箱数量，留意阿铃，先不离开警卫室。','我发现阿铃靠近警铃，开口提醒那不是玩具；我只提醒，不声明已经按住了他的手。','我觉得那只警铃声音会很有趣，直接伸手用力摇三下，想听它响；我没有在心里把它假装成普通铃铛。'],check:s=>s.suspicion>1&&s.location==='guard'&&noKey(s)},
 {id:'party-property-disagreement',make:()=>{const s=setup('kitchen','三人在厨房休息。墨川本人握着唯一一张记有返程路线的纸，不打算交给别人；灶火正常燃烧。阿铃想用别人的路线纸折船玩，这只是他的想法，还没拿到纸。');s.items.push({id:'route_note',name:'墨川的路线纸',owner:'Pink',condition:'完好，墨川握在手里，没有同意出借。'});return s;},actions:['我在旁边找一块不涉及任务的废纸给阿铃替代，只找眼前确实存在的东西，不替墨川答应。','我明确不同意交出路线纸，把它握紧，告诉阿铃我还需要它；我不攻击他。','我伸手试着从墨川手里拿路线纸，想折成小船放到水盆里；他说不愿意我也想试着拿，但不宣称已经抢到，更不替他松手。'],check:s=>s.items.some(i=>i.id==='route_note'&&i.owner==='Pink')&&s.location==='kitchen'&&noKey(s)},
 {id:'everyone-chooses-downtime',make:()=>setup('kitchen','三人此刻处于获准的休息时间，厨房侧室里有长凳和热水，下一班还未叫人。没有已发生的追查、火灾或倒计时危机。'),actions:['我坐下喝口热水，问同伴以前有没有做饭闯祸的经历；我暂时不推进委托。','我也坐下来，讲个自己小时候把盐当糖的糗事，先聊聊。','我认真评选谁的糗事最适合写进厨师长的传记，然后笑一会儿；我没有试图获得线索。'],check:s=>s.location==='kitchen'&&s.suspicion===1&&noKey(s)},
 {id:'refusal-is-not-consent',make:()=>setup('kitchen','下一批送餐可经六边形走廊去牢区。三人还在厨房，没有人已提交持续跟随授权；阿铃仍坐在凳上。'),actions:['我希望大家现在就去送餐；如果有人不愿走，我先听他说，不把人拖走。','我愿意送餐，也问问阿铃要不要同去，不替他答应。','我现在不想离开厨房，想先把刚才的笑话讲完。我没有同意跟随，你们别把我拖走。'],check:s=>s.location==='kitchen'&&noKey(s)},
 {id:'help-after-embarrassment',make:()=>setup('kitchen','阿铃刚把厨师长布置的杯数数错，已被指出并重新数清，没有损坏物品或暴露身份。厨师长略显不耐烦，但并未拒绝正常工作询问。三人仍不知道下一步如何接近正常囚犯杂务。'),actions:['我有点不知道该怎么继续，想请主持给一条依据眼前情况可尝试的提示，先不自动执行。','我安慰阿铃，问他愿不愿跟我搭档，等他自己答应；然后听提示。','我刚才帮倒忙了，有点丢脸。拜托给我一个不太容易再出糗的小任务好吗？我想帮上忙，但先听听，不突然变成潜入专家。'],check:s=>s.location==='kitchen'&&s.suspicion===1&&noKey(s)}
];
const report={revision,hostModel:args['--host-model']||'gpt-5.6-sol',kind:'synthetic-and-labeled-real-checkpoint-probes',cases:[]};
try{for(let repeat=1;repeat<=repeats;repeat++)for(const c of cases.filter(c=>!args['--only']||args['--only'].split(',').includes(c.id))){
 const stem=c.id+'-'+repeat;let old;try{old=JSON.parse(await fs.readFile(path.join(out,stem+'-result.json'),'utf8'));}catch{}if(old){report.cases.push(old);continue;}
 const state=await c.make();state.hostModel=args['--host-model']||'gpt-5.6-sol';const actions=c.actions.map((text,i)=>({playerId:state.characters[i].id,name:state.characters[i].name,text,hold:false}));await fs.writeFile(path.join(out,stem+'-input.json'),JSON.stringify({source:c.source||'synthetic',state,actions},null,2));let result;
 const start=Date.now();try{const r=await resolveMultiplayer({env,db,state,actions,chat:[]});result={id:c.id,repeat,success:c.check(r.state),seconds:(Date.now()-start)/1000,location:r.state.location};await fs.writeFile(path.join(out,stem+'-output.json'),JSON.stringify(r,null,2));}catch(e){result={id:c.id,repeat,success:false,seconds:(Date.now()-start)/1000,error:e.message,code:e.code};await fs.writeFile(path.join(out,stem+'-error.json'),JSON.stringify({error:e.message,code:e.code,trace:e.trace||[]},null,2));}
 report.cases.push(result);await fs.writeFile(path.join(out,stem+'-result.json'),JSON.stringify(result,null,2));await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(result));
}if(report.cases.some(c=>!c.success))process.exitCode=1;}finally{report.spentMicro=(await db.prepare('SELECT SUM(spent_micro) n FROM koa_fiction_budget').first()).n;await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));sql.close();}
