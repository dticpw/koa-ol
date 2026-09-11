import * as THREE from 'three';
import {createRuntime} from './lib/runtime.js';
import {palette,box,cylinder,beam,mesh,batchStatic,seededRandom} from './lib/geometry.js';
const embedded=new URLSearchParams(location.search).has('embed');
const canvas=document.querySelector('canvas');
const tell=type=>{if(parent!==window)parent.postMessage({type},location.origin);};
try {
const rt=createRuntime({canvas,background:'#eee8ef',embedded});
const model=new THREE.Group();rt.scene.add(model);
const p=palette({base:'#413849',edge:'#796077',floor:'#a58c7d',tile:'#b69b87',wood:'#533730',trim:'#986746',dark:'#302a36',gold:'#c6a367',paper:'#e4d5ad',rug:'#674c79',red:'#954b5d',blue:'#536981',green:'#61776d',purple:'#82668e',stone:'#a197a8'});
const rand=seededRandom(495);
box(model,[13.3,.55,10.3],[0,0,0],p.base,.12);
box(model,[13.5,.12,10.5],[0,.29,0],p.edge,.06);
box(model,[13,.18,10],[0,.43,0],p.floor);
for(let x=-6;x<=6;x++)for(let z=-4.5;z<=4.5;z++)box(model,[.96,.025,.96],[x,.535,z],(Math.round(x+z+.5)%2)?p.floor:p.tile);
box(model,[4.9,.04,7.4],[.6,.56,.5],p.gold);
box(model,[4.72,.045,7.2],[.6,.59,.5],p.rug);
for(const z of [-2.9,3.9])for(let i=0;i<9;i++)box(model,[.018,.012,.2],[-1.55+i*.54,.62,z],p.gold);
function shelf(x,z,width=3.3,angle=0,height=5.6){
 const g=new THREE.Group();g.position.set(x,.55,z);g.rotation.y=angle;model.add(g);
 box(g,[width,height,.22],[0,height/2,-.4],p.wood);
 for(const xx of [-width/2+.2,0,width/2-.2])box(g,[.075,height-.3,.045],[xx,height/2,-.533],p.trim);
 for(const yy of [.28,height/2,height-.22])box(g,[width-.3,.075,.045],[0,yy,-.533],p.trim);
 for(const xx of [-width/2,width/2]){box(g,[.17,height,.85],[xx,height/2,0],p.trim);box(g,[.29,.25,1],[xx,.12,0],p.wood);}
 box(g,[width+.42,.22,1.03],[0,height,0],p.trim);
 box(g,[width+.18,.13,.98],[0,height+.17,0],p.gold);
 for(let row=0;row<Math.floor(height/1.05);row++){
  const y=.18+row*1.05;box(g,[width,.12,.9],[0,y,0],p.trim);
  let xx=-width/2+.15;
  while(xx<width/2-.22){const w=rand(.12,.23),h=rand(.58,.89),mat=[p.red,p.blue,p.green,p.purple,p.wood][Math.floor(rand(0,5))];
   box(g,[w,h,.48],[xx+w/2,y+.06+h/2,.10],mat);
   for(const yy of [.14,h-.13])box(g,[w*.82,.025,.012],[xx+w/2,y+.06+yy,.348],p.gold);
   xx+=w+.035;
  }
 }
}
shelf(-4.55,-4.35,3.15);shelf(4.55,-4.35,3.15);
shelf(-6,-1.5,3.45,Math.PI/2,5.3);shelf(-6,2.22,3.45,Math.PI/2,4.35);
// Open architectural cutaway: arched glazing remains visible from both sides.
const glass=new THREE.MeshBasicMaterial({color:'#b3a0cf',side:THREE.DoubleSide});
const shape=new THREE.Shape();shape.moveTo(-1.48,0);shape.lineTo(1.48,0);shape.lineTo(1.48,3.45);shape.absarc(0,3.45,1.48,0,Math.PI,false);shape.lineTo(-1.48,0);
mesh(model,new THREE.ShapeGeometry(shape),glass,[0,1.05,-4.72]);
for(const x of [-1.66,1.66]){box(model,[.27,4.28,.5],[x,2.65,-4.7],p.stone);box(model,[.46,.22,.68],[x,.67,-4.7],p.trim);}
for(let i=0;i<24;i++){const a=i*Math.PI/24,b=(i+1)*Math.PI/24;beam(model,[1.65*Math.cos(a),4.5+1.65*Math.sin(a),-4.7],[1.65*Math.cos(b),4.5+1.65*Math.sin(b),-4.7],.14,p.stone);}
box(model,[.065,4.75,.12],[0,3.35,-4.53],p.gold);
box(model,[2.94,.07,.12],[0,3.5,-4.53],p.gold);
box(model,[3.55,.2,.75],[0,.95,-4.65],p.trim);
// Crescent emblem in the arched window.
const crescent=new THREE.Shape();crescent.absarc(0,0,.46,.5,Math.PI*2-.5,false);crescent.absarc(.20,0,.37,Math.PI*2-.3,.3,true);
mesh(model,new THREE.ShapeGeometry(crescent),p.gold,[0,4.85,-4.5]);
function book(x,y,z,w=.55,mat=p.red,rot=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;model.add(g);box(g,[w,.13,.72],[0,.065,0],p.paper);for(const yy of [0,.14])box(g,[w+.035,.03,.76],[0,yy,0],mat);box(g,[.035,.16,.76],[-w/2,.065,0],mat);}
// Reading desk, chair and an open grimoire.
box(model,[3.7,.23,1.65],[.6,1.83,.5],p.wood,.05);
box(model,[3.8,.065,1.73],[.6,1.97,.5],p.trim,.04);
for(const x of [-.92,2.12])for(const z of [-.08,1.08]){box(model,[.16,1.18,.16],[x,1.15,z],p.wood);box(model,[.24,.12,.24],[x,.62,z],p.gold);}
for(const x of [.15,.75]){const page=box(model,[.6,.095,.83],[x,2.08,.51],p.paper);page.rotation.z=x<.5?-.12:.12;for(let i=0;i<5;i++)box(model,[.42,.012,.012],[x,2.14,.26+i*.1],p.trim);}
book(1.8,2.03,.6,.52,p.purple,.12);
box(model,[1.05,.2,1.0],[.6,1.15,-1.12],p.wood);box(model,[.91,.11,.88],[.6,1.3,-1.12],p.rug);
for(const x of [.17,1.03])for(const z of [-1.52,-.72])box(model,[.11,.65,.11],[x,.87,z],p.wood);
box(model,[1.03,1.38,.14],[.6,1.92,-1.59],p.wood,.08);box(model,[.8,1.12,.06],[.6,1.96,-1.49],p.rug,.06);
function candle(x,y,z){cylinder(model,.17,.24,.10,[x,y+.05,z],p.gold);cylinder(model,.048,.07,.34,[x,y+.24,z],p.gold);cylinder(model,.075,.075,.32,[x,y+.57,z],p.paper);const flame=mesh(model,new THREE.SphereGeometry(.085,7,6),new THREE.MeshBasicMaterial({color:'#ffd58c'}),[x,y+.79,z]);flame.scale.y=1.65;}
candle(-.8,2.02,.36);candle(4.6,.55,2.9);
// Shelf ladder and deliberately sparse foreground stacks.
for(const x of [-5.24,-4.56])beam(model,[x,.58,.35],[x,4.76,-.8],.065,p.trim);
for(let i=0;i<10;i++){const t=i/10;beam(model,[-5.24,.76+3.8*t,.3-1.05*t],[-4.56,.76+3.8*t,.3-1.05*t],.05,p.gold);}
for(let i=0;i<4;i++)book(3.7,.57+i*.18,2.45,.77,[p.purple,p.green,p.red,p.blue][i],i*.13);
for(let i=0;i<3;i++)book(-3.3,.57+i*.18,3.45,.7,[p.red,p.purple,p.blue][i],-.2+i*.1);
// Brass armillary globe on its own pedestal.
cylinder(model,.35,.5,.17,[4.55,.65,.55],p.wood);cylinder(model,.10,.15,.85,[4.55,1.13,.55],p.gold);
const orb=new THREE.Group();orb.position.set(4.55,1.98,.55);model.add(orb);
mesh(orb,new THREE.SphereGeometry(.40,16,12),p.blue);
for(const tilt of [-.45,.75]){const ring=mesh(orb,new THREE.TorusGeometry(.6,.035,6,48),p.gold);ring.rotation.x=tilt;ring.rotation.y=.5;}
const before=new THREE.Box3().setFromObject(model);const batching=batchStatic(model);const after=new THREE.Box3().setFromObject(model);
rt.camera.position.set(20,18,27);rt.fit(model);
window.libraryScene={runtime:rt,model,batching,boundsError:before.min.distanceTo(after.min)+before.max.distanceTo(after.max)};
const visibility=e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='library-visibility')rt.setVisible(e.data.visible);};
window.addEventListener('message',visibility);
canvas.addEventListener('webglcontextlost',()=>tell('library-unavailable'));
canvas.addEventListener('webglcontextrestored',()=>requestAnimationFrame(()=>tell('library-ready')));
window.addEventListener('pagehide',e=>{if(!e.persisted){window.removeEventListener('message',visibility);rt.dispose();}});
requestAnimationFrame(()=>{document.body.classList.add('ready');tell('library-ready');});
} catch(error){tell('library-unavailable');document.body.classList.add('unavailable');console.error(error);}
