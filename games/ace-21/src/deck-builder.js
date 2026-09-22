import { cardArt } from './card-art.js?v=104';
import { CATALOG } from './engine.js?v=104';
import { toneOf } from './feedback.js?v=104';
import { sortOrder } from './presentation.js?v=104';

export const STORAGE_KEY = 'koa-ace21-decks-v1';
export const cardKey = (type, value) => value === undefined ? type : `${type}:${value}`;
const artFor = icon => ({ sword:'sword', shield:'shield', crown:'crown', eye:'eye', moon:'moon', star:'crown', harvest:'scales' })[icon] || 'scales';

export function buildCatalog(balance, planned = []) {
  const cards = balance.cards.flatMap(meta => {
    const def = CATALOG[meta.type];
    if (!def) throw new Error(`卡牌配置缺失：${meta.type}`);
    return (meta.values || [undefined]).map(value => ({
      ...meta, ...def, value, key:cardKey(meta.type,value), tone:toneOf(meta.type), art:cardArt(meta.type),
      name:def.name + (value === undefined ? '' : ` ${value}`),
      text:meta.type === 'number' ? `抽取数牌 ${value}；它已不在共用数牌池时无事发生。`
        : meta.type === 'challenge' ? `将目标点数改为 ${value}，移除双方桌上的其他挑战牌；此牌离场后恢复目标21。`
        : def.text.replace(/占 [23] 格。/g,''),
      status:meta.deckEligible ? 'ordinary' : 'special', order:sortOrder[meta.type] ?? 99,
    }));
  });
  for (const c of planned) cards.push({...c,key:c.type,status:'planned',deckEligible:false,order:100});
  return cards.sort((a,b)=>a.order-b.order || (a.value||0)-(b.value||0));
}

export function validateDeck(entries, catalog, rules) {
  const index = new Map(catalog.map(c=>[c.key,c]));
  let count=0, power=0; const errors=[], seen=new Set();
  if (!Array.isArray(entries)) return {count:0,power:0,valid:false,errors:['牌组格式不正确']};
  for (const e of entries) {
    if (!e || typeof e.key !== 'string' || !Number.isSafeInteger(e.count) || e.count<1) {
      errors.push(`卡牌数量必须为1至${rules.cardCount}的整数`); continue;
    }
    if (seen.has(e.key)) { errors.push('同一卡牌应合并数量'); continue; }
    seen.add(e.key);
    const card=index.get(e.key);
    if (!card?.deckEligible) { errors.push('含未知、专属或尚未实装的卡牌'); continue; }
    count+=e.count; power+=e.count*card.power;
  }
  if (count!==rules.cardCount) errors.push(count<rules.cardCount ? `还需加入 ${rules.cardCount-count} 张` : `需移除 ${count-rules.cardCount} 张`);
  if (power>rules.maxPower) errors.push(`牌力超出 ${power-rules.maxPower} 点`);
  return {count,power,valid:errors.length===0,errors};
}

// Structural validation permits unfinished/over-budget drafts. It never permits
// unknown cards or special cards to become ordinary deck entries.
export function parseDeck(input, catalog, rules, allowOversize = false) {
  const data=typeof input==='string'?JSON.parse(input):input;
  if (!data || (data.game!==undefined && data.game!=='ace21') || data.version!==1 || !Array.isArray(data.entries) || data.entries.length>catalog.length) throw new Error('不是支持的王牌21点牌组文件');
  const index=new Map(catalog.map(c=>[c.key,c])), seen=new Set();
  const entries=data.entries.map(e=>{
    if (!e || typeof e.key!=='string' || !index.get(e.key)?.deckEligible || seen.has(e.key)
      || !Number.isSafeInteger(e.count) || e.count<1 || (!allowOversize && e.count>rules.cardCount)) throw new Error('牌组含无效卡牌或数量，请检查文件');
    seen.add(e.key); return {key:e.key,count:e.count};
  });
  return {name:typeof data.name==='string'?data.name.trim().slice(0,32)||'未命名牌组':'未命名牌组',entries};
}
export function serializeDeck(deck) {
  return JSON.stringify({game:'ace21',version:1,name:deck.name,entries:deck.entries},null,2);
}
export function loadCollection(raw, catalog, rules) {
  if (!raw) return null;
  const data=JSON.parse(raw);
  if (data?.version!==1 || !Array.isArray(data.decks) || !data.decks.length) throw new Error('本地牌组格式不正确');
  const ids=new Set();
  const decks=data.decks.map(d=>{
    if (typeof d.id!=='string' || !d.id || ids.has(d.id)) throw new Error('牌组标识重复或无效');
    ids.add(d.id);return {id:d.id,...parseDeck({...d,version:1},catalog,rules,true)};
  });
  return {version:1,decks,active:ids.has(data.active)?data.active:decks[0].id};
}
