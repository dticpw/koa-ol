import {hostView} from './fiction-models.js';
// Snake Tomb / 蛇墓余火 — deterministic, server-only adventure rules.
// Adapted from Tomb of the Serpent Kings by Skerples, CC BY-NC-SA 4.0.
// See games/lantern-tomb/credits.html. Never send the private state to a model/client.
export const MAX_TURNS = 40;
const TITLE = '蛇墓余火';
const rooms = {
  entrance: { name: '雨中的墓道', description: '雨水在墓口织成一道银帘。你的灯照见三条短廊：盾纹、书卷与弯曲的法杖刻在各自的门楣上。正前方，一道横着粗重石闩的门挡住了去路。', exits: ['guard', 'scholar', 'sorcerer', 'barred'] },
  guard: { name: '守卫墓', description: '两具陶制蛇人像躺在浅棺中，头顶还留着一道细细的接缝。一处裂口里闪着金色。地面蒙着黄灰，靠近棺口的虫子一动不动。', exits: ['entrance'] },
  scholar: { name: '学者墓', description: '断裂的书卷浮雕铺满墙壁。地上有一枚沉重的方形石镇。壁画刻着一幅石门机关示意：两根细杆托着一根横闩，它们都是墙上的刻线，并非墓室里的实物。更深处的碑文被人用炭涂黑了一半。', exits: ['entrance'] },
  sorcerer: { name: '术士墓', description: '一只青铜小杯倒在干涸的石槽旁。墙上，一条细线从杯口延伸到蛇人神像脚下。陶棺内的手指上套着银戒，周围是一圈漆黑的痕迹。', exits: ['entrance'] },
  barred: { name: '横闩石门', description: '石闩的两端压着两根铁栓。门顶有一道很深的凹槽；几片碎石表面平整得像被巨物拍过。灰尘里，有人最后留下的脚印忽然中断。', exits: ['entrance', 'falseking'] },
  falseking: { name: '伪王墓', description: '王冠、宝剑、玉座，一切都太齐整。灯光落近时，镀金边缘露出了廉价的木头。石棺后方还有一道窄门，冷风正从那里吹来。', exits: ['barred', 'temple'] },
  temple: { name: '假神殿', description: '一尊高大的蛇人神像俯视着你。浅浅的积水顺着台座流走，石缝边有被冲刷过的泥沙。一个小个子身影躲在破幔后，眼睛跟着你的灯移动。', exits: ['falseking'] },
};
const itemBook = {
  rope: { name: '探路绳', description: '一捆结实的绳子。能从远处牵动东西。' },
  cloth: { name: '厚布', description: '可浸湿后包住易碎或有灰尘的东西。' },
  chalk: { name: '白垩', description: '记路，也能标出不易看清的接缝。' },
  notebook: { name: '随身手记', description: '几页折好的纸，用来记录石刻、线索和归路。' },
  weight: { name: '方形石镇', description: '很沉，底部平整。' },
  cup: { name: '青铜小杯', description: '杯底刻着流水与阶梯。' },
  amulet: { name: '金制护符', description: '从陶像中取出的薄金护符。', value: 1 },
  ring: { name: '银戒', description: '从术士棺中取出的旧银戒，贴着皮肤时很冷。', value: 1 },
  rubbing: { name: '墓碑拓记', description: '你记录下来的墓碑文字与王冠造假证据。' },
  scholar_rubbing: { name: '学者碑文拓记', description: '厚重石闩、双栓与门顶机关的碑文抄记。' },
  proof: { name: '真墓入口记录', description: '台座下的阶梯、真实王印与入口方位。足以带领下一支队伍回来。' },
};
const clueBook = {
  poison: { title: '金光与黄灰', text: '陶像是中空的。棺边的死虫、接缝和黄灰说明里面可能有危险粉尘；墓口有水，厚布可以浸湿。' },
  pins: { title: '不能松开的铁栓', text: '壁画中的横闩压住两根铁栓。抬闩时若铁栓弹起，门顶机关就会被释放。必须继续压住它们，或让人远离机关再触发。' },
  inscription: { title: '炭痕下的警告', text: '擦去炭痕后读出：“闩离而双栓起，悬石下；留其重，莫立门中。”碑文与壁画一起解释了墓道正前方的横闩石门。' },
  water: { title: '水所走的路', text: '术士墓的石刻把杯、神像与向下的阶梯连在一起。图旁的字是：“让水先替你走。”' },
  false: { title: '王冠之下', text: '真正的王墓不会使用镀金木冠。这里是用来让盗墓者止步的假墓；冷风来自石棺后方。' },
  channel: { title: '台座的暗流', text: '假神殿的积水钻进台座旁的石缝。细看会发现流水冲掉了泥沙，露出一块与四周磨损不同的地板。' },
  smee: { title: '斯米的悄悄话', text: '斯米用手指描出一条弯线：“水下去，风上来。那块边上没有灰的石头，下面不是土。”' },
  true: { title: '真墓仍在更深处', text: '活动地板下面有向下的阶梯，门额的王印与伪王棺不同。你已经找到了真墓入口；继续深入需要新的补给。' },
};

export function createGame() {
  return { version: 1, sessionId: '', revision: 0, turn: 0, location: 'entrance', status: 'playing', ending: null,
    inventory: ['rope', 'cloth', 'chalk', 'notebook'], clues: [], visited: ['entrance'], flags: {}, resolve: 3,
    log: [{ role: 'narrator', turn: 0, text: '天亮以前，你要带着一件值得留下的东西离开这座蛇人古墓。可以是金子，也可以是一个被埋藏的答案。\n\n你点亮最后一盏灯。雨声渐远，三间侧墓与一道横闩石门出现在光里。背包里有绳子、厚布、白垩与随身手记。灯油够支撑四十轮行动，足够谨慎地走一趟。' }] };
}
function add(list, id) { if (!list.includes(id)) list.push(id); }
function remove(list, id) { const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); }
function treasure(s) { return s.inventory.reduce((n, id) => n + (itemBook[id]?.value || 0), 0); }
function info(s) {
  let text = rooms[s.location].description;
  if (s.location === 'guard' && s.flags.amuletTaken) text = '两具陶制蛇人像躺在浅棺中。其中一具已经打开，金护符不再躺在里面。地上的黄灰与棺边的死虫提醒着你刚才的危险。';
  if (s.location === 'scholar' && s.flags.weightTaken) text = text.replace('地上有一枚沉重的方形石镇', '石镇原来的位置只剩一块干净的方印');
  if (s.location === 'scholar' && s.flags.inscriptionRead) text = text.replace('更深处的碑文被人用炭涂黑了一半。', '碑文上的炭痕已经擦开，露出关于双栓与悬石的警告。');
  if (s.location === 'sorcerer' && s.flags.cupTaken) text = text.replace('一只青铜小杯倒在干涸的石槽旁。', '干涸的石槽旁留着青铜小杯原来的圆印。');
  if (s.location === 'sorcerer' && s.flags.ringTaken) text = text.replace('陶棺内的手指上套着银戒，周围是一圈漆黑的痕迹。', '陶棺内的手指已经空了，只留下一圈漆黑的痕迹。');
  if (s.location === 'barred' && s.flags.doorOpen) text = s.flags.hammerSpent ? '石锤已经砸落，碎裂在门前。越过碎石，伪王墓的门敞开着。' : '石镇稳稳压住铁栓，横闩已被移开。你可以进入伪王墓。请别挪动机关上的石镇。';
  if (s.location === 'barred' && !s.flags.doorOpen && s.flags.doorWeighted) text += '\n你放下的石镇正压住双栓，横闩还未抬起。';
  if (s.location === 'barred' && !s.flags.doorOpen && s.flags.doorRoped) text += '\n探路绳已系在横闩上，绳尾延伸到落点之外，还没有拉动。';
  if (s.location === 'temple' && s.flags.trueEntrance) text += '\n台座旁的活动地板已经移开，一段向下的阶梯显露出来。你记下了位置，入口可以安全留给下一支队伍。';
  if (s.flags.routeMarks?.includes(s.location)) text += '\n入口边留着你用白垩画下的归路箭头。';
  return text;
}

export function getActions(s) {
  if (s.status !== 'playing') return [];
  const a = [];
  const push = (id, label, hint) => a.push({ id, label, ...(hint ? { hint } : {}) });
  push('observe', '仔细观察这里', '重新看一眼现场，也会消耗一步灯火');
  switch (s.location) {
    case 'entrance': push('leave', '离开古墓', '带着已有的收获结束本次探索'); break;
    case 'guard':
      if (!s.clues.includes('poison')) push('inspect_statue', '检查陶像与黄灰');
      if (!s.flags.amuletTaken) {
        if (s.clues.includes('poison')) push('wrap_statue', '用湿布包住陶像，再取金光', '厚布与墓口雨水都已具备');
        push('break_statue', '直接打开陶像', '金光近在咫尺，但里面是什么还不确定');
      }
      break;
    case 'scholar':
      if (!s.clues.includes('pins')) push('read_relief', '辨读铁栓壁画');
      if (!s.flags.weightTaken) push('take_weight', '带上方形石镇');
      break;
    case 'sorcerer':
      if (!s.clues.includes('water')) push('read_water', '辨读流水石刻');
      if (!s.flags.cupTaken) push('take_cup', '拾起青铜小杯');
      if (!s.flags.ringTaken) push('take_ring', '取下棺中的银戒', '戒指四周有一圈黑痕');
      break;
    case 'barred':
      if (!s.flags.doorOpen) {
        if (!s.flags.trapInspected) push('inspect_door', '检查铁栓与门顶凹槽');
        if (s.flags.doorWeighted) push('lift_door', '保持石镇压住铁栓，抬起横闩');
        if (s.flags.doorRoped) push('pull_rope', '退到侧廊，拉动已系好的绳索');
        if (!s.flags.doorWeighted && s.clues.includes('pins') && s.inventory.includes('weight')) push('weight_door', '用石镇压住铁栓，再抬横闩');
        if (s.clues.includes('pins') && s.inventory.includes('rope')) push('rope_door', '退到安全处，用绳索拉开横闩');
        if (!s.flags.doorWeighted) push('force_door', '直接抬起横闩', '这可能触发门顶的东西');
      }
      break;
    case 'falseking': if (!s.clues.includes('false')) push('inspect_king', '查验王冠和石棺'); break;
    case 'temple':
      if (!s.flags.smeeMet) push('talk_smee', '向破幔后的人影打招呼');
      else {
        if (!s.clues.includes('smee')) push('ask_smee', '问斯米这里的风和水', '礼貌交谈，不需要交出财物');
        if (!s.flags.smeeTrusted && s.inventory.includes('amulet')) push('gift_smee', '把金护符交给斯米，换他的信任');
      }
      if (!s.clues.includes('channel')) push('inspect_base', '检查神像脚下的水痕');
      if (!s.flags.trueEntrance && s.clues.includes('channel')) {
        if (s.inventory.includes('cup')) push('pour_water', '用杯舀水，沿台座石缝慢慢倒下');
        if (s.clues.includes('smee')) push('trace_draft', '沿斯米指出的风口，寻找活动地板');
        push('pry_floor', '顺着接缝强撬地板', '有可能破坏留在石上的文字');
      }
      if (s.flags.trueEntrance) push('return', '记录入口，沿原路返回墓口', '安全撤回，不必逐个房间走回去');
      break;
  }
  for (const id of rooms[s.location].exits) {
    if (id === 'falseking' && s.location === 'barred' && !s.flags.doorOpen) continue;
    push(`go_${id}`, `前往${rooms[id].name}`);
  }
  return a;
}

function finish(s, exhausted = false) {
  const gold = treasure(s);
  let ending;
  if (s.flags.trueEntrance) {
    ending = s.flags.damagedProof
      ? { id: 'scarred-discovery', title: '裂石里的答案', text: '你找到了通向真墓的阶梯。石刻在强撬中受了损伤，但你保存了入口的位置。下一次，会有人带着更好的工具回来。' }
      : s.flags.smeeTrusted
        ? { id: 'shared-discovery', title: '有人替你守灯', text: '你带回了真墓入口的记录，也在地底留下了一个愿意记住你的人。斯米答应照看那块活动地板——在你带着补给回来之前。' }
        : { id: 'discovery', title: '真正的门', text: '伪王墓没有骗过你。你带出了真实王印与入口的记录，留下完整的石刻。宝藏仍在地下，而下一次探索已经有了方向。' };
  } else if (gold) ending = { id: 'treasure', title: '掌心的微光', text: '你带着古墓中的财物回到了雨里。收获真实地压在掌心，但这座墓究竟藏着什么，仍留在那扇更深的门后。' };
  else ending = { id: 'safe-return', title: '平安也是收获', text: '你收起灯，回到了墓口。空着手走出来，也比留在黑暗里好。沿途记下的线索，足够让下一次出发更有把握。' };
  if (exhausted) ending.text += s.resolve <= 0 ? ' 身上的伤让你选择及时撤离。' : ' 灯油将尽，你在最后的光里结束了探索。';
  s.status = 'ended'; s.ending = ending; s.location = 'entrance';
}

export function applyAction(original, actionId, playerText = '') {
  if (!getActions(original).some(a => a.id === actionId)) throw new Error('ACTION_NOT_ALLOWED');
  const s = structuredClone(original);
  const label = getActions(original).find(a => a.id === actionId).label;
  s.turn += 1; s.revision += 1;
  let effect = '';
  if (actionId.startsWith('go_')) {
    s.location = actionId.slice(3); add(s.visited, s.location);
    effect = `你来到${rooms[s.location].name}。${info(s)}`;
  } else switch (actionId) {
    case 'observe': effect = info(s); break;
    case 'leave': finish(s); effect = `你选择结束探索。${s.ending.text}`; break;
    case 'inspect_statue': add(s.clues, 'poison'); effect = '你发现陶像里藏着金护符，也封着危险黄灰。棺边的死虫证实了你的猜测。用湿布包住接缝，应该能让粉尘留在布里。'; break;
    case 'wrap_statue': s.flags.amuletTaken = true; add(s.inventory, 'amulet'); effect = '你浸湿厚布，包住陶像的接缝再慢慢打开。黄灰留在湿布里，金护符安全地落入掌心。你没有受伤。'; break;
    case 'break_statue': s.flags.amuletTaken = true; add(s.inventory, 'amulet'); add(s.clues, 'poison'); s.resolve -= 1; effect = '陶像裂开，金护符掉了出来，黄灰也扑向你的脸。你及时退开，但仍呛得胸口作痛。取得金护符，状态损失一格。'; break;
    case 'read_relief': add(s.clues, 'pins'); effect = '你读懂了墙上的机关示意：画中横闩压住铁栓，铁栓一弹起，顶上的巨物就会落下。这是在解释墓道正前方的横闩石门；学者墓里只有图画，没有可压的铁栓。到石门处让重量继续压着铁栓，或远远拉动横闩，都能避免站在落点。'; break;
    case 'take_weight': s.flags.weightTaken = true; add(s.inventory, 'weight'); effect = '你把方形石镇放进背包。它很沉，底部平整，恰好能同时压住相近的两点。'; break;
    case 'read_water': add(s.clues, 'water'); effect = '石刻不是咒语，而是一幅示意：杯中的水流过神像脚下，进入地下阶梯。你记住了那句“让水先替你走”。'; break;
    case 'take_cup': s.flags.cupTaken = true; add(s.inventory, 'cup'); effect = '你拾起青铜小杯。杯身完好，可以从浅水里舀出一杯水。'; break;
    case 'take_ring': s.flags.ringTaken = true; add(s.inventory, 'ring'); s.resolve -= 1; effect = '银戒离开指骨时，一阵刺骨的寒意沿着你的手臂窜上来。你把它裹好收起，手指却暂时不听使唤。取得银戒，状态损失一格。'; break;
    case 'inspect_door': s.flags.trapInspected = true; add(s.clues, 'pins'); effect = '灯光伸进凹槽，你看见悬起的石锤。两根铁栓就是它的释放机关。石闩可以移开，但必须保持铁栓受压，或从落点外拉动横闩。'; break;
    case 'lift_door':
    case 'weight_door': s.flags.doorOpen = true; remove(s.inventory, 'weight'); effect = '石镇接过横闩的重量，两根铁栓没有弹起。你移开横闩，打开了门。石镇留在机关上，石锤仍安静地悬在头顶。'; break;
    case 'pull_rope':
    case 'rope_door': s.flags.doorOpen = true; s.flags.hammerSpent = !s.flags.doorWeighted; remove(s.inventory, 'rope'); effect = s.flags.doorWeighted ? '你从侧廊拉动绳索，横闩被移开。石镇仍压住铁栓，石锤没有落下，门已经打开。绳子仍系在移开的横闩上。' : '你确认绳子系在横闩上，退到侧廊再拉。铁栓弹起，石锤轰然落下，把绳子压在碎石底下。你毫发无伤，石门已经打开。'; break;
    case 'force_door': s.flags.doorOpen = true; s.flags.hammerSpent = true; s.resolve -= 1; effect = '横闩一抬，头顶便传来沉重的断裂声。你扑向门边，碎石擦伤肩膀。石锤已落下，门打开了，状态损失一格。'; break;
    case 'inspect_king': add(s.clues, 'false'); add(s.inventory, 'rubbing'); effect = '王冠是镀金木制品，碑文也刻意含混。你把文字与造假痕迹记在纸上：这里并非真正的王墓。石棺后方的风，来自更深处。'; break;
    case 'talk_smee': s.flags.smeeMet = true; effect = '小个子从破幔后探出头，自称斯米。他没有靠近你的背包，只小声问：“你也发现这里的王是假的了？”他愿意谈谈自己见过的事。'; break;
    case 'ask_smee': add(s.clues, 'smee'); effect = '斯米蹲下指着台座：“水下去，风上来。那块边上没有灰的石头，下面不是土。”他提醒你别砸坏那块刻了字的地板。'; break;
    case 'gift_smee': remove(s.inventory, 'amulet'); s.flags.smeeTrusted = true; add(s.clues, 'smee'); effect = '斯米接过金护符，认真把它藏好。他指给你一块边缘没有灰的活动地板，并答应替你守住入口。你失去了金护符，赢得了他的信任。'; break;
    case 'inspect_base': add(s.clues, 'channel'); effect = '你顺着水痕看到台座旁的一条细缝。泥沙被冲走后，一块活动地板的边缘显露出来。需要确认它的边界，再把它挪开。'; break;
    case 'pour_water': s.flags.trueEntrance = true; add(s.clues, 'true'); add(s.inventory, 'proof'); effect = '你舀起积水，沿接缝慢慢倒下。水冲走泥沙，完整的活动地板显露出来。你小心移开它，发现向下的阶梯与真正的王印，并记下了入口。'; break;
    case 'trace_draft': s.flags.trueEntrance = true; add(s.clues, 'true'); add(s.inventory, 'proof'); effect = '你沿斯米指出的风口摸索，用白垩标出接缝，再平稳挪开活动地板。向下的阶梯与真正的王印显露出来。你完整地记下了入口。'; break;
    case 'pry_floor': s.flags.trueEntrance = true; s.flags.damagedProof = true; add(s.clues, 'true'); add(s.inventory, 'proof'); effect = '活动地板终于被撬开，一角石刻也随之崩裂。你看见向下的阶梯和残留的王印，记下了入口。发现已经成立，但部分文字无法恢复。'; break;
    case 'return': s.location = 'entrance'; effect = '你收好真墓入口的记录，沿着熟悉的路线退回墓口。雨还在下。现在可以决定带着这些收获离开。'; break;
    default: throw new Error('ACTION_NOT_IMPLEMENTED');
  }
  return conclude(s, effect, playerText || label);
}

function conclude(s, effect, playerText, consumesTurn = true) {
  s.log.push({ role: 'player', turn: s.turn, text: String(playerText).slice(0, 300) });
  if (s.status === 'playing' && (s.turn >= MAX_TURNS || s.resolve <= 0)) { finish(s, true); effect += `\n${s.ending.text}`; }
  if (consumesTurn && s.turn === 28 && s.status === 'playing') effect += '\n灯芯轻轻爆了一声。灯火还剩十二步，该留意归路了。';
  s.log.push({ role: 'narrator', turn: s.turn, text: effect });
  return { state: s, effect, consumesTurn };
}

export function getView(s) {
  const visible = new Set(s.visited);
  for (const a of getActions(s)) if (a.id.startsWith('go_')) visible.add(a.id.slice(3));
  return { title: TITLE, sessionId: s.sessionId, revision: s.revision, turn: s.turn, maxTurns: MAX_TURNS,
    location: { id: s.location, name: rooms[s.location].name, description: info(s) }, status: s.status, ending: s.ending,
    inventory: s.inventory.map(id => ({ id, name: itemBook[id].name, description: itemBook[id].description })),
    clues: [...s.clues.map(id => ({ id, ...clueBook[id] })), ...(s.fieldNotes || [])],
    map: [...visible].map(id => ({ id, name: rooms[id].name, visited: s.visited.includes(id), current: s.location === id })),
    choices: getActions(s), log: s.log.map(x => ({ role: x.role, text: x.text, turn: x.turn })),
    stats: { resolve: s.resolve, treasure: treasure(s) }, ...hostView(s), remainingTurns: MAX_TURNS - s.turn };
}

export function narrationContext(s, effect) {
  const v = getView(s);
  return { title: v.title, turn: v.turn, location: v.location, outcome: effect, status: v.status, ending: v.ending,
    inventory: v.inventory, clues: v.clues, stats: v.stats,
    recentEvents: v.log.slice(-6), choices: v.choices.map(({ id, label }) => ({ id, label })) };
}

// Free actions are composed from verbs, local objects and carried tools. They
// deliberately do not use getActions(): those are only the suggested shortcuts.
export const INTERACTION_VERBS = ['examine', 'touch', 'listen', 'smell', 'clean', 'take', 'use', 'place', 'tie', 'force', 'talk', 'offer', 'mark', 'record', 'wait'];
const sceneObjects = {
  entrance: [
    ['rain', '墓口雨水', 'water', '雨水就在墓口，可浸湿厚布。'],
    ['passages', '侧廊与门楣', 'stone', '盾纹、书卷、法杖各标记一间侧墓，正前方是横闩石门。'],
  ],
  guard: [
    ['statues', '陶像与浅棺', 'fragile', '陶像有接缝，一处裂口里闪着金光，附近有黄灰与死虫。'],
    ['dust', '黄灰与死虫', 'hazard', '虫子在黄灰边一动不动。不要靠近嗅闻或扬起粉末。'],
  ],
  scholar: [
    ['relief', '机关壁画、画中的细杆与横闩', 'drawing', '细杆与横闩只是墙上的刻线，图画指向墓道正前方的横闩石门。'],
    ['inscription', '炭黑碑文', 'writing', '碑文被炭粉涂黑了一半，炭粉附着在浅刻的字槽边。'],
    ['scrolls', '断裂的书卷浮雕', 'stone', '石头刻成书卷的样子，与墓墙连成一体，没有纸页。'],
  ],
  sorcerer: [
    ['water_relief', '流水石刻', 'drawing', '墙上细线连接杯口与神像脚下，旁边刻着字。'],
    ['basin', '干涸石槽', 'stone', '石槽已干涸，边沿留着水痕，没有水可舀。'],
    ['coffin', '陶棺与指骨', 'fragile', '指骨四周有一圈漆黑痕迹。'],
  ],
  barred: [
    ['door', '横闩石门、铁栓与门顶凹槽', 'mechanism', '真实的横闩压住两根铁栓，门顶有一道深槽。'],
  ],
  falseking: [
    ['king', '王冠、宝剑、玉座与石棺', 'display', '摆设过分齐整，镀金边缘露出木头。石棺后方有冷风。'],
  ],
  temple: [
    ['base', '神像台座、水痕与地板接缝', 'mechanism', '台座旁的浅水流向石缝，泥沙被冲走。'],
    ['water', '台座旁的浅水', 'water', '浅水可用杯舀取，也可浸湿厚布。'],
    ['smee', '破幔后的小个子', 'person', '小个子藏在破幔后，正看着你的灯。'],
  ],
};

export function interactionContext(s) {
  const targets = [
    { id: 'room', name: rooms[s.location].name, kind: 'place', description: info(s) },
    { id: 'wall', name: '墙面与入口边', kind: 'stone', description: '可以检查、画记号；厚实的石墙并非可随手挪走的物件。' },
    { id: 'lamp', name: '手中的灯', kind: 'light', description: '灯火有限，没有备用灯油。' },
    ...sceneObjects[s.location].map(([id, name, kind, description]) => ({ id, name, kind, description })),
    ...s.inventory.map(id => ({ id, name: itemBook[id].name, kind: 'carried', description: itemBook[id].description })),
  ];
  if (s.location === 'scholar' && !s.flags.weightTaken) targets.push({ id: 'weight', name: '地上的方形石镇', kind: 'loose', description: '沉重、平底，可拿取。' });
  if (s.location === 'sorcerer' && !s.flags.cupTaken) targets.push({ id: 'cup', name: '石槽旁的青铜小杯', kind: 'loose', description: '倒在石槽旁，可拿取。' });
  if (s.location === 'sorcerer' && !s.flags.ringTaken) targets.push({ id: 'ring', name: '指骨上的银戒', kind: 'loose', description: '套在指骨上，四周有黑痕。' });
  if (s.location === 'scholar' && s.flags.inscriptionRead) targets.find(t => t.id === 'inscription').description = clueBook.inscription.text;
  if (s.location === 'guard' && s.flags.amuletTaken) targets.find(t => t.id === 'statues').description = info(s);
  if (s.location === 'barred') targets.find(t => t.id === 'door').description = info(s);
  if (s.location === 'temple' && s.flags.trueEntrance) targets.find(t => t.id === 'base').description = '地板已经移开，入口与王印已经记录。' ;
  if (s.flags.smeeMet && s.location === 'temple') targets.find(t => t.id === 'smee').name = '斯米';
  return { targets, tools: ['none', 'lamp', ...s.inventory], verbs: INTERACTION_VERBS };
}

export function applyInteraction(original, plan, playerText) {
  if (original.status !== 'playing' || original.turn >= MAX_TURNS) throw new Error('ACTION_NOT_ALLOWED');
  const world = interactionContext(original);
  const target = world.targets.find(t => t.id === plan.target_id);
  const verb = plan.verb, tool = plan.tool_id || 'none';
  if (!target || !INTERACTION_VERBS.includes(verb) || !world.tools.includes(tool)) throw new Error('INVALID_INTERACTION');
  const s = structuredClone(original);
  const commit = (effect, consumesTurn = true) => {
    s.revision += 1;
    if (consumesTurn) s.turn += 1;
    return conclude(s, effect + (consumesTurn ? '' : '（这次辨认不消耗灯火。）'), playerText, consumesTurn);
  };
  const scripted = id => applyAction(s, id, playerText);
  const can = id => getActions(s).some(a => a.id === id);
  const id = target.id;

  // A drawing cannot turn into a physical mechanism, even if a model proposes it.
  if (target.kind === 'drawing' && ['use', 'place', 'tie', 'force', 'take', 'offer'].includes(verb) && tool !== 'lamp') {
    return commit(id === 'relief'
      ? '你将目光移回墙面：两根细杆和横闩都是刻在石上的图画，这里没有可压住的实体。真正的横闩石门在雨中墓道正前方。你没有留下或消耗手边的物品，也没有触动任何机关。'
      : '手指接触到的是墙上的刻线，图画中的器物并不是眼前的实物。你没有取下或改变它，也没有消耗物品。', false);
  }
  if (verb === 'mark') {
    if (!['none', 'chalk'].includes(tool) || !s.inventory.includes('chalk')) return commit('这件工具不能留下清晰的白色路标，需要用白垩。你还没有画下标记。', false);
    if (!['wall', 'room', 'passages'].includes(id)) return commit('把归路标记画在入口边的石墙上会更清楚，不必涂在这件东西上。', false);
    s.flags.routeMarks ||= [];
    if (s.flags.routeMarks.includes(s.location)) return commit('入口边已经有你留下的白垩箭头，指向来路，尚未被擦掉。', false);
    add(s.flags.routeMarks, s.location);
    return commit('你用白垩在入口边画下指向来路的箭头。白色记号会留在这里，重返此处时仍能认出；白垩还够继续使用。');
  }
  if (verb === 'record') {
    if (!s.inventory.includes('notebook')) return commit('你没有可记录的手记，暂时只能记在心里。', false);
    if (id === 'inscription' && !s.flags.inscriptionRead) return commit('炭痕遮住了关键文字；你能描下黑色轮廓，却还不能得到完整的碑文内容。先清理表面会更有用。', false);
    s.fieldNotes ||= [];
    const noteId = `note_${s.location}_${id}`;
    if (s.fieldNotes.some(n => n.id === noteId)) return commit('手记里已有这一处的记录，你对照后没有发现需要补写的新变化。', false);
    const fact = id === 'inscription' ? clueBook.inscription.text : target.description;
    s.fieldNotes.push({ id: noteId, title: `${rooms[s.location].name} · ${target.name}`, text: fact });
    if (id === 'inscription') add(s.inventory, 'scholar_rubbing');
    return commit(`你把眼前已经能辨认的内容记入手记：${fact}记录已收进随身线索。`);
  }
  if ((id === 'rain' || id === 'water') && tool === 'cloth' && ['use', 'clean'].includes(verb)) {
    s.flags.clothWet = true;
    return commit('你将厚布浸湿，再拧去多余的水。湿布收在手边，可以擦拭石面或裹住有粉尘的物件。');
  }
  if (id === 'inscription' && (verb === 'clean' || (verb === 'use' && tool === 'cloth'))) {
    if (!['none', 'cloth'].includes(tool)) return commit('坚硬的工具容易划伤浅刻的文字。炭粉浮在表面，用手指轻拂或厚布擦拭就够了。', false);
    if (s.flags.inscriptionRead) return commit('炭痕已经擦开，警告仍然清楚可读。继续擦拭没有露出其他文字。', false);
    s.flags.inscriptionRead = true; add(s.clues, 'inscription'); add(s.clues, 'pins');
    return commit('你轻轻擦开碑文表面的炭粉，读出：“闩离而双栓起，悬石下；留其重，莫立门中。”旁边的刻图说明，这条警告对应墓道正前方的横闩石门，不是学者墓内的机关。你记下了警告，碑文没有损坏。');
  }
  if (id === 'inscription' && ['examine', 'touch', 'listen', 'smell'].includes(verb)) return commit(s.flags.inscriptionRead ? clueBook.inscription.text : '你凑近检查碑面：炭粉附在浅刻的字槽上，指腹能带下一点黑色。文字还被遮挡，但遮盖物并没有渗进石头，用厚布或手指轻拂就能尝试清理。');
  if (id === 'relief' && ['examine', 'touch'].includes(verb)) return can('read_relief') ? scripted('read_relief') : commit('你对照刻线再次确认：图中双栓和横闩对应外面那道石门。墙上没有可活动的细杆，也没有额外的暗钮。');
  if (id === 'water_relief' && verb === 'examine') return can('read_water') ? scripted('read_water') : commit(clueBook.water.text);
  if (id === 'statues' || id === 'dust') {
    if (['examine', 'touch'].includes(verb) || (verb === 'use' && tool === 'lamp')) return can('inspect_statue') ? scripted('inspect_statue') : commit(clueBook.poison.text);
    if (['smell', 'clean'].includes(verb) || (verb === 'force' && id === 'dust')) return commit('你在靠近黄灰前停住：旁边的死虫已经是足够的警告。你没有凑近吸入或扬起它，也没有取走粉末。', false);
    if (id === 'statues' && !s.flags.amuletTaken) {
      if (verb === 'use' && tool === 'cloth') {
        if (!s.flags.clothWet && !s.clues.includes('poison')) return commit('你把厚布比在接缝旁，干燥的布不能稳妥地挡住细粉。先检查黄灰，或去墓口把布浸湿，可以避免冒险。', false);
        add(s.clues, 'poison'); return scripted('wrap_statue');
      }
      if (verb === 'force') return scripted('break_statue');
    }
  }
  if (verb === 'take') {
    const pickup = { weight: 'take_weight', cup: 'take_cup', ring: 'take_ring' }[id];
    if (pickup && can(pickup)) return scripted(pickup);
    if (s.inventory.includes(id)) return commit(`${target.name}已经在你的背包里，没有再获得一件。`, false);
    return commit(`${target.name}并不是这里可以直接拾起带走的散落物。你确认了它的位置，没有把它加入背包。`, false);
  }
  if (id === 'door') {
    if (s.flags.doorOpen) return commit(info(s) + '你确认了门口的状态，没有挪动支撑物。', false);
    if (verb === 'examine' || verb === 'touch' || (verb === 'use' && tool === 'lamp')) return can('inspect_door') ? scripted('inspect_door') : commit(clueBook.pins.text + '你面前就是图中所示的真实机关。' + info(s));
    if (['use', 'place'].includes(verb) && tool === 'weight') {
      add(s.clues, 'pins'); s.flags.doorWeighted = true; remove(s.inventory, 'weight');
      return commit('你把方形石镇稳稳放在两根铁栓上，接住它们承受的重量。石镇留在机关上，横闩尚未抬起，门仍关着；接下来抬闩时可以继续保持双栓受压。');
    }
    if (['use', 'tie'].includes(verb) && tool === 'rope') {
      s.flags.doorRoped = true; remove(s.inventory, 'rope'); add(s.clues, 'pins');
      return commit('你把绳子系在横闩上，将另一端带到侧廊落点之外。绳子已经就位，但你还没有拉动它，门与机关都保持原状。');
    }
    if (verb === 'force') return scripted(s.flags.doorWeighted ? 'lift_door' : 'force_door');
    if (verb === 'use') return commit(`${target.name}承受着横闩的重量；这件工具无法稳定接替重量，也不能把你与落点隔开。你没有贸然抬闩，物品仍在。`, false);
  }
  if (id === 'king' && verb === 'examine') return can('inspect_king') ? scripted('inspect_king') : commit(clueBook.false.text);
  if (id === 'base') {
    if (s.flags.trueEntrance) return commit('活动地板已经移开，向下的入口就在眼前。你已记录王印与入口位置，本次补给不足以继续深入。', false);
    if (verb === 'examine' || verb === 'touch' || (verb === 'use' && tool === 'lamp')) return can('inspect_base') ? scripted('inspect_base') : commit(clueBook.channel.text);
    if (verb === 'use' && tool === 'cup') { add(s.clues, 'channel'); return scripted('pour_water'); }
    if (verb === 'force') { add(s.clues, 'channel'); return scripted('pry_floor'); }
    if (verb === 'listen') {
      if (s.clues.includes('smee')) { add(s.clues, 'channel'); return scripted('trace_draft'); }
      return commit('你蹲下听石缝里的动静。细微的水声就在台座边，尚不能凭它确定哪块地板可以移动；水痕和缝边的泥沙更容易看清。');
    }
  }
  if (id === 'smee') {
    if (verb === 'offer' && tool === 'amulet') { s.flags.smeeMet = true; return can('gift_smee') ? scripted('gift_smee') : commit('斯米认得你先前的善意，你们的信任仍在。', false); }
    if (verb === 'talk' || verb === 'listen') {
      if (!s.flags.smeeMet) return scripted('talk_smee');
      if (!s.clues.includes('smee')) return scripted('ask_smee');
      return commit('斯米愿意继续回答你的问题。他只知道这里是假王墓，见过台座旁的流水与石缝中的风；他没有走进更深处，也不知道完整的王族往事。' + clueBook.smee.text + (s.flags.smeeTrusted ? '他答应替你守住入口。' : '他愿意交谈，但你们尚未建立替你守候的信任。'));
    }
    if (verb === 'offer') return commit('斯米看了看你递近的东西，没有接走。它仍在你手中；他愿意先听你说话。', false);
  }
  if (verb === 'wait') return commit('你停下来整理呼吸，灯火仍在消耗。周围没有因此发生新的事件，身体状态也没有自动恢复。');
  if (verb === 'listen') return commit(`你静下来听${target.name}附近的声音：${s.location === 'entrance' ? '雨声盖过了细小的回响。' : '墓室里只有脚步与衣料的轻响，没有听见新的活动。'}这次聆听没有发现新的通道或人物。`);
  if (verb === 'smell') return commit('你保持距离辨认空气中的气息，只闻到潮石与旧尘，不能据此证明任何东西无毒或可以食用。');
  if (verb === 'examine' || verb === 'touch' || (verb === 'use' && tool === 'lamp')) return commit(`你把注意力集中到${target.name}。${target.description}这次检查没有移动它，也没有改变机关或物品。`);
  if (verb === 'talk') return commit('你的话在石壁间轻轻回响。这里没有能回答的人，墙上的文字也不会因询问自行开口。', false);
  if (verb === 'clean') return commit(`你拂去${target.name}表面的浮尘，没有在下方发现新的文字、机关或物品。`, true);
  if (verb === 'force') return commit(`你先试了试${target.name}的受力处。手边工具不足以在这里稳妥地拆开它，你没有强行毁坏或凭空打开通道。`, false);
  return commit(`你把${tool === 'none' ? '手' : tool === 'lamp' ? '灯' : itemBook[tool].name}移近${target.name}，试着寻找着力或连接的位置。${target.description}两者没有形成能够改变现场的作用；物品仍在原处，机关也没有变化。`, false);
}
