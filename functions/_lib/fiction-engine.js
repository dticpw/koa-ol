// Snake Tomb / 蛇墓余火 — deterministic, server-only adventure rules.
// Adapted from Tomb of the Serpent Kings by Skerples, CC BY-NC-SA 4.0.
// See games/lantern-tomb/credits.html. Never send the private state to a model/client.
export const MAX_TURNS = 40;
const TITLE = '蛇墓余火';
const rooms = {
  entrance: { name: '雨中的墓道', description: '雨水在墓口织成一道银帘。你的灯照见三条短廊：盾纹、书卷与弯曲的法杖刻在各自的门楣上。正前方，一道横着粗重石闩的门挡住了去路。', exits: ['guard', 'scholar', 'sorcerer', 'barred'] },
  guard: { name: '守卫墓', description: '两具陶制蛇人像躺在浅棺中，头顶还留着一道细细的接缝。一处裂口里闪着金色。地面蒙着黄灰，靠近棺口的虫子一动不动。', exits: ['entrance'] },
  scholar: { name: '学者墓', description: '断裂的书卷浮雕铺满墙壁。地上有一枚沉重的方形石镇，壁画里，两根细杆托着一根横闩；更深处的碑文被人用炭涂黑了一半。', exits: ['entrance'] },
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
  proof: { name: '真墓入口记录', description: '台座下的阶梯、真实王印与入口方位。足以带领下一支队伍回来。' },
};
const clueBook = {
  poison: { title: '金光与黄灰', text: '陶像是中空的。棺边的死虫、接缝和黄灰说明里面可能有危险粉尘；墓口有水，厚布可以浸湿。' },
  pins: { title: '不能松开的铁栓', text: '壁画中的横闩压住两根铁栓。抬闩时若铁栓弹起，门顶机关就会被释放。必须继续压住它们，或让人远离机关再触发。' },
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
  if (s.location === 'sorcerer' && s.flags.cupTaken) text = text.replace('一只青铜小杯倒在干涸的石槽旁。', '干涸的石槽旁留着青铜小杯原来的圆印。');
  if (s.location === 'sorcerer' && s.flags.ringTaken) text = text.replace('陶棺内的手指上套着银戒，周围是一圈漆黑的痕迹。', '陶棺内的手指已经空了，只留下一圈漆黑的痕迹。');
  if (s.location === 'barred' && s.flags.doorOpen) text = s.flags.hammerSpent ? '石锤已经砸落，碎裂在门前。越过碎石，伪王墓的门敞开着。' : '石镇稳稳压住铁栓，横闩已被移开。你可以进入伪王墓。请别挪动机关上的石镇。';
  if (s.location === 'temple' && s.flags.trueEntrance) text += '\n台座旁的活动地板已经移开，一段向下的阶梯显露出来。你记下了位置，入口可以安全留给下一支队伍。';
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
        if (s.clues.includes('pins') && s.inventory.includes('weight')) push('weight_door', '用石镇压住铁栓，再抬横闩');
        if (s.clues.includes('pins') && s.inventory.includes('rope')) push('rope_door', '退到安全处，用绳索拉开横闩');
        push('force_door', '直接抬起横闩', '这可能触发门顶的东西');
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
    case 'read_relief': add(s.clues, 'pins'); effect = '你读懂了壁画：横闩压住铁栓，铁栓一弹起，顶上的巨物就会落下。让重量继续压着铁栓，或远远拉动横闩，都能避免站在落点。'; break;
    case 'take_weight': s.flags.weightTaken = true; add(s.inventory, 'weight'); effect = '你把方形石镇放进背包。它很沉，底部平整，恰好能同时压住相近的两点。'; break;
    case 'read_water': add(s.clues, 'water'); effect = '石刻不是咒语，而是一幅示意：杯中的水流过神像脚下，进入地下阶梯。你记住了那句“让水先替你走”。'; break;
    case 'take_cup': s.flags.cupTaken = true; add(s.inventory, 'cup'); effect = '你拾起青铜小杯。杯身完好，可以从浅水里舀出一杯水。'; break;
    case 'take_ring': s.flags.ringTaken = true; add(s.inventory, 'ring'); s.resolve -= 1; effect = '银戒离开指骨时，一阵刺骨的寒意沿着你的手臂窜上来。你把它裹好收起，手指却暂时不听使唤。取得银戒，状态损失一格。'; break;
    case 'inspect_door': s.flags.trapInspected = true; add(s.clues, 'pins'); effect = '灯光伸进凹槽，你看见悬起的石锤。两根铁栓就是它的释放机关。石闩可以移开，但必须保持铁栓受压，或从落点外拉动横闩。'; break;
    case 'weight_door': s.flags.doorOpen = true; remove(s.inventory, 'weight'); effect = '石镇接过横闩的重量，两根铁栓没有弹起。你移开横闩，打开了门。石镇留在机关上，石锤仍安静地悬在头顶。'; break;
    case 'rope_door': s.flags.doorOpen = true; s.flags.hammerSpent = true; remove(s.inventory, 'rope'); effect = '你把绳子系在横闩上，退到侧廊再拉。铁栓弹起，石锤轰然落下，把绳子压在碎石底下。你毫发无伤，石门已经打开。'; break;
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
  s.log.push({ role: 'player', turn: s.turn, text: String(playerText || label).slice(0, 300) });
  if (s.status === 'playing' && (s.turn >= MAX_TURNS || s.resolve <= 0)) { finish(s, true); effect += `\n${s.ending.text}`; }
  if (s.turn === 28 && s.status === 'playing') effect += '\n灯芯轻轻爆了一声。灯火还剩十二步，该留意归路了。';
  s.log.push({ role: 'narrator', turn: s.turn, text: effect });
  return { state: s, effect };
}

export function getView(s) {
  const visible = new Set(s.visited);
  for (const a of getActions(s)) if (a.id.startsWith('go_')) visible.add(a.id.slice(3));
  return { title: TITLE, sessionId: s.sessionId, revision: s.revision, turn: s.turn, maxTurns: MAX_TURNS,
    location: { id: s.location, name: rooms[s.location].name, description: info(s) }, status: s.status, ending: s.ending,
    inventory: s.inventory.map(id => ({ id, name: itemBook[id].name, description: itemBook[id].description })),
    clues: s.clues.map(id => ({ id, ...clueBook[id] })),
    map: [...visible].map(id => ({ id, name: rooms[id].name, visited: s.visited.includes(id), current: s.location === id })),
    choices: getActions(s), log: s.log.map(x => ({ role: x.role, text: x.text, turn: x.turn })),
    stats: { resolve: s.resolve, treasure: treasure(s) }, model: 'gpt-5.6-sol', remainingTurns: MAX_TURNS - s.turn };
}

export function narrationContext(s, effect) {
  const v = getView(s);
  return { title: v.title, turn: v.turn, location: v.location, outcome: effect, status: v.status, ending: v.ending,
    inventory: v.inventory, clues: v.clues, stats: v.stats,
    recentEvents: v.log.slice(-6), choices: v.choices.map(({ id, label }) => ({ id, label })) };
}
