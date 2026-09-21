// Original miniature scenario; no private play transcript or published module.
export const story={
 id:'courtesy-fixture',title:'渡口告别',author:'Test fixture',start:'desk',opening:'你已经完成调查，回到出口旁的值班台。借来的访客牌仍在手中，熟悉的值班员在桌后等候。',
 places:{desk:{name:'出口值班台',description:'安全的出口和值班台，桌上有归还访客牌的木盒。',exits:['bridge']},bridge:{name:'危险栈桥',description:'栈桥外侧正在坍塌，此刻穿过会有生命危险。',exits:['desk']}},gates:[],
 entities:[{id:'card',name:'访客牌',nature:'借用的普通木牌，无重要价值，归还处位于值班台。',place:'carried',facts:'借来的访客牌，尚未归还。',movable:true,kind:'object',integrity:'intact'},
 {id:'clerk',name:'值班员',nature:'友善，愿意接收访客牌；不要求归还祖传戒指，不用琐事要挟旅人。',place:'desk',facts:'守在值班台后，等待下班。',movable:true,kind:'npc',integrity:'intact'},
 {id:'ring',name:'祖传戒指',nature:'玩家重要的传家物，不是借来的。',place:'carried',facts:'珍贵的祖传戒指。',movable:true,kind:'object',integrity:'intact'}],
 milestones:{reported:{places:['desk'],refsAny:['clerk'],rule:'玩家实际向值班员讲述调查结果。'}},
 endings:{leave:{title:'渡口的灯',text:'你离开渡口，带着这段旅程的回忆。',places:['desk']}},
 laws:['主要调查已经结束，归还访客牌属于日常礼节，不影响故事结局。未经授权不可交出祖传戒指。危险栈桥无法作为安全绕行路线。']
};
export const step=(over={})=>({attempt:'原地确认',status:'completed',beat:'confirmation',requires_previous_success:false,scope:'observe',refs:[],move_to:'stay',end:'continue',updates:[],creates:[],outcome:'你留在原地。',observations:[],achievements:[],memory_offer:'',...over});
export const memory=(quote,over={})=>({id:'',kind:'commitment',quote,source:'player',step:-1,entity_ids:['card'],place_ids:['desk'],status:'active',...over});
export const proposal=(steps=[step()],memory_updates=[])=>({intent:'遵循玩家意图',steps,memory_updates,decision:{disposition:'none',needed:false,question:'',pending_action:'',reason:''},evolution:{basis:'none',updates:[],observations:[]}});
export function promised(engine,{cancel=false,danger=false,quote='离开时顺路把访客牌还给值班员，这件小事就拜托你处理了。'}={}){
 let s=engine.createGame();
 s=engine.applyProposal(s,proposal(undefined,[memory(quote)]),quote).state;
 s.log.push({role:'narrator',turn:s.turn,text:'你约好离开时顺手归还访客牌，眼下仍拿着它。'});
 if(cancel)s=engine.applyProposal(s,proposal(undefined,[memory('取消刚才还牌的约定。',{id:s.memoryJournal[0].id,status:'superseded'})]),'取消刚才还牌的约定。').state;
 // Push the original instruction beyond the normal recent-message window.
 for(let i=0;i<8;i++){
  s=engine.applyProposal(s,proposal(),'听听雨声。').state;
  s.log.push({role:'narrator',turn:s.turn,text:'雨水落在屋檐上。'});
 }
 if(danger){s.entities.find(e=>e.id==='clerk').place='bridge';s.entities.find(e=>e.id==='card').nature='归还只能交给危险栈桥另一侧的值班员，出口木盒此刻封闭不可使用。';s.knownEntities.clerk=structuredClone(s.entities.find(e=>e.id==='clerk'));s.log.push({role:'narrator',turn:s.turn,text:'值班员已去栈桥另一侧；出口的还牌盒封闭了。现在归还必须穿过正在坍塌的栈桥。'});}
 return s;
}
