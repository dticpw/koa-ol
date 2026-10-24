import {positionKey} from './engine.mjs';
export const bookTitle = id => ({meihua:'梅花谱',zichudonglai:'自出洞来无敌手',juzhongmi:'橘中秘 · 全局谱'}[id]||id);
export function lookup(data,state) {
  const hits=data.position_index[positionKey(state)]||[], sources=new Map(),moves=new Map();
  for(const [gameId,nodeId] of hits){
    const game=data.games[gameId],node=game.nodes[nodeId];
    if(!sources.has(gameId))sources.set(gameId,{game,paths:[]});
    sources.get(gameId).paths.push(node);
    for(const childId of node.child_ids){
      const child=game.nodes[childId],uci=child.move.uci;
      if(!moves.has(uci))moves.set(uci,[]);
      moves.get(uci).push({game,node,child});
    }
  }
  return {sources,moves,occurrences:hits.length};
}
export function annotations(game,node){const ids=new Set(node.annotation_ids);return game.annotations.filter(a=>ids.has(a.id)&&a.text.trim());}
export const pathLabel = node => `${node.line_id==='0'?'主线':`分支 ${node.line_id}`} · 第 ${node.ply} 手`;
