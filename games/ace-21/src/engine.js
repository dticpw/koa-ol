import { DECK_RULES, CARD_META, DEFAULT_DECK } from './deck-rules.js?v=101';
// Pure state transitions. The UI never decides damage, legality or turn ownership.
export const CATALOG = {
  foresight: { name: "占卜", icon: 'eye', family: '操控', cost: 1, stay: false, text: "查看自己王牌堆顶部至多3张，选1张加入手牌，其余按原相对顺序放到牌堆底部。" },
  dismantle: { name: "拆解", icon: 'scales', family: '操控', cost: 1, stay: false, text: "选择并移除自己桌上1张普通持续王牌，再从自己的王牌堆抽2张。" },
  allIn: { name: "孤注一掷", icon: 'sword', family: '进攻', cost: 1, stay: true, text: "在桌上时，双方本局败北时的伤害翻倍。先加减伤再倍增，多张倍率相乘，最终伤害上限最后生效。" },
  cashOut: { name: "见好就收", icon: 'scales', family: '操控', cost: 1, stay: false, text: "从自己的王牌堆抽1张，然后立即停牌并移交行动权。" },
  trapdoor: { name: "暗门", icon: 'moon', family: '操控', cost: 1, stay: false, text: "交换自己的底牌与当前最右侧明牌的位置。" },
  blindBet: { name: "盲注", icon: 'eye', family: '操控', cost: 1, stay: true, text: "宣告对手底牌数值。在桌上时，开牌猜中且获胜则对手伤害+3，猜中且败北则自己伤害−3。平局不受伤。" },
  curtain: { name: "帷幕", icon: 'moon', family: '操控', cost: 1, stay: true, text: "在桌上时，将自己下一张抽到的数牌暗置，自己可见；本王牌离场时该数牌明置。暗牌仍计点数，局末开牌。" },
  multiplyingG: { name: "增值的G", icon: 'scales', family: '操控', cost: 1, stay: false, text: "打出后至本局结束，对手每使用一张王牌，自己从剩余王牌堆抽一张。此效果不占桌面牌位，可叠加。" },
  nurture: { name: "哺育", icon: 'crown', family: '操控', cost: 1, stay: true, text: "在桌上时，以打出时数牌池张数为基准：每减少一张目标+1，每增加一张目标−1。多张叠加；希儿的决定权优先锁定目标。" },
  blackjack: { name: "黑杰克", icon: 'sword', family: '进攻', cost: 1, stay: true, text: "在桌上时，自己以恰好21点赢得本局，造成的伤害翻倍。多张倍率相乘，最终伤害封顶仍生效。" },
  shield: { name: '护盾', icon: 'shield', family: '守护', cost: 1, stay: true, text: '在桌上时，你输掉本局的伤害减少 1。' },
  joy: { name: '幸福', icon: 'star', family: '命运', cost: 1, text: '双方各获得 1 张王牌。' },
  add1: { name: '+1', icon: 'sword', family: '进攻', cost: 1, stay: true, text: '对手输掉本局的伤害增加 1；打出时获得 1 张王牌。' },
  cycle: { name: '王牌变换', icon: 'cycle', family: '命运', cost: 1, text: '随机弃掉另外 2 张手牌王牌，再获得 3 张。至少需要另外 2 张手牌。' },
  return: { name: '退回', icon: 'return', family: '操控', cost: 1, text: '将自己最右侧的数牌洗回数牌池，不能退回底牌。' },
  destroy: { name: '破坏', icon: 'break', family: '操控', cost: 1, text: '移除对手桌上最右侧的王牌。' },
  swap: { name: '交换', icon: 'swap', family: '操控', cost: 1, text: '交换双方最右侧的数牌并明置，不影响底牌。' },
  remove: { name: '撤除', icon: 'return', family: '操控', cost: 1, text: '将对手最右侧的数牌洗回数牌池，不影响底牌。' },
  desire: { name: '欲望', icon: 'eye', family: '进攻', cost: 1, stay: true, text: '对手输掉本局时，额外受到其手牌王牌数量一半的伤害，向下取整。' },
  shield2: { name: '护盾+', icon: 'shield', family: '守护', cost: 1, stay: true, text: '在桌上时，你输掉本局的伤害减少 2。' },
  add2: { name: '+2', icon: 'sword', family: '进攻', cost: 1, stay: true, text: '对手输掉本局的伤害增加 2；打出时获得 1 张王牌。' },
  destroyAll: { name: '破坏+', icon: 'break', family: '操控', cost: 1, text: '移除对手桌上的所有王牌。' },
  devil: { name: '魔抽', icon: 'moon', family: '命运', cost: 1, stay: true, text: '立即获得 3 张王牌；在桌上时，你输掉本局的伤害增加 1。' },
  slam: { name: '盾击', icon: 'sword', family: '进攻', cost: 1, stay: true, text: '自己的桌上至少有 2 张护盾或护盾+时可生效，不消耗护盾。在桌上时，对手输掉本局的伤害增加 3。护盾牌不足 2 张时，本牌直接弃置。' },
  harvest: { name: '收割', icon: 'harvest', family: '命运', cost: 1, stay: true, text: '在桌上时，此后每使用 1 张王牌就获得 1 张新王牌。打出自身不触发。' },
  curse: { name: '诅咒', icon: 'eye', family: '进攻', cost: 1, text: '随机弃掉另外 1 张手牌王牌，强迫对手抽 1 张数牌。至少需要另外 1 张手牌。' },
  number: { name: '数字', icon: 'number', family: '操控', cost: 1, text: '抽取指定数牌；它已不在牌池时无事发生。' },
  challenge: { name: '挑战', icon: 'crown', family: '规则', cost: 1, stay: true, text: '将目标改为本牌点数，并移除双方桌上的其他挑战牌。此牌离场后恢复目标 21。' },
  perfect: { name: '圆满', icon: 'star', family: '进攻', cost: 1, stay: true, text: '对手输掉本局的伤害增加 2；从牌池抽取不使你爆牌的最大数牌。没有安全牌时不抽。' },
  seelieCute: { name: '希儿很可爱', icon: 'moon', family: '希儿专属', special: true, cost: 1, stay: true, text: '在牌桌上时，本轮结束不进行任何血量结算，直接进入下一轮发牌。' },
  seelieAngry: { name: '希儿生气了', icon: 'sword', family: '希儿专属', special: true, cost: 1, stay: true, text: '在牌桌上时，双方所有普通及专属王牌均无法打出。本轮真人玩家输掉对局的血量损失最高为 3 点；仍可抽数牌和停牌。' },
  seelieInsight: { name: '希儿看破一切', icon: 'eye', family: '希儿专属', special: true, cost: 1, stay: true, text: '在牌桌上时，对手输掉本局的伤害增加 1。打出时无视牌池，创造一张「当前目标 − 希儿点数总和」的数牌，可超过 11，也可为 0 或负数。创造牌被洗回、交换或本牌被破坏时直接消失，不进入牌池。' },
  seelieWant: { name: '希儿想要那个', icon: 'star', family: '希儿专属', special: true, cost: 1, stay: true, text: '打出时获得 3 张随机普通王牌；在牌桌上被破坏时，再获得 2 张随机普通王牌。自然换局清场不触发。' },
  seelieForget: { name: '希儿忘记了', icon: 'cycle', family: '希儿专属', special: true, cost: 1, stay: true, text: '打出时，双方将底牌之外的全部数牌洗回牌池；创造牌直接消失。在牌桌上被破坏时，对手抽取牌池中点数最小的数牌；空池时不抽。' },
  seelieDecision: { name: '希儿的决定权', icon: 'crown', family: '希儿专属', special: true, cost: 1, stay: true, text: '在牌桌上时，目标固定为打出时希儿的数牌总和，后续点数变化不改变该目标；双方均不能打出挑战牌。本牌离场后恢复场上挑战牌的目标，若无则恢复 21。' },
};

// With-replacement ordinary draw weights; physical number cards remain 1–11.
export const TRUMP_WEIGHTS = {
  shield: 6, shield2: 4, add1: 8, add2: 7, desire: 6, slam: 3,
  perfect: 3, joy: 6, cycle: 6, devil: 3, harvest: 2,
  return: 6, swap: 6, remove: 6, curse: 3, destroy: 6, destroyAll: 3,
};
export const DRAW_POOL = [
  ...Object.entries(TRUMP_WEIGHTS).flatMap(([type, count]) => Array.from({ length: count }, () => ({ type }))),
  ...[17, 24, 27].flatMap(value => Array.from({ length: 3 }, () => ({ type: 'challenge', value }))),
  ...[2, 3, 4, 5, 6, 7].flatMap(value => Array.from({ length: 2 }, () => ({ type: 'number', value }))),
];
export const SPECIAL_POOL = Object.keys(CATALOG).filter(type => CATALOG[type].special);
const tableCard = (s, type) => s.players.flatMap(p => p.table).find(c => c.type === type);
export const cardName = c => c.type === 'number' ? `数字 ${c.value}` : c.type === 'challenge' ? `挑战 ${c.value}` : CATALOG[c.type].name;
export const total = p => p.numbers.reduce((n, c) => n + (c?.value || 0), 0);
export const slots = p => p.table.reduce((n, c) => n + CATALOG[c.type].cost, 0);
export const targetOf = s => tableCard(s, 'seelieDecision')?.value ?? ((tableCard(s, 'challenge')?.value ?? 21) + s.players.flatMap(p=>p.table).filter(c=>c.type==='nurture').reduce((n,c)=>n+c.poolAtPlay-(s.deck?.length ?? s.deckCount),0));
export const hiddenNumber = (c, index) => !c.public && (index === 0 || !!c.hidden);
export function numberView(s, owner, viewer) {
  return s.players[owner].numbers.map((c,n)=> {
    const hidden = hiddenNumber(c,n), id = hidden ? `hidden-${s.round}-${owner}-${n}` : c.id;
    return owner===viewer || s.phase!=='playing' || !hidden ? {...c,id} : {id,hidden:true};
  });
}
export function deckError(entries) {
  if (!Array.isArray(entries)) return '牌组格式无效。';
  let count=0,power=0; const seen=new Set();
  for(const e of entries){const meta=CARD_META[e?.type];
    if(!meta?.deckEligible || !Number.isSafeInteger(e.count) || e.count<1 || e.count>40 || (meta.values ? !meta.values.includes(e.value) : e.value!==undefined))return '牌组含无效卡牌或数量。';
    const key=e.type+':'+e.value;if(seen.has(key))return '请合并同名卡数量。';seen.add(key);count+=e.count;power+=e.count*meta.power;
  }
  return count!==40?'牌组必须恰好40张。':power>100?'牌组总牌力不能超过100。':'';
}
function shuffledDeck(s, entries){const error=deckError(entries);if(error)throw new Error(error);const cards=entries.flatMap(e=>Array.from({length:e.count},()=>({type:e.type,...(e.value===undefined?{}:{value:e.value}),id:`t${++s.serial}`})));for(let i=cards.length-1;i>0;i--){const j=pick(s,cards.slice(0,i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;}
const lastVisibleIndex = p => p.numbers.findLastIndex((c,i)=>i>0&&!c.hidden);
const drawnLabel = (s,actor,n) => s.players[actor].numbers.at(-1)?.hidden ? '一张暗置数牌' : `数牌 ${n}`;
const shields = p => p.table.filter(c => ['shield', 'shield2'].includes(c.type));

function random(s) {
  s.rng = (Math.imul(1664525, s.rng) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function pick(s, array) { return Math.floor(random(s) * array.length); }
function addLog(s, text, kind = 'info') {
  const entry = { id: ++s.eventId, round: s.round, text, kind };
  s.log.push(entry);
  if (s.log.length > 160) s.log.shift();
  return entry;
}
function newTrump(s) {
  const card = { ...DRAW_POOL[pick(s, DRAW_POOL)], id: `t${++s.serial}` };
  return card;
}
function grant(s, actor, n) { let gained=0;for (let i = 0; i < n; i++){const p=s.players[actor];const card=p.drawPile ? p.drawPile.shift() : newTrump(s);if(!card)break;p.hand.push(card);gained++;}return gained; }
function grantSpecial(s) {
  const available = SPECIAL_POOL.filter(type => !s.players[1].hand.some(c => c.type === type));
  if (!available.length) return;
  s.players[1].hand.push({ type: available[pick(s, available)], id: `t${++s.serial}` });
}
function recycleNumber(s, card) { if (!card.generated) s.deck.push(card.value); }
function destroyTrumps(s, owner, all = false, selectedId = null) {
  const p = s.players[owner];
  const removed = all ? p.table.splice(0) : p.table.splice(selectedId ? p.table.findIndex(c=>c.id===selectedId) : -1, 1);
  for (const card of removed) {
    if(card.type==='curtain')for(const player of s.players)for(const n of player.numbers)if(n.veilId===card.id){delete n.hidden;delete n.veilId;}
    if (card.type === 'seelieInsight') {
      for (const player of s.players) player.numbers = player.numbers.filter(n => n.createdBy !== card.id);
      addLog(s, '「希儿看破一切」被破坏，其创造的数牌消失。');
    }
    if (card.type === 'seelieWant') { const got=grant(s, owner, 2); addLog(s, `「希儿想要那个」被破坏，希儿获得 ${got} 张普通王牌。`, 'bonus'); }
    if (card.type === 'seelieForget' && s.deck.length) {
      const n = drawNumber(s, 1 - owner, Math.min(...s.deck));
      addLog(s, `「希儿忘记了」被破坏，${s.players[1 - owner].name}抽到${drawnLabel(s,1-owner,n)}。`, 'draw');
    }
  }
}
function drawNumber(s, actor, specified) {
  const at = specified === undefined ? pick(s, s.deck) : s.deck.indexOf(specified);
  if (!s.deck.length || at < 0) return null;
  const [value] = s.deck.splice(at, 1);
  const veil=s.players[actor].table.find(c=>c.type==='curtain'&&!c.used);if(veil)veil.used=true;
  s.players[actor].numbers.push({ id: `n${s.round}-${value}`, value, ...(veil?{hidden:true,veilId:veil.id}:{}) });
  return value;
}
function beginRound(s) {
  s.pending=null; s.round++;
  s.phase = 'playing'; s.actor = s.firstActor ?? 1; s.stood = [false, false]; s.result = null; s.turnActions = 0;
  s.deck = Array.from({ length: 11 }, (_, i) => i + 1);
  for (const p of s.players) { p.numbers = []; p.table = []; p.gEffects=0; }
  for (let pass = 0; pass < 2; pass++) for (let actor = 1; actor >= 0; actor--) drawNumber(s, actor);
  const granted=[0,0];for (let actor = 0; actor < 2; actor++) granted[actor]=grant(s, actor, s.round === 1 ? 2 : 1);
  const beforeSpecials = s.players[1].hand.length;
  if (s.specials) for (let i = 0, count = s.round === 1 ? 2 : s.round % 2 === 1 ? 1 : 0; i < count; i++) grantSpecial(s);
  addLog(s, `第 ${s.round} 局开始。${s.players.map((p,i)=>p.name+'获得'+granted[i]+'张普通王牌').join('，')}，${s.players[s.actor].name}先手。`, 'round');
  const addedSpecials = s.players[1].hand.length - beforeSpecials;
  if (addedSpecials) addLog(s, `希儿额外获得 ${addedSpecials} 张手中尚未持有的专属王牌。`, 'bonus');
}
const emptyStats = () => ({ maxDamage: 0, trumpsPlayed: 0, hpTaken: 0, roundsWon: 0 });
// Old saves cannot recover complete totals from the capped public log.
export function matchStats(s) {
  return s.stats || { complete: false, players: [emptyStats(), emptyStats()] };
}
function ensureStats(s) { s.stats ||= matchStats(s); }

export function createGame(seed = Date.now(), options = {}) {
  const s = { version: 1, firstActor: options.multiplayer ? 0 : 1, rng: seed >>> 0, serial: 0, eventId: 0, round: 0, log: [], players: [
    { name: options.names?.[0] || '你', hp: 10, maxHp: 10, hand: [], table: [], numbers: [] },
    { name: options.names?.[1] || '希儿', hp: options.multiplayer ? 10 : 20, maxHp: options.multiplayer ? 10 : 20, hand: [], table: [], numbers: [] },
  ] };
  s.stats = { complete: true, players: [emptyStats(), emptyStats()] };
  if(options.decks){s.deckMode='constructed';s.players.forEach((p,i)=>p.drawPile=shuffledDeck(s,options.decks[i]||DEFAULT_DECK));}
  s.specials = !options.multiplayer && options.specials !== false;
  beginRound(s); return s;
}

export function damage(s, victim, resolved = false) {
  if (tableCard(s, 'seelieCute')) return 0;
  const p = s.players[victim], enemy = s.players[1 - victim];
  let n = 1;
  for (const c of enemy.table) {
    n += ({ add1: 1, add2: 2, slam: 3, perfect: 2, seelieInsight: 1 }[c.type] || 0);
    if (c.type === 'desire') n += Math.floor((p.handCount ?? p.hand.length) / 2);
    if(c.type==='blindBet' && (!resolved || c.guess===p.numbers[0].value))n+=3;
  }
  for (const c of p.table) n += ({ shield: -1, shield2: -2, devil: 1 }[c.type] || 0);
  for(const c of p.table)if(c.type==='blindBet'&&resolved&&c.guess===enemy.numbers[0].value)n-=3;
  n=Math.max(0,n)*2**(s.players.flatMap(p=>p.table).filter(c=>c.type==='allIn').length+enemy.table.filter(c=>c.type==='blackjack'&&(!resolved||total(enemy)===21)).length);
  return Math.max(0, tableCard(s, 'seelieAngry') && victim === 0 ? Math.min(3, n) : n);
}

export function playError(s, actor, id) {
  if (s.phase !== 'playing') return '本局已结算。';
  if(s.pending)return '请先完成占卜选牌。';
  if (s.actor !== actor) return '还没轮到你。';
  const p = s.players[actor], enemy = s.players[1 - actor], card = p.hand.find(c => c.id === id);
  if (!card) return '这张王牌已经不在手中。';
  if (!CATALOG[card.type]) return '这张王牌不在当前卡牌目录中。';
  if (tableCard(s, 'seelieAngry')) return '「希儿生气了」在场，双方均不能打出任何王牌。';
  if (CATALOG[card.type].special) {
    if (!s.specials || actor !== 1) return '只有单人对战的希儿可以使用专属牌。';
    if (s.players.some(p => p.table.some(c => CATALOG[c.type].special))) return '场上最多存在 1 张希儿专属牌。';
  }
  if (card.type === 'challenge' && tableCard(s, 'seelieDecision')) return '「希儿的决定权」在场，不能打出挑战牌。';
  if (slots(p) + CATALOG[card.type].cost > 5) return `桌面空位不足，需要 ${CATALOG[card.type].cost} 格。`;
  if (card.type === 'cycle' && p.hand.length < 3) return '需要另外 2 张手牌王牌。';
  if (card.type === 'curse' && p.hand.length < 2) return '需要另外 1 张手牌王牌。';
  if (card.type === 'curse' && !s.deck.length) return '数牌池已空，无法强制抽牌。';
  if (card.type === 'return' && p.numbers.length < 2) return '只有底牌，不能退回。';
  if (card.type === 'remove' && enemy.numbers.length < 2) return '对手只有底牌，不能撤除。';
  if (card.type === 'swap' && (p.numbers.length < 2 || enemy.numbers.length < 2)) return '双方都需要至少 1 张明牌。';
  if (['destroy', 'destroyAll'].includes(card.type) && !enemy.table.length) return '对手桌上没有王牌。';
  if(card.type==='trapdoor'&&lastVisibleIndex(p)<1)return '需要至少一张明牌。';
  if(card.type==='dismantle'&&!p.table.some(c=>!CATALOG[c.type].special))return '自己桌上没有可拆解的普通王牌。';
  return '';
}

function settle(s) {
  if (tableCard(s, 'seelieCute')) {
    addLog(s, '「希儿很可爱」生效：本轮不结算血量，直接重新发牌。', 'result');
    beginRound(s); return;
  }
  const target = targetOf(s), sums = s.players.map(total), bust = sums.map(n => n > target);
  let winner = null;
  if (!(bust[0] && bust[1]) && sums[0] !== sums[1]) {
    winner = bust[0] ? 1 : bust[1] ? 0 : sums[0] > sums[1] ? 0 : 1;
  }
  const victim = winner === null ? null : 1 - winner;
  const hit = victim === null ? 0 : damage(s, victim, true);
  const hpLoss = victim === null ? 0 : Math.min(s.players[victim].hp, hit);
  if (victim !== null) {
    s.players[victim].hp -= hpLoss;
    const stats = s.stats.players[winner];
    stats.maxDamage = Math.max(stats.maxDamage, hit);
    stats.hpTaken += hpLoss; stats.roundsWon++;
  }
  s.result = { winner, victim, damage: hit, hpLoss, sums, bust, target };
  s.phase = s.players.some(p => p.hp === 0) ? 'finished' : 'roundEnd';
  addLog(s, `开牌：${s.players[0].name} ${sums[0]} 点，${s.players[1].name} ${sums[1]} 点。${winner === null ? '平局，双方不受伤害。' : `${s.players[winner].name}获胜，${s.players[victim].name}受到 ${hit} 点伤害。`}`, 'result');
}

export function dispatch(state, action) {
  const actor = action.actor ?? state.actor;
  if(state.pending){
    if(action.type!=='choose'||actor!==state.pending.actor||!Number.isInteger(action.index)||action.index<0||action.index>=state.pending.cards.length)return {state,error:'请选择一张占卜王牌。'};
    const s=structuredClone(state),pending=s.pending,p=s.players[actor],cards=pending.cards; p.hand.push(cards.splice(action.index,1)[0]);p.drawPile.push(...cards);s.pending=null;
    grant(s,actor,pending.harvest);grant(s,1-actor,pending.g);addLog(s,`${p.name}完成占卜选牌。`);return {state:s,error:''};
  }
  if (action.type === 'next') {
    if (state.phase !== 'roundEnd') return { state, error: '尚不能进入下一局。' };
    const s = structuredClone(state); ensureStats(s); beginRound(s); return { state: s, error: '' };
  }
  if (state.phase !== 'playing' || actor !== state.actor) return { state, error: '现在不能执行这个行动。' };
  if (!['draw', 'stand', 'play'].includes(action.type)) return { state, error: '未知行动。' };
  if (action.type === 'draw' && !state.deck.length) return { state, error: '数牌池已空，可以使用王牌或停牌。' };
  if (action.type === 'play') { const error = playError(state, actor, action.id); if (error) return { state, error }; }
  if(action.type==='play'){
    const card=state.players[actor].hand.find(c=>c.id===action.id);
    if(card.type==='blindBet'&&(!Number.isSafeInteger(action.guess)||Math.abs(action.guess)>1000000))return {state,error:'请宣告一个有效的底牌整数点数。'};
    if(card.type==='dismantle'&&!state.players[actor].table.some(c=>c.id===action.target&&!CATALOG[c.type].special))return {state,error:'请选择自己的普通桌面王牌进行拆解。'};
  }
  const s = structuredClone(state), p = s.players[actor], enemy = s.players[1 - actor];
  ensureStats(s);
  if (action.type === 'stand') {
    s.stood[actor] = true;
    addLog(s, `${p.name}停牌。`);
    if (s.stood.every(Boolean)) settle(s);
    else { s.actor = 1 - actor; s.turnActions = 0; }
    return { state: s, error: '' };
  }
  s.stood = [false, false]; s.turnActions++;
  if (action.type === 'draw') {
    const n = drawNumber(s, actor);
    addLog(s, `${p.name}抽到${drawnLabel(s,actor,n)}。`, 'draw');
    if (random(s) < 1 / 6) { const got=grant(s, actor, 1); addLog(s, got?`${p.name}额外获得 1 张王牌。`:'王牌堆已空，无法补牌。', 'bonus'); }
  } else {
    const index = p.hand.findIndex(c => c.id === action.id), [card] = p.hand.splice(index, 1);
    s.stats.players[actor].trumpsPlayed++;
    const harvestCount = p.table.filter(c => c.type === 'harvest').length;
    let stay = CATALOG[card.type].stay;
    const played = addLog(s, `${p.name}使用「${cardName(card)}」。`, 'trump');
    switch (card.type) {
      case 'foresight': {
        const choices=p.drawPile?.splice(0,3)||[];
        if(choices.length)s.pending={actor,cards:choices,harvest:harvestCount,g:enemy.gEffects||0};
        else addLog(s,'王牌堆已空，占卜没有取得牌。');break;
      }
      case 'dismantle': destroyTrumps(s,actor,false,action.target);grant(s,actor,2);break;
      case 'cashOut': grant(s,actor,1);break;
      case 'blindBet': card.guess=action.guess;addLog(s,`${p.name}宣告对手底牌为 ${card.guess}。`);break;
      case 'multiplyingG': p.gEffects=(p.gEffects||0)+1;break;
      case 'nurture': card.poolAtPlay=s.deck.length;break;
      case 'trapdoor': {
        const at=lastVisibleIndex(p),old=p.numbers[0];p.numbers[0]=p.numbers[at];p.numbers[0].public=true;p.numbers[at]=old;delete old.hidden;delete old.veilId;
        addLog(s,`${p.name}交换底牌与最右侧明牌的位置，新底牌是此前公开的 ${p.numbers[0].value}。`);break;
      }
      case 'seelieInsight': {
        const value = targetOf(s) - total(p);
        p.numbers.push({ id: `created-${card.id}`, value, generated: true, createdBy: card.id });
        addLog(s, `希儿创造并获得 ${value} 点数牌，当前总和 ${total(p)}。`, 'draw'); break;
      }
      case 'seelieWant': {const got=grant(s, actor, 3); addLog(s, `希儿获得 ${got} 张普通王牌。`, 'bonus'); break;}
      case 'seelieForget':
        for (const owner of s.players) for (const n of owner.numbers.splice(1)) recycleNumber(s, n);
        addLog(s, '双方底牌保留，所有普通明牌洗回牌池，创造牌直接消失。'); break;
      case 'seelieDecision': card.value = total(p); addLog(s, `希儿将目标锁定为 ${card.value} 点。`); break;
      case 'seelieAngry': addLog(s, '双方王牌已封锁，仍可抽数牌或停牌；本轮玩家败北伤害最多 3 点。'); break;
      case 'seelieCute': addLog(s, '本轮结束将跳过血量结算，直接发下一局。'); break;
      case 'joy': grant(s, actor, 1); grant(s, 1 - actor, 1); break;
      case 'add1': case 'add2': grant(s, actor, 1); break;
      case 'cycle':
        for (let i = 0; i < 2; i++) p.hand.splice(pick(s, p.hand), 1);
        grant(s, actor, 3); break;
      case 'return': case 'remove': {
        const owner = card.type === 'return' ? p : enemy;
        const n = owner.numbers.pop(); recycleNumber(s, n);
        addLog(s, `${owner.name}的${n.generated ? '创造牌' : '数牌'} ${n.value} ${n.generated ? '直接消失' : '回到牌池'}。`); break;
      }
      case 'destroy': destroyTrumps(s, 1 - actor); break;
      case 'destroyAll': destroyTrumps(s, 1 - actor, true); break;
      case 'swap': {
        const a = p.numbers.pop(), b = enemy.numbers.pop(); delete a.hidden; delete b.hidden; delete a.veilId; delete b.veilId; if (!b.generated) p.numbers.push(b); if (!a.generated) enemy.numbers.push(a);
        addLog(s, `双方交换数牌 ${a.value} 与 ${b.value}。${a.generated || b.generated ? '创造牌在交换时直接消失。' : ''}`); break;
      }
      case 'devil': grant(s, actor, 3); break;
      case 'slam':
        if (shields(p).length < 2) { stay = false; addLog(s, '护盾牌不足 2 张，盾击被弃置。'); }
        break;
      case 'curse': {
        p.hand.splice(pick(s, p.hand), 1);
        const n = drawNumber(s, 1 - actor); addLog(s, `${enemy.name}被迫抽到${drawnLabel(s,1-actor,n)}。`, 'draw'); break;
      }
      case 'number': {
        const n = drawNumber(s, actor, card.value);
        addLog(s, n === null ? `数牌 ${card.value} 不在牌池，本牌没有效果。` : `${p.name}获得${drawnLabel(s,actor,n)}。`, 'draw'); break;
      }
      case 'challenge': for (const owner of s.players) owner.table = owner.table.filter(c => c.type !== 'challenge'); break;
      case 'perfect': {
        const afterDrawTarget=targetOf({...s,deck:s.deck.slice(1)});
        const safe = s.deck.filter(n => total(p) + n <= afterDrawTarget);
        if (safe.length) { const n = drawNumber(s, actor, Math.max(...safe)); addLog(s, `${p.name}获得${drawnLabel(s,actor,n)}。`, 'draw'); }
        else addLog(s, '没有安全的数牌，未抽取数牌。');
        break;
      }
    }
    if (stay) p.table.push(card);
    if(!s.pending){if (harvestCount) {const got=grant(s, actor, harvestCount);addLog(s,`${p.name}的收割补充了 ${got} 张王牌。`,'bonus');} if(enemy.gEffects){const got=grant(s,1-actor,enemy.gEffects);addLog(s,`${enemy.name}的增值的G补充了 ${got} 张王牌。`,'bonus');}}
    // Public facts only: never attach a hand, hole card, deck or RNG snapshot.
    Object.assign(played, {
      actor, card: { type: card.type, ...(card.value !== undefined ? { value: card.value } : {}), ...(card.guess!==undefined?{guess:card.guess}:{}) },
      changes: { target: [targetOf(state), targetOf(s)], damage: [0, 1].map(i => [damage(state, i), damage(s, i)]) },
    });
    if(card.type==='cashOut'){s.stood[actor]=true;s.actor=1-actor;s.turnActions=0;addLog(s,`${p.name}见好就收，停牌并移交行动权。`);}
    if (card.type === 'slam' && !stay) played.note = '护盾不足，盾击已弃置，未增加伤害。';
    if (card.type === 'number' && !state.deck.includes(card.value)) played.note = '指定数牌不在牌池，本牌没有抽到数牌。';
  }
  return { state: s, error: '' };
}

// This is the only input to the computer policy. It has no opponent hole card,
// no opponent trump identities, no true deck contents and no RNG state.
export function observe(s, actor) {
  return {
    actor, pending:s.pending?.actor===actor?structuredClone(s.pending):null, target: targetOf(s), deckCount: s.deck.length, turnActions: s.turnActions,
    stood: [...s.stood], damage: [damage(s, 0), damage(s, 1)],
    players: s.players.map((p, i) => ({
      hp: p.hp, drawCount:p.drawPile?.length??null, table: structuredClone(p.table), handCount: p.hand.length,
      hand: i === actor ? structuredClone(p.hand) : [],
      numbers: numberView(s,i,actor).map(c=>c.value===undefined?null:c),
    })),
    legal: s.players[actor].hand.filter(c => !playError(s, actor, c.id)).map(c => c.id),
  };
}
