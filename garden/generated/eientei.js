// Generated from eientei/scene.js by build-models.py. Edit the original model to update.
import * as T from 'three';
import {palette,box,cylinder,mesh,beam,blob,plinth,roof,cord,seededRandom,batchStatic} from './eientei-geometry.js';
export function createModel() {
const world=new T.Group();
const p=palette({stone:'#536474',stoneLight:'#75828a',edge:'#b4b5a4',ground:'#3f5b50',wood:'#665044',dark:'#302e35',timber:'#a38964',wall:'#bebca2',roof:'#293f52',tile:'#536b7d',moss:'#536b48',leaf:'#45735a',leafLight:'#6d9270',bamboo:'#799069',joint:'#acaf7b',path:'#9baba6',sand:'#778b83',water:'#244a60',gold:'#c9ae79',red:'#956878'});
const glow=new T.MeshStandardMaterial({color:'#f5d49a',emissive:'#f4b657',emissiveIntensity:.55,roughness:1});
const B=(s,pos,m=p.wood,g=world,r=0)=>box(g,s,pos,m,r);
const C=(a,b,h,pos,m=p.stone,g=world,n=10)=>cylinder(g,a,b,h,pos,m,n);
function G(x,y,z,a=0){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=a;world.add(g);return g;}
const rnd=seededRandom(913);
plinth(world,{size:23,stone:p.stone,stoneLight:p.stoneLight,wood:p.gold,ground:p.ground});
B([22.65,.06,22.65],[0,.94,0],p.moss,world,.12);
// Quiet gravel court nested inside an asymmetrical residential compound.
B([12.7,.07,10.4],[.25,.99,3.25],p.sand,world,.25);
for(let i=0;i<26;i++)B([11.9,.014,.022],[.25,1.035,-1.5+i*.38],p.path);
// Main hall, west residential wing, east moon-viewing chamber; locally closed walls and gables.
function hall(x,z,w,d,h,a=0){const g=G(x,1,z,a);
 B([w+.6,.26,d+.6],[0,.13,0],p.stone,g,.06);B([w+.75,.15,d+.75],[0,.39,0],p.dark,g);
 B([w,h,d],[0,.52+h/2,0],p.wall,g);
 for(let side of [0,Math.PI]){const f=new T.Group();f.rotation.y=side;g.add(f);
 B([w+.85,.15,.88],[0,.48,d/2+.35],p.wood,f);
 for(let xx=-w/2-.25;xx<w/2+.4;xx+=.22)B([.022,.018,.82],[xx,.565,d/2+.35],p.timber,f);
 for(let xx=-w/2;xx<w/2+.01;xx+=w/Math.round(w/1.5)){
 B([.14,h+.13,.15],[xx,.55+h/2,d/2+.08],p.dark,f);
 }
 for(let xx=-w/2+.15;xx<w/2-.2;xx+=1.5){let sw=Math.min(1.28,w/2-xx-.1);if(sw<.2)continue;
 B([sw,h*.70,.035],[xx+sw/2,.65+h*.49,d/2+.09],glow,f);
 for(let j=0;j<=4;j++)B([.027,h*.70,.045],[xx+sw*j/4,.65+h*.49,d/2+.12],p.wood,f);
 for(let yy=.65+h*.14;yy<.65+h*.85;yy+=.28)B([sw,.026,.045],[xx+sw/2,yy,d/2+.12],p.wood,f);
 B([sw,.28,.05],[xx+sw/2,.69,d/2+.12],p.wood,f);}
 for(let yy of [.56,h+.5])B([w+.25,.16,.16],[0,yy,d/2+.1],p.dark,f);
 for(let xx=-w/2;xx<=w/2;xx+=.42)B([.075,.11,.72],[xx,h+.49,d/2+.27],p.timber,f);
 }
 for(let s of [-1,1]){B([.1,h,d],[s*w/2,.52+h/2,0],p.wood,g);for(let zz=-d/2+.18;zz<d/2;zz+=.28)B([.055,h-.1,.025],[s*(w/2+.06),.55+h/2,zz],p.timber,g);
 // Closed curved gable matches roof profile, no open roof underside.
 let shape=new T.Shape();shape.moveTo(-d/2-.55,0);for(let j=0;j<=36;j++){let zz=-d/2-.55+j*(d+1.1)/36,t=Math.abs(zz)/(d/2+.55);shape.lineTo(zz,1.18*(1-t)**1.4+.065*t**9);}shape.lineTo(d/2+.55,0);shape.closePath();let m=mesh(g,new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false}),p.wood,[s*w/2,h+.57,0]);m.rotation.y=Math.PI/2;
 }
 roof(g,{width:w+1.15,depth:d+1.1,rise:1.18,uplift:.065,position:[0,h+.58,0],surface:p.roof,trim:p.dark,seam:p.tile,tileStep:.25});
 for(let xx=-w/2-.4;xx<w/2+.5;xx+=.3)C(.065,.065,.1,[xx,h+1.87,0],p.tile,g,8).rotation.z=Math.PI/2;
 return g;}
hall(-.7,-5.45,12.6,3.9,2.75);
hall(-6.9,-.55,3.1,5.4,2.35);
hall(6.25,-2.8,3.5,4.8,2.45);
// Covered east passage, slender load-bearing posts and open view through the court.
const passage=G(6.25,1,1.75);B([2.4,.45,4.2],[0,.225,0],p.stone,passage);B([2.5,.13,4.3],[0,.5,0],p.wood,passage);
for(let z=-1.9;z<=2;z+=1.25)for(let x of [-.98,.98]){B([.15,2.2,.15],[x,1.6,z],p.dark,passage);B([.28,.12,.28],[x,.64,z],p.edge,passage);}
let rg=new T.Group();rg.rotation.y=Math.PI/2;passage.add(rg);roof(rg,{width:4.75,depth:2.9,rise:.65,uplift:.03,position:[0,2.76,0],surface:p.roof,trim:p.dark,seam:p.tile,tileStep:.25});
for(let zz=-2;zz<2.1;zz+=.23)B([2.35,.016,.025],[0,.578,zz],p.timber,passage);
// Lower entrance canopy and broad shallow steps.
const porch=G(-.7,1,-2.7);roof(porch,{width:4.2,depth:2.2,rise:.46,uplift:.03,position:[0,2.65,0],surface:p.roof,trim:p.dark,seam:p.tile,tileStep:.23});for(let x of [-1.7,1.7])B([.14,2.65,.14],[x,1.32,.75],p.dark,porch);
for(let i=0;i<3;i++)B([3.5,.16*(3-i),.55],[-.7,1+.08*(3-i),-1.53+i*.5],p.stoneLight);
// Offset stepping-stone path encourages depth rather than a shrine axis.
for(let i=0;i<11;i++){let z=.25+i*.91,x=-.7+Math.sin(i*.32)*1.25;const o=C(.45,.49,.095,[x,1.09,z],i%3?p.path:p.edge,world,7);o.scale.x=1.45;o.rotation.y=i*.8;}
// Pond with enclosing stones and a low arched timber bridge.
const pond=G(3.05,1.05,5.8);let basin=C(2.1,2.24,.16,[0,.01,0],p.stone,pond,48);basin.scale.set(1,.7,1.45);let water=C(1.96,1.96,.028,[0,.09,0],p.water,pond,48);water.scale.z=1.45;
for(let i=0;i<22;i++){let a=i*Math.PI*2/22;blob(pond,.26,[2.08*Math.cos(a),.14,3.0*Math.sin(a)],i%2?p.stone:p.stoneLight,[1.4,.6,1]);}
for(let i=0;i<19;i++){let x=-2.2+i*.245,y=.30+.38*Math.sin(i/18*Math.PI);B([.225,.12,.97],[x,y,-.1],p.wood,pond);}
for(let s of [-1,1]){let pts=[];for(let i=0;i<=12;i++){let x=-2.2+i*4.4/12;pts.push([x,.46+.38*Math.sin(i/12*Math.PI),s*.46-.1]);}cord(pond,pts,.065,p.dark);}
for(let i=0;i<7;i++){let x=rnd(-1.3,1.3),z=rnd(.8,2);C(.15,.15,.015,[x,.117,z],p.leaf,pond,16);}
// Stone lanterns: small emissive cores, no per-object lights.
function lantern(x,z,h=1){const g=G(x,1.06,z);B([.66,.16,.66],[0,.08,0],p.stoneLight,g,.05);C(.15,.24,.72*h,[0,.16+.36*h,0],p.stone,g);B([.48,.13,.48],[0,.22+.72*h,0],p.edge,g);B([.38,.4,.38],[0,.47+.72*h,0],glow,g);for(let sx of [-1,1])for(let sz of [-1,1])B([.08,.47,.08],[sx*.22,.47+.72*h,sz*.22],p.stone,g);C(.1,.51,.32,[0,.84+.72*h,0],p.stoneLight,g,4).rotation.y=Math.PI/4;blob(g,.105,[0,1.04+.72*h,0],p.edge);}
lantern(-3.1,.8);lantern(5.1,8.65,.75);lantern(-3.4,8.6,.7);lantern(8.2,-7,.8);
// Low perimeter fence and rear service path, readable from the back.
function fence(x,z,l,a=0){let g=G(x,1,z,a);for(let y of [.38,.92])B([l,.085,.085],[0,y,0],p.wood,g);for(let xx=-l/2;xx<=l/2;xx+=.35)C(.037,.048,1.1,[xx,.55,0],p.bamboo,g,6);}
fence(0,-9.35,19);fence(-9.65,-.4,17,Math.PI/2);fence(9.65,-.4,17,Math.PI/2);fence(-6.45,9.65,6);fence(6.2,9.65,6.3);
for(let x=-7;x<7.6;x+=.8)B([.67,.08,.7],[x,1.02,-8.4],p.path,world,.06);
for(let i=0;i<3;i++){const g=G(-4.9+i*.8,1.03,-8.25);C(.28,.24,.48,[0,.24,0],p.wood,g,12);for(let y of [.08,.4])C(.288,.288,.04,[0,y,0],p.dark,g,12);}
// Bamboo groves occupy rear and outer pockets, leaving eaves and entry visible.
function bamboo(x,z,h){const g=G(x,1,z,rnd(-.2,.2));let lean=rnd(-.35,.35);beam(g,[0,0,0],[lean,h,0],.065,p.bamboo,.043);for(let y=.45;y<h;y+=.58)C(.078,.078,.044,[lean*y/h,y,0],p.joint,g,8);
 for(let i=0;i<4;i++){let y=h*(.54+i*.12),s=i%2?1:-1,ex=lean+s*rnd(.45,.85),ez=rnd(-.4,.4);beam(g,[lean*y/h,y,0],[ex,y+.3,ez],.027,p.leaf,.009);
 for(let j=0;j<5;j++){let t=(j+1)/5,xx=lean*y/h+(ex-lean*y/h)*t,zz=ez*t;const leaf=mesh(g,new T.SphereGeometry(1,5,3),i%2?p.leaf:p.leafLight,[xx,y+.3*t,zz]);leaf.scale.set(.30,.035,.082);leaf.rotation.set(rnd(-.3,.3),s*.5+j*.7,s*.35);}}
}
for(let i=0;i<39;i++){let x=-10.1+i*.52,z=-10.15+rnd(-.25,.32);bamboo(x,z,rnd(4.7,7.1));}
for(let s of [-1,1])for(let i=0;i<12;i++)bamboo(s*rnd(9.9,10.6),-7.8+i*.9,rnd(3.7,5.9));
for(let s of [-1,1])for(let i=0;i<11;i++){let x=s*rnd(7.8,9.2),z=rnd(4.4,8.8);blob(world,rnd(.32,.58),[x,1.18,z],i%2?p.moss:p.leaf,[1,.55,1]);}
for(let i=0;i<18;i++){let x=rnd(-5.8,-3.8),z=rnd(2.2,7.8);blob(world,rnd(.13,.33),[x,1.08,z],p.stone,[1,.65,1.3]);}
// Domestic scale cues: moon-viewing bench, tea tray, round window and two quiet rabbits.
B([2.1,.13,.64],[4.85,1.62,2.3],p.wood);for(let x of [4.1,5.6])B([.12,.56,.5],[x,1.3,2.3],p.dark);
B([.56,.04,.34],[4.85,1.71,2.3],p.dark);C(.075,.085,.09,[4.73,1.77,2.3],p.wall);C(.055,.055,.065,[5.0,1.76,2.3],p.wall);
let circle=mesh(world,new T.TorusGeometry(.52,.065,8,48),p.timber,[6.25,2.8,-.345]);let disk=C(.47,.47,.025,[6.25,2.8,-.36],glow,world,40);disk.rotation.x=Math.PI/2;
for(let x of [6.0,6.25,6.5])B([.035,.85,.04],[x,2.8,-.31],p.wood);
function rabbit(x,z,a){let g=G(x,1.12,z,a);blob(g,.17,[0,.16,0],p.wall,[.8,.85,1.2]);blob(g,.115,[0,.29,.12],p.wall);for(let s of [-1,1]){let ear=blob(g,.07,[s*.063,.45,.1],p.wall,[.48,2,.55]);ear.rotation.z=-s*.16;blob(g,.018,[s*.057,.32,.216],p.dark);}blob(g,.065,[0,.2,-.2],p.wall);}
rabbit(-2.1,4.7,.8);rabbit(-1.65,5.2,-.5);
// Pale moon is a physical miniature disc on the rear composition plane.
const moonMat=new T.MeshBasicMaterial({color:'#e4e3c5'});let moon=mesh(world,new T.SphereGeometry(.83,40,24),moonMat,[4.2,8.3,-9.75]);moon.castShadow=false;

batchStatic(world);
return world;
}
