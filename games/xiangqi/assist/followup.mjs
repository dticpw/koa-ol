// Bounded, whole-annotation interpretation. Never search a paragraph for keywords.
// No engine evaluation, title inference, or material-count inference is used.
export const conclusionRuleVersion='whole-note-v2';
export function classifyNote(text){
  const s=text.trim().replace(/[。！!．.]$/u,'');
  if(/^[红黑](方)?胜$/.test(s))return {kind:'result',label:s[0]+'胜'};
  if(/^(和棋|和)$/.test(s))return {kind:'result',label:'和棋'};
  if(/^(大体|双方)?均势$/.test(s))return {kind:'balance',label:s};
  if(s==='得子')return {kind:'material',label:'得子 · 原注未指明红黑'};
  if(/^[红黑](方)?得子$/.test(s))return {kind:'material',label:s};
  if(/^[红黑](方)?得子(大优|优)$/.test(s))return {kind:'material-advantage',label:s[0]+'得子 · '+s[0]+(s.endsWith('大优')?'大优':'优')};
  if(/^[红黑](方)?(占优|大优|较优|稍优|略优|优)$/.test(s))return {kind:'advantage',label:s};
  if(/^[红黑]左翼有攻势较优$/.test(s))return {kind:'advantage',label:s};
  return null;
}

// Use node identities and complete ordered prefixes, never position_key equivalence.
export function followupLines(game,nodeId,uci,childIds){
  const parent=game.nodes[nodeId];if(!parent)return [];
  const permitted=new Set(childIds),seen=new Set(),out=[];
  for(const line of game.lines){
    const ids=line.node_ids,start=ids.indexOf(nodeId),child=game.nodes[ids[start+1]];
    if(start<0||!child||!permitted.has(child.id)||child.move?.uci!==uci||child.parent_id!==nodeId)continue;
    if(ids[0]!==game.root_node_id||ids.some((id,i)=>{const n=game.nodes[id];return !n||n.ply!==i||(i&&(n.parent_id!==ids[i-1]||!game.nodes[ids[i-1]].child_ids.includes(id)));}))continue;
    const identity=JSON.stringify(ids);if(seen.has(identity))continue;seen.add(identity);
    out.push({line,start,ids:ids.slice(start)});
  }
  return out;
}

export function nodeConclusion(game,nodeId){
  const node=game.nodes[nodeId];if(!node)return null;
  const notes=game.annotations.filter(a=>node.annotation_ids.includes(a.id)&&a.text.trim());
  if(!notes.length)return null;
  const parsed=[];
  for(const a of notes){
    const source=game.lines.find(l=>l.id===a.source_line_id),index=source?.node_ids.indexOf(nodeId);
    if(a.status!=='attached'||a.conflicting_field||a.anchor_node_id!==nodeId||a.source_after_ply!==node.ply||index!==node.ply)return null;
    // Annotation's source prefix must describe this node's actual parent chain.
    let id=nodeId;for(let i=index;i>=0;i--){if(id!==source.node_ids[i])return null;id=game.nodes[id]?.parent_id;}
    const value=classifyNote(a.text);if(!value)return null;
    parsed.push({...value,annotationId:a.id,text:a.text,sourceTag:a.source_tag,sourceLineId:a.source_line_id});
  }
  // Multiple claims, including a recognizable claim beside uncertain prose, are withheld.
  if(new Set(parsed.map(p=>JSON.stringify([p.kind,p.label]))).size!==1)return null;
  return {...parsed[0],gameId:game.id,nodeId,ply:node.ply};
}
export function lineConclusions(game,route){
  const claims=route.ids.slice(1).flatMap((id,i)=>{const c=nodeConclusion(game,id);return c?[{...c,lineId:route.line.id,distance:i+1}]:[];});
  // Opposite terminal claims anywhere on this complete path cannot certify its result.
  // Material/advantage at different plies may legitimately change; retain their anchors.
  const results=route.line.node_ids.map(id=>nodeConclusion(game,id)).filter(c=>c?.kind==='result');
  return new Set(results.map(c=>c.label)).size>1?claims.filter(c=>c.kind!=='result'):claims;
}

// A manually audited long terminal note supplements the general corroboration rule.
// Rebuild/audit: tests/followup.mjs --audit-results. Never infer a result from a title.
const verifiedResult={libraryId:'ad7cff72236ec6f609d474645ef3725d33f7e6e89736a627c913b64b5369d6b9',gameId:'yl-3390',sourceSha:'e9abe4d5e5e2ca4f0f8a90e4380237809e77339ebb6b050a5e0d19d6c6ab7423',lineId:'0',nodeId:'0:62',value:'黑胜'};
export function gameResult(libraryId,game,route){
  const v=verifiedResult,main=game.lines.find(l=>l.id==='0');
  if(libraryId!==v.libraryId||!main||route.line!==main||main.status!=='legal'||main.first_failure||!main.node_ids.length)return null;
  const field=name=>{const values=[...new Set((game.metadata['DhtmlXQ_'+name]||[]).map(s=>s.trim()).filter(Boolean))];return values.length===1?values[0]:null;};
  const raw=field('result'),value=raw==='和局'?'和棋':raw;
  if(!['红胜','黑胜','和棋'].includes(value)||!['全局','实战全局/开局'].includes(field('type')))return null;
  const red=field('red'),black=field('black'),date=field('date');
  const named=s=>s&&s.length>=2&&!/^(红方|黑方|先手|后手|未知|不详|佚名|无|空|[?？\d\s]+)$/.test(s);
  if(!named(red)||!named(black)||red===black||!date||!/^(18|19|20)\d{2}[-年]/.test(date)||!field('event'))return null;
  if(main.node_ids[0]!==game.root_node_id||main.node_ids.some((id,i)=>{const n=game.nodes[id];return !n||n.ply!==i||(i&&(n.parent_id!==main.node_ids[i-1]||!game.nodes[main.node_ids[i-1]].child_ids.includes(id)));}))return null;
  if(game.annotations.some(a=>a.text.trim()&&(a.conflicting_field||a.status==='unresolved')))return null;
  if(main.node_ids.some(id=>{const c=nodeConclusion(game,id);return c?.kind==='result'&&c.label!==value;}))return null;
  const end=main.node_ids.at(-1),terminal=nodeConclusion(game,end);
  const audited=game.id===v.gameId&&game.source_sha256===v.sourceSha&&end===v.nodeId&&value===v.value&&game.lines.length===1;
  if(!audited&&!(terminal?.kind==='result'&&terminal.label===value))return null;
  return {libraryId,gameId:game.id,sourceSha:game.source_sha256,lineId:'0',nodeId:end,value,raw,field:'metadata.DhtmlXQ_result',basis:audited?'audited-terminal-note':'named-dated-record-and-matching-main-terminal',annotationId:terminal?.annotationId||'DhtmlXQ_comment62:0'};
}
