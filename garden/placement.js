// Collision is a conservative horizontal oriented bounding rectangle of the whole model.
// Empty space inside courtyards is intentionally reserved for its owning diorama.
export const FIELD = Object.freeze({width:112, depth:96, margin:.45, gap:.18});
export function corners(p) {
  const c=Math.cos(p.angle),s=Math.sin(p.angle);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({
    x:p.x+a*p.hx*c+b*p.hz*s, z:p.z-a*p.hx*s+b*p.hz*c
  }));
}
export function overlaps(a,b,gap=FIELD.gap) {
  const aa=corners(a),bb=corners(b);
  for(const angle of [a.angle,b.angle]) for(const [x,z] of [[Math.cos(angle),-Math.sin(angle)],[Math.sin(angle),Math.cos(angle)]]) {
    const pa=aa.map(p=>p.x*x+p.z*z),pb=bb.map(p=>p.x*x+p.z*z);
    if(Math.max(...pa)+gap<=Math.min(...pb)+1e-9||Math.max(...pb)+gap<=Math.min(...pa)+1e-9)return false;
  }
  return true;
}
export function validPlacement(candidate,items,field=FIELD) {
  if(!['x','z','angle','hx','hz'].every(k=>Number.isFinite(candidate[k]))||candidate.hx<=0||candidate.hz<=0)return {ok:false,reason:'布局数据无效'};
  if(corners(candidate).some(p=>Math.abs(p.x)>field.width/2-field.margin||Math.abs(p.z)>field.depth/2-field.margin))return {ok:false,reason:'这里超出草地边界'};
  const hit=items.find(other=>other.id!==candidate.id&&overlaps(candidate,other,field.gap));
  return hit?{ok:false,reason:`这里与${hit.name||'其他模型'}重叠`}:{ok:true,reason:''};
}
export function restoreLayout(raw,items) {
  // Restore atomically: a corrupt, incomplete or incompatible saved layout never moves a subset.
  if(!raw||raw.version!==1||!Array.isArray(raw.items)||raw.items.length!==items.length)return null;
  const seen=new Set();const restored=[];
  for(const item of items){
    const record=raw.items.find(p=>p?.id===item.id);
    if(!record||seen.has(record.id)||!['x','z','angle'].every(k=>Number.isFinite(record[k]))||Math.abs(record.angle)>Math.PI*2)return null;
    seen.add(record.id);restored.push({...item,x:record.x,z:record.z,angle:record.angle});
  }
  return restored.every(p=>validPlacement(p,restored).ok)?restored:null;
}
