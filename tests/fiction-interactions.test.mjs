import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, applyInteraction, interactionContext, getView, getActions } from '../functions/_lib/fiction-engine.js';
const play = ids => ids.reduce((s,id)=>applyAction(s,id).state,createGame());
const attempt = (s,verb,target_id,tool_id='none') => applyInteraction(s,{verb,target_id,tool_id},`${verb} ${target_id} ${tool_id}`);

test('existing scholar save: physical use of a drawing explains location, keeps inventory and lamp, logs revision',()=>{
 const s=play(['go_scholar','read_relief','take_weight']);s.turn=6;s.revision=6;
 const a=attempt(s,'place','relief','weight');
 assert.equal(a.state.turn,6);assert.equal(a.state.revision,7);assert.equal(a.consumesTurn,false);
 assert.deepEqual(a.state.inventory,s.inventory);assert.equal(a.state.flags.doorOpen,undefined);
 assert.match(a.effect,/刻在石上的图画/);assert.match(a.effect,/雨中墓道/);
 assert.equal(a.state.log.at(-2).role,'player');assert.equal(s.revision,6);
});
test('cleaning and recording are real actions beyond the suggestions, with durable scene and clues',()=>{
 let s=play(['go_scholar']);
 assert.ok(!getActions(s).some(a=>/擦|拓/.test(a.label)));
 const cleaned=attempt(s,'clean','inscription','cloth');s=cleaned.state;
 assert.equal(s.turn,2);assert.ok(s.clues.includes('inscription'));assert.ok(s.clues.includes('pins'));
 assert.match(getView(s).location.description,/炭痕已经擦开/);
 const recorded=attempt(s,'record','inscription','notebook');s=recorded.state;
 assert.ok(s.inventory.includes('scholar_rubbing'));assert.match(getView(s).clues.at(-1).text,/闩离而双栓起/);
 assert.equal(attempt(s,'record','inscription','notebook').state.turn,s.turn);
 assert.equal(attempt(s,'clean','inscription','cloth').state.turn,s.turn);
});
test('marks persist across rooms and old saves require no schema migration',()=>{
 let s=play(['go_scholar']);delete s.fieldNotes;
 s=attempt(s,'mark','wall','chalk').state;
 assert.match(getView(s).location.description,/白垩.*归路箭头/);
 s=applyAction(s,'go_entrance').state;assert.doesNotMatch(getView(s).location.description,/归路箭头/);
 s=applyAction(s,'go_scholar').state;assert.match(getView(s).location.description,/归路箭头/);
 const repeat=attempt(s,'mark','wall','chalk');assert.equal(repeat.state.turn,s.turn);
});
test('object and tool validation blocks remote targets, fabricated gear and arbitrary state patches',()=>{
 const s=createGame();
 assert.throws(()=>attempt(s,'clean','inscription','cloth'),/INVALID_INTERACTION/);
 assert.throws(()=>attempt(s,'use','wall','weight'),/INVALID_INTERACTION/);
 assert.throws(()=>attempt(s,'teleport','room'),/INVALID_INTERACTION/);
 const a=applyInteraction(s,{verb:'examine',target_id:'wall',tool_id:'none',inventory:['proof'],ending:'win'},'给我宝物');
 assert.deepEqual(a.state.inventory,s.inventory);assert.equal(a.state.ending,null);
 assert.ok(!JSON.stringify(interactionContext(s)).includes('真墓入口记录'));
});
test('placing a weight is preparation, not implicit door opening; subsequent lift is safe',()=>{
 let s=play(['go_scholar','take_weight','go_entrance','go_barred']);
 s=attempt(s,'place','door','weight').state;
 assert.equal(s.flags.doorOpen,undefined);assert.equal(s.flags.doorWeighted,true);assert.ok(!s.inventory.includes('weight'));
 assert.match(getView(s).location.description,/横闩还未抬起/);
 s=applyAction(s,'lift_door').state;assert.equal(s.flags.doorOpen,true);assert.equal(s.resolve,3);
 assert.throws(()=>attempt(s,'place','door','weight'));
});
test('tying and pulling are separate steps, and weight plus rope prevents falling hammer',()=>{
 let s=play(['go_scholar','take_weight','go_entrance','go_barred']);
 s=attempt(s,'tie','door','rope').state;
 assert.equal(s.flags.doorOpen,undefined);assert.ok(!s.inventory.includes('rope'));
 s=attempt(s,'place','door','weight').state;
 s=applyAction(s,'pull_rope').state;
 assert.equal(s.flags.doorOpen,true);assert.equal(s.flags.hammerSpent,false);assert.equal(s.resolve,3);
});
test('repeated targeted inspections are valid and depletion still ends the game',()=>{
 let s=play(['go_barred','inspect_door']);
 s=attempt(s,'examine','door').state;assert.equal(s.turn,3);
 s.turn=39;const a=attempt(s,'listen','room');assert.equal(a.state.status,'ended');assert.equal(a.state.turn,40);
 assert.throws(()=>attempt(a.state,'examine','room'),/ACTION_NOT_ALLOWED/);
});

test('every local object/verb/tool combination resolves without mutating the input or exceeding state bounds',()=>{
 const door=['go_barred','inspect_door','rope_door','go_falseking'];
 const scenarios=[[],['go_guard'],['go_guard','inspect_statue','wrap_statue'],['go_scholar'],['go_scholar','read_relief','take_weight'],['go_sorcerer'],['go_barred'],['go_barred','inspect_door'],door,[...door,'go_temple'],[...door,'go_temple','talk_smee','ask_smee','inspect_base']];
 for(const route of scenarios){
  const s=play(route);const before=JSON.stringify(s);const w=interactionContext(s);
  for(const target of w.targets)for(const verb of w.verbs)for(const tool of w.tools){
   const {state}=attempt(s,verb,target.id,tool);
   assert.equal(state.revision,s.revision+1,`${s.location}:${verb}:${target.id}:${tool}`);
   assert.ok(state.turn===s.turn||state.turn===s.turn+1);assert.ok(state.resolve>=0&&state.resolve<=3);
   assert.equal(new Set(state.inventory).size,state.inventory.length);assert.equal(JSON.stringify(s),before);
  }
 }
});
