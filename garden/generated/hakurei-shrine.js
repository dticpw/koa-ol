// Generated from hakurei-shrine/scene.js by build-models.py. Edit the original model to update.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
export function createModel() {
const model=new THREE.Group();
const ramp = new THREE.DataTexture(new Uint8Array([115,165,210,255]),4,1,THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;ramp.needsUpdate=true;
const mat = (color,extra={}) => new THREE.MeshToonMaterial({color,gradientMap:ramp,...extra});
const M = {
  red:mat('#b94334'), scarlet:mat('#d95540'), redShade:mat('#883a30'),
  dark:mat('#343d3a'), roof:mat('#3b5355'), tile:mat('#536d6a'), tileLight:mat('#6b8279'),
  wood:mat('#886247'), woodLight:mat('#b78b60'), endgrain:mat('#d0a97a'),
  plaster:mat('#eee3ce'), paper:mat('#fff5df'), gold:mat('#bda061'), rope:mat('#d8bc83'),
  stone:mat('#9ca69a'), stoneLight:mat('#b9bfb0'), stoneDark:mat('#7a877e'),
  sand:mat('#d2ceb2'), earth:mat('#8d926c'), moss:mat('#809668'),
  green:mat('#8ca674'), greenDark:mat('#587d60'), greenLight:mat('#acc18b'),
  pink:mat('#e9a9ae'), pinkLight:mat('#f4c4c1'), pinkWhite:mat('#f8d6cc'), pinkDark:mat('#cf8998'),
  leaf:mat('#c49b60'), water:mat('#88bab0',{transparent:true,opacity:0.8}),
  ink:new THREE.MeshBasicMaterial({color:'#564237'}),
};
let seed=431;
function rand(a=0,b=1){ seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+(seed/4294967296)*(b-a); }
function mesh(geo,material,x=0,y=0,z=0,parent=model){
  const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function box(w,h,d,x,y,z,material=M.wood,parent=model,r=0){
  return mesh(r?new RoundedBoxGeometry(w,h,d,2,r):new THREE.BoxGeometry(w,h,d),material,x,y,z,parent);
}
function ball(r,x,y,z,material,parent=model,detail=1){return mesh(new THREE.IcosahedronGeometry(r,detail),material,x,y,z,parent);}
function cyl(rt,rb,h,x,y,z,material=M.wood,parent=model,n=10){return mesh(new THREE.CylinderGeometry(rt,rb,h,n),material,x,y,z,parent);}
function beam(a,b,r,material=M.wood,parent=model,r2=r){
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A);
  const m=cyl(r2,r,v.length(),...A.clone().add(B).multiplyScalar(.5).toArray(),material,parent);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;
}
function cord(points,r,material=M.rope,parent=model){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length*6),r,6,false),material,0,0,0,parent);
}
function plaque(text,w,h,x,y,z,material=M.wood,vertical=false,parent=model){
  box(w,h,.10,x,y,z,material,parent,.025);
  const c=document.createElement('canvas');c.width=vertical?128:512;c.height=vertical?512:192;
  const ctx=c.getContext('2d');ctx.fillStyle='#f6e5ba';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`600 ${vertical?86:95}px "Yu Mincho","Noto Serif CJK SC","SimSun",serif`;
  if(vertical) [...text].forEach((ch,i)=>ctx.fillText(ch,c.width/2,(i+.5)*c.height/text.length));
  else ctx.fillText(text,c.width/2,c.height/2,c.width*.87);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(w*.90,h*.88),new THREE.MeshBasicMaterial({map:texture,transparent:true}),x,y,z+.057,parent);
}

// The floating collectible base: rounded stone foundation, a wooden sandwich,
// a fitted border and a quiet gravel courtyard. Individual masonry wraps all sides.
box(18,.72,18,0,-.1,0,M.stoneDark,model,.19);
for(let side=0;side<4;side++){
  const group=new THREE.Group();group.rotation.y=side*Math.PI/2;model.add(group);
  for(let row=0;row<2;row++) for(let i=0;i<13;i++){
    let x=-8.34+i*1.36+(row?.32:0);if(x>8.6)continue;
    box(1.28,.285,.15,x,-.27+row*.33,8.94,[M.stone,M.stoneLight,M.stoneDark][Math.floor(rand(0,3))],group,.055);
  }
}
box(18.05,.16,18.05,0,.34,0,M.wood,model,.12);
box(18.12,.12,18.12,0,.49,0,M.woodLight,model,.10);
box(17.96,.16,17.96,0,.62,0,M.dark,model,.12);
box(17.83,.22,17.83,0,.80,0,M.sand,model,.16);
for(let side=0;side<4;side++){
 const g=new THREE.Group();g.rotation.y=side*Math.PI/2;model.add(g);
 for(let i=0;i<18;i++)box(.935,.16,.36,-8.45+i*.995,.93,8.64,i%3?M.stoneLight:M.stone,g,.045);
}
// Low rear terrace, with exposed retaining blocks and broad front steps.
box(16.75,.42,9.45,0,1.04,-3.55,M.earth,model,.18);
box(16.7,.10,9.4,0,1.28,-3.55,M.moss,model,.12);
for(let i=0;i<19;i++)box(.82,.35,.38,-7.97+i*.885,1.08,1.1,i%2?M.stone:M.stoneLight,model,.05);
for(let i=0;i<2;i++)box(4.15,.15,1.00-i*.30,0,.98+i*.15,1.53-i*.20,M.stoneLight,model,.035);
// Irregular but carefully fitted approach stones.
for(let row=0;row<8;row++)for(let col=0;col<3;col++){
 box(.90,.10,.74,(col-1)*.97+rand(-.025,.025),.96,2.00+row*.82+rand(-.02,.02),rand()>.7?M.stone:M.stoneLight,model,.06);
}
for(let i=0;i<10;i++){
 const b=box(.58,.065,.47,4.65+Math.sin(i*.5)*.32,1.365,-6.9+i*.76,M.stoneLight,model,.09);b.rotation.y=rand(-.28,.28);
}
for(let i=0;i<180;i++){
 const x=rand(-8.3,8.3),z=rand(1.95,8.3);if(Math.abs(x)<1.55)continue;
 const b=box(rand(.025,.075),.012,rand(.025,.09),x,.922,z,rand()>.5?M.stoneLight:M.endgrain);b.rotation.y=rand(0,6.28);
}

// Roof geometry has a curved, lifted eave profile, a dark fascia and individual
// rounded tile seams; rotate the group to turn a horizontal ridge into a gable.
function roof(w,d,y,x,z,parent=model){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
 const eave=t=>1.46*(1-t)**1.48+.15*t**9;
 for(const s of [-1,1]){
  const verts=[],uv=[],idx=[],steps=18;
  for(let i=0;i<=steps;i++){
   const t=i/steps;for(const side of [-1,1]){verts.push(side*(w/2+.10*t*t),eave(t),s*t*d/2);uv.push((side+1)/2,t);}
  }
  for(let i=0;i<steps;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const rm=M.roof.clone();rm.side=THREE.DoubleSide;mesh(geo,rm,0,0,0,g);
  for(let x1=-w/2;x1<=w/2+.01;x1+=.25){
   const pts=[];for(let j=0;j<=12;j++){const t=j/12;pts.push([x1,eave(t)+.035,s*t*d/2]);}
   cord(pts,.029,M.tile,g);
  }
  for(let j=1;j<=6;j++){const t=j/6;box(w+.2*t,.025,.028,0,eave(t)+.025,s*t*d/2,M.tile,g);}
  box(w+.28,.14,.15,0,eave(1)-.045,s*d/2,M.dark,g,.035);
  box(w+.31,.038,.17,0,eave(1)+.04,s*d/2,M.tileLight,g,.012);
  for(let x1=-w/2;x1<=w/2;x1+=.25){const c=cyl(.065,.065,.07,x1,eave(1)+.01,s*(d/2+.085),M.tile,g,8);c.rotation.x=Math.PI/2;}
 }
 for(const side of [-1,1]){
  for(const s of [-1,1]){const pts=[];for(let j=0;j<=12;j++){const t=j/12;pts.push([side*(w/2+.1*t*t),eave(t)-.04,s*t*d/2]);}cord(pts,.09,M.dark,g);cord(pts.map(p=>[p[0]+side*.025,p[1]+.075,p[2]]),.035,M.endgrain,g);}
 }
 box(w+.38,.22,.23,0,1.49,0,M.tile,g,.045);
 for(const s of [-1,1]){
  const cap=box(.21,.35,.32,s*(w/2+.18),1.59,0,M.tile,g,.035);cap.rotation.z=-s*.18;
  ball(.13,s*(w/2+.18),1.78,0,M.tileLight,g);
 }
 return g;
}

// Main haiden. Every side is constructed, including the underfloor, shutters,
// veranda joinery, rear access steps and a small projecting entrance gable.
box(7.1,.32,5.45,0,1.52,-3.2,M.stoneDark,model,.09);
for(const x of [-3.15,0,3.15])for(const z of [-5.45,-3.3,-.9]){
 box(.52,.23,.52,x,1.55,z,M.stoneLight,model,.05);box(.27,.62,.27,x,1.94,z,M.wood);
}
box(7.65,.22,5.9,0,2.16,-3.2,M.wood);
for(let i=0;i<29;i++)box(.247,.055,5.83,-3.64+i*.26,2.29,-3.2,i%4===0?M.woodLight:M.endgrain);
box(6.3,2.65,4.2,0,3.60,-3.55,M.plaster);
box(6.35,.16,4.26,0,2.53,-3.55,M.redShade);
box(6.5,.17,4.32,0,4.88,-3.55,M.red);
for(const x of [-3.18,-1.1,1.1,3.18])for(const z of [-5.67,-1.42]){
 box(.22,2.91,.23,x,3.63,z,M.red);box(.33,.12,.32,x,2.31,z,M.dark);box(.38,.11,.36,x,4.93,z,M.scarlet);
}
for(const x of [-3.2,3.2]){
 box(.14,.14,4.2,x,3.0,-3.55,M.red);
 for(const z of [-4.7,-2.55]){
  box(.05,1.36,1.4,x*1.015,3.79,z,M.dark);
  for(let j=0;j<8;j++)box(.08,1.32,.062,x*1.03,3.79,z-.61+j*.174,M.woodLight);
  box(.1,.08,1.43,x*1.03,3.69,z,M.woodLight);
 }
}
for(const x of [-2.13,0,2.13]){
 box(1.84,2.0,.09,x,3.37,-1.355,M.wood);
 box(1.67,1.19,.03,x,3.64,-1.29,M.paper);
 for(let i=0;i<8;i++)box(.047,1.2,.05,x-.76+i*.216,3.64,-1.24,M.wood);
 for(let i=0;i<4;i++)box(1.70,.045,.05,x,3.10+i*.36,-1.24,M.wood);
 box(1.65,.4,.07,x,2.67,-1.24,M.woodLight);
}
for(let i=0;i<15;i++)box(.07,1.8,.045,-2.97+i*.425,3.45,-5.71,M.woodLight);
// Open red veranda railing, leaving the central approach unobstructed.
for(const side of [-1,1]){
 for(let j=0;j<5;j++){
  const z=-5.82+j*1.32;box(.13,.79,.13,side*3.63,2.72,z,M.red);cyl(.12,.075,.13,side*3.63,3.18,z,M.dark);
 }
 box(.15,.13,5.55,side*3.63,3.04,-3.13,M.scarlet);
 box(.09,.10,5.55,side*3.63,2.60,-3.13,M.red);
 box(2.0,.13,.15,side*2.63,3.04,-.38,M.scarlet);
 for(let j=0;j<4;j++)box(.10,.7,.10,side*(1.65+j*.65),2.70,-.38,M.red);
 box(2.0,.09,.1,side*2.63,2.57,-.38,M.red);
}
for(let j=0;j<4;j++){
 box(3.0,.22,.53,0,1.44+j*.23,.95-j*.43,M.woodLight,model,.025);
 box(3.08,.06,.54,0,1.57+j*.23,.95-j*.43,M.endgrain,model,.016);
}
for(const s of [-1,1]){
 beam([s*1.61,1.7,1.15],[s*1.61,2.85,-.55],.065,M.red);
 for(const z of [-.48,.95])box(.12,.8,.12,s*1.61,z<0?2.5:1.89,z,M.red);
}
// Brackets and visible rafters below the broad main roof.
for(let i=0;i<21;i++)box(.10,.12,6.75,-3.8+i*.38,4.99,-3.40,M.woodLight);
for(const side of [-1,1]){
 const gable=new THREE.BufferGeometry();
 gable.setAttribute('position',new THREE.Float32BufferAttribute([
  side*3.23,4.96,-5.67, side*3.23,6.43,-3.40, side*3.23,4.96,-1.13
 ],3));gable.computeVertexNormals();
 const gableMat=M.plaster.clone();gableMat.side=THREE.DoubleSide;mesh(gable,gableMat);
 for(const z of [-4.48,-3.40,-2.32])box(.10,z===-3.40?1.42:.70,.10,side*3.29,z===-3.40?5.65:5.30,z,M.red);
 box(.13,.10,3.9,side*3.30,5.19,-3.40,M.red);
}
for(const x of [-3.18,-1.1,1.1,3.18]){
 box(.53,.14,.66,x,4.74,-1.38,M.scarlet);box(.77,.13,.81,x,4.89,-1.38,M.red);
}
roof(8.15,6.8,5.0,0,-3.4);
// Decorative projecting gable above the bell and offertory box.
const entryRoof=roof(2.50,4.5,4.83,0,-.58);entryRoof.rotation.y=Math.PI/2;
for(const s of [-1,1])beam([0,6.18,.76],[s*2.18,4.93,.76],.085,M.endgrain);
box(4.30,.14,.16,0,4.95,.78,M.red);
box(.14,1.05,.15,0,5.49,.78,M.red);
for(const x of [-1.66,1.66]){
 box(.23,2.76,.23,x,3.59,-.09,M.red);box(.35,.13,.35,x,2.28,-.09,M.dark);
 box(.62,.12,.44,x,4.83,-.09,M.scarlet);
}
plaque('博麗神社',1.28,.40,0,5.65,.90,M.dark);

function shide(x,y,z,size=.32,parent=model){
 const pts=[[0,0],[.33,0],[.33,-.30],[.65,-.30],[.65,-.62],[.33,-.62],[.33,-.92],[0,-.92],[0,-.56],[.30,-.56],[.30,-.32],[0,-.32]];
 const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0]*size,p[1]*size)));
 const paper=M.paper.clone();paper.side=THREE.DoubleSide;const m=mesh(new THREE.ShapeGeometry(shape),paper,x,y,z,parent);m.rotation.z=-.13;return m;
}
cord([[-1.8,4.59,.10],[-1.2,4.36,.17],[0,4.24,.2],[1.2,4.36,.17],[1.8,4.59,.1]],.085);
for(let j=0;j<29;j++){
 const x=-1.75+j*.125,y=4.24+.35*(Math.abs(x)/1.75)**2;
 beam([x-.035,y-.06,.15],[x+.035,y+.065,.23],.022,M.woodLight);
}
for(const x of [-1.3,-.65,.58,1.18])shide(x,4.28+.20*Math.abs(x),.25,.46);
cyl(.15,.23,.30,0,4.12,.26,M.gold);ball(.22,0,3.99,.26,M.gold);
box(.21,.045,.025,0,3.92,.466,M.dark);
const bellRope=cord([[0,3.87,.29],[.03,3.20,.34],[-.045,2.69,.41],[.02,2.21,.54]],.045);
for(let j=0;j<15;j++){
 const y=2.3+j*.1;cyl(.048,.048,.04,Math.sin(j*.55)*.025,y,.51-(y-2.3)*.14,j%2?M.paper:M.redShade);
}
cyl(.10,.035,.21,.02,2.12,.54,M.rope);
// Saisen box: slatted top, metal straps and the traditional dedication.
box(1.56,.66,.77,0,2.63,-.27,M.wood,model,.035);
box(1.66,.10,.85,0,2.96,-.27,M.dark,model,.018);
for(let j=0;j<8;j++)box(1.51,.065,.06,0,3.01,-.60+j*.094,M.endgrain);
for(const x of [-.69,.69])box(.085,.56,.028,x,2.62,.13,M.dark);
plaque('奉 納',.8,.31,0,2.63,.145,M.wood);

// The torii is tall enough to read clearly but low enough to reveal the shrine.
const torii=new THREE.Group();torii.position.set(-.05,.91,6.25);model.add(torii);
for(const s of [-1,1]){
 const post=cyl(.135,.185,3.56,s*2.11,1.80,0,M.red,torii,12);post.rotation.z=s*.021;
 cyl(.24,.28,.36,s*2.15,.18,0,M.dark,torii,12);
 cyl(.22,.24,.085,s*2.15,.405,0,M.scarlet,torii,12);
 box(.38,.15,.52,s*2.04,3.4,0,M.redShade,torii,.025);
}
box(5.35,.25,.31,0,2.89,0,M.red,torii,.025);
box(.17,.71,.22,0,3.22,0,M.red,torii);
const toriiShape=new THREE.Shape();
toriiShape.moveTo(-3.08,3.69);toriiShape.quadraticCurveTo(0,3.26,3.08,3.69);toriiShape.lineTo(3.00,3.98);toriiShape.quadraticCurveTo(0,3.63,-3.00,3.98);toriiShape.closePath();
mesh(new THREE.ExtrudeGeometry(toriiShape,{depth:.45,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1}),M.red,0,0,-.225,torii);
cord([[-3.12,3.98,0],[-2,3.82,0],[0,3.75,0],[2,3.82,0],[3.12,3.98,0]],.095,M.dark,torii);
plaque('博麗',.45,.65,0,3.30,.24,M.dark,true,torii);
cord([[-1.90,2.87,.07],[-1,2.61,.12],[0,2.53,.14],[1,2.61,.12],[1.90,2.87,.07]],.040,M.rope,torii);
for(const x of [-1.3,-.5,.38,1.15])shide(x,2.58+.12*Math.abs(x),.16,.34,torii);

function lantern(x,z,ground=.94,scale=1){
 const g=new THREE.Group();g.position.set(x,ground,z);g.scale.setScalar(scale);model.add(g);
 box(.88,.15,.88,0,.075,0,M.stoneDark,g,.045);box(.69,.17,.69,0,.23,0,M.stoneLight,g,.045);
 cyl(.22,.31,.2,0,.42,0,M.stone,g,4);cyl(.16,.22,.83,0,.94,0,M.stone,g,8);
 cyl(.43,.24,.20,0,1.41,0,M.stoneLight,g,4);box(.67,.10,.67,0,1.55,0,M.stoneLight,g,.025);
 box(.47,.44,.47,0,1.81,0,M.dark,g,.02);
 for(const s of [-1,1]){
  box(.29,.25,.012,0,1.83,s*.24,M.endgrain,g);box(.012,.25,.29,s*.24,1.83,0,M.endgrain,g);
 }
 for(const x1 of [-.27,.27])for(const z1 of [-.27,.27])box(.1,.49,.1,x1,1.81,z1,M.stoneLight,g);
 box(.68,.10,.68,0,2.06,0,M.stone,g,.025);
 const cap=cyl(.15,.70,.32,0,2.27,0,M.stoneLight,g,4);cap.rotation.y=Math.PI/4;
 box(1.0,.065,1.0,0,2.13,0,M.stone,g,.055);
 ball(.12,0,2.51,0,M.stone,g);cyl(.015,.11,.18,0,2.63,0,M.stoneLight,g);
}
lantern(-2.78,3.75);lantern(2.78,3.75);
lantern(-4.2,-5.45,1.34,.78);lantern(4.25,-5.75,1.34,.78);

// Temizuya, with a real recessed basin, water, bamboo spout and ladles.
const wash=new THREE.Group();wash.position.set(-6.02,1.34,-.05);model.add(wash);
box(2.7,.11,2.45,0,.055,0,M.stone,wash,.09);
for(const x of [-1.0,1.0])for(const z of [-.84,.84]){
 box(.36,.19,.36,x,.19,z,M.stoneLight,wash,.03);box(.14,2.07,.14,x,1.30,z,M.wood,wash);
}
box(1.77,.20,1.05,0,.51,.07,M.stoneDark,wash,.07);
for(const s of [-1,1]){
 box(1.8,.42,.18,0,.79,.07+s*.46,M.stoneLight,wash,.035);
 box(.20,.42,.76,s*.80,.79,.07,M.stoneLight,wash,.035);
}
box(1.38,.018,.66,0,.84,.07,M.water,wash);
box(2.1,.07,.065,0,1.03,.20,M.wood,wash);
for(const x of [-.42,.34]){
 beam([x,.99,-.13],[x+.11,1.10,.59],.023,M.endgrain,wash);
 const dip=cyl(.09,.075,.12,x,1.06,-.12,M.endgrain,wash);cyl(.069,.069,.005,x,1.124,-.12,M.wood,wash);
}
beam([-.5,.85,-.52],[-.5,1.51,-.52],.065,M.greenDark,wash);
beam([-.5,1.48,-.53],[-.5,1.48,-.02],.058,M.greenDark,wash);
beam([-.5,1.44,-.02],[-.5,.85,-.02],.009,M.water,wash);
box(2.2,.14,1.84,0,2.25,0,M.woodLight,wash);const wr=roof(2.95,2.63,2.32,0,0,wash);wr.scale.y=.56;
plaque('手水',.60,.29,0,2.25,.97,M.wood,false,wash);

// Shrine office / storehouse: windows, tiled roof and a side service entrance.
const office=new THREE.Group();office.position.set(6.05,1.34,-4.20);model.add(office);
box(3.25,.24,3.7,0,.13,0,M.stoneDark,office,.07);
box(2.85,2.23,3.13,0,1.37,0,M.plaster,office);
for(const x of [-1.46,1.46])for(const z of [-1.61,1.61])box(.16,2.4,.16,x,1.37,z,M.wood,office);
for(let j=0;j<11;j++)box(2.90,.065,.035,0,.31+j*.065,1.58,M.woodLight,office);
box(1.9,.90,.04,0,1.65,1.59,M.dark,office);
box(1.78,.73,.035,0,1.68,1.62,M.paper,office);
for(let j=0;j<10;j++)box(.045,.81,.06,-.85+j*.19,1.65,1.66,M.wood,office);
box(2.16,.10,.49,0,1.17,1.76,M.woodLight,office);
plaque('授 与 所',1.1,.25,0,2.26,1.67,M.wood,false,office);
box(.04,1.65,.89,1.50,1.11,.6,M.wood,office);
for(let j=0;j<6;j++)box(.04,1.59,.045,1.53,1.11,.22+j*.15,M.woodLight,office);
box(.52,.18,1.11,1.70,.20,.60,M.stoneLight,office,.045);
roof(3.60,3.90,2.48,0,0,office).scale.y=.62;
// Storage crates and tied firewood at the back reward orbiting the model.
for(let i=0;i<3;i++){
 box(.57,.5,.57,5.5+i*.65,1.6,-6.6,M.wood,model,.02);
 for(const s of [-1,1])box(.045,.50,.60,5.5+i*.65+s*.21,1.6,-6.6,M.endgrain);
}
for(let row=0;row<3;row++)for(let j=0;j<5-row;j++){
 const log=cyl(.11,.12,.95,-2.3+j*.26+row*.13,1.49+row*.2,-6.90,M.wood,model,8);log.rotation.x=Math.PI/2;
 const end=cyl(.085,.085,.012,log.position.x,log.position.y,-6.414,M.endgrain,model,8);end.rotation.x=Math.PI/2;
}

// Ema rack: individually hung pentagonal prayer plaques and tiny ink marks.
const ema=new THREE.Group();ema.position.set(5.65,1.34,.50);ema.rotation.y=-.12;model.add(ema);
for(const x of [-1.12,1.12]){
 box(.16,1.99,.16,x,1.00,0,M.wood,ema);box(.40,.15,.43,x,.06,0,M.stoneLight,ema,.035);
}
for(const y of [.80,1.51])box(2.39,.10,.13,0,y,0,M.woodLight,ema);
roof(2.79,.89,2.03,0,0,ema).scale.y=.24;
const emaShape=new THREE.Shape([new THREE.Vector2(-.18,-.12),new THREE.Vector2(.18,-.12),new THREE.Vector2(.18,.12),new THREE.Vector2(0,.23),new THREE.Vector2(-.18,.12)]);
for(let row=0;row<2;row++)for(let j=0;j<5;j++){
 const x=-.86+j*.43,y=.63+row*.71;
 cord([[x-.04,y+.16,.06],[x,y+.33,.04],[x+.04,y+.16,.06]],.009,M.redShade,ema);
 const p=mesh(new THREE.ExtrudeGeometry(emaShape,{depth:.035,bevelEnabled:false}),j%2?M.endgrain:M.woodLight,x,y,.08,ema);p.rotation.z=rand(-.12,.12);
 for(let k=0;k<3;k++)box(.012,rand(.055,.12),.007,x-.085+k*.078,y,.124,M.ink,ema);
}
// Omikuji rack, with small folded paper knots.
for(const x of [5.00,7.14]){box(.10,1.56,.10,x,1.70,2.19,M.red);box(.35,.12,.35,x,.96,2.19,M.stone,model,.03);}
for(const y of [1.62,2.18]){
 beam([5,y,2.19],[7.14,y,2.19],.018,M.rope);
 for(let j=0;j<9;j++){
  const x=5.13+j*.225;const p=box(.14,.075,.08,x,y,2.2,M.paper);p.rotation.z=rand(-.5,.5);
  const tail=box(.063,.22,.018,x+.025,y-.09,2.2,M.paper);tail.rotation.z=rand(-.6,.6);
 }
}
// Roofed notice board and a broom left beside the veranda.
for(const x of [-4.68,-3.76])box(.09,1.56,.09,x,1.69,2.19,M.wood);
box(1.28,.86,.11,-4.22,2.03,2.19,M.wood,model,.035);
box(1.1,.68,.018,-4.22,2.03,2.26,M.endgrain);
for(const x of [-4.49,-4.12]){
 box(.28,.44,.01,x,2.04,2.28,M.paper);
 for(let j=0;j<5;j++)box(.18,.012,.005,x,2.19-j*.07,2.29,M.woodLight);
}
roof(1.53,.58,2.51,-4.22,2.19).scale.y=.16;
beam([-3.99,1.39,-.48],[-3.59,2.91,-.71],.029,M.woodLight);
for(let i=0;i<11;i++)beam([-4.18+i*.035,1.35,-.44],[-3.94,1.82,-.54],.014,M.rope);
cord([[-4.04,1.68,-.55],[-3.89,1.68,-.49]],.025,M.redShade);

// Perimeter fence stays inside the plinth, with stone footings and two rails.
function fence(a,b,count){
 for(let i=0;i<=count;i++){
  const t=i/count,x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t);
  const ground=z<1.1?1.34:.92;
  box(.28,.12,.28,x,ground+.04,z,M.stone,model,.035);box(.14,1.0,.14,x,ground+.55,z,M.wood);
  box(.21,.075,.21,x,ground+1.08,z,M.dark,model,.02);
 }
 const y=a[1]<1.1&&b[1]<1.1?1.34:.92;
 for(const h of [.40,.89]){
  const dx=b[0]-a[0],dz=b[1]-a[1];const r=box(.08,.105,Math.hypot(dx,dz),(a[0]+b[0])/2,y+h,(a[1]+b[1])/2,M.woodLight);r.rotation.y=Math.atan2(dx,dz);
 }
}
fence([-8.13,-7.97],[8.13,-7.97],16);
fence([-8.12,-7.97],[-8.12,.7],9);fence([8.12,-7.97],[8.12,.7],9);
fence([-8.12,2],[-8.12,6.80],5);fence([8.12,2],[8.12,6.80],5);

function rock(x,z,r,ground=.95){
 const m=ball(r,x,ground+r*.30,z,rand()>.5?M.stone:M.stoneDark,model,1);m.scale.set(1,.57,.83);m.rotation.set(rand(-.25,.25),rand(0,6),rand(-.15,.15));
 if(r>.4){const cap=ball(r*.71,x-.03,ground+r*.64,z,M.moss);cap.scale.set(1,.17,.77);}
}
function shrub(x,z,r,ground=1.34){
 for(let i=0;i<5;i++){
  const ang=i*2.399;const b=ball(r*.60,x+Math.cos(ang)*r*.42,ground+r*.34+rand(0,.13),z+Math.sin(ang)*r*.4,[M.green,M.greenDark,M.greenLight][i%3]);b.scale.y=.8;
 }
}
for(const [x,z,r] of [[-7.05,6.9,1],[6.85,6.65,.95],[-5.5,5.65,.55],[5.6,5.95,.55],[-7.1,3.1,.68],[7.2,3.8,.75],[-5.5,-6.8,.8],[3.9,-7.2,.55]]){
 rock(x,z,r,z<1?1.34:.93);shrub(x-.45,z-.5,r*.85,z<1?1.34:.93);
}
for(const [x,z,r] of [[-5.5,-3.0,.70],[-7.1,-5.9,.95],[3.95,-6.9,.67],[7.4,-.7,.62],[-7.3,.8,.55],[3.9,1.0,.6]])shrub(x,z,r);
// Sculpted cherry trees: tapering angular branches, layered clouds of blossoms,
// and loose five-petal flowers, all shaded with a limited anime palette.
function cherry(x,z,height,spread){
 const g=new THREE.Group();g.position.set(x,1.34,z);model.add(g);
 beam([0,0,0],[.12,height*.40,.08],.23,M.wood,g,.15);
 beam([.12,height*.40,.08],[-.25,height*.71,-.02],.15,M.wood,g,.07);
 for(let i=0;i<5;i++){
  const a=i*2.39+.6;beam([0,.16,0],[Math.cos(a)*.47,.01,Math.sin(a)*.47],.09,M.wood,g,.035);
 }
 const crowns=[];
 for(let i=0;i<9;i++){
  const angle=i*2.399,rad=spread*(i===8?.1:rand(.34,.77));
  const px=Math.cos(angle)*rad,pz=Math.sin(angle)*rad,py=height*(.68+rand(0,.23));
  beam([.08,height*.35,0],[px*.58,py*.79,pz*.6],.115,M.wood,g,.060);
  beam([px*.58,py*.79,pz*.6],[px,py,pz],.060,M.wood,g,.026);
  crowns.push([px,py,pz]);
 }
 for(let k=0;k<crowns.length;k++){
  const p=crowns[k];
  for(let j=0;j<7;j++){
   const a=j*2.399,rad=j===0?0:spread*.28;
   const m=ball(spread*rand(.29,.43),p[0]+Math.cos(a)*rad,p[1]+rand(-.20,.22),p[2]+Math.sin(a)*rad,[M.pink,M.pinkLight,M.pinkWhite,M.pinkLight,M.pinkDark][(j+k)%5],g,1);
   m.scale.set(1,.68,1);m.rotation.y=rand(0,6.28);
  }
 }
 for(let i=0;i<60;i++){
  const p=crowns[i%crowns.length],px=p[0]+rand(-spread*.58,spread*.58),py=p[1]+rand(-.15,.48),pz=p[2]+rand(-spread*.58,spread*.58);
  const flower=ball(.085,px,py,pz,i%3?M.pinkWhite:M.pinkDark,g,0);flower.scale.y=.4;
 }
}
cherry(-5.62,-4.66,6.95,2.12);
cherry(5.83,-6.39,6.50,1.9);
// Small rounded evergreen gives the garden a lower, greener counterweight.
const evergreen=new THREE.Group();evergreen.position.set(-6.63,.94,4.68);model.add(evergreen);
beam([0,0,0],[.04,2.43,0],.11,M.wood,evergreen,.04);
for(let i=0;i<7;i++){
 const a=i*2.4,px=Math.cos(a)*.61,pz=Math.sin(a)*.61,y=1.3+i*.17;
 beam([0,.6,0],[px,y,pz],.05,M.wood,evergreen,.018);
 const b=ball(.64,px,y,pz,[M.greenDark,M.green,M.greenLight][i%3],evergreen);b.scale.y=.58;
}
for(let i=0;i<105;i++){
 const x=rand(-8,8),z=rand(-7.6,7.9);if(Math.abs(x)<3.6&&z<.8)continue;
 if(z<1&&x>4.3&&z<-2)continue;
 const y=z<1?1.35:.93;
 const p=mesh(new THREE.CircleGeometry(rand(.035,.07),5),i%4?M.pinkLight:M.leaf,x,y+.016,z);p.rotation.x=-Math.PI/2;p.rotation.z=rand(0,6);
}
for(let i=0;i<80;i++){
 const x=rand(-8,8),z=rand(-7.4,7.8);if(Math.abs(x)<4|| (z<-2&&x>4))continue;
 const y=z<1?1.35:.94;
 for(let j=0;j<3;j++){
  const grass=mesh(new THREE.ConeGeometry(.025,rand(.09,.19),3),i%2?M.green:M.greenDark,x+j*.037,y+.045,z);grass.rotation.z=(j-1)*.3;
 }
}
// Quiet rear access stair and a few worn stones in the maintenance path.
for(let i=0;i<3;i++)box(1.35,.17,.38,0,1.43+i*.20,-6.68+i*.3,M.woodLight,model,.025);
for(let i=0;i<7;i++)box(.64,.06,.47,-2.2+i*.69,1.38,-7.32,M.stoneLight,model,.05);

// Bake static meshes by material. Hundreds of individual architectural details
// remain real geometry, while the render loop keeps a small draw-call budget.
function bakeStatic(root){
 root.updateMatrixWorld(true);const batches=new Map();const originals=[];
 root.traverse(o=>{
  if(!o.isMesh)return;
  const key=o.material.uuid;
  if(!batches.has(key))batches.set(key,{material:o.material,geos:[]});
  const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
  geo.applyMatrix4(o.matrixWorld);geo.deleteAttribute('uv');geo.deleteAttribute('color');
  // Textured signs require their UVs and stay unbatched.
  if(o.material.map){geo.dispose();return;}
  batches.get(key).geos.push(geo);originals.push(o);
 });
 for(const {material,geos} of batches.values()){
  if(!geos.length)continue;const merged=mergeGeometries(geos,false);
  const m=new THREE.Mesh(merged,material);m.castShadow=true;m.receiveShadow=true;model.add(m);
  geos.forEach(g=>g.dispose());
 }
 for(const o of originals){o.removeFromParent();o.geometry.dispose();}
}
bakeStatic(model);

return model;
}
