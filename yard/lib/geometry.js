import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../shrine/vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from '../../shrine/vendor/BufferGeometryUtils.js';

export function seededRandom(seed=431){return (a=0,b=1)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+seed/4294967296*(b-a);};}
export function palette(colors){
  const ramp=new THREE.DataTexture(new Uint8Array([115,165,210,255]),4,1,THREE.RedFormat);
  ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
  return Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshToonMaterial({color,gradientMap:ramp})]));
}
export function mesh(parent,geometry,material,position=[0,0,0]){
  const m=new THREE.Mesh(geometry,material);m.position.fromArray(position);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
}
export function box(parent,size,position,material,radius=0){return mesh(parent,radius?new RoundedBoxGeometry(...size,2,radius):new THREE.BoxGeometry(...size),material,position);}
export function cylinder(parent,rTop,rBottom,height,position,material,segments=10){return mesh(parent,new THREE.CylinderGeometry(rTop,rBottom,height,segments),material,position);}
export function blob(parent,radius,position,material,scale=[1,1,1]){const m=mesh(parent,new THREE.IcosahedronGeometry(radius,1),material,position);m.scale.fromArray(scale);return m;}
export function beam(parent,a,b,radius,material,tipRadius=radius){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);
  if(v.lengthSq()<1e-12)throw new Error('Beam endpoints must differ');
  const m=cylinder(parent,tipRadius,radius,v.length(),start.add(end).multiplyScalar(.5).toArray(),material);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;
}
export function cord(parent,points,radius,material){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return mesh(parent,new THREE.TubeGeometry(curve,Math.max(12,points.length*6),radius,6,false),material);
}
/** Square plinth, top plane y=.91. Material roles are explicit, not theme names. */
export function plinth(parent,{size=14,stone,stoneLight,wood,ground}){
  const g=new THREE.Group();parent.add(g);
  box(g,[size,.72,size],[0,-.1,0],stone,.17);
  const count=Math.ceil(size/1.2),step=(size-.2)/count;
  for(let side=0;side<4;side++){
    const wall=new THREE.Group();wall.rotation.y=side*Math.PI/2;g.add(wall);
    for(let row=0;row<2;row++)for(let i=0;i<count;i++){
      // Keep fitted blocks inside the corners.
      const left=-size/2+.1+i*step;
      box(wall,[step-.04,.28,.12],[left+step/2,-.27+row*.33,size/2-.04],(i+row)%3?stoneLight:stone,.04);
    }
  }
  box(g,[size+.03,.15,size+.03],[0,.34,0],wood,.1);
  box(g,[size-.05,.12,size-.05],[0,.49,0],stone,.1);
  box(g,[size-.12,.34,size-.12],[0,.74,0],ground,.15);
  return g;
}
/** Ridge along X. rise is independent from footprint; use uplift=0 for a cabin. */
export function roof(parent,{width=5,depth=4,rise=1.5,uplift=.12,position=[0,0,0],surface,trim,seam,tileStep=.3}){
  const g=new THREE.Group();g.position.fromArray(position);parent.add(g);
  const profile=t=>rise*(1-t)**1.4+uplift*t**9;
  for(const sign of [-1,1]){
    const p=[],uv=[],indices=[];
    for(let i=0;i<=18;i++){const t=i/18;for(const s of [-1,1]){p.push(s*width/2,profile(t),sign*t*depth/2);uv.push((s+1)/2,t);}}
    for(let i=0;i<18;i++){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    const m=surface.clone();m.side=THREE.DoubleSide;mesh(g,geo,m);
    for(let x=-width/2;x<=width/2+.001;x+=tileStep){const pts=[];for(let j=0;j<=12;j++)pts.push([x,profile(j/12)+.03,sign*j/12*depth/2]);cord(g,pts,.027,seam);}
    box(g,[width+.14,.13,.15],[0,profile(1)-.03,sign*depth/2],trim,.025);
    for(const side of [-1,1]){const pts=[];for(let j=0;j<=12;j++)pts.push([side*width/2,profile(j/12),sign*j/12*depth/2]);cord(g,pts,.055,trim);}
  }
  box(g,[width+.16,.17,.21],[0,rise+.025,0],trim,.035);return g;
}
export function shrub(parent,{position,radius=.6,materials,random=seededRandom()}){
  const g=new THREE.Group();g.position.fromArray(position);parent.add(g);
  for(let i=0;i<5;i++){const a=i*2.399;blob(g,radius*.65,[Math.cos(a)*radius*.4,radius*.4+random(0,.12),Math.sin(a)*radius*.4],materials[i%materials.length],[1,.75,1]);}
  return g;
}
export function tree(parent,{position,height=5,spread=1.5,bark,leaves,random=seededRandom()}){
  const g=new THREE.Group();g.position.fromArray(position);parent.add(g);
  beam(g,[0,0,0],[.1,height*.65,0],.19,bark,.075);
  for(let i=0;i<7;i++){
    const a=i*2.399,x=Math.cos(a)*spread*.6,z=Math.sin(a)*spread*.6,y=height*(.65+random(0,.22));
    beam(g,[.05,height*.32,0],[x,y,z],.08,bark,.025);
    for(let j=0;j<3;j++)blob(g,spread*.53,[x+random(-.25,.25),y+random(-.14,.16),z+random(-.25,.25)],leaves[(i+j)%leaves.length],[1,.72,1]);
  }
  return g;
}
/** Batch only a static subtree. Transparent, instanced, skinned and multi-material
 * meshes remain independent. Positions are baked relative to root, preserving UVs. */
export function batchStatic(root){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(),batches=new Map(),originals=[];
  root.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||Array.isArray(o.material)||o.material.transparent||o.material.vertexColors||o.morphTargetInfluences)return;
    if(Object.keys(o.geometry.attributes).some(k=>!['position','normal','uv'].includes(k)))return;
    for(let ancestor=o;ancestor;ancestor=ancestor.parent){if(!ancestor.visible)return;if(ancestor===root)break;}
    const key=[o.material.uuid,o.castShadow,o.receiveShadow].join(':');
    if(!batches.has(key))batches.set(key,{material:o.material,cast:o.castShadow,receive:o.receiveShadow,geos:[]});
    const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
    for(const attr of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(attr))geo.deleteAttribute(attr);
    if(!geo.attributes.normal)geo.computeVertexNormals();
    if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
    batches.get(key).geos.push(geo);originals.push(o);
  });
  for(const b of batches.values()){
    const geo=mergeGeometries(b.geos,false);if(!geo)throw new Error('Incompatible static geometry');
    const m=new THREE.Mesh(geo,b.material);m.castShadow=b.cast;m.receiveShadow=b.receive;root.add(m);b.geos.forEach(g=>g.dispose());
  }
  originals.forEach(o=>o.removeFromParent());
  return {before:originals.length,after:batches.size};
}
