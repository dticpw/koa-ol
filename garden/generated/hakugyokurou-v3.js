// Generated from hakugyokurou-v3/scene.js by build-models.py. Edit the original model to update.
import * as THREE from 'three';
import {palette,box,cylinder,blob,beam,cord,seededRandom,batchStatic,mesh} from './hakugyokurou-v3-geometry.js';
export function createModel() {
const model=new THREE.Group();
const p=palette({base:'#a19bac',edge:'#ded8dd',sand:'#ded8d1',rake:'#bcb2bc',wood:'#78657f',lightwood:'#a490a4',dark:'#4c3f59',paper:'#eee2df',roof:'#817994',tile:'#aaa0b7',stone:'#9793a6',stoneLight:'#c9c5cf',moss:'#91a189',mossLight:'#b6c0a0',bark:'#756170',pink:'#e6a6c3',blush:'#f0c3d4',white:'#f5dfe3',gold:'#c5ab78',ground:'#bcc4ad'});
// Expand the plan, never the model scale: original room depth and eaves retained.
const DX=1.5,DZ=2.5;
const courtyard={before:{width:2*(4.53-1.15/2),depth:4.6-(-2.78+1.15/2)},after:{width:2*(4.53+DX-1.15/2),depth:4.6-(-2.78-DZ+1.15/2)}};
for(const c of Object.values(courtyard))c.area=c.width*c.depth;
courtyard.area_ratio=courtyard.after.area/courtyard.before.area;
const rnd=seededRandom(9132026);
const B=(s,pos,m=p.wood,r=0)=>box(model,s,pos,m,r);
B([22.8,.48,20],[0,0,-.5],p.base,.12);B([22.92,.12,20.12],[0,.29,-.5],p.dark,.045);B([22.8,.18,20],[0,.44,-.5],p.edge,.06);B([22.6,.16,19.8],[0,.55,-.5],p.ground,.07);
// A clear sand rectangle runs between the verandas and opens to the front garden.
B([11.0,.025,12.4],[0,.636,1.45],p.sand,.025);
for(let x=-10.9;x<11;x+=1)B([.96,.27,.035],[x,0,9.51],p.edge,.02);
for(const x of [-11.41,11.41])for(let z=-10;z<9.2;z+=1)B([.035,.27,.96],[x,0,z],p.edge,.02);
// Rear room and two side rooms share one floor datum; verandas meet without gaps.
function room(w,d,x,z){
 B([w,.27,d],[x,.805,z],p.base,.025);B([w+.10,.16,d+.1],[x,1.02,z],p.dark);
 B([w,2.18,d],[x,2.17,z],p.paper);
 for(let face=0;face<4;face++){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=face*Math.PI/2;model.add(g);
  const span=face%2?d:w,depth=face%2?w:d,n=Math.round(span/.92);
  for(let i=0;i<=n;i++)box(g,[.09,2.25,.13],[-span/2+i*span/n,2.18,depth/2+.016],p.wood);
  for(const yy of [1.13,1.49,3.16,3.30])box(g,[span+.1,.09,.14],[0,yy,depth/2+.024],p.dark);
  for(let i=0;i<n;i++){
   const cx=-span/2+(i+.5)*span/n;
   box(g,[span/n-.11,.30,.04],[cx,1.30,depth/2+.05],p.wood);
   for(let j=1;j<=4;j++)box(g,[.022,1.61,.045],[-span/2+(i+j/5)*span/n,2.33,depth/2+.08],p.lightwood);
   for(let j=0;j<7;j++)box(g,[span/n-.08,.024,.045],[cx,1.57+j*.25,depth/2+.08],p.lightwood);
   box(g,[.03,.11,.02],[cx+span/n*.3,2,depth/2+.108],p.dark);
  }
 }
}
room(15+2*DX,2.6,0,-4.65-DZ);room(2.45,7.35+DZ,-6.275-DX,.325-DZ/2);room(2.45,7.35+DZ,6.275+DX,.325-DZ/2);
// Engawa: fine planks run across the circulation direction. Columns rest on stones.
B([15.1+2*DX,.18,1.15],[0,1.02,-2.78-DZ]);
for(let x=-7.5-DX;x<7.5+DX;x+=.16)B([.145,.025,1.14],[x,1.123,-2.78-DZ],Math.round(x*100)%3?p.wood:p.lightwood);
for(const s of [-1,1]){
 B([1.15,.18,7.2+DZ],[s*(4.53+DX),1.02,1.0-DZ/2]);
 for(let z=-2.52-DZ;z<4.6;z+=.16)B([1.14,.025,.145],[s*(4.53+DX),1.123,z],Math.round(z*100)%3?p.wood:p.lightwood);
 for(let z=-2.1-DZ;z<=4.6;z+=1.1){B([.28,.20,.28],[s*(4.0+DX),.72,z],p.stone,.025);B([.12,2.66,.12],[s*(4.0+DX),2.10,z]);B([.3,.13,.20],[s*(4.0+DX),3.24,z],p.dark);}
 B([.13,.22,7.6+DZ],[s*(4.0+DX),3.36,.95-DZ/2],p.dark);
 B([1.36,.18,.37],[s*(4.51+DX),.73,4.84],p.stoneLight,.035);B([1.25,.16,.34],[s*(4.51+DX),.89,4.59],p.wood);
}
for(let x=-3.9-DX;x<4+DX;x+=1.3){B([.28,.20,.28],[x,.72,-2.23-DZ],p.stone,.025);B([.12,2.66,.12],[x,2.10,-2.23-DZ]);}
B([8.1+2*DX,.22,.13],[0,3.36,-2.23-DZ],p.dark);
// Continuous U roof from distance-to-boundary; sharp mitred hips and valleys.
// The expanded inner cutout ends at z=-4.15; all mitred corners remain closed.
const outerX=8.25+DX,back=-6.55-DZ,front=5.10,innerX=3.62+DX,innerZ=-1.65-DZ;
function inside(x,z){return Math.abs(x)<=outerX&&z>=back&&z<=front&&(Math.abs(x)>=innerX||z<=innerZ);}
function roofY(x,z){const edge=Math.min(outerX-Math.abs(x),z-back,front-z,Math.max(Math.abs(x)-innerX,innerZ-z));return 3.48+.58*Math.max(0,edge);}
const verts=[];
function patch(x0,x1,z0,z1){const nx=Math.ceil((x1-x0)/.12),nz=Math.ceil((z1-z0)/.12);for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=x0+(x1-x0)*i/nx,b=x0+(x1-x0)*(i+1)/nx,c=z0+(z1-z0)*j/nz,d=z0+(z1-z0)*(j+1)/nz;for(const [x,z] of [[a,c],[a,d],[b,c],[b,c],[a,d],[b,d]])verts.push(x,roofY(x,z),z);}}
patch(-outerX,outerX,back,innerZ);patch(-outerX,-innerX,innerZ,front);patch(innerX,outerX,innerZ,front);
const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();mesh(model,geo,p.roof);
function roofLine(points,r=.019,mat=p.tile){cord(model,points.map(([x,z])=>[x,roofY(x,z)+.028,z]),r,mat);}
for(let x=-outerX+.05;x<=outerX-.05;x+=.235){const end=Math.abs(x)>=innerX?front:innerZ;const pts=[];for(let z=back;z<end;z+=.12)pts.push([x,z]);pts.push([x,end]);roofLine(pts);}
for(let z=back+.26;z<front;z+=.31){if(z<innerZ)roofLine([[-outerX,z],...Array.from({length:Math.ceil(outerX*2/.12)},(_,i)=>[-outerX+i*.12,z]),[outerX,z]],.009,p.roof);else for(const s of [-1,1]){const pts=[];for(let x=innerX;x<outerX;x+=.12)pts.push([s*x,z]);pts.push([s*outerX,z]);roofLine(pts,.009,p.roof);}}
for(const [a,b] of [[[-outerX,back],[outerX,back]],[[-outerX,back],[-outerX,front]],[[outerX,back],[outerX,front]],[[-outerX,front],[-innerX,front]],[[innerX,front],[outerX,front]],[[-innerX,front],[-innerX,innerZ]],[[innerX,front],[innerX,innerZ]],[[-innerX,innerZ],[innerX,innerZ]]])beam(model,[a[0],3.45,a[1]],[b[0],3.45,b[1]],.07,p.dark);
// Ridge caps follow the roof's connected ridge; underside is closed by timber soffits.
const ridgeX=(outerX+innerX)/2,ridgeZ=(back+innerZ)/2;
roofLine([[-ridgeX,ridgeZ],[ridgeX,ridgeZ]],.075,p.tile);
for(const s of [-1,1])roofLine([[s*ridgeX,ridgeZ],[s*ridgeX,front-(outerX-innerX)/2]],.075,p.tile);
B([2*outerX,.09,4.9],[0,3.43,-4.10-DZ],p.dark);for(const s of [-1,1])B([4.63,.09,6.75+DZ],[s*(5.935+DX),3.43,1.725-DZ/2],p.dark);
// Asymmetric dry garden: three stone compositions, broad empty sand in foreground.
function island(x,z,sx,sz){const m=cylinder(model,1,1,.065,[x,.658,z],p.moss,48);m.scale.set(sx,1,sz);for(let i=0;i<16;i++){const a=i*2.399;blob(model,.24,[x+Math.cos(a)*sx*.79,.682,z+Math.sin(a)*sz*.76],i%3?p.moss:p.mossLight,[1.25,.19,1]);}}
function stone(x,z,h,w,angle=0){const m=blob(model,1,[x,.61+h*.43,z],p.stone,[w,h*.65,w*.75]);m.rotation.y=angle;const cap=blob(model,.45,[x-.1*w,.63+h*.80,z],p.stoneLight,[w,.22*h,w*.7]);cap.rotation.y=angle;}
island(-3.05,-1.8,1.55,1.16);stone(-3.8,-1.12,.62,.55,1);
island(1.15,1.55,1.28,.83);stone(.88,1.48,1.8,.57,.4);stone(1.53,1.67,.95,.62,1.3);stone(.38,1.8,.40,.45);
island(3.35,-2.6,.78,.53);stone(3.42,-2.65,.8,.53,2);stone(2.93,-2.5,.4,.36);
for(const [cx,cz,rx,rz] of [[1.15,1.55,1.5,1.0],[3.35,-2.6,1.0,.71]])for(let k=0;k<4;k++){
 const pts=[];for(let i=0;i<=80;i++){const a=i/80*Math.PI*2;pts.push([cx+Math.cos(a)*(rx+k*.13),.659,cz+Math.sin(a)*(rz+k*.12)]);}cord(model,pts,.008,p.rake);
}
for(let z=3.65;z<7.3;z+=.14){const pts=[];for(let x=-5.1;x<5.2;x+=.3){pts.push([x,.659,z+.027*Math.sin(x*.9)]);}if(pts.length>2)cord(model,pts,.007,p.rake);}
for(let i=0;i<360;i++){const x=rnd(-5.1,5.1),z=rnd(-4.0,7.3);if((x+3.05)**2+(z+1.8)**2<3.1||(x-1.15)**2+(z-1.55)**2<2.4)continue;blob(model,rnd(.013,.028),[x,.659,z],i%3?p.rake:p.edge,[1,.35,.7]);}
// Branching pink-white clusters adapted from v1; crowns vary in height and spread.
function sakura(x,y,z,h,spread,seed){
 const r=seededRandom(seed),g=new THREE.Group();g.position.set(x,y,z);model.add(g);
 beam(g,[0,0,0],[.17,h*.62,.08],.19,p.bark,.08);
 for(let k=0;k<6;k++){
  const a=k*2.399,ex=Math.cos(a)*spread*.68,ez=Math.sin(a)*spread*.65,ey=h*(.7+r(0,.15));
  const joint=[ex*.60,h*.57,ez*.57];
  beam(g,[.10,h*.35,0],joint,.075,p.bark,.048);
  beam(g,joint,[ex,ey,ez],.048,p.bark,.020);
  for(let j=0;j<7;j++){
   const aa=j*2.399,rr=j?spread*.33:0;
   blob(g,spread*.40,[ex+Math.cos(aa)*rr,ey+r(-.12,.24),ez+Math.sin(aa)*rr],[p.pink,p.blush,p.white][(k+j)%3],[1,.60,1]);
  }
 }
 for(let i=0;i<5;i++){const a=i*1.26;beam(g,[0,.22,0],[Math.cos(a)*.43,.01,Math.sin(a)*.43],.075,p.bark,.025);}
}

sakura(-3.05,.69,-1.8,4.0,1.48,81);
island(-8.0,6.45,1.5,1.16);sakura(-8.0,.69,6.45,3.0,1.25,95);
island(8.55,6.35,1.40,1.05);sakura(8.55,.69,6.35,3.5,1.42,112);
// Low boundary walls describe the outer cherry garden without closing the entrance.
for(const side of [-1,1]){
 B([.20,.54,18.6],[side*10.9,.90,-.6],p.edge,.035);
 B([.30,.075,18.7],[side*10.9,1.2,-.6],p.stoneLight,.025);
 B([7.0,.48,.20],[side*7.35,.87,8.6],p.edge,.025);
 B([7.1,.07,.3],[side*7.35,1.145,8.6],p.stoneLight,.02);
 for(let z=-9.4;z<5.9;z+=.73)B([.36,.045,.58],[side*10.24,.66,z],p.stone,.04);
 for(let i=0;i<8;i++){const x=side*(3.1+i*.85);B([.63,.05,.44],[x,.66,7.88+.13*Math.sin(i)],p.stoneLight,.055);}
}
B([21.8,.54,.20],[0,.90,-9.95],p.edge,.035);B([21.9,.075,.30],[0,1.20,-9.95],p.stoneLight,.025);
for(let x=-9.8;x<10;x+=.75)B([.57,.045,.36],[x,.66,-9.52],p.stone,.04);
function lantern(x,z,scale=1){
 const g=new THREE.Group();g.position.set(x,.65,z);g.scale.setScalar(scale);model.add(g);
 box(g,[.65,.12,.65],[0,.06,0],p.stoneLight,.045);box(g,[.45,.12,.45],[0,.18,0],p.stone,.03);
 cylinder(g,.12,.18,.58,[0,.53,0],p.edge,8);box(g,[.45,.12,.45],[0,.87,0],p.stoneLight,.025);
 box(g,[.28,.29,.28],[0,1.065,0],p.paper,.02);
 for(const a of [-1,1])for(const b of [-1,1])box(g,[.055,.33,.055],[a*.17,1.065,b*.17],p.stone);
 const cap=cylinder(g,.07,.44,.22,[0,1.34,0],p.stoneLight,4);cap.rotation.y=Math.PI/4;
 blob(g,.075,[0,1.52,0],p.gold,[1,1.25,1]);
}
lantern(-4.45,3.8,.85);lantern(4.65,-3.1,.8);lantern(-6.7,7.8);lantern(7.0,7.95,.9);
// A small bench and tea tray sit on the right engawa, outside its circulation line.
B([.62,.09,1.50],[6.20,1.54,1.1],p.lightwood,.025);
for(const z of [.52,1.68])B([.46,.39,.09],[6.20,1.30,z],p.dark);
B([.43,.035,.39],[6.20,1.61,1.1],p.dark,.02);
cylinder(model,.07,.055,.075,[6.14,1.666,1.03],p.gold,10);cylinder(model,.09,.07,.10,[6.27,1.68,1.20],p.paper,10);
// Sparse petals under the trees only; no confetti covering the open sand.
for(const [cx,cz,spread] of [[-3.05,-1.8,1.8],[-8,6.45,1.65],[8.55,6.35,1.8]])for(let i=0;i<75;i++){
 const a=rnd(0,Math.PI*2),r=spread*Math.sqrt(rnd());
 const petal=blob(model,.03,[cx+Math.cos(a)*r,.682,cz+Math.sin(a)*r],i%3?p.blush:p.pink,[1.6,.18,.8]);petal.rotation.y=rnd(0,Math.PI);
}

batchStatic(model);
return model;
}
