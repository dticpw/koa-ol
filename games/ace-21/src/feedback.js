export const toneOf = type => ['shield', 'shield2', 'seelieCute'].includes(type) ? 'defense'
  : ['add1', 'add2', 'desire', 'slam', 'perfect', 'seelieInsight', 'allIn', 'blackjack'].includes(type) ? 'attack' : 'utility';
export const toneLabel = { attack: '进攻', defense: '防御', utility: '功能' };
// Describe an opponent's card from the viewer's perspective, not the card owner's.
export function opponentEffect(card) {
  return ({
    trapdoor:'对手交换底牌与最右侧明牌的位置。',blindBet:`对手宣告你的底牌为 ${card.guess}；开牌猜中后，对手获胜增伤3，败北减伤3。`,curtain:'对手下一张数牌暗置；此牌离场后明置。',multiplyingG:'本局你每使用一张王牌，对手从剩余王牌堆补抽一张。',nurture:'数牌池相对入场时每少一张目标+1，每多一张目标−1。',blackjack:'对手以恰好21点获胜时，伤害翻倍。',allIn:'双方本局败北伤害翻倍。',foresight:'对手查看自己牌堆顶至多三张，选一张，其余沉底。',dismantle:'对手拆解自己一张普通桌面牌，补抽两张。',cashOut:'对手补抽一张并立即停牌，行动交给你。',
    shield: '对手败北时，少受 1 点伤害。', shield2: '对手败北时，少受 2 点伤害。',
    add1: '你败北时，多受 1 点伤害；对手立即获得 1 张王牌。', add2: '你败北时，多受 2 点伤害；对手立即获得 1 张王牌。',
    desire: '你败北时，额外受到你手中王牌数量一半的伤害，向下取整。',
    joy: '双方各获得 1 张普通王牌。', cycle: '对手随机弃掉另外 1 张王牌，再获得 3 张。',
    return: '对手将自己的最右侧明牌洗回牌池。', remove: '你的最右侧明牌被洗回牌池，底牌不受影响。',
    swap: '交换双方最右侧的明牌，底牌不受影响。', destroy: '你的最右侧桌面王牌被破坏。', destroyAll: '你的全部桌面王牌被破坏。',
    devil: '对手立即获得 3 张王牌，但对手败北时多受 1 点伤害。',
    slam: '对手保留自己的护盾；你败北时，多受 3 点伤害。需对手桌上已有至少 2 张护盾或护盾+。',
    harvest: '此后对手每使用 1 张王牌，就补抽 1 张；打出收割自身不触发。',
    curse: '对手随机弃掉另外 1 张王牌，并强迫你抽 1 张数牌。',
    number: `对手指定抽取数牌 ${card.value}；不在牌池则无事发生。`,
    challenge: `双方目标改为 ${card.value}，原有挑战牌移除。`,
    perfect: '你败北时，多受 2 点伤害；对手抽取不会爆牌的最大可用数牌。',
    seelieCute: '本轮结束不扣血，直接进入下一轮发牌。',
    seelieAngry: '双方王牌全部封锁；你本轮败北最多损失 3 点生命，仍可抽牌或停牌。',
    seelieInsight: '你败北时多受 1 点伤害；希儿创造数牌补足当前目标，创造牌离场即消失。',
    seelieWant: '希儿获得 3 张普通王牌；此牌被破坏时，希儿再获得 2 张。',
    seelieForget: '双方全部明牌洗回，仅保留底牌；此牌被破坏时，你抽到牌池中最小的数牌。',
    seelieDecision: `目标固定为希儿打出时的总点数 ${card.value}，双方不能再打出挑战牌。`,
  })[card.type];
}
export function newPlays(previous, next) {
  if (!previous || next.round < previous.round || next.eventId < previous.eventId) return [];
  return next.log.filter(e => e.id > previous.eventId && e.kind === 'trump' && e.card && Number.isInteger(e.actor));
}
export function changeText(event) {
  const changes = event.changes, parts = [];
  if (!changes) return '';
  if (changes.target[0] !== changes.target[1]) parts.push(`目标 ${changes.target[0]} → ${changes.target[1]}`);
  changes.damage.forEach(([before, after], i) => { if (before !== after) parts.push(`${i === 0 ? '你' : '对手'}败北伤害 ${before} → ${after}`); });
  return parts.join(' · ');
}

// A non-blocking queue. Pausing a page/dialog retains the current card for review.
export class BroadcastQueue {
  constructor(show, hide, blocked = () => false) {
    this.show = show; this.hide = hide; this.blocked = blocked; this.queue = []; this.timer = null;
  }
  push(events) { this.queue.push(...events); this.resume(); }
  resume() {
    if (this.timer || !this.queue.length || this.blocked()) return;
    this.show(this.queue[0], this.queue.length - 1);
    this.timer = setTimeout(() => { this.timer = null; this.queue.shift(); this.hide(); this.resume(); }, this.queue.length > 2 ? 2300 : 3200);
  }
  suspend() { clearTimeout(this.timer); this.timer = null; this.hide(); }
  clear() { this.suspend(); this.queue = []; }
}
