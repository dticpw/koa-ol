import { total, slots } from './engine.js?v=050';

export function chooseAction(view) {
  const actor = view.actor, p = view.players[actor], other = view.players[1 - actor];
  const sum = total(p), target = view.target;
  const known = view.players.flatMap(x => x.numbers).filter(c => c && !c.generated).map(c => c.value);
  const unknown = Array.from({ length: 11 }, (_, i) => i + 1).filter(n => !known.includes(n));
  const otherOpen = total(other);
  const plausible = unknown.map(n => otherOpen + n);
  const chanceAhead = plausible.length ? plausible.filter(n => n > target || (sum <= target && sum > n)).length / plausible.length : 0.5;
  const safe = unknown.filter(n => sum + n <= target);
  const safeChance = unknown.length ? safe.length / unknown.length : 0;
  const last = p.numbers.at(-1)?.value || 0, theirs = other.numbers.at(-1)?.value || 0;
  const valueOfSum = n => n > target ? -12 - (n - target) : n;
  let best = null, score = 0.8;
  if (view.turnActions < 7) for (const c of p.hand.filter(c => view.legal.includes(c.id))) {
    let v = -1;
    switch (c.type) {
      case 'seelieCute': v = (sum > target || (chanceAhead < .3 && safeChance < .5)) && view.damage[actor] > 0 ? 13 : -1; break;
      case 'seelieAngry': v = sum <= target && chanceAhead > .75 ? 8 : -1; break;
      case 'seelieInsight': v = sum !== target ? 15 : 3; break;
      case 'seelieWant': v = p.handCount < 6 ? 6 : 1; break;
      case 'seelieForget': v = sum > target ? 14 : otherOpen >= target - 3 && sum < target - 6 ? 8 : -1; break;
      case 'seelieDecision': v = sum > 0 && sum >= otherOpen ? (sum > target ? 14 : sum >= target - 4 ? 10 : 4) : -1; break;
      case 'shield': case 'shield2': v = view.damage[actor] > 0 ? (chanceAhead < .6 ? 3 : 1) : -.5; break;
      case 'add1': case 'add2': v = sum <= target && chanceAhead > .35 ? 2.5 : .3; break;
      case 'perfect': case 'perfect2': v = sum <= target ? (safe.length ? 7 : chanceAhead > .6 ? 3 : -1) : -1; break;
      case 'number': v = unknown.includes(c.value) ? valueOfSum(sum + c.value) - valueOfSum(sum) : -1; break;
      case 'return': v = valueOfSum(sum - last) - valueOfSum(sum); break;
      case 'swap': v = valueOfSum(sum - last + (other.numbers.at(-1)?.generated ? 0 : theirs)) - valueOfSum(sum); break;
      case 'remove': v = otherOpen >= target - 8 && otherOpen <= target ? 2 : -1; break;
      case 'destroy': case 'destroyAll': v = other.table.length * (c.type === 'destroyAll' ? 2 : 1.5); break;
      case 'desire': v = sum <= target && chanceAhead > .55 && other.handCount >= 2 ? 2.5 : -1; break;
      case 'challenge': v = sum > target && sum <= c.value ? 12 : sum <= target && c.value - sum < 5 ? 1 : -1; break;
      case 'harvest': v = p.handCount >= 4 && slots(p) <= 1 ? 5 : -1; break;
      case 'cycle': v = p.hand.filter(x => x.type === 'number' && !unknown.includes(x.value)).length >= 2 ? 2 : -.5; break;
      case 'devil': v = p.handCount < 3 && view.damage[actor] <= 2 ? 2 : -.5; break;
      case 'joy': v = p.handCount <= 2 && other.handCount >= p.handCount ? 1.2 : -.5; break;
      case 'curse': v = otherOpen >= target - 9 ? 4 : -.5; break;
      case 'slam': v = p.table.filter(x => ['shield', 'shield2'].includes(x.type)).length >= 2 && chanceAhead > .7 ? 4 : -1; break;
    }
    if (v > score) { best = c; score = v; }
  }
  if (best) return { type: 'play', actor, id: best.id };
  if (view.deckCount && sum < target && view.turnActions < 9 && (sum <= target - 9 || (safeChance >= .52 && (chanceAhead < .72 || sum < target - 5)))) return { type: 'draw', actor };
  return { type: 'stand', actor };
}
