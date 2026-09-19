import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, getActions, getView, narrationContext, MAX_TURNS } from '../functions/_lib/fiction-engine.js';

const play = ids => ids.reduce((s, id) => applyAction(s, id).state, createGame());
const gold = ['go_guard', 'inspect_statue', 'wrap_statue', 'go_entrance'];
const door = ['go_scholar', 'read_relief', 'take_weight', 'go_entrance', 'go_barred', 'weight_door', 'go_falseking', 'inspect_king', 'go_temple'];

test('water route completes with intact evidence and all state from rules', () => {
  const s = play(['go_sorcerer','read_water','take_cup','go_entrance', ...door, 'inspect_base','pour_water','return','leave']);
  assert.equal(s.ending.id, 'discovery');
  assert.equal(s.resolve, 3);
  assert.ok(s.inventory.includes('proof'));
  assert.ok(!s.inventory.includes('weight'));
  assert.equal(s.turn, 17);
});
test('Smee alternative works without cup, gift still possible after asking', () => {
  const s = play([...gold, ...door, 'talk_smee','ask_smee','gift_smee','inspect_base','trace_draft','return','leave']);
  assert.equal(s.ending.id, 'shared-discovery');
  assert.ok(!s.inventory.includes('cup'));
  assert.ok(!s.inventory.includes('amulet'));
});
test('risky floor route has its own ending and needs no NPC or cup', () => {
  const s = play([...door, 'inspect_base','pry_floor','return','leave']);
  assert.equal(s.ending.id, 'scarred-discovery');
});
test('rope route opens door without injury, sacrifices only the rope', () => {
  const s = play(['go_barred','inspect_door','rope_door']);
  assert.equal(s.resolve, 3);
  assert.equal(s.flags.hammerSpent, true);
  assert.ok(!s.inventory.includes('rope'));
  assert.ok(getActions(s).some(a => a.id === 'go_falseking'));
});
test('treasure and early retreat produce distinct conclusions', () => {
  assert.equal(play([...gold,'leave']).ending.id, 'treasure');
  assert.equal(play(['leave']).ending.id, 'safe-return');
});
test('injury and lamp depletion end gracefully; no post-ending action', () => {
  const hurt = play(['go_guard','break_statue','go_entrance','go_sorcerer','take_ring','go_entrance','go_barred','force_door']);
  assert.equal(hurt.resolve, 0);
  assert.equal(hurt.status, 'ended');
  assert.deepEqual(getActions(hurt), []);
  const timed = play(Array(MAX_TURNS).fill('observe'));
  assert.equal(timed.status, 'ended');
  assert.equal(getView(timed).remainingTurns, 0);
  assert.throws(() => applyAction(timed, 'observe'));
});
test('cannot teleport, repeat rewards or mutate original object', () => {
  const initial = createGame();
  assert.throws(() => applyAction(initial, 'go_temple'));
  assert.throws(() => applyAction(initial, 'pour_water'));
  applyAction(initial,'go_guard');
  assert.equal(initial.location, 'entrance');
  const s = play(['go_guard','inspect_statue','wrap_statue']);
  assert.throws(() => applyAction(s, 'wrap_statue'));
  assert.throws(() => applyAction(s, 'break_statue'));
  assert.equal(getView(s).stats.treasure, 1);
});
test('initial view and narration context withhold undiscovered rooms and solutions', () => {
  const initial = createGame();
  const v = getView(initial);
  assert.equal(v.flags, undefined);
  assert.deepEqual(v.clues, []);
  assert.ok(!v.map.some(r => r.id === 'temple'));
  assert.ok(!JSON.stringify(narrationContext(initial, '')).includes('斯米'));
  assert.ok(!JSON.stringify(narrationContext(initial, '')).includes('真正的王印'));
});
test('scene description never respawns removed objects', () => {
  const s = play([...door,'go_falseking','go_barred','go_entrance','go_scholar']);
  assert.ok(!getView(s).location.description.includes('地上有一枚'));
  const t = play(['go_sorcerer','take_cup','take_ring']);
  assert.ok(!getView(t).location.description.includes('套着银戒'));
  assert.ok(!getView(t).location.description.includes('一只青铜小杯倒'));
});
