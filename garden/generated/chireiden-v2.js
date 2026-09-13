// Generated from chireiden-v2/scene.js by build-models.py. Edit the original model to update.
import * as T from 'three';
import {palette,box,cylinder,blob,beam,mesh,batchStatic,seededRandom} from './chireiden-v2-geometry.js';
export function createModel() {
const g=new T.Group();
const p=palette({wall:'#b4a083',light:'#d3bea0',shade:'#8e7f6b',joint:'#9c8b73',roof:'#3c514e',roof2:'#455a54',seam:'#69736a',dark:'#292f33',door:'#4e4544',metal:'#a58b63',rock:'#41434b',rock2:'#55545b',paving:'#8b8579'});
const glass=['#a95374','#578e93','#a88b50','#706ca0'].map(color=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.24,roughness:.55}));
const rand=seededRandom(20260913);
const b=(s,v,m=p.wall,parent=g)=>box(parent,s,v,m);
const line=(a,c,r=.035,m=p.light,parent=g)=>beam(parent,a,c,r,m);
function group(x=0,z=0,rot=0){const q=new T.Group();q.position.set(x,0,z);q.rotation.y=rot;g.add(q);return q;}
function ring(q,r,t,x,y,z,m=p.light){return mesh(q,new T.TorusGeometry(r,t,6,64),m,[x,y,z]);}
function shapeArch(w,h){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h*.61);s.quadraticCurveTo(w*.46,h*.84,0,h);s.quadraticCurveTo(-w*.46,h*.84,-w/2,h*.61);s.closePath();return s;}
function arch(q,x,y,z,w,h,mat=p.dark,frame=.075){mesh(q,new T.ShapeGeometry(shapeArch(w,h)),mat,[x,y,z]);const pts=shapeArch(w,h).getPoints(22);for(let i=1;i<pts.length;i++)line([x+pts[i-1].x,y+pts[i-1].y,z+.035],[x+pts[i].x,y+pts[i].y,z+.035],frame,p.light,q);}
function windowUnit(q,x,y,z,w=.7,h=2){arch(q,x,y,z,w+.15,h+.15,p.shade,.055);arch(q,x,y+.07,z+.018,w,h,glass[1],.045);line([x,y+.07,z+.06],[x,y+h,z+.06],.027,p.light,q);for(let i=1;i<4;i++)b([w,.035,.05],[x,y+.07+i*h*.2,z+.055],p.metal,q);b([w+.32,.13,.23],[x,y-.025,z+.05],p.light,q);}
function rose(q,y,z,r=1){mesh(q,new T.CircleGeometry(r,64),p.dark,[0,y,z]);ring(q,r+.13,.1,0,y,z+.06);ring(q,r,.045,0,y,z+.1,p.metal);ring(q,r*.3,.047,0,y,z+.13);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const s=new T.Shape();s.moveTo(Math.cos(a-.2)*r*.33,Math.sin(a-.2)*r*.33);s.lineTo(Math.cos(a-.22)*r*.8,Math.sin(a-.22)*r*.8);s.quadraticCurveTo(Math.cos(a)*r*1.02,Math.sin(a)*r*1.02,Math.cos(a+.22)*r*.8,Math.sin(a+.22)*r*.8);s.lineTo(Math.cos(a+.2)*r*.33,Math.sin(a+.2)*r*.33);s.closePath();mesh(q,new T.ShapeGeometry(s),glass[i%4],[0,y,z+.09]);line([Math.cos(a+.26)*r*.3,y+Math.sin(a+.26)*r*.3,z+.13],[Math.cos(a+.26)*r*.97,y+Math.sin(a+.26)*r*.97,z+.13],.025,p.light,q);}
 mesh(q,new T.CircleGeometry(r*.23,24),glass[0],[0,y,z+.14]);}
// Solid extruded gables: closed ends, continuous ridge, no dollhouse cuts.
function gable(q,w,d,eave,rise,z=0,mat=p.roof){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,rise);s.closePath();mesh(q,new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,steps:1}),mat,[0,eave,z-d/2]);
 for(const end of [-1,1]){const cap=mesh(q,new T.ShapeGeometry(s),p.wall,[0,eave,z+end*(d/2+.006)]);if(end<0)cap.rotation.y=Math.PI;}
 for(const side of [-1,1]){b([.16,.18,d+.18],[side*w/2,eave,z],p.shade,q);for(let zz=z-d/2;zz<=z+d/2+.001;zz+=.65)line([0,eave+rise+.025,zz],[side*w/2,eave+.035,zz],.025,p.seam,q);
 for(let k=1;k<12;k++){const t=k/12;line([side*w*.5*t,eave+rise*(1-t)+.025,z-d/2],[side*w*.5*t,eave+rise*(1-t)+.025,z+d/2],.012,p.roof2,q);}}
 b([.16,.16,d+.24],[0,eave+rise+.04,z],p.seam,q);for(const zz of [z-d/2-.015,z+d/2+.015])for(const side of [-1,1])line([side*w/2,eave,zz],[0,eave+rise,zz],.075,p.shade,q);}
// Narrow layered stone platform and subdued subterranean rock strata.
b([11.7,.33,25.8],[0,-.22,-2.4],p.dark);b([11.45,.62,25.5],[0,.24,-2.4],p.rock);b([11.75,.17,25.75],[0,.64,-2.4],p.shade);b([11.5,.18,25.5],[0,.81,-2.4],p.paving);
for(const side of [-1,1])for(let i=0;i<23;i++){b([.16,.25,1.06],[side*5.72,.36,-14.45+i*1.1],i%3?p.rock2:p.rock);}
for(let i=0;i<38;i++){const side=i%2?1:-1;blob(g,rand(.18,.43),[side*rand(5.05,5.46),1,-14+rand(0,23)],p.rock,[.7,.6,1.25]);}
for(let z=-14.4;z<10;z+=.82)for(let x=-5.1;x<5.3;x+=.85)b([.81,.027,.78],[x,.913,z],rand()>.72?p.shade:p.paving);
// Raised foundations, tall central nave and low closed side aisles.
b([8.6,.4,20.7],[0,1.12,-2.5],p.shade);b([8.35,.19,20.45],[0,1.4,-2.5],p.light);
b([5.65,6.1,19.8],[0,4.5,-2.5]);b([8,3.7,19.8],[0,3.3,-2.5]);
gable(g,6.15,20.2,7.55,4.3,-2.5); // 54-degree dominant roof
// Lower aisle roofs, tucked into clerestory.
for(const side of [-1,1]){const q=group(side*3.34,-2.5);const s=new T.Shape();s.moveTo(-.8,0);s.lineTo(.8,0);s.lineTo(-side*.8,1.25);s.closePath();mesh(q,new T.ExtrudeGeometry(s,{depth:19.95,bevelEnabled:false}),p.roof,[0,5.14,-9.975]);for(let z=-9.9;z<10;z+=.65)line([-side*.8,6.42,z],[side*.8,5.16,z],.025,p.seam,q);}
for(const y of [1.65,3.15,5.1,7.35])b([5.83,.12,20.02],[0,y,-2.5],p.light);
// Short rear transept, subordinate to the longitudinal roof.
b([10.1,4.7,3.5],[0,3.8,-7.7]);const tran=group(0,-7.7,Math.PI/2);gable(tran,3.85,10.5,6.15,2.7);
for(const side of [-1,1]){
 const end=group(side*5.06,-7.7,side*Math.PI/2);windowUnit(end,0,2.2,.015,1.5,3.1);b([3.55,.17,.23],[0,6.1,.02],p.light,end);for(const x of [-1.6,1.6])b([.23,4.6,.3],[x,3.75,0],p.light,end);
 for(const z of [5.7,3.15,.6,-1.95,-4.5,-10.5]){
  const face=group(side*4.015,z,side*Math.PI/2);windowUnit(face,0,1.95,.015,.95,2.5);
  const upper=group(side*2.836,z,side*Math.PI/2);windowUnit(upper,0,5.65,.015,.64,1.3);
 }
 for(const z of [6.95,4.42,1.87,-.68,-3.23,-5.75,-9.65,-12.3]){
  b([.57,.25,.66],[side*4.25,1.57,z],p.light);b([.42,3.5,.43],[side*4.22,3.3,z],p.shade);b([.49,.16,.55],[side*4.22,4.98,z],p.light);
  line([side*4.23,4.97,z],[side*2.95,6.55,z],.15,p.light);b([.19,1.22,.26],[side*2.98,6.8,z],p.light);
 }
}
// Front wall: two square belfries flank rose and pointed entry.
const front=group(0,7.52);b([3.5,6.55,.28],[0,4.65,0],p.wall,front);
const ped=new T.Shape();ped.moveTo(-1.8,0);ped.lineTo(1.8,0);ped.lineTo(0,2.1);ped.closePath();mesh(front,new T.ExtrudeGeometry(ped,{depth:.27,bevelEnabled:false}),p.light,[0,7.9,-.12]);
for(const side of [-1,1])line([side*1.87,7.9,.19],[0,10.08,.19],.1,p.shade,front);
rose(front,6.65,.18,1.02);b([3.55,.2,.45],[0,5.14,.16],p.light,front);
arch(front,0,1.51,.18,2.28,3.25,p.shade,.12);arch(front,0,1.53,.22,1.91,2.97,p.dark,.075);arch(front,0,1.54,.25,1.65,2.65,p.door,.055);
for(let x=-.7;x<.8;x+=.175)b([.025,1.9,.035],[x,2.52,.28],p.shade,front);for(const x of [-.43,.43]){b([.55,.065,.05],[x,2.2,.31],p.metal,front);b([.55,.065,.05],[x,3.04,.31],p.metal,front);ring(front,.055,.018,x*.4,2.55,.35,p.metal);}
for(let i=0;i<4;i++)b([3.25+i*.35,.15,.62],[0,1.4-i*.15,7.85+i*.43],p.light);
function tower(x){const z=6.47;b([2.1,8.55,2.5],[x,5.74,z]);
 for(const y of [1.6,3.45,6.02,8.48,9.92,10.12])b([2.33,.15,2.72],[x,y,z],p.light);
 for(const dx of [-.92,.92])for(const dz of [-1.13,1.13]){b([.2,8.5,.2],[x+dx,5.72,z+dz],p.light);for(let y=1.9;y<9.8;y+=.48)b([.28,.095,.28],[x+dx,y,z+dz],p.shade);}
 for(const side of [0,1,2,3]){const angle=side*Math.PI/2;const q=group(x+Math.sin(angle)*1.06,z+Math.cos(angle)*1.26,angle);for(const xx of [-.43,.43]){windowUnit(q,xx,6.48,.02,.5,1.53);windowUnit(q,xx,8.75,.02,.46,.92);}windowUnit(q,0,3.87,.02,.72,1.64);}
 const q=group(x,z);b([2.4,.22,2.78],[0,10.29,0],p.shade,q);
 // Steep square spire, slate horizontal courses and four crisp hips.
 const pyr=mesh(q,new T.ConeGeometry(1.83,3.45,4),p.roof,[0,12.1,0]);pyr.rotation.y=Math.PI/4;pyr.scale.z=1.16;
 for(let i=1;i<13;i++){const t=i/14,y=10.38+3.45*t,w=2.58*(1-t);for(const side of [-1,1]){line([-w/2,y,side*w*.58],[w/2,y,side*w*.58],.018,p.seam,q);line([side*w/2,y,-w*.58],[side*w/2,y,w*.58],.018,p.seam,q);}}
 for(const dx of [-1,1])for(const dz of [-1,1])line([dx*1.29,10.39,dz*1.49],[0,13.85,0],.035,p.seam,q);
 // Small dormer on the front spire face, no cross or religious finial.
 b([.65,.6,.28],[0,10.95,1.19],p.wall,q);windowUnit(q,0,10.72,1.35,.28,.49);const dorm=new T.Group();dorm.position.z=1.2;q.add(dorm);gable(dorm,.83,.48,11.25,.59);
}
tower(-2.9);tower(2.9);
// Complete rear gable, buttresses, triple lancets and restrained circular tracery.
const rear=group(0,-12.52,Math.PI);b([5.75,.17,.28],[0,7.5,0],p.light,rear);for(const x of [-1.8,0,1.8])windowUnit(rear,x,2.25,.015,1,3.65);rose(rear,8.56,.045,.7);
for(const x of [-3.65,3.65]){b([.43,4.1,.6],[x,3.6,.12],p.shade,rear);b([.55,.16,.72],[x,5.65,.12],p.light,rear);}
// Sparse masonry joints give scale without turning the walls into noisy grids.
for(const side of [-1,1])for(let y=1.88;y<5;y+=.43){for(let z=-12.2;z<7.15;z+=.92){if(z>-9.55&&z<-5.7)continue;b([.015,.018,.83],[side*4.022,y,z],p.joint);b([.017,.34,.014],[side*4.024,y+.17,z+(Math.round(y*10)%2)*.35],p.joint);}}

batchStatic(g);
return g;
}
