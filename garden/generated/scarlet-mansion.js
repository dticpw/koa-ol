// Generated from scarlet-mansion/scene.js by build-models.py. Edit the original model to update.
import * as T from 'three';
import {palette,box,cylinder,mesh,beam,blob,plinth,seededRandom,batchStatic} from './scarlet-mansion-geometry.js';
export function createModel() {
const world=new T.Group();
const p=palette({wall:'#b76570',light:'#d59896',stone:'#776375',edge:'#e8c4ac',roof:'#4a425f',roofLight:'#61556f',metal:'#383445',gold:'#caa36e',glass:'#e4bb7d',dark:'#51404e',ground:'#768477',hedge:'#3e6657',leaf:'#527565',rose:'#ad354f',pink:'#db6b87',path:'#b6adb0',water:'#729ca8',wood:'#6c4050'});
const B=(s,pos,m=p.wall,g=world,r=0)=>box(g,s,pos,m,r);
const C=(a,b,h,pos,m=p.edge,g=world,n=12)=>cylinder(g,a,b,h,pos,m,n);
const G=(x,y,z,angle=0)=>{let g=new T.Group();g.position.set(x,y,z);g.rotation.y=angle;world.add(g);return g;};
const rand=seededRandom(495);
plinth(world,{size:23,stone:p.stone,stoneLight:p.light,wood:p.gold,ground:p.ground});
B([22.9,.11,22.9],[0,.93,0],p.edge,world,.08);B([22.5,.08,22.5],[0,1.02,0],p.ground);
// A stone-paved axial approach, with two landscaped parterres.
B([3.1,.06,12.9],[0,1.09,3.9],p.path);
B([18.4,.06,2.2],[0,1.09,.1],p.path);
for(let z=-1.8;z<10.8;z+=.58)for(let x=-1.25;x<=1.3;x+=.63)B([.59,.015,.53],[x,1.13,z],(Math.round(z*5)+Math.round(x*7))%4?p.path:p.edge);
// Arched silhouette, extruded so window surrounds have actual depth.
function arch(w,h,d,mat,g,x,y,z){let s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.lineTo(-w/2,0);return mesh(g,new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:10}),mat,[x,y,z]);}
function win(g,x,y,z,w=.65,h=1.45){arch(w+.2,h+.16,.11,p.edge,g,x,y-.08,z);arch(w,h,.025,p.dark,g,x,y,z+.12);arch(w-.13,h-.12,.02,p.glass,g,x,y+.06,z+.147);B([.045,h-.16,.045],[x,y+h/2,z+.19],p.metal,g);B([w-.1,.045,.04],[x,y+h*.56,z+.19],p.metal,g);B([w+.31,.1,.29],[x,y-.05,z+.11],p.edge,g);}
function roof(g,w,d,y,h){ // closed, straight hipped roof; ridge follows X
 const v=[-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2,-w*.30,h,0,w*.30,h,0];
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex([0,4,5,0,5,1,3,2,5,3,5,4,0,3,4,1,5,2,0,1,2,0,2,3]);geo.computeVertexNormals();mesh(g,geo,p.roof,[0,y,0]);
 B([w+.12,.16,d+.12],[0,y,0],p.edge,g);B([w*.6+.12,.12,.14],[0,y+h+.02,0],p.roofLight,g);
 for(let t=.2;t<1;t+=.2){let yy=y+h*t,ww=w*(1-.4*t),dd=d*(1-t);for(let sign of [-1,1])B([ww,.035,.035],[0,yy+.02,sign*dd/2],p.roofLight,g);}
 for(let x=-w*.29;x<=w*.3;x+=.62)for(let s of [-1,1])beam(g,[x,y+.03,s*d/2],[x,y+h+.035,0],.022,p.roofLight);
}
function block(x,z,w,d,h){let g=G(x,1.13,z);B([w+.3,.28,d+.3],[0,.14,0],p.stone,g);B([w,h,d],[0,h/2+.25,0],p.wall,g);
 for(let y of [.5,2.8,h+.18])B([w+.15,.12,d+.15],[0,y,0],p.edge,g);
 for(let sx of [-1,1])for(let sz of [-1,1]){B([.23,h,.22],[sx*(w/2-.05),h/2+.25,sz*(d/2-.05)],p.edge,g);for(let yy=.6;yy<h;yy+=.4)B([.36,.17,.29],[sx*(w/2-.04),yy,sz*(d/2-.02)],p.light,g);}
 for(let side of [0,Math.PI]){let face=new T.Group();face.rotation.y=side;g.add(face);for(let xx=-w/2+.8;xx<w/2-.5;xx+=1.22)for(let yy of [.84,3.16])if(yy+1.4<h+.3)win(face,xx,yy,d/2+.015);}
 for(let side of [-Math.PI/2,Math.PI/2]){let face=new T.Group();face.rotation.y=side;g.add(face);for(let xx=-d/2+.8;xx<d/2-.4;xx+=1.18)for(let yy of [.84,3.16])if(yy+1.4<h+.3)win(face,xx,yy,w/2+.015);}
 roof(g,w+.65,d+.65,h+.34,1.65);return g;}
const main=block(0,-4.1,12.6,4.7,5.65);
block(-7,-2.2,3.1,7.3,4.9);block(7,-2.2,3.1,7.3,4.9);
// Chimneys with stone caps and dark hollow-looking mouths.
for(let x of [-4.5,4.5]){B([.62,1.7,.72],[x,8.1,-4.8],p.wall);B([.83,.15,.92],[x,8.98,-4.8],p.edge);B([.46,.025,.56],[x,9.07,-4.8],p.dark);}
// The front clock tower: large round clock, arched doors and tall slate spire.
const tower=G(0,1.13,-1.9);B([3,7.55,2.9],[0,3.78,0],p.wall,tower);for(let y of [.2,2.8,5.35,7.5])B([3.23,.2,3.14],[0,y,0],p.edge,tower);
for(let x of [-1.36,1.36])B([.24,7.5,.21],[x,3.8,1.49],p.edge,tower);
arch(1.65,2.3,.16,p.edge,tower,0,.36,1.46);arch(1.38,2.12,.04,p.wood,tower,0,.36,1.64);for(let x of [-.48,-.24,0,.24,.48])B([.025,1.57,.03],[x,1.18,1.70],p.gold,tower);C(.05,.05,.04,[-.13,1.2,1.74],p.gold,tower).rotation.x=Math.PI/2;C(.05,.05,.04,[.13,1.2,1.74],p.gold,tower).rotation.x=Math.PI/2;
win(tower,0,3.18,1.48,1.07,1.66);
function clock(g,z,rot=0){let f=new T.Group();f.position.set(0,6.36,z);f.rotation.y=rot;g.add(f);let ring=C(.95,.95,.14,[0,0,0],p.edge,f,48);ring.rotation.x=Math.PI/2;let disk=C(.8,.8,.05,[0,0,.10],p.dark,f,48);disk.rotation.x=Math.PI/2;for(let i=0;i<12;i++){let a=i*Math.PI/6;let tick=B([.045,i%3?.10:.17,.03],[Math.sin(a)*.67,Math.cos(a)*.67,.145],p.gold,f);tick.rotation.z=-a;}beam(f,[0,0,.17],[-.33,.35,.17],.035,p.edge);beam(f,[0,0,.17],[.43,.24,.17],.025,p.edge);C(.07,.07,.05,[0,0,.18],p.gold,f).rotation.x=Math.PI/2;}
clock(tower,1.59);clock(tower,-1.59,Math.PI);
C(2.22,2.22,.17,[0,7.67,0],p.roofLight,tower,4).rotation.y=Math.PI/4;
const spire=C(0,2.23,3.3,[0,9.37,0],p.roof,tower,4);spire.rotation.y=Math.PI/4;
for(let sx of [-1,1])for(let sz of [-1,1])beam(tower,[sx*1.56,7.77,sz*1.56],[0,11.02,0],.035,p.roofLight);
beam(tower,[0,10.96,0],[0,11.78,0],.035,p.gold);blob(tower,.105,[0,11.28,0],p.gold); // finial
// Round corner turrets, inset windows and conical roofs.
for(let x of [-8.05,8.05])for(let z of [-5.65,1.05]){let g=G(x,1.13,z);C(.84,.95,5.3,[0,2.65,0],p.wall,g,16);for(let y of [.16,2.7,5.25])C(.99,.99,.16,[0,y,0],p.edge,g,16);for(let angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){let f=new T.Group();f.rotation.y=angle;g.add(f);win(f,0,3.23,.84,.46,1.15);}C(0,1.23,2.3,[0,6.5,0],p.roof,g,16);C(.045,.06,.57,[0,7.9,0],p.gold,g);blob(g,.105,[0,7.65,0],p.gold);}
// Entrance stairway and porch columns.
for(let i=0;i<4;i++)B([3.9-i*.2,.13*(i+1),1.55-i*.30],[0,1.13+.065*(i+1),.12-i*.16],p.edge);
for(let x of [-1.12,1.12]){C(.10,.14,2.3,[x,2.55,-.2],p.edge);C(.2,.2,.12,[x,1.48,-.2],p.edge);C(.2,.2,.14,[x,3.7,-.2],p.gold);}
B([2.7,.19,1.4],[0,3.83,-.67],p.edge);B([2.95,.14,1.58],[0,3.98,-.67],p.roof);
// Fountain basin with concentric mouldings, a quiet water surface and a central jet.
const fountain=G(0,1.17,5.1);
C(1.63,1.82,.23,[0,.11,0],p.stone,fountain,32);C(1.58,1.58,.13,[0,.26,0],p.edge,fountain,32);C(1.39,1.39,.025,[0,.34,0],p.water,fountain,48);
C(.39,.54,.23,[0,.42,0],p.edge,fountain);C(.13,.25,1,[0,.96,0],p.edge,fountain);C(.81,.26,.24,[0,1.52,0],p.edge,fountain,24);C(.7,.7,.025,[0,1.65,0],p.water,fountain,32);C(.06,.17,.7,[0,1.97,0],p.edge,fountain);blob(fountain,.17,[0,2.35,0],p.gold);
for(let r of [.9,1.22]){let o=mesh(fountain,new T.TorusGeometry(r,.013,5,64),p.edge,[0,.36,0]);o.rotation.x=Math.PI/2;}
// Parterre hedges, roses, slender cypresses and stone benches.
function hedge(x,z,w,d){B([w+.18,.12,d+.18],[x,1.17,z],p.edge,world,.05);B([w,.48,d],[x,1.43,z],p.hedge,world,.15);}
for(let sign of [-1,1]){
 let cx=sign*5.65;
 for(let z of [3.05,8.6])hedge(cx,z,4.5,.42);for(let x of [cx-2.05,cx+2.05])hedge(x,5.83,.4,5.2);
 for(let z of [4.25,7.25]){B([2.8,.08,.9],[cx,1.14,z],p.dark,world,.12);for(let j=0;j<12;j++){let x=cx+rand(-1.25,1.25),zz=z+rand(-.3,.3);beam(world,[x,1.2,zz],[x,1.68,zz],.024,p.hedge);blob(world,.17,[x,1.57,zz],p.leaf,[1,.7,1]);blob(world,.11,[x,1.78,zz],j%3?p.rose:p.pink);}}
 B([2.2,.16,.62],[cx,1.72,5.78],p.edge);for(let x of [-.73,.73])B([.2,.54,.49],[cx+x,1.43,5.78],p.stone);B([2.2,.54,.13],[cx,2.02,5.49],p.edge);
}
function cypress(x,z,h){C(.09,.14,.8,[x,1.5,z],p.wood);for(let i=0;i<4;i++)blob(world,.63*(1-i*.16),[x,1.7+h*i*.22,z],i%2?p.hedge:p.leaf,[1,h*.52,1]);C(.67,.8,.28,[x,1.25,z],p.stone);}
for(let x of [-9.65,9.65])for(let z of [-8.55,-2.7,3.7,8.5])cypress(x,z,z<0?2.65:1.9);
for(let x of [-4.8,0,4.8])cypress(x,-9.05,2.15);
// Masonry enclosure and wrought-iron rails; the opening frames the main axis.
function fence(x,z,length,angle=0){let g=G(x,1.12,z,angle);B([length,.55,.30],[0,.275,0],p.wall,g);B([length+.03,.1,.41],[0,.58,0],p.edge,g);for(let y of [.87,1.57])B([length,.055,.06],[0,y,0],p.metal,g);for(let xx=-length/2+.15;xx<length/2;xx+=.29){B([.037,1.14,.037],[xx,1.2,0],p.metal,g);C(0,.076,.17,[xx,1.84,0],p.gold,g,4);}}
fence(0,-10.65,21.3);fence(-10.65,0,21.3,Math.PI/2);fence(10.65,0,21.3,Math.PI/2);fence(-6.35,10.65,8.6);fence(6.35,10.65,8.6);
for(let x of [-10.65,-2.05,2.05,10.65]){B([.63,1.65,.63],[x,1.94,10.65],p.wall);B([.8,.16,.8],[x,2.8,10.65],p.edge);C(0,.39,.4,[x,3.08,10.65],p.roof,world,4).rotation.y=Math.PI/4;}
for(let sign of [-1,1]){let gate=G(sign*2.03,1.14,10.65,-sign*.23);let w=1.96;for(let y of [.2,1.1,1.8])B([w,.06,.065],[-sign*w/2,y,0],p.metal,gate);for(let i=0;i<8;i++){let xx=-sign*(i+.4)*w/8,hh=1.8+.43*Math.sin((i+.4)/8*Math.PI/2);B([.045,hh,.045],[xx,hh/2,0],p.metal,gate);C(0,.08,.15,[xx,hh+.07,0],p.gold,gate,4);}let circle=mesh(gate,new T.TorusGeometry(.34,.035,6,32),p.gold,[-sign*w/2,1.1,.045]);}
// Amber lamps create scale cues without expensive point-light shadows.
for(let x of [-2.2,2.2])for(let z of [2.25,8.15]){C(.095,.16,1.72,[x,1.98,z],p.metal);B([.31,.43,.31],[x,3.02,z],p.glass);for(let sx of [-1,1])for(let sz of [-1,1])B([.035,.49,.035],[x+sx*.15,3.02,z+sz*.15],p.metal);C(0,.29,.26,[x,3.39,z],p.roof,world,4).rotation.y=Math.PI/4;B([.39,.08,.39],[x,2.77,z],p.metal);}

batchStatic(world);
return world;
}
