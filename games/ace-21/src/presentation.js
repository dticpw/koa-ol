import { toneOf } from './feedback.js?v=100';

// Display-only ordering: never reorder the authoritative hand (random discards use it).
export const sortOrder = Object.fromEntries([
  'allIn','blackjack','add1', 'add2', 'desire', 'slam', 'perfect', 'seelieInsight',
  'shield', 'shield2', 'seelieCute',
  'trapdoor','blindBet','curtain','multiplyingG','nurture','foresight','dismantle','cashOut','joy', 'cycle', 'return', 'swap', 'remove', 'destroy', 'destroyAll',
  'devil', 'harvest', 'curse', 'number', 'challenge',
  'seelieAngry', 'seelieWant', 'seelieForget', 'seelieDecision',
].map((type, index) => [type, index]));
export function reconcileHand(order, hand) {
  const ids = new Set(hand.map(c => c.id)), known = new Set(order);
  return [...order.filter(id => ids.has(id)), ...hand.filter(c => !known.has(c.id)).map(c => c.id)];
}
export function sortHand(order, hand) {
  const cards = new Map(hand.map(c => [c.id, c]));
  const tone = { attack: 0, defense: 1, utility: 2 };
  return reconcileHand(order, hand).map((id, index) => ({ ...cards.get(id), index })).sort((a, b) =>
    tone[toneOf(a.type)] - tone[toneOf(b.type)] || (sortOrder[a.type] ?? 99) - (sortOrder[b.type] ?? 99)
    || (a.value ?? 0) - (b.value ?? 0) || a.index - b.index).map(c => c.id);
}
export const damageTier = damage => damage <= 0 ? 0 : damage === 1 ? 1 : damage === 2 ? 2 : damage < 5 ? 3 : 5;
export function danger(damage, hp, protectedRound = false) {
  return { tier: damageTier(protectedRound ? 0 : damage), lethal: !protectedRound && hp > 0 && damage >= hp, protected: protectedRound };
}
export function settlement(previous, next) {
  const r = next.result;
  if (!previous || previous.phase !== 'playing' || previous.round !== next.round || !r || r.forfeit || r.victim === null) return null;
  return { victim: r.victim, damage: r.damage, tier: damageTier(r.damage), lethal: next.players[r.victim].hp === 0 };
}

const frame = `<svg class="life-energy" viewBox="0 0 320 70" preserveAspectRatio="none" aria-hidden="true">
  <rect class="energy-rim" x="2" y="2" width="316" height="66" rx="8"/>
  <path class="energy-wire wire-a" d="M4 58 L31 58 36 51 44 62 51 58 H126 M190 4 H249 L256 10 262 1 270 4 H313"/>
  <path class="energy-wire wire-b" d="M4 17 H18 L24 11 28 24 36 17 H77 M200 66 H269 L276 60 282 70 290 66 H314"/>
  <g class="energy-sparks"><circle cx="32" cy="-3" r="1.4"/><circle cx="289" cy="74" r="1.3"/><circle cx="270" cy="-4" r="1"/><circle cx="44" cy="73" r="1.6"/></g>
  <path class="life-crack" d="M3 2 L14 9 9 16 21 23 M14 9 L26 7 M317 2 L303 12 309 22 295 29 M303 12 L290 9 M317 68 L304 57 309 50 298 43 M304 57 L288 59 M3 68 L16 58 10 50 24 41"/>
</svg>`;
const bolt = '<path d="M0 38 L45 29 69 40 100 20 117 43 139 32 172 45 202 25 225 41 266 28 320 36"/>';
export class LifeEffects {
  constructor(seats, reduced) {
    this.seats = seats; this.reduced = reduced; this.timers = new Set();
    this.observer = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('life-offscreen', !e.isIntersecting)));
    seats.forEach(seat => { const life = seat.querySelector('.identity'); life.classList.add('life-zone'); life.insertAdjacentHTML('beforeend', frame); this.observer.observe(life); });
  }
  update(actor, risk, active) {
    const zone = this.seats[actor].querySelector('.life-zone');
    zone.dataset.danger = active ? risk.tier : 'idle';
    zone.classList.toggle('is-lethal', active && risk.lethal);
    zone.classList.toggle('is-protected', active && risk.protected);
    zone.setAttribute('aria-label', active ? risk.protected ? '本轮免血量结算' : `败北伤害等级 ${risk.tier === 3 ? '3至4' : risk.tier === 5 ? '5以上' : risk.tier}${risk.lethal ? '，当前生命不足以承受' : ''}` : '生命状态');
  }
  clear() {
    this.timers.forEach(clearTimeout); this.timers.clear();
    this.seats.forEach(s => { s.classList.remove('life-shattered'); s.querySelectorAll('.damage-burst').forEach(e => e.remove()); });
  }
  hit(event) {
    if (!event || document.hidden) return;
    const seat = this.seats[event.victim], zone = seat.querySelector('.life-zone');
    seat.classList.toggle('life-shattered', event.lethal);
    const el = document.createElement('div'); el.className = `damage-burst burst-${event.tier}${event.lethal ? ' burst-lethal' : ''}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<svg viewBox="0 0 320 76" preserveAspectRatio="none"><g class="bolt bolt-a">${bolt}</g><g class="bolt bolt-b" transform="translate(0 76) scale(1 -1)">${bolt}</g><ellipse class="shock-ring" cx="160" cy="38" rx="148" ry="32"/></svg><b class="hit-number">${event.damage ? '−' + event.damage : '0'}</b><span class="shard shard-a"></span><span class="shard shard-b"></span><span class="shard shard-c"></span><span class="shard shard-d"></span>`;
    zone.append(el);
    const timer = setTimeout(() => { el.remove(); this.timers.delete(timer); }, this.reduced.matches ? 700 : 1200);
    this.timers.add(timer);
  }
}
