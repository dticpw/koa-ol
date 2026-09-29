import * as THREE from 'three';
import { createRuntime } from './lib/runtime.js';
import { palette,seededRandom,box,blob,cylinder,beam,cord,roof,tree,shrub,batchStatic,mesh } from './lib/geometry.js';

// Countryside yard diorama, laid out from a hand-drawn plan.
// Ground top is y=0; +Z faces the pond (house front). From +X to -X:
// side road, main house, L-shaped carport, red-tiled and grey-tiled
// outbuildings (ridges run front-to-back), vegetable plot and orchard.
const random=seededRandom(929);
const M=palette({
  tile:'#ffffff',skirt:'#a7aba6',plaster:'#b3aea2',cement:'#948f84',concrete:'#b8b3a6',concreteLight:'#cdc8bb',stain:'#aca79a',
  frame:'#eef0ec',glass:'#4f7f6a',curtain:'#9fcaa3',door:'#6b4636',bars:'#3a3d3b',couplet:'#c2493a',gold:'#d9b24a',
  roofRed:'#9b5b45',roofRedDark:'#6e3c2e',seamRed:'#7f4637',roofGrey:'#7d807b',roofGreyDark:'#5a5d59',seamGrey:'#646763',
  sheet:'#4d84bf',sheetRib:'#6c9fd4',sheetUnder:'#a9aaa4',rust:'#8b5f48',steel:'#9ea6a9',moss:'#6f7a55',
  grass:'#86a55c',grassDark:'#6f9056',soil:'#8c6b4d',soilDark:'#5f4735',wood:'#6f5240',plank:'#c9a77f',
  water:'#6f7f45',waterLight:'#93a067',leaf:'#6f9a55',leafDark:'#4f7646',leafLight:'#9cbd62',deep:'#3f6340',
  golden:'#cbd65a',goldenDark:'#a8bc45',bamboo:'#88a25a',bark:'#cfcbb8',barkDark:'#7a6a58',
  brick:'#ad5a42',mesh:'#6f7672',blue:'#4c8fd0',white:'#f4f4f0',dark:'#2f3131',black:'#26211f',
  truck:'#b9bdbd',tealCar:'#5bb8c0',redLight:'#d0453a',orange:'#e0913a',pink:'#e79ab0',flower:'#f1d35a',
  tan:'#c48b55',tanLight:'#e0b07c',cloth:'#5d5a73',clothBlue:'#3f4f7a',clothGrey:'#c4c8cc',
});

// White facade tiles, projected in world units so neighbouring blocks share one grid.
const tileMap=(()=>{
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  g.fillStyle='#eff0ec';g.fillRect(0,0,256,256);
  const r=seededRandom(12);
  for(let j=0;j<8;j++)for(let i=0;i<4;i++){const l=236+Math.floor(r(0,14));g.fillStyle=`rgb(${l},${l+1},${l-2})`;g.fillRect(i*64+2,j*32+2,60,28);}
  g.strokeStyle='#b9bdb7';g.lineWidth=3;
  for(let i=0;i<=4;i++){g.beginPath();g.moveTo(i*64,0);g.lineTo(i*64,256);g.stroke();}
  for(let j=0;j<=8;j++){g.beginPath();g.moveTo(0,j*32);g.lineTo(256,j*32);g.stroke();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
})();
M.tile.map=tileMap;
function tileBox(parent,size,pos,material=M.tile,span=1){
  const geo=new THREE.BoxGeometry(...size);geo.translate(...pos);
  const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
  for(let i=0;i<p.count;i++){
    const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i));
    const u=ax>.5?p.getZ(i):p.getX(i),v=ay>.5?p.getZ(i):p.getY(i);
    uv.setXY(i,u/span,v/span);
  }
  return mesh(parent,geo,material);
}

const dog=new THREE.Group(),dogParts={};
const app=createRuntime({canvas:document.querySelector('canvas'),background:'#e8e9e2',onFrame:({time})=>{
  if(dogParts.tail)dogParts.tail.rotation.y=Math.sin(time*7)*.55;
  if(dogParts.head)dogParts.head.rotation.y=Math.sin(time*.45)*.35;
}});
const model=new THREE.Group();app.scene.add(model);
const S=new THREE.Group();model.add(S); // static subtree, batched once

// Rectangles that must stay free of scattered grass tufts and flowers.
const keepOut=[];
const reserve=(x0,x1,z0,z1)=>keepOut.push([Math.min(x0,x1),Math.max(x0,x1),Math.min(z0,z1),Math.max(z0,z1)]);
const blocked=(x,z)=>keepOut.some(([a,b,c,d])=>x>a&&x<b&&z>c&&z<d);

// ---------- Base: layered earth slab with a recessed pond ----------
function roundRect(x0,z0,x1,z1,r){
  // Shape XY maps to world (x,-z) after the -90° X rotation below.
  const s=new THREE.Shape();
  s.moveTo(x0+r,-z0);s.lineTo(x1-r,-z0);s.quadraticCurveTo(x1,-z0,x1,-z0-r);
  s.lineTo(x1,-z1+r);s.quadraticCurveTo(x1,-z1,x1-r,-z1);s.lineTo(x0+r,-z1);
  s.quadraticCurveTo(x0,-z1,x0,-z1+r);s.lineTo(x0,-z0-r);s.quadraticCurveTo(x0,-z0,x0+r,-z0);return s;
}
const pondPts=[[-11.3,6.0],[-9.5,5.4],[-6,5.35],[-3,5.45],[0,5.55],[2.4,5.6],[3.5,6.3],[3.3,7.4],[1.6,8.1],[-2,8.25],[-6,8.2],[-9.5,8.15],[-11.2,7.7],[-11.7,6.9]];
const pondCurve=new THREE.CatmullRomCurve3(pondPts.map(([x,z])=>new THREE.Vector3(x,-z,0)),true,'centripetal');
const pondOutline=pondCurve.getPoints(72).map(v=>new THREE.Vector2(v.x,v.y));
const inPond=(()=>{const poly=pondOutline.map(v=>[v.x,-v.y]);return (x,z,pad=.35)=>{
  let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}
  return inside||poly.some(([px,pz])=>Math.hypot(px-x,pz-z)<pad);};})();
function slab(shape,y0,depth,materials){
  const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:10});geo.rotateX(-Math.PI/2);geo.translate(0,y0,0);
  const m=new THREE.Mesh(geo,materials);m.receiveShadow=true;S.add(m);return m;
}
const [BX0,BZ0,BX1,BZ1]=[-12.3,-7.4,9.0,9.1];
const topShape=roundRect(BX0,BZ0,BX1,BZ1,1.4);topShape.holes.push(new THREE.Path(pondOutline));
slab(topShape,-.32,.32,[M.grass,M.soil]);
slab(roundRect(BX0,BZ0,BX1,BZ1,1.4),-1.1,.78,M.soilDark);
slab(roundRect(BX0-.2,BZ0-.2,BX1+.2,BZ1+.2,1.55),-1.3,.2,M.wood);
// Pebble strata on the cut edge of the base.
for(let i=0;i<46;i++){
  const side=i%4,t=random(.08,.92),y=random(-.95,-.45);
  const [x,z]=side===0?[BX0+(BX1-BX0)*t,BZ1]:side===1?[BX1,BZ0+(BZ1-BZ0)*t]:side===2?[BX0+(BX1-BX0)*t,BZ0]:[BX0,BZ0+(BZ1-BZ0)*t];
  if(Math.abs(x-BX0)<1.5&&Math.abs(z-BZ0)<1.5||Math.abs(x-BX1)<1.5&&Math.abs(z-BZ1)<1.5||Math.abs(x-BX0)<1.5&&Math.abs(z-BZ1)<1.5||Math.abs(x-BX1)<1.5&&Math.abs(z-BZ0)<1.5)continue;
  blob(S,random(.07,.13),[x,y,z],i%3?M.soil:M.stain,[1.3,.8,1.3]);
}
{
  const shape=new THREE.Shape(pondOutline);
  const water=new THREE.Mesh(new THREE.ShapeGeometry(shape),M.water);water.rotation.x=-Math.PI/2;water.position.y=-.12;water.receiveShadow=true;S.add(water);
  const bed=new THREE.Mesh(new THREE.ShapeGeometry(shape),M.soilDark);bed.rotation.x=-Math.PI/2;bed.position.y=-.3;S.add(bed);
  for(const [x,z,l] of [[-7,6.6,2.4],[-2.2,7.1,1.8],[1.0,6.4,1.1],[-9.6,7.4,1.2]])box(S,[l,.006,.07],[x,-.115,z],M.waterLight);
  for(let i=0;i<16;i++){const p=cylinder(S,.13,.13,.012,[-10.8+random(0,2.6),-.11,6.0+random(0,1.8)],i%3?M.leafDark:M.leaf,9);p.scale.z=.8;}
  for(let i=0;i<3;i++)blob(S,.05,[-10.2+i*.7,-.07,6.5+i*.3],M.pink,[1,.7,1]);  // water lilies
  for(let i=0;i<40;i++){
    const t=random(0,1),v=pondCurve.getPointAt(t),x=v.x,z=-v.y;if(z<6.1&&x>-8)continue;
    const h=random(.35,.75);beam(S,[x,-.14,z],[x+random(-.06,.06),h,z+random(-.06,.06)],.018,i%4?M.leaf:M.goldenDark,.008);
  }
}

// ---------- Ground surfaces ----------
const pad=(x0,x1,z0,z1,m=M.concrete,h=.06)=>{reserve(x0,x1,z0,z1);return box(S,[x1-x0,h,z1-z0],[(x0+x1)/2,h/2,(z0+z1)/2],m);};
pad(-.8,5.0,-.3,2.3);                     // front yard
pad(-3.9,-.8,-.3,4.0);                    // carport, front section
pad(-3.9,-1.83,-2.2,-.3);                 // carport beside the house
pad(-4.1,-1.83,-6.4,-2.2,M.cement);       // open-air passage
pad(-1.83,5.0,-5.6,-3.9);                 // rear walkway
pad(5.0,8.5,-6.9,2.3,M.concreteLight);    // village road, ends at the front lawn
reserve(-1.83,4.6,-3.9,-.3);reserve(-6.9,-3.8,-6.4,4.1);
for(const [x,z,sx,sz] of [[1.8,1.1,1.5,.8],[4.8,1.6,.9,.6],[-2.2,2.4,1.0,.7],[7.6,-2.5,.5,1.4]]){const d=cylinder(S,1,1,.004,[x,.061,z],M.stain,18);d.scale.set(sx,1,sz);}
cord(S,[[.2,.065,2.1],[.5,.065,1.3],[.1,.065,.5]],.016,M.cement);
cord(S,[[3.6,.065,2.2],[3.2,.065,1.5],[3.5,.065,.8]],.014,M.cement);
for(let z=-6.6;z<2.2;z+=1.1)box(S,[3.5,.004,.02],[6.75,.062,z],M.cement);   // road slab joints

// ---------- Shared building parts ----------
function windowAt(parent,{x,y,z,w,h,rot=0,cols=3,bars=false,curtain=false,transom=true,frame=M.frame,glass=M.glass}){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);
  box(g,[w+.08,h+.08,.05],[0,0,.015],frame);box(g,[w,h,.02],[0,0,.04],glass);
  if(curtain)for(const s of [-1,1])box(g,[w*.22,h*.78,.01],[s*w*.18,-.02,.052],M.curtain);
  for(let i=1;i<cols;i++)box(g,[.035,h,.03],[-w/2+i*w/cols,0,.06],frame);
  if(transom)box(g,[w,.035,.03],[0,h*.28,.06],frame);
  box(g,[w+.16,.05,.1],[0,-h/2-.05,.06],frame);
  if(bars){
    const n=Math.round(w/.085);
    for(let i=0;i<=n;i++)box(g,[.018,h+.04,.018],[-w/2+i*w/n,0,.11],M.bars);
    for(const yy of [-h/2,0,h/2])box(g,[w+.04,.025,.02],[0,yy,.11],M.bars);
  }
  return g;
}
function doorAt(parent,{x,y=0,z,w,h,rot=0,grill=false,leaf=M.door}){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);
  box(g,[w+.1,h+.06,.05],[0,h/2+.03,.015],M.dark);box(g,[w,h,.03],[0,h/2,.04],leaf);
  for(const yy of [.28,.62])box(g,[w*.7,h*.26,.012],[0,h*yy,.06],M.wood);
  blob(g,.025,[w*.36,h*.47,.07],M.frame);
  if(grill){box(g,[w,.24,.02],[0,h+.19,.04],M.dark);for(let i=0;i<7;i++)box(g,[.015,.2,.015],[-w/2+.05+i*(w-.1)/6,h+.19,.06],M.steel);}
  return g;
}
function gable(x0,x1,y0,apex,z,material){
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([x0,y0,z,(x0+x1)/2,apex,z,x1,y0,z],3));geo.computeVertexNormals();
  const m=material.clone();m.side=THREE.DoubleSide;return mesh(S,geo,m);
}
// A gabled outbuilding whose ridge runs along Z.
function outbuilding({x0,x1,z0,z1,h,rise,surface,trim,seam,step}){
  const cx=(x0+x1)/2,cz=(z0+z1)/2;
  box(S,[x1-x0,h,z1-z0],[cx,h/2,cz],M.plaster);
  box(S,[x1-x0+.02,.14,z1-z0+.02],[cx,.07,cz],M.cement);
  const r=roof(S,{width:z1-z0+.35,depth:x1-x0+.5,rise,uplift:0,position:[cx,h,cz],surface,trim,seam,tileStep:step});r.rotation.y=Math.PI/2;
  for(const z of [z0,z1])gable(x0,x1,h,h+rise*.93,z,M.plaster);
}

// ---------- Main house ----------
const H=new THREE.Group();S.add(H);
const [HX0,HX1,HZ0,HZ1]=[-1.83,4.6,-3.9,-.3],HW=HX1-HX0,HC=(HX0+HX1)/2,HD=HZ1-HZ0,HZC=(HZ0+HZ1)/2;
tileBox(H,[HW,1.6,HD],[HC,.8,HZC]);
box(H,[HW,.2,HD+.02],[HC,.1,HZC],M.skirt);
box(H,[HW,.14,HD+.12],[HC,1.67,HZC],M.frame);                 // floor band
tileBox(H,[HX1,1.6,HD],[HX1/2,2.54,HZC]);                          // upper floor
tileBox(H,[-HX0,1.6,1.7],[HX0/2,2.54,-3.05]);                      // room behind the sunroom
box(H,[HX1+.05,.14,HD+.1],[(HX1-.05)/2,3.41,HZC],M.frame);box(H,[-HX0+.05,.14,1.8],[(HX0+.05)/2,3.41,-3.05],M.frame);
box(H,[.02,3.46,HD],[HX1+.011,1.73,HZC],M.plaster);               // plain cement gable side
// Red-tiled gable roof in the outbuildings' style, ridge along X (south = +Z).
// The front parapet hides its lower edge. Over the west back room a smaller
// gable starts from the same rear eave but peaks halfway across that room.
tileBox(H,[4.5,.26,.1],[2.3,3.61,-.35]);box(H,[4.6,.05,.16],[2.3,3.765,-.35],M.frame);
const RY=3.48,RISE=.95,RZ=HZC,RHALF=1.65,WZ=-3.05;                   // WZ: early ridge over the west back room
const mainH=z=>RISE*(1-Math.min(1,Math.abs(z-RZ)/RHALF))**1.4;          // same curve as roof() in geometry.js
const westH=z=>z<WZ?mainH(z):mainH(2*WZ-z);                             // shares the rear slope, then mirrors down
const [RX0,RX1,WX0]=[-.25,HX1+.25,HX0-.2];
const roofTile=M.roofRed.clone();roofTile.side=THREE.DoubleSide;
function slope(x0,x1,zA,zB,h){                 // curved tile surface; seams sit on one global grid so pieces merge
  const n=18,p=[],uv=[],idx=[];
  for(let i=0;i<=n;i++){const z=zA+(zB-zA)*i/n;for(const x of [x0,x1]){p.push(x,RY+h(z),z);uv.push(x,z);}}
  for(let i=0;i<n;i++){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();mesh(H,geo,roofTile);
  for(let x=Math.ceil(x0/.2-1e-6)*.2;x<=x1+1e-6;x+=.2){const pts=[];for(let j=0;j<=12;j++){const z=zA+(zB-zA)*j/12;pts.push([x,RY+h(z)+.03,z]);}cord(H,pts,.027,M.seamRed);}
}
const verge=(x,z0,z1,h)=>{const pts=[];for(let j=0;j<=16;j++){const z=z0+(z1-z0)*j/16;pts.push([x,RY+h(z),z]);}cord(H,pts,.055,M.roofRedDark);};
slope(RX0,RX1,RZ,RZ+RHALF,mainH);               // main front slope, behind the parapet
slope(RX0,RX1,RZ,RZ-RHALF,mainH);               // main rear slope
slope(WX0,RX0,WZ,RZ-RHALF,westH);               // same rear slope continued west
slope(WX0,RX0,WZ,-2.3,westH);                   // west part falls toward the sunroom
box(H,[RX1-RX0+.14,.13,.15],[(RX0+RX1)/2,RY-.03,RZ+RHALF],M.roofRedDark);
box(H,[RX1-WX0+.14,.13,.15],[(WX0+RX1)/2,RY-.03,RZ-RHALF],M.roofRedDark);       // one continuous rear eave
box(H,[RX0-WX0+.1,.11,.13],[(WX0+RX0)/2,RY-.02,-2.3],M.roofRedDark);
box(H,[RX1-RX0+.16,.17,.21],[(RX0+RX1)/2,RY+RISE+.025,RZ],M.roofRedDark);          // ridges
box(H,[RX0-WX0+.06,.15,.19],[(WX0+RX0)/2,RY+mainH(WZ)+.02,WZ],M.roofRedDark);
verge(RX1,RZ+RHALF,RZ-RHALF,mainH);verge(RX0,RZ+RHALF,WZ,mainH);verge(WX0,RZ-RHALF,-2.3,westH);
function houseGable(x,z0,z1,h,material){       // wall closing a roof end, following its curved profile
  const pts=[];for(let i=0;i<=24;i++){const z=z0+(z1-z0)*i/24;pts.push([z,RY+h(z)*.97]);}
  const c=[(z0+z1)/2,RY],pos=[],uv=[];
  for(let i=0;i<pts.length-1;i++)for(const [z,y] of [c,pts[i],pts[i+1]]){pos.push(x,y,z);uv.push(z,y);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  const m=material.clone();m.side=THREE.DoubleSide;return mesh(H,geo,m);
}
houseGable(HX1+.012,HZ1,HZ0,mainH,M.plaster);        // east gable: plain cement, no windows
houseGable(0,HZ1,HZ0,mainH,M.tile);                  // above the sunroom
houseGable(HX0-.012,HZ0,-2.2,westH,M.plaster);       // west gable of the early-peaking part
// Front facade (+Z).
windowAt(H,{x:-.95,y:.95,z:HZ1,w:.95,h:.7,bars:true});
doorAt(H,{x:1.2,y:.2,z:HZ1,w:.62,h:1.1,grill:true});
box(H,[.5,.13,.02],[1.2,1.62,HZ1+.03],M.couplet);
for(const s of [-1,1])box(H,[.09,.9,.02],[1.2+s*.44,.78,HZ1+.03],M.couplet);
box(H,[.14,.14,.01],[1.2,.95,HZ1+.075],M.gold).rotation.z=Math.PI/4;               // lucky diamond on the door
blob(H,.06,[1.2,1.52,HZ1+.1],M.white);                                               // porch lamp
windowAt(H,{x:3.45,y:.98,z:HZ1,w:1.0,h:.72,bars:true});
windowAt(H,{x:1.15,y:2.62,z:HZ1,w:1.35,h:.82,curtain:true});
windowAt(H,{x:3.45,y:2.62,z:HZ1,w:1.3,h:.82,curtain:true});
box(H,[.24,.3,.1],[4.3,1.3,HZ1+.05],M.frame);box(H,[.18,.1,.02],[4.3,1.36,HZ1+.11],M.glass);  // meter box
cord(H,[[4.3,1.45,HZ1+.05],[4.4,2.6,HZ1+.04],[4.58,3.6,-.4]],.012,M.dark);
// Front platform, step and doorstep clutter.
box(H,[4.65,.2,.9],[2.3,.1,.15],M.concrete);box(H,[4.45,.1,.35],[2.3,.05,.78],M.cement);
blob(H,.1,[2.95,.33,.3],M.wood,[1,1.3,1]);blob(H,.1,[3.25,.33,.25],M.plank,[1,1.2,1]);   // stumps used as seats
blob(H,.06,[2.95,.47,.3],M.golden,[1.5,.6,1]);                                       // melons drying on a stump
beam(H,[2.25,.2,-.15],[2.35,1.15,-.25],.015,M.plank);blob(H,.09,[2.25,.26,-.13],M.goldenDark,[1.4,1,.5]);  // broom
cylinder(H,.12,.09,.2,[4.25,.3,.3],M.brick,10);shrub(H,{position:[4.25,.38,.3],radius:.16,materials:[M.leaf,M.leafDark],random});
for(let i=0;i<3;i++)box(H,[.1,.02,.2],[.1+i*.14,.21,.35],M.white);                 // slippers
// Sunroom on the lower roof, front corner nearest the carport.
{
  const g=new THREE.Group();H.add(g);const [x0,x1,z0,z1,y0]=[HX0,0,-2.2,HZ1,1.74];
  for(const [x,z] of [[x0,z1],[x1-.05,z1],[x0,z0]])box(g,[.06,1.35,.06],[x,y0+.67,z],M.frame);
  for(let i=1;i<4;i++)box(g,[.04,1.3,.04],[x0+i*(x1-x0)/4,y0+.65,z1],M.frame);
  for(let i=1;i<3;i++)box(g,[.04,1.3,.04],[x0,y0+.65,z0+i*(z1-z0)/3],M.frame);
  for(const y of [y0+.02,y0+.55,y0+1.33]){box(g,[x1-x0,.05,.05],[(x0+x1)/2,y,z1],M.frame);box(g,[.05,.05,z1-z0],[x0,y,(z0+z1)/2],M.frame);}
  for(const [a,b] of [[[x0-.05,z1+.06],[x1,z1+.06]],[[x0-.05,z0],[x0-.05,z1+.06]]]){
    beam(g,[a[0],y0+.52,a[1]],[b[0],y0+.52,b[1]],.02,M.steel);
    const n=Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/.14);
    for(let i=0;i<=n;i++){const t=i/n;box(g,[.015,.5,.015],[a[0]+(b[0]-a[0])*t,y0+.27,a[1]+(b[1]-a[1])*t],M.steel);}
  }
  box(g,[x1-x0-.1,.01,z1-z0-.1],[(x0+x1)/2,y0+.005,(z0+z1)/2],M.stain);     // patterned floor tiles
  box(g,[.5,.4,.3],[-1.2,y0+.2,-1.9],M.white,.03);box(g,[.4,.2,.02],[-.5,y0+.3,-.4],M.plank);  // chair and a board
  const glass=new THREE.MeshToonMaterial({color:'#cfe6ec',transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide,gradientMap:M.frame.gradientMap});
  const pane=(size,pos)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),glass);m.position.fromArray(pos);model.add(m);return m;};
  pane([x1-x0,1.3,.01],[(x0+x1)/2,y0+.67,z1]);pane([.01,1.3,z1-z0],[x0,y0+.67,(z0+z1)/2]);
  const rise=.22,len=Math.hypot(z1-z0,rise),ang=Math.atan2(rise,z1-z0);
  const roofG=new THREE.Group();roofG.position.set((x0+x1)/2,y0+1.47,(z0+z1)/2);roofG.rotation.x=ang;g.add(roofG);
  for(let i=0;i<=4;i++)box(roofG,[.05,.05,len+.1],[-(x1-x0)/2+i*(x1-x0)/4,0,0],M.frame);
  const top=new THREE.Mesh(new THREE.BoxGeometry(x1-x0+.1,.012,len+.1),glass);top.position.copy(roofG.position);top.rotation.x=ang;model.add(top);
}
// Rear (north): a two-storey block projects at the west end; the back door is on
// its east face. East of it a recessed balcony runs to the east wall, which
// ends open on the east side. A flat concrete canopy covers both.
const BX=HX0+1.4,BZ=-4.8;
tileBox(H,[1.4,1.6,.9],[HX0+.7,.8,-4.35]);tileBox(H,[1.4,1.6,.9],[HX0+.7,2.54,-4.35]);
box(H,[1.4,.14,.96],[HX0+.7,1.67,-4.35],M.frame);box(H,[1.4,.2,.92],[HX0+.7,.1,-4.35],M.skirt);
windowAt(H,{x:HX0+.7,y:1.0,z:BZ,w:.45,h:.55,rot:Math.PI,cols:1,bars:true,transom:false});
windowAt(H,{x:HX0+.7,y:2.7,z:BZ,w:.45,h:.6,rot:Math.PI,cols:1,transom:false});
doorAt(H,{x:BX,z:-4.35,w:.5,h:1.1,rot:Math.PI/2});                                  // back door faces east
box(H,[.3,.06,.6],[BX+.15,.03,-4.35],M.concrete);
box(H,[HX1-BX,.12,.9],[(BX+HX1)/2,1.68,-4.35],M.frame);                     // balcony slab
tileBox(H,[HX1-BX,.55,.1],[(BX+HX1)/2,2.02,-4.75]);box(H,[HX1-BX+.05,.05,.16],[(BX+HX1)/2,2.32,-4.75],M.frame);
tileBox(H,[.1,.55,.8],[HX1-.05,2.02,-4.3]);box(H,[.16,.05,.85],[HX1-.05,2.32,-4.3],M.frame);   // low east rail, open above
box(H,[HX1-BX,1.6,.02],[(BX+HX1)/2,2.54,HZ0-.011],M.frame);                // plastered wall inside the balcony
box(H,[HW+.1,.14,1.0],[HC,3.41,-4.4],M.frame);box(H,[HW,.01,.9],[HC,3.485,-4.4],M.cement);   // flat canopy
blob(H,.05,[1.8,1.6,-4.35],M.white,[1,.5,1]);                                       // lamp under the balcony
for(const [x,c] of [[2.8,M.clothBlue],[3.15,M.white],[4.1,M.clothGrey]])box(H,[.25,.35,.02],[x,2.05,-4.25],c);  // laundry
beam(H,[2.5,2.25,-4.25],[4.45,2.25,-4.25],.008,M.steel);
windowAt(H,{x:3.5,y:2.7,z:HZ0,w:.8,h:.6,rot:Math.PI,cols:2});
windowAt(H,{x:2.0,y:2.7,z:HZ0,w:.8,h:.6,rot:Math.PI,cols:2});
doorAt(H,{x:1.05,y:1.74,z:HZ0,w:.5,h:1.1,rot:Math.PI});                            // balcony door, same style as the back door
windowAt(H,{x:3.35,y:1.0,z:HZ0,w:.9,h:.66,rot:Math.PI,bars:true,curtain:true});   // east to west: large,
windowAt(H,{x:2.1,y:.95,z:HZ0,w:.36,h:.7,rot:Math.PI,cols:1,bars:true,transom:false});  // narrow,
windowAt(H,{x:1.0,y:.95,z:HZ0,w:.36,h:.7,rot:Math.PI,cols:1,bars:true,transom:false});  // narrow
box(H,[.55,.38,.22],[4.05,1.3,HZ0-.13],M.frame,.02);
{const fan=cylinder(H,.13,.13,.02,[3.95,1.3,HZ0-.25],M.dark,14);fan.rotation.x=Math.PI/2;}
cord(H,[[4.25,1.4,HZ0-.1],[4.35,1.62,HZ0-.02]],.012,M.frame);
cylinder(H,.035,.035,3.4,[HX1-.05,1.7,HZ0-.05],M.frame,8);cylinder(H,.035,.035,3.4,[HX0+.04,1.7,BZ-.05],M.frame,8);
// West wall is plain cement with windows only on the ground floor (under the carport).
box(H,[.02,1.7,HD],[HX0-.011,.85,HZC],M.plaster);box(H,[.02,1.6,1.7],[HX0-.011,2.54,-3.05],M.plaster);
box(H,[.02,3.4,.9],[HX0-.011,1.7,-4.35],M.plaster);
windowAt(H,{x:HX0-.02,y:.95,z:-1.4,w:.8,h:.7,rot:-Math.PI/2,bars:true});
windowAt(H,{x:HX0-.02,y:.95,z:-3.3,w:.6,h:.6,rot:-Math.PI/2,bars:true,transom:false,cols:2});
box(H,[.5,.16,3.5],[HX0-.25,.08,-2.1],M.concrete);

// ---------- Carport: blue steel lean-to between house and outbuilding ----------
const C=new THREE.Group();S.add(C);
const CX0=-3.9,CX1=-.8,roofY=x=>1.74-(x-CX0)*.12,ang=-Math.atan(.12);
function sheet(x0,x1,z0,z1){
  const cx=(x0+x1)/2,cz=(z0+z1)/2,len=(x1-x0)/Math.cos(ang),g=new THREE.Group();
  g.position.set(cx,roofY(cx),cz);g.rotation.z=ang;C.add(g);
  box(g,[len,.03,z1-z0],[0,.02,0],M.sheet);box(g,[len,.015,z1-z0],[0,-.005,0],M.sheetUnder);
  for(let z=z0+.12;z<z1;z+=.26)box(g,[len,.035,.05],[0,.045,z-cz],M.sheetRib);
}
sheet(CX0,CX1,-.3,4.05);sheet(CX0,HX0,-2.2,-.3);
box(C,[.06,.06,4.4],[CX1+.02,roofY(CX1)-.01,1.87],M.sheetRib);box(C,[CX1-CX0,.05,.06],[(CX0+CX1)/2,roofY((CX0+CX1)/2)-.02,4.07],M.sheetRib);
function truss(a,b,yA,yB,depth=.28,step=.6){
  const l=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.round(l/step));
  const P=(t,dy=0)=>[a[0]+(b[0]-a[0])*t,yA+(yB-yA)*t-dy,a[1]+(b[1]-a[1])*t];
  beam(C,P(0),P(1),.028,M.rust);beam(C,P(0,depth),P(1,depth),.024,M.rust);
  for(let i=0;i<=n;i++){beam(C,P(i/n,depth),P(i/n),.016,M.rust);if(i<n)beam(C,P(i/n,depth),P((i+1)/n),.014,M.rust);}
}
truss([CX1,-.3],[CX1,4.0],roofY(CX1)-.04,roofY(CX1)-.04);                       // low eave beam
for(const z of [4.0,1.85,-.3])truss([CX0,z],[CX1,z],roofY(CX0)-.04,roofY(CX1)-.04,.24);
truss([CX0,-2.15],[HX0,-2.15],roofY(CX0)-.04,roofY(HX0)-.04,.2);
for(const z of [4.0,1.85])beam(C,[CX1,.06,z],[CX1,roofY(CX1)-.05,z],.045,M.steel);
beam(C,[-2.4,roofY(-2.4)-.06,-2.2],[-2.4,roofY(-2.4)-.06,4.0],.02,M.rust);                    // purlin
cord(C,[[CX1,1.2,1.0],[-1.6,1.1,1.0],[-2.4,1.15,1.0]],.006,M.dark);blob(C,.05,[-2.4,1.1,1.0],M.white);  // hanging bulb
// Tarp on the eave beam, shading the house corner.
{
  const geo=new THREE.PlaneGeometry(1.4,.95,10,6),p=geo.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*9)*.025*(.5-p.getY(i)));geo.computeVertexNormals();
  const m=M.cloth.clone();m.side=THREE.DoubleSide;const t=mesh(C,geo,m,[CX1+.03,.82,1.85]);t.rotation.y=Math.PI/2;
}

// ---------- Outbuildings: red-tiled (front) and grey-tiled (rear) ----------
outbuilding({x0:-6.8,x1:-3.9,z0:-2.1,z1:4.0,h:1.55,rise:.75,surface:M.roofRed,trim:M.roofRedDark,seam:M.seamRed,step:.2});
outbuilding({x0:-6.8,x1:-4.1,z0:-6.3,z1:-2.45,h:1.55,rise:.75,surface:M.roofGrey,trim:M.roofGreyDark,seam:M.seamGrey,step:.15});
// Red building faces the carport (+X): roller shutter, doorway, open workshop, small door.
{
  const g=new THREE.Group();g.position.set(-3.9,0,0);g.rotation.y=Math.PI/2;S.add(g);   // local +X = world -Z
  box(g,[1.5,1.05,.04],[-2.5,.55,.01],M.concreteLight);
  for(let i=0;i<9;i++)box(g,[1.5,.012,.012],[-2.5,.12+i*.11,.035],M.cement);
  box(g,[1.56,.15,.08],[-2.5,1.13,.03],M.concreteLight);
  box(g,[.5,1.1,.03],[-.95,.55,.01],M.dark);
  box(g,[1.3,.7,.03],[.4,.75,.01],M.dark);for(const y of [.4,1.1])box(g,[1.36,.05,.06],[.4,y,.03],M.frame);
  box(g,[.4,1.05,.03],[1.75,.53,.01],M.dark);box(g,[.3,.35,.03],[1.2,.9,.01],M.glass);
  box(g,[.34,1.0,.04],[-.35,.52,.1],M.plank);box(g,[.9,.4,.04],[.2,.3,.08],M.plank);            // leaning boards
  box(g,[.72,.05,.34],[.55,.45,.3],M.frame);for(const x of [.25,.85])box(g,[.04,.42,.3],[x,.22,.3],M.frame);  // white table
  box(g,[.36,.4,.3],[1.0,.2,.27],M.frame);
  box(g,[.5,.07,.28],[2.3,.55,.2],M.frame);box(g,[.12,.5,.12],[2.3,.25,.2],M.frame);        // wash basin
  for(let i=0;i<3;i++)box(g,[.05,.28,.02],[2.05+i*.12,1.05,.05],i===1?M.white:M.clothGrey);  // towels
  beam(g,[1.95,1.2,.05],[2.4,1.2,.05],.012,M.wood);
  cylinder(g,.11,.11,.4,[-1.5,.2,.25],M.blue,12);                                            // gas cylinder
  box(g,[.3,.3,.02],[-1.5,1.05,.03],M.frame);                                                // switch box
}
windowAt(S,{x:-5.35,y:.95,z:4.0,w:.55,h:.45,cols:2,transom:false,bars:true});                // front gable window
for(const z of [2.4,-.9])windowAt(S,{x:-6.8,y:.95,z,w:.6,h:.45,rot:-Math.PI/2,cols:2,transom:false,bars:true,frame:M.wood});  // west side
// Grey building faces the open-air passage: door and small barred window.
doorAt(S,{x:-4.1,z:-3.4,w:.5,h:1.0,rot:Math.PI/2,leaf:M.wood});
windowAt(S,{x:-4.1,y:.85,z:-5.2,w:.5,h:.4,rot:Math.PI/2,cols:3,transom:false,bars:true,frame:M.wood});
for(const [z,y,w] of [[-4.4,.25,.6],[-5.8,.4,.4]])box(S,[.01,.3,w],[-4.095,y,z],M.moss);
// Passage clutter.
box(S,[.4,.4,.35],[-2.5,.26,-3.0],M.white,.03);box(S,[.4,.35,.05],[-2.5,.6,-3.17],M.white,.02);
cylinder(S,.2,.16,.4,[-3.7,.26,-5.8],M.dark,12);cylinder(S,.21,.21,.02,[-3.7,.47,-5.8],M.wood,12);   // water jar with lid
for(const [x,z] of [[-2.2,-5.2],[-2.2,-4.6]]){cylinder(S,.1,.08,.16,[x,.14,z],M.brick,10);blob(S,.12,[x,.3,z],M.leaf);}

// ---------- Front lawn: stepping stones, golden tree, cycas, clothesline ----------
for(let i=0;i<7;i++)box(S,[.34,.04,.3],[-.2+i*.62,.02,3.05+Math.sin(i)*.12],M.concreteLight,.02);
function roundTree({x,z,h,r,trunk=M.barkDark,leaves}){
  beam(S,[x,0,z],[x,h-r*.6,z],.07,trunk,.045);
  blob(S,r,[x,h,z],leaves[0],[1,1.05,1]);
  for(let i=0;i<6;i++){const a=i*1.05;blob(S,r*.55,[x+Math.cos(a)*r*.55,h+random(-.25,.3)*r,z+Math.sin(a)*r*.55],leaves[i%leaves.length]);}
}
roundTree({x:1.3,z:4.0,h:2.1,r:.62,leaves:[M.golden,M.goldenDark,M.leafLight]});
function cycas(x,z,s=1){for(let i=0;i<9;i++){const a=i*.7;beam(S,[x,.08,z],[x+Math.cos(a)*.38*s,.28*s+random(0,.08),z+Math.sin(a)*.38*s],.03*s,M.leafDark,.006);}blob(S,.07*s,[x,.07,z],M.barkDark);}
cycas(-.2,3.7);cycas(3.3,3.6,.9);cycas(4.9,3.3,.8);
beam(S,[-.6,0,3.9],[-.6,1.45,3.9],.03,M.steel);beam(S,[4.9,0,4.3],[4.9,1.35,4.3],.025,M.plank);
cord(S,[[-.6,1.38,3.9],[1.0,1.22,4.02],[3.0,1.2,4.15],[4.9,1.28,4.3]],.008,M.frame);
for(const [x,c,l] of [[.0,M.clothGrey,.42],[.35,M.clothBlue,.5],[.75,M.white,.3],[3.8,M.pink,.34]]){const z=3.9+(x+.6)*.072;box(S,[.22,l,.02],[x,1.3-l/2,z],c);}
{const log=cylinder(S,.07,.08,1.4,[2.4,.08,3.5],M.wood,9);log.rotation.z=Math.PI/2;log.rotation.y=.2;}
{const tyre=new THREE.Mesh(new THREE.TorusGeometry(.2,.07,8,16),M.black);tyre.rotation.x=Math.PI/2;tyre.position.set(4.0,.07,2.8);S.add(tyre);}
// Loquat trees in front of the red building, by the pond.
for(const [x,z,h] of [[-5.0,4.75,2.5],[-6.4,4.6,2.1]])tree(S,{position:[x,0,z],height:h,spread:.9,bark:M.barkDark,leaves:[M.deep,M.leafDark,M.leaf],random});

// ---------- Chicken coop at the lawn's road end, taro field beyond ----------
{
  const g=new THREE.Group();g.position.set(7.4,0,4.85);g.rotation.y=Math.PI;S.add(g);reserve(6.6,8.2,4.3,5.4);
  box(g,[1.3,.1,.8],[0,.1,0],M.plank);
  for(const s of [-1,1]){box(g,[.28,.5,.72],[s*.5,.4,0],M.brick);for(let j=0;j<5;j++)box(g,[.29,.012,.73],[s*.5,.2+j*.1,0],M.concreteLight);}
  box(g,[.72,.5,.08],[0,.4,-.32],M.brick);
  box(g,[.46,.42,.02],[.1,.4,.36],M.mesh);box(g,[.2,.3,.02],[-.26,.36,.36],M.white);box(g,[.12,.1,.02],[-.26,.36,.375],M.dark);
  box(g,[1.45,.03,.92],[0,.67,0],M.clothGrey);
  for(const [x,z] of [[-.5,-.25],[.2,.3],[.55,-.1]])box(g,[.22,.07,.1],[x,.72,z],M.brick);
  cylinder(S,.2,.16,.1,[6.4,.05,4.5],M.blue,14);cylinder(S,.12,.12,.26,[8.3,.13,4.4],M.steel,12);
}
{
  const soilShape=new THREE.Shape([[3.7,-5.45],[8.5,-5.45],[8.4,-8.0],[4.2,-8.3],[3.6,-6.8]].map(([x,y])=>new THREE.Vector2(x,y)));
  const soil=new THREE.Mesh(new THREE.ShapeGeometry(soilShape),M.soil);soil.rotation.x=-Math.PI/2;soil.position.y=.012;soil.receiveShadow=true;S.add(soil);
  reserve(3.6,8.5,5.4,8.3);
  for(let i=0;i<9;i++)box(S,[.22,.05,.1],[3.9+i*.27,.03,5.4],M.brick);
for(let i=0;i<7;i++)blob(S,.07,[5.3+i*.28,.07,2.6+Math.sin(i*1.7)*.12],i%2?M.pink:M.leaf);   // purslane flowers by the paving
}
function taro(x,z,s=1){
  for(let i=0;i<4;i++){const a=i*1.6+random(0,.4),r=.22*s,h=(.35+random(0,.2))*s;
    beam(S,[x,0,z],[x+Math.cos(a)*r,h,z+Math.sin(a)*r],.018*s,M.leaf);
    const leaf=blob(S,.2*s,[x+Math.cos(a)*r*1.4,h+.03,z+Math.sin(a)*r*1.4],i%2?M.leafDark:M.leaf,[1,.14,1.35]);leaf.rotation.set(.35,a,.2);}
}
for(const [x,z,s] of [[4.0,5.9,1.2],[4.4,6.8,1],[3.9,7.6,.9],[6.4,6.0,.8],[6.9,7.2,1.1],[5.4,7.9,.9],[5.3,6.3,.8],[7.8,6.1,1],[7.9,7.8,.9]])taro(x,z,s);
for(const [x,z,h] of [[5.0,5.8,1.9],[6.1,7.7,1.6],[4.4,8.0,1.4]])tree(S,{position:[x,0,z],height:h,spread:.55,bark:M.barkDark,leaves:[M.leaf,M.leafLight],random});

// ---------- Vegetable plot and orchard at the far -X end ----------
box(S,[4.4,.05,7.1],[-9.2,.02,1.55],M.soil);reserve(-11.4,-7.0,-2.0,5.1);
for(let z=-1.8;z<5;z+=.5)box(S,[.12,.12,.4],[-6.95,.06,z],M.concreteLight);                 // curb along the plot
cord(S,[[-9.0,.06,-1.9],[-9.3,.06,.4],[-8.9,.06,2.4],[-9.3,.06,5.0]],.13,M.plank);          // trodden path
for(let i=0;i<80;i++){                                                                      // sweet potato vines
  const x=-11.2+random(0,1.7),z=-1.7+random(0,6.6);blob(S,random(.12,.2),[x,.08,z],[M.leaf,M.leafDark,M.leafLight][i%3],[1.2,.55,1.2]);
}
for(let r=0;r<5;r++)for(let c=0;c<9;c++){                                                   // sesame rows
  const x=-8.6+r*.3+random(-.04,.04),z=-1.6+c*.42+random(-.05,.05),h=random(.55,.85);
  beam(S,[x,.04,z],[x,h,z],.013,M.leaf);blob(S,.06,[x,h,z],c%3?M.leafLight:M.golden,[1,1.8,1]);
  if(c%2)blob(S,.07,[x+.05,h*.6,z],M.leafLight,[1.3,.4,1]);
}
for(let i=0;i<5;i++){                                                                        // bean trellis
  const z=2.6+i*.5;beam(S,[-8.6,0,z],[-8.0,1.2,z],.015,M.plank);beam(S,[-7.4,0,z],[-8.0,1.2,z],.015,M.plank);
  for(let j=0;j<4;j++)blob(S,.1,[-8.0+random(-.35,.35),random(.3,1.1),z+random(-.1,.1)],j%2?M.leaf:M.leafLight,[1,1.3,.7]);
}
beam(S,[-8.0,1.2,2.5],[-8.0,1.2,4.7],.015,M.plank);
box(S,[1.2,.02,1.3],[-10.3,.06,4.3],M.mesh);                                                 // net over a seed bed
for(const [x,z] of [[-9.7,3.6],[-10.9,3.6],[-9.7,5.0],[-10.9,5.0]])beam(S,[x,0,z],[x,.9,z],.02,M.plank);
for(let i=0;i<3;i++)beam(S,[-9.7,.15+i*.25,3.6],[-9.7,.15+i*.25,5.0],.006,M.mesh);
blob(S,.07,[-8.9,.95,.2],M.redLight,[1,1.4,1]);beam(S,[-8.9,0,.2],[-8.9,.9,.2],.015,M.plank); // red bag scarecrow
cylinder(S,.1,.08,.2,[-9.5,.12,-1.2],M.white,10);                                            // bucket
// Orchard: fruit trees on grass.
for(const [x,z,f] of [[-8.0,-2.9,M.orange],[-10.3,-3.1,M.golden],[-8.2,-4.6,M.orange],[-10.5,-4.8,M.golden],[-9.2,-6.0,M.orange]]){
  const h=random(1.8,2.3);beam(S,[x,0,z],[x,h*.55,z],.08,M.barkDark,.05);
  for(let i=0;i<5;i++){const a=i*1.3;blob(S,.45,[x+Math.cos(a)*.35,h*.7+random(0,.3),z+Math.sin(a)*.35],[M.deep,M.leafDark,M.leaf][i%3],[1,.8,1]);}
  for(let i=0;i<7;i++){const a=random(0,6.28);blob(S,.055,[x+Math.cos(a)*.6,h*.55+random(0,.5),z+Math.sin(a)*.6],f);}
  reserve(x-.3,x+.3,z-.3,z+.3);
}
{const g=new THREE.Group();g.position.set(-8.6,0,-3.6);g.rotation.z=.35;S.add(g);for(const s of [-1,1])beam(g,[0,0,s*.15],[0,1.6,s*.12],.02,M.plank);for(let i=0;i<5;i++)beam(g,[0,.25+i*.3,-.15],[0,.25+i*.3,.15],.012,M.plank);}   // ladder

// ---------- Road, utility poles and wires ----------
for(const [x,z] of [[8.75,2.0],[8.75,-6.4]]){cylinder(S,.07,.1,4.4,[x,2.2,z],M.concreteLight,8);box(S,[.9,.06,.08],[x,4.1,z],M.cement);}
cord(S,[[8.75,4.05,2.0],[6.6,3.7,.9],[4.6,3.62,-.4]],.009,M.dark);
cord(S,[[8.4,4.1,2.0],[8.45,3.7,-2.2],[8.4,4.1,-6.4]],.009,M.dark);
cord(S,[[9.1,4.1,2.0],[9.1,3.65,-2.2],[9.1,4.1,-6.4]],.009,M.dark);
box(S,[.3,.4,.18],[8.75,1.6,2.12],M.frame);

// ---------- Trees and greenery around the edges ----------
box(S,[.5,.35,.3],[4.3,.2,-6.1],M.brick);box(S,[.6,.03,.4],[4.3,.39,-6.1],M.plank);blob(S,.12,[4.3,.48,-6.1],M.soilDark,[1.6,.5,1.2]);
tree(S,{position:[2.3,0,-6.2],height:1.8,spread:.55,bark:M.barkDark,leaves:[M.leaf,M.leafLight],random});
for(const [x,z,r] of [[.3,-6.4,.45],[1.2,-6.5,.35],[3.3,-6.5,.4],[-11.5,-.4,.45],[8.4,5.8,.4],[-11.6,5.5,.4],[-6.2,4.7,.4],[-3.4,-6.8,.4],[-.8,4.6,.3]])
  shrub(S,{position:[x,0,z],radius:r,materials:[M.leafDark,M.leaf,M.leafLight],random});
function poplar(x,z,h){
  beam(S,[x,0,z],[x,h,z],.09,M.bark,.035);
  for(let i=0;i<4;i++)blob(S,.55-i*.07,[x+random(-.12,.12),h*.55+i*h*.13,z+random(-.12,.12)],[M.leaf,M.leafLight,M.leafDark][i%3],[1,1.9,1]);
}
for(const [x,z,h] of [[-10.6,-6.8,6.2],[-7.6,-6.9,6.8],[-5.2,-6.9,6.0],[-.6,-6.9,6.8],[1.4,-6.9,6.2],[3.4,-6.85,7.0],[8.8,-4.3,6.4],[8.8,-1.2,5.8]])poplar(x,z,h);
function bamboo(x,z,n,h){
  for(let i=0;i<n;i++){
    const a=random(0,6.28),r=random(0,.35),bx=x+Math.cos(a)*r,bz=z+Math.sin(a)*r,top=[bx+random(-.35,.35),h*random(.75,1),bz+random(-.35,.35)];
    beam(S,[bx,0,bz],top,.035,M.bamboo,.018);
    for(let j=0;j<3;j++)blob(S,.28,[top[0]+random(-.2,.2),top[1]-j*.45,top[2]+random(-.2,.2)],j%2?M.leafDark:M.leaf,[1.3,.55,1.3]);
  }
}
bamboo(-11.5,-6.4,8,4.6);bamboo(5.2,-6.6,7,4.2);bamboo(3.6,8.5,5,2.6);bamboo(5.3,5.0,9,3.6);
tree(S,{position:[7.6,0,-6.5],height:5.0,spread:1.1,bark:M.barkDark,leaves:[M.leafDark,M.leaf],random});
// Grass tufts and small flowers, kept off paved, built and planted areas.
for(let i=0,placed=0;i<900&&placed<170;i++){
  const x=random(BX0+.5,BX1-.5),z=random(BZ0+.5,BZ1-.5);
  if(blocked(x,z)||inPond(x,z))continue;placed++;
  if(placed%9===0){beam(S,[x,0,z],[x,.14,z],.008,M.leaf);blob(S,.035,[x,.15,z],placed%2?M.flower:M.white);continue;}
  const t=mesh(S,new THREE.ConeGeometry(.06,random(.12,.22),4),placed%3?M.grassDark:M.leaf,[x,.06,z]);t.rotation.y=random(0,3);
}

// ---------- Vehicles and yard clutter ----------
function wheel(g,x,y,z,r,w){const t=cylinder(g,r,r,w,[x,y,z],M.black,14);t.rotation.z=Math.PI/2;const h=cylinder(g,r*.5,r*.5,w+.01,[x,y,z],M.steel,10);h.rotation.z=Math.PI/2;}
{ // Mini truck, nose toward the red building.
  const g=new THREE.Group();g.position.set(-2.35,.06,2.75);g.rotation.y=-Math.PI/2;S.add(g);
  box(g,[.7,.1,1.95],[0,.24,0],M.dark);
  box(g,[.82,.62,.62],[0,.56,.66],M.truck,.06);
  box(g,[.7,.28,.02],[0,.7,.975],M.glass);for(const s of [-1,1])box(g,[.02,.24,.34],[s*.415,.7,.68],M.glass);
  for(const s of [-1,1])box(g,[.06,.05,.02],[s*.3,.4,.98],M.white);
  box(g,[.84,.07,1.3],[0,.33,-.3],M.truck);
  for(const s of [-1,1]){box(g,[.03,.25,1.3],[s*.42,.49,-.3],M.steel);for(let i=0;i<9;i++)box(g,[.035,.26,.03],[s*.425,.49,-.9+i*.15],M.truck);}
  box(g,[.84,.25,.03],[0,.49,-.95],M.truck);for(const s of [-1,1])box(g,[.08,.05,.02],[s*.3,.43,-.97],M.redLight);
  box(g,[.84,.35,.04],[0,.6,.34],M.steel);
  box(g,[.5,.12,.4],[.1,.42,-.5],M.plank);box(g,[.25,.2,.3],[-.2,.47,-.1],M.clothGrey);   // cargo
  for(const z of [.62,-.55])for(const s of [-1,1])wheel(g,s*.38,.14,z,.14,.1);
}
{ // Sage-green SUV, nose toward the garage, next to the truck.
  const g=new THREE.Group();g.position.set(-2.3,.06,1.3);g.rotation.y=-Math.PI/2;S.add(g);
  box(g,[.9,.2,1.84],[0,.2,0],M.dark,.05);                          // black lower cladding
  box(g,[.9,.36,1.8],[0,.43,0],M.sage,.09);
  box(g,[.82,.3,1.2],[0,.74,-.14],M.dark,.08);                      // black glasshouse
  box(g,[.8,.05,1.12],[0,.9,-.14],M.sage,.03);                      // body-coloured roof
  for(const s of [-1,1])box(g,[.04,.05,1.0],[s*.35,.95,-.14],M.steel);  // roof rails
  box(g,[.84,.05,.02],[0,.55,-.91],M.redLight);box(g,[.5,.1,.02],[0,.33,-.92],M.steel);
  box(g,[.7,.08,.02],[0,.5,.91],M.dark);for(const s of [-1,1])box(g,[.16,.05,.02],[s*.3,.56,.91],M.white);
  for(const z of [.58,-.6])for(const s of [-1,1])wheel(g,s*.4,.17,z,.17,.12);
}
{ // Electric cargo tricycle.
  const g=new THREE.Group();g.position.set(-3.25,.06,3.62);g.rotation.y=-Math.PI/2+.05;S.add(g);
  box(g,[.62,.24,.65],[0,.38,-.25],M.tealCar);box(g,[.56,.02,.6],[0,.5,-.25],M.dark);
  box(g,[.2,.3,.45],[0,.35,.3],M.tealCar,.05);box(g,[.24,.06,.2],[0,.55,.2],M.dark);
  beam(g,[0,.3,.55],[0,.8,.5],.02,M.steel);beam(g,[-.2,.8,.5],[.2,.8,.5],.015,M.dark);
  for(const s of [-1,1])wheel(g,s*.28,.12,-.35,.12,.08);wheel(g,0,.12,.58,.12,.07);
  blob(g,.25,[.05,.62,-.25],M.plank,[1.1,.45,1]);
}
{ // Scooter parked beside the truck.
  const g=new THREE.Group();g.position.set(-3.45,.06,-.75);g.rotation.y=-Math.PI/2-.2;S.add(g);
  box(g,[.24,.3,.7],[0,.35,0],M.white,.08);box(g,[.25,.12,.28],[0,.3,-.1],M.redLight,.03);
  box(g,[.2,.07,.32],[0,.53,-.12],M.dark,.03);beam(g,[0,.4,.32],[0,.78,.3],.025,M.white);beam(g,[-.18,.78,.3],[.18,.78,.3],.012,M.dark);
  for(const z of [-.3,.32])wheel(g,0,.1,z,.1,.06);
}
function stool(x,z,rot=0){const g=new THREE.Group();g.position.set(x,.06,z);g.rotation.y=rot;S.add(g);box(g,[.3,.04,.18],[0,.24,0],M.plank);for(const s of [-1,1])box(g,[.04,.22,.16],[s*.11,.11,0],M.plank);}
stool(-2.9,-1.0,.2);stool(-2.3,-1.9,-.1);stool(.6,.9,.4);
{const g=new THREE.Group();g.position.set(-2.8,.06,-.5);S.add(g);box(g,[.42,.03,.32],[0,.36,0],M.wood);beam(g,[-.15,0,-.12],[.15,.35,.12],.012,M.dark);beam(g,[.15,0,-.12],[-.15,.35,.12],.012,M.dark);box(g,[.2,.04,.15],[.05,.39,0],M.clothGrey);}
for(let i=0;i<6;i++){const l=cylinder(S,.05,.05,.9,[-3.65,.07+i%3*.1,.2+Math.floor(i/3)*.11],M.wood,7);l.rotation.x=Math.PI/2;}   // firewood
blob(S,.3,[-3.55,.12,-1.7],M.wood,[1.4,.4,1.1]);                                                             // brushwood pile

// ---------- The dog (animated, not batched) ----------
{
  dog.position.set(.2,.06,1.5);dog.rotation.y=-.9;dog.scale.setScalar(1.5);model.add(dog);
  const tan=M.tan,dk=M.black;
  box(dog,[.22,.2,.5],[0,.3,0],tan,.06);box(dog,[.23,.1,.36],[0,.38,-.04],dk,.04);
  for(const [x,z] of [[-.07,.17],[.07,.17],[-.07,-.18],[.07,-.18]])cylinder(dog,.032,.028,.23,[x,.115,z],tan,8);
  const head=new THREE.Group();head.position.set(0,.42,.25);dog.add(head);dogParts.head=head;
  box(head,[.16,.16,.19],[0,.07,.06],tan,.05);box(head,[.1,.08,.13],[0,.03,.2],M.tanLight,.03);
  blob(head,.024,[0,.055,.27],dk);
  for(const s of [-1,1]){const ear=mesh(head,new THREE.ConeGeometry(.04,.1,4),dk,[s*.05,.19,.03]);ear.rotation.z=-s*.15;blob(head,.014,[s*.045,.1,.155],dk);}
  const tail=new THREE.Group();tail.position.set(0,.34,-.24);dog.add(tail);dogParts.tail=tail;
  beam(tail,[0,0,0],[0,-.12,-.18],.028,tan,.018);
  cylinder(S,.09,.07,.05,[.75,.085,1.9],M.steel,12);                                          // food bowl
}

const batching=batchStatic(S);
app.renderer.toneMappingExposure=.95;
app.scene.children.find(o=>o.isHemisphereLight).intensity=1.9;
app.camera.position.set(-18,22,30);
app.fit(model);
{ // Fill more of the frame than the rotation-safe fit, and allow close inspection.
  const frame=()=>{const a=innerWidth/Math.max(1,innerHeight);app.camera.zoom=a>1?1.28:1.15;app.camera.updateProjectionMatrix();};
  frame();app.controls.maxZoom=6;app.controls.saveState();
  // Warm sun from front-right so shadows fall toward the back-left.
  const sun=app.scene.children.find(o=>o.isDirectionalLight&&o.castShadow);
  sun.position.copy(app.controls.target).add(new THREE.Vector3(12,26,14));
}
window.__diorama=Object.assign(app,{model,batching,ready:true});
