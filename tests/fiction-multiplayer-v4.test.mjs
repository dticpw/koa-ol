import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/fiction-preview.mjs';
import {createAdventure} from '../functions/_lib/multiplayer/host.js';
import {createMultiplayerHandler} from '../functions/_lib/multiplayer/service.js';
import {applyRuling,schemasFor} from '../functions/_lib/multiplayer/v4/host.js';
import {applyRuling as applyV3} from '../functions/_lib/multiplayer/v3/host.js';
import {buildContext} from '../functions/_lib/multiplayer/v4/context.js';
import {storyFor} from '../functions/_lib/multiplayer/stories/registry.js';
const members=[{id:'Pa',name:'青'},{id:'Pb',name:'墨'},{id:'Pc',name:'铃'}];
function setup(place='kitchen',revision='cooperative-v4'){
 const s=createAdventure(members,revision);s.location=place;s.scenes.main.location=place;s.positions=Object.fromEntries(members.map(m=>[m.id,place]));return s;
}
const acts=s=>s.characters.map(m=>({playerId:m.id,text:'我同意沿已核准的正常路线随队走到码头。',hold:false}));
const proposal=(s,route=[s.location])=>({destination:route.at(-1),route,progress:{...s.progress},ended:false,suspicionDelta:0,suspicionReason:'',coordination:s.characters.map(m=>({playerId:m.id,basis:route.length>1?'current':'stay',agreementId:''})),outcomes:s.characters.map(m=>({playerId:m.id,kind:'progress',text:'完成了自己声明的行动。'})),items:[],removeItems:[],memoryUpdates:[],turnEnd:{kind:'complete',reason:'已经完成本轮各自的声明，没有跨过新的选择。'},sceneSummary:{place:route.at(-1),text:'大家完成了本次行程。'}});

test('v4 completes long adjacent routes while frozen v3 retains its original limit',()=>{
 const s=setup(),route=['kitchen','hexagon','guard','lift','dock'],p=proposal(s,route);
 const n=applyRuling(s,p,acts(s));assert.equal(n.location,'dock');assert.deepEqual(Object.values(n.positions),['dock','dock','dock']);assert.equal(n.version,3);assert.equal(n.hostRevision,'cooperative-v4');
 assert.equal(n.journal[0].turnEnd.kind,'complete');assert.throws(()=>applyV3(setup('kitchen','cooperative-v3'),p,acts(s)),/路线/);
 assert.throws(()=>applyRuling(s,proposal(s,['kitchen','dock']),acts(s)),/路线/);
 const hold=acts(s);hold[1].hold=true;assert.throws(()=>applyRuling(s,p,hold),/原地/);
});
test('v4 supports an authorized return via an intermediate stop without teleporting',()=>{
 const s=setup('yard'),route=['yard','hexagon','panopticon','hexagon','kitchen'];
 assert.equal(applyRuling(s,proposal(s,route),acts(s)).location,'kitchen');
});
test('full route context carries intermediate constraints and final-area opportunities',()=>{
 const s=setup('mess'),a=acts(s);a[0].text='我随勤务员沿正常路线把茶送到赦免议事厅。';
 const c=buildContext(s,a,[],storyFor(s));
 for(const id of ['mess','hexagon','panopticon','hub','barracks','council'])assert.ok(c.scenario.nearbyPlaces[id]);
 assert.match(c.scenario.routeGraph.barracks.constraints,/五十/);
 assert.match(c.scenario.routeGraph.cells.constraints,/反魔法/);
});
test('roleplay can receive attention without mission progress or a manufactured crisis',()=>{
 const s=setup(),p=proposal(s);p.outcomes[2]={playerId:'Pc',kind:'roleplay',text:'铃给自己的勺子起了绰号，厨师听到后笑了笑。'};
 const n=applyRuling(s,p,acts(s));assert.equal(n.memory.spotlight.Pc,1);assert.equal(n.attention.Pc.lastMeaningfulRound,1);assert.equal(n.progress.keyCopied,false);assert.equal(n.suspicion,1);
 assert.equal(buildContext(n,acts(n),[],storyFor(n)).recentEvents[0].turnEnd.kind,'complete');
});
test('new turn boundary is required and does not replace ownership or ending checks',()=>{
 const s=setup(),p=proposal(s);delete p.turnEnd;assert.throws(()=>applyRuling(s,p,acts(s)),/停下/);
 const invalid=proposal(s);invalid.items=[{id:'x',name:'钥匙',owner:'unknown',condition:'完好'}];assert.throws(()=>applyRuling(s,invalid,acts(s)),/归属/);
 const falseEnd=proposal(s);falseEnd.ended=true;assert.throws(()=>applyRuling(s,falseEnd,acts(s)),/结束|离场/);
 assert.equal(schemasFor(s).proposal.properties.route.maxItems,64);
});
test('an enacted joke accepts action background with outcome evidence, never intent alone',()=>{
 const s=setup(),a=acts(s),p=proposal(s);a[2].text='我给勺子起名爵士';p.outcomes[2]={playerId:'Pc',kind:'roleplay',text:'铃给勺子起了名，厨师笑着叫它爵士。'};
 p.memoryUpdates=[{id:'spoon_name',kind:'relationship',basis:'event',text:'厨师听到了勺子的外号爵士。',status:'active',owner:'Pc',places:['kitchen'],knownBy:members.map(m=>m.id),evidence:[{round:1,kind:'action',playerId:'Pc'},{round:1,kind:'outcome',playerId:'Pc'}]}];
 const n=applyRuling(s,p,a);assert.equal(n.memory.entries[0].source.actor,'host');assert.equal(n.memory.entries[0].evidence.length,2);
 p.memoryUpdates[0].evidence.pop();assert.throws(()=>applyRuling(s,p,a),/结算依据/);
 p.memoryUpdates[0].evidence.push({round:2,kind:'outcome',playerId:'Pc'});assert.throws(()=>applyRuling(s,p,a),/不存在/);
});
test('stationary turns do not consume newly offered follow agreements; movement still requires one',()=>{
 const s=setup(),a=acts(s),p=proposal(s);p.coordination[0]={playerId:'Pa',basis:'standing',agreementId:'new_follow'};
 p.memoryUpdates=[{id:'new_follow',kind:'agreement',basis:'claim',text:'青同意从厨房跟随到码头。',status:'active',owner:'Pa',places:['kitchen','hexagon','guard','lift','dock'],knownBy:members.map(m=>m.id),evidence:[{round:1,kind:'action',playerId:'Pa'}]}];
 const n=applyRuling(s,p,a);assert.equal(n.journal[0].coordination[0].basis,'stay');assert.equal(n.memory.entries[0].origin.actor,'Pa');
 p.route=['kitchen','hexagon'];p.destination='hexagon';assert.throws(()=>applyRuling(s,p,a),/跟随/);
});
test('v4 uses existing atomic storage, pause/restore and fixed-revision continuation',async()=>{
 const sql=new DatabaseSync(':memory:'),env={DB:sqliteAdapter(sql),FICTION_MULTIPLAYER_HOST_REVISION:'cooperative-v4'},revisions=[];
 const handler=createMultiplayerHandler({resolver:async({state,actions})=>{revisions.push(state.hostRevision);const n=applyRuling(state,proposal(state),actions);n.log.push({id:crypto.randomUUID(),round:n.round,audience:n.characters.map(c=>c.id),role:'host',name:'主持',text:'交谈得到了回应。'});n.drafts={};return {state:n};}});
 const client=()=>{let cookie='';return async body=>{const r=await handler({env,request:new Request('https://x.test/api/fiction-rooms'+(body?'':'?table=20000'),{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:'https://x.test'}:{})},...(body?{body:JSON.stringify(body)}:{})})});if(r.headers.has('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};};
 const [a,b]=[client(),client()],op=(op,rest={})=>({op,table:20000,...rest});
 for(const [i,c]of [a,b].entries()){await c({op:'hello',name:'队员'+i});await c(op('join'));}await a(op('start',{requestId:crypto.randomUUID()}));
 const id=(await a()).table.game.runId;env.FICTION_MULTIPLAYER_HOST_REVISION='cooperative-v3';
 await a(op('pause',{title:'勺子骑士的远行'}));await b(op('restore',{runId:id}));await a(op('join'));await b(op('resume'));
 for(const c of [a,b])await c(op('act',{round:0,text:'我留在码头聊聊。',hold:false}));await b(op('resolve',{round:0,requestId:crypto.randomUUID()}));
 const g=(await a()).table.game;assert.equal(g.hostRevision,'cooperative-v4');assert.equal(g.round,1);assert.equal(g.runId,id);assert.deepEqual(revisions,['cooperative-v4']);
 assert.ok(sql.prepare('SELECT COUNT(*) n FROM koa_fiction_multi_events').get().n>0);sql.close();
});
