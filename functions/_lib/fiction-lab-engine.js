// Small authored world + generic ledger. Physical interpretation belongs to the
// host; these checks bound resources, topology, time and the authored hammer.
export const MAX_TURNS = 20;
const places = {
  outside: {name:'石门外',description:'雨水落在身后的墓口。门槛边就在脚前，双栓和石镇在门外触手可及处；门内近处是越过门槛后约两步远的地面。门打开时，可以从外面照看或投物到那里。'},
  threshold: {name:'门内近处',description:'这里在门槛内约两步，是门外可以看见并投到的石地；往里可步入伪王墓。双栓释放时，门槛附近是悬锤的落点。'},
  chamber: {name:'伪王墓',description:'石棺、木制镀金王冠和冷清的石墙围住墓室。这里只能观察和试用随身物件；更深的通道不在本次短篇范围。'},
};
const item = (id,name,nature,place,facts,movable=true)=>({id,name,nature,place,facts,movable,integrity:'intact',source:null});
export function createGame(){
 return {version:2,gameKind:'lab',sessionId:'',revision:0,turn:0,location:'outside',visited:['outside'],status:'playing',ending:null,resolve:3,doorOpen:true,hammerFallen:false,notes:[],events:[],
 entities:[
 item('lamp','油灯','普通燃油灯，有可打开的玻璃灯罩。火焰有热量，露出火焰可点燃合适的干燥材料。没有备用油，不能凭空补充燃料。','carried','灯罩合着，灯正在正常燃烧。'),
 item('cloth','厚布','普通厚布，可以吸水、遮光、燃烧、撕分或组合使用；不预先限制用途。','carried','干燥、完好。'),
 item('rope','探路绳','一捆普通结实的绳，约五步长；可以系结、牵引，过火会受损。','carried','完好，卷起。'),
 item('cup','青铜杯','手掌大的空青铜杯，能盛少量水，金属不燃；倒扣可以隔绝杯口覆盖的小范围空气。','carried','空杯，完好。'),
 item('chalk','白垩','能在石头或物件上留下可辨认的白色记号。','carried','剩下一小截。'),
 item('notebook','随身手记','几页纸和用于书写的炭笔，能记录看到的事实。','carried','尚无本次探查记录。'),
 item('weight','方形石镇','沉重、平底，正压住双栓；挪走会释放悬锤，不因主持描述而失效。','door_support','稳稳压住双栓。'),
 item('rain','墓口雨水','普通雨水，可用于浸湿物品或用已有容器盛取。','outside','持续有雨水滴落。',false),
 item('wall','门外石墙','厚实石墙，不会被徒手或小工具击穿；可画记号、投影或固定已有物件。','outside','潮冷，尚无新标记。',false),
 item('tomb','石棺与镀金木冠','伪王墓的固定陈设，木冠露出廉价木头。无可领取的金银奖励或秘密机关。','chamber','陈设原位。',false)
 ],log:[{role:'narrator',turn:0,text:'你停在已经打开的石门外。方形石镇压住双栓，悬锤静静扣在头顶；门内两步远的地面就在灯光可及之处。你还没有进入伪王墓。\n\n手中是一盏带玻璃罩的普通油灯，背包里有干厚布、绳、青铜杯、白垩与手记。雨水在身后滴落，灯油还够二十刻。你可以在门外试探，也可以走进去观察，最后带着自己的发现离开。\n\n把连贯的想法一起说出来。一次尝试可以包含准备、操作与观察；如果途中发生变化，主持会停在那个时刻。'}]};
}
export function getActions(s){
 if(s.status!=='playing')return [];
 return [
 {id:'look',label:'留在原地，举灯仔细观察眼前环境'},
 ...(s.location==='outside'?[{id:'near',label:'走到门内近处，留意脚下'},{id:'leave',label:'收好随身物品，结束探查并离开'}]:[{id:'back',label:'沿已经走过的路回到石门外'}]),
 ];
}
const placeName=p=>p==='carried'?'随身':p==='consumed'?'已消耗':p==='door_support'?'双栓上':places[p]?.name||p;
const description=s=>`${places[s.location].description}${s.doorOpen?'石门敞开。':'石门已经关上，阻断门两侧的视线和投掷。'}${s.hammerFallen?'悬锤已落下，不能再次触发。':'悬锤仍被双栓扣住；移走支撑石镇会触发它。'}`;
export function getView(s){
 return {title:'门后的火光',sessionId:s.sessionId,revision:s.revision,turn:s.turn,maxTurns:MAX_TURNS,remainingTurns:MAX_TURNS-s.turn,
 location:{id:s.location,name:places[s.location].name,description:description(s)},status:s.status,ending:s.ending,
 inventory:s.entities.filter(e=>e.place==='carried'&&e.integrity!=='consumed').map(e=>({id:e.id,name:e.name,description:e.facts})),
 clues:[...s.entities.filter(e=>e.movable&&e.place!=='carried').map(e=>({id:e.id,title:`${e.name} · ${placeName(e.place)}`,text:e.facts})),...s.notes.map((text,i)=>({id:`note_${i}`,title:'探查记录',text}))],
 map:Object.entries(places).map(([id,p])=>({id,name:p.name,visited:s.visited.includes(id),current:s.location===id})),choices:getActions(s),log:s.log,stats:{resolve:s.resolve,treasure:s.notes.length},model:'gpt-5.6-sol'};
}
export function hostContext(s){
 return {location:s.location,remaining:MAX_TURNS-s.turn,resolve:s.resolve,doorOpen:s.doorOpen,hammerFallen:s.hammerFallen,
 places,entities:s.entities,notes:s.notes,recent:s.log.slice(-6),recentEvents:s.events.slice(-3),
 laws:['人物所在、视线范围和投掷范围分别判断。outside与threshold相邻，threshold与chamber相邻，门控制outside与threshold。outside包含门槛外边缘和侧面安全站位，门槛边本身在手边，双栓与支撑石镇也在outside可直接触及。threshold特指门内约两步远的落点，不等同门槛边。开门时可从outside向threshold投物而不进入；门外系石镇无需先进入threshold。',
 '油灯是普通有热量的火，罩盖可打开。当前facts优先于初始外观。合理未预写用途由主持裁量，未知细节以不改变关键设定的常识处理。',
 '石镇仅在door_support能压住双栓。移走它会落锤；由程序决定，不能宣称仍安全。布/绳等变化须持续记住，不因换轮恢复。',
 '没有其他房间、宝物、角色或魔法能力。可用现有物品产生有来源的碎片；不可凭空造物。火焰和未触发机关的观察不能证明空气或整座墓安全。']};
}
const physicalPlace=(e,location)=>e.place==='carried'?location:e.place==='door_support'?'outside':e.place;
const adjacent=(a,b)=>a===b||(['outside','threshold'].includes(a)&&['outside','threshold'].includes(b))||(['threshold','chamber'].includes(a)&&['threshold','chamber'].includes(b));
const passageOpen=(s,a,b)=>s.doorOpen||!((a==='outside')!==(b==='outside'));
const assert=(v,msg)=>{if(!v)throw Error(`LAB_INVALID:${msg}`);};
const short=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
function finish(s,reason){s.status='ended';s.ending={id:reason,title:reason==='time'?'灯火将尽':reason==='hurt'?'及时退回':'带着观察归来',text:reason==='time'?'灯油已经不足以继续探索。你结束了这次试探，留下物品与观察的记录。':reason==='hurt'?'你已经承受太多危险，及时结束探查。':'你结束了这次探查。带走的是仍在手中的物品，以及亲眼确认过的事情。'};}
export function applyProposal(original,proposal,playerText){
 assert(original.version===2&&original.status==='playing','session');
 assert(proposal&&Array.isArray(proposal.steps)&&proposal.steps.length>=1&&proposal.steps.length<=6,'steps');
 assert(short(proposal.intent,500),'intent');
 const s=structuredClone(original), outcomes=[];
 for(const step of proposal.steps){
  assert(typeof step.requires_previous_success==='boolean','dependency');
  if(step.requires_previous_success&&outcomes.at(-1)?.status==='failed')break;
  assert(short(step.attempt,400)&&short(step.outcome,700),'text');
  assert(['completed','partial','failed','clarify'].includes(step.status),'status');
  assert(Number.isInteger(step.duration)&&step.duration>=0&&step.duration<=MAX_TURNS,'time');
  assert(Array.isArray(step.updates)&&step.updates.length<=12&&Array.isArray(step.creates)&&step.creates.length<=3,'updates');
  assert(Array.isArray(step.refs)&&step.refs.length<=12,'refs');
  assert(Array.isArray(step.observations)&&step.observations.length<=4&&step.observations.every(t=>short(t,300)),'observations');
  assert(['stay',...Object.keys(places)].includes(step.move_to)&&['unchanged','open','closed'].includes(step.door)&&['continue','leave'].includes(step.end),'controls');
  assert(['near','project','observe','travel','time'].includes(step.scope),'scope');
  if(step.duration>MAX_TURNS-s.turn){const remaining=MAX_TURNS-s.turn;s.turn=MAX_TURNS;outcomes.push({attempt:step.attempt,status:'interrupted',outcome:'你来不及完成这段需要更长时间的行动，灯油先耗尽了；本步尚未完成的变化没有发生。',observations:[],duration:remaining});finish(s,'time');break;}
  const beforeLocation=s.location;
  const distanceOK=p=>p===beforeLocation||(step.scope!=='near'&&step.scope!=='time'&&adjacent(beforeLocation,p)&&passageOpen(s,beforeLocation,p));
  for(const id of step.refs){
   const entity=s.entities.find(e=>e.id===id);assert(entity,'unknown ref');
   // Remembering a consumed/distant object is fine; physically changing it isn't.
  }
  if(step.status==='clarify')assert(step.duration===0&&step.updates.length===0&&step.creates.length===0&&step.move_to==='stay'&&step.door==='unchanged'&&step.end==='continue','clarify effects');
  // The release is immediate. Combining it with actor movement would make the
  // injury position ambiguous; the host must express their order as two steps.
  if(!s.hammerFallen&&step.move_to!=='stay')assert(!step.updates.some(u=>u.id==='weight'&&u.place!=='door_support'),'split support release and travel');
  if(step.move_to!=='stay')assert(adjacent(beforeLocation,step.move_to)&&passageOpen(s,beforeLocation,step.move_to),'travel');
  if(step.door!=='unchanged')assert(['outside','threshold'].includes(beforeLocation),'door reach');
  const changes=new Set();
  for(const update of step.updates){
   const e=s.entities.find(x=>x.id===update.id);assert(e&&!changes.has(e.id),'update id');changes.add(e.id);
   assert(short(update.facts,500)&&['intact','damaged','consumed'].includes(update.integrity),'facts');
   assert(['carried','outside','threshold','chamber','door_support','consumed'].includes(update.place),'place');
   assert(e.integrity!=='consumed'&&e.place!=='consumed','resurrection');
   assert(distanceOK(physicalPlace(e,beforeLocation)),'source reach');
   assert((update.integrity==='consumed')===(update.place==='consumed'),'consumption');
   if(!e.movable)assert(update.place===e.place&&update.integrity!=='consumed','fixed entity');
   if(e.id==='lamp')assert(update.integrity!=='consumed','lamp budget');
   if(e.integrity==='damaged')assert(update.integrity!=='intact','repair without materials');
   if(update.place==='door_support')assert(e.id==='weight'&&['outside','threshold'].includes(beforeLocation),'support');
   const destination=update.place==='carried'?beforeLocation:update.place==='door_support'?'outside':update.place;
   if(destination!=='consumed')assert(distanceOK(destination),'destination reach');
   if(step.scope==='observe'||step.scope==='time')assert(update.place===e.place,'observe transfer');
   if(update.place==='carried'&&e.place!=='carried')assert(physicalPlace(e,beforeLocation)===beforeLocation||step.scope==='project','pickup reach');
   e.place=update.place;e.integrity=update.integrity;e.facts=update.facts;
  }
  for(const child of step.creates){
   const source=s.entities.find(e=>e.id===child.source);
   assert(source&&source.movable&&changes.has(source.id)&&source.integrity!=='intact','derive source');
   assert(/^[a-z][a-z0-9_]{1,39}$/.test(child.id)&&!s.entities.some(e=>e.id===child.id),'derived id');
   assert(short(child.name,35)&&child.name.includes(source.name)&&short(child.facts,400),'derived facts');
   assert(['carried',...Object.keys(places)].includes(child.place)&&distanceOK(child.place==='carried'?beforeLocation:child.place),'derived place');
   assert(s.entities.length<18,'entity limit');
   s.entities.push({...item(child.id,child.name,`由${source.name}分出，材质和普通性质沿用来源，不能凭空变成其他材料。`,child.place,child.facts),source:source.id});
  }
  if(step.move_to!=='stay'){s.location=step.move_to;if(!s.visited.includes(s.location))s.visited.push(s.location);}
  if(step.door!=='unchanged')s.doorOpen=step.door==='open';
  s.turn+=step.duration;
  const event={attempt:step.attempt,status:step.status,outcome:step.outcome,observations:step.observations,duration:step.duration};outcomes.push(event);
  for(const note of step.observations)if(!s.notes.includes(note))s.notes.push(note);
  s.notes=s.notes.slice(-16);
  if(!s.hammerFallen&&s.entities.find(e=>e.id==='weight').place!=='door_support'){
   s.hammerFallen=true;
   if(s.location==='threshold')s.resolve=Math.max(0,s.resolve-1);
   event.outcome+=' 【规则结算】石镇离开双栓，悬锤立刻落在门槛附近。'+(s.location==='threshold'?'你在落点边受伤，状态减一。':'你不在门槛落点内，没有受伤。');
   event.observations.push('悬锤已经落下，不能再次释放。');
   break; // An authored unexpected event interrupts the proposed chain.
  }
  if(s.turn>=MAX_TURNS){finish(s,'time');break;}
  if(s.resolve<=0){finish(s,'hurt');break;}
  if(step.end==='leave'){assert(s.location==='outside','exit');finish(s,'leave');break;}
  if(step.status==='clarify'||step.status==='partial')break;
 }
 // A physical change cannot become a free turn just by labeling every preparation zero.
 if(s.turn===original.turn&&(JSON.stringify(s.entities)!==JSON.stringify(original.entities)||s.location!==original.location||s.doorOpen!==original.doorOpen)){
  s.turn+=1;outcomes.at(-1).duration+=1;
 }
 if(s.status==='playing'&&s.turn>=MAX_TURNS)finish(s,'time');
 if(s.status==='playing'&&s.resolve<=0)finish(s,'hurt');
 s.revision+=1;
 s.log.push({role:'player',turn:s.turn,text:playerText});
 s.events.push({revision:s.revision,intent:proposal.intent,steps:outcomes});s.events=s.events.slice(-30);
 return {state:s,outcomes};
}
