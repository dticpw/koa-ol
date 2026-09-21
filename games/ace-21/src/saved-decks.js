import { DEFAULT_DECK, CARD_META, DECK_RULES } from './deck-rules.js';
import { buildCatalog, loadCollection, validateDeck, STORAGE_KEY } from './deck-builder.js';
export function availableDecks(){
  const fallback={id:'default',name:'初始牌组 · 98牌力',entries:DEFAULT_DECK};
  try{
    const catalog=buildCatalog({cards:Object.values(CARD_META)}),data=loadCollection(localStorage.getItem(STORAGE_KEY),catalog,DECK_RULES);
    const decks=data?.decks.filter(d=>validateDeck(d.entries,catalog,DECK_RULES).valid).map(d=>({...d,entries:d.entries.map(e=>{const [type,value]=e.key.split(':');return {type,count:e.count,...(value===undefined?{}:{value:Number(value)})};})}))||[];
    return {decks:[fallback,...decks],active:decks.some(d=>d.id===data.active)?data.active:'default'};
  }catch{return {decks:[fallback],active:'default'};}
}
export function populateDeckSelect(el){const data=availableDecks();el.replaceChildren(...data.decks.map(d=>new Option(d.name,d.id)));el.value=data.active;return data.decks;}
