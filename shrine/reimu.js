import * as T from 'three';
// Six restrained poses: narrow sweep pair, idle, three walking steps.
export async function createReimu(scene,camera,groundMeshes){
 const W=256,H=256,N=6,atlas=document.createElement('canvas');atlas.width=W*N;atlas.height=H;
 const source=new Image();source.src=new URL('./assets/reimu-walk-atlas.png',import.meta.url).href;await source.decode();atlas.getContext('2d').drawImage(source,0,0);
 const tex=new T.CanvasTexture(atlas);tex.magFilter=tex.minFilter=T.NearestFilter;tex.generateMipmaps=false;tex.colorSpace=T.SRGBColorSpace;tex.repeat.set(1/N,1);
 const mat=new T.MeshLambertMaterial({map:tex,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:.12,transparent:true,alphaTest:.12,side:T.DoubleSide,depthWrite:true});
 const pivot=new T.Group();scene.add(pivot);const actor=new T.Mesh(new T.PlaneGeometry(2.5,2.5),mat);actor.position.y=1.25;actor.receiveShadow=true;pivot.add(actor);
 // A separately blurred alpha silhouette remains on the floor during walking.
 const sc=document.createElement('canvas');sc.width=W*N;sc.height=H;const sx=sc.getContext('2d');sx.filter='blur(6px)';sx.drawImage(atlas,0,0);sx.filter='none';sx.globalCompositeOperation='source-in';sx.fillStyle='#564f48';sx.fillRect(0,0,sc.width,sc.height);
 const st=new T.CanvasTexture(sc);st.repeat.set(1/N,1);st.minFilter=st.magFilter=T.LinearFilter;st.generateMipmaps=false;
 const sm=new T.MeshBasicMaterial({map:st,transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
 const shadow=new T.Mesh(new T.PlaneGeometry(2.5,1.2),sm);shadow.rotation.x=-Math.PI/2;scene.add(shadow);
 const ray=new T.Raycaster(),groundCache=new Map();function ground(x,z){const key=Math.round(x*40)+':'+Math.round(z*40);if(groundCache.has(key))return groundCache.get(key);ray.set(new T.Vector3(x,1.65,z),new T.Vector3(0,-1,0));const y=ray.intersectObjects(groundMeshes,false).find(hit=>hit.point.y>=.89&&hit.point.y<1.42)?.point.y??.91;groundCache.set(key,y);return y;}
 const spots=[[-.6,7.4],[.65,7.3],[1.0,5.7],[-.2,5.2],[-1.0,6.4]];
 const petals=[],pm=[new T.MeshLambertMaterial({color:'#d59aa5',side:T.DoubleSide}),new T.MeshLambertMaterial({color:'#c3a471',side:T.DoubleSide})];
 let seed=73;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const [x,z] of spots)for(let i=0;i<13;i++){let xx=x+(random()-.5)*1.25,zz=z+(random()-.5)*.8;let m=new T.Mesh(new T.CircleGeometry(.045+random()*.025,5),pm[i%2]);m.rotation.x=-Math.PI/2;m.rotation.z=random()*6.28;m.position.set(xx,ground(xx,zz)+.014,zz);scene.add(m);petals.push({mesh:m,vx:0,vz:0,moved:0});}
 const duration=13;let pushed=0,lastT=0,lastCycle=-1,lastFrame=-1,facing=1;const state={phase:'sweep',cycle:0,frame:0,facing:1,ground:1,height:0,pushed:0,position:[0,0,0]};
 const smooth=t=>t*t*(3-2*t);
 function update(t,dt=0){
 const cycle=Math.floor(t/duration),q=t%duration,from=spots[cycle%spots.length],to=spots[(cycle+1)%spots.length];
 let x=from[0],z=from[1],h=0,squash=1,frame=0,phase='sweep';
 if(q<8){frame=q%2<1?0:1;}
 else if(q<9){phase='pause';frame=2;}
 else if(q<12){phase='walk';const u=(q-9)/3;x=from[0]+(to[0]-from[0])*smooth(u);z=from[1]+(to[1]-from[1])*smooth(u);frame=[4,3,4,5][Math.floor(Math.hypot(to[0]-from[0],to[1]-from[1])*smooth(u)/.14)%4];}
 else{x=to[0];z=to[1];phase='rest';frame=2;}
 // Face the travel direction in the camera's horizontal basis, never by cycle parity.
 const yaw=Math.atan2(camera.position.x-x,camera.position.z-z),dx=to[0]-from[0],dz=to[1]-from[1];
 const projected=dx*Math.cos(yaw)-dz*Math.sin(yaw);
 if((q>=8.65&&q<12)&&Math.abs(projected)>.08)facing=projected>0?1:-1;
 const direction=facing;
 const rxFoot=Math.cos(yaw),rzFoot=-Math.sin(yaw);let gy=ground(x,z);for(const offset of [-.28,0,.28])for(const depth of [-.08,.08])gy=Math.max(gy,ground(x+rxFoot*offset+Math.sin(yaw)*depth,z+rzFoot*offset+Math.cos(yaw)*depth));pivot.position.set(x,gy+h-.059,z);pivot.rotation.y=Math.atan2(camera.position.x-x,camera.position.z-z);actor.scale.set(direction,squash,1);actor.position.y=1.25*squash; // bottom pivot remains fixed
 const breathing=Math.sin(t*1.9)*.003;actor.scale.y+=breathing;actor.position.y+=1.25*breathing;
 tex.offset.x=frame/N;st.offset.x=frame/N;const sf=1+h*.8;shadow.position.set(x+.14,gy+.022,z-.22);shadow.scale.set(direction*sf,sf,1);shadow.rotation.z=-pivot.rotation.y;sm.opacity=.24*(1-h/.9);
 // Once per low-framerate stroke, nearby loose petals receive a small physical impulse.
 if(phase==='sweep'&&(cycle!==lastCycle||frame!==lastFrame)&&dt>0&&dt<.2){const rx=Math.cos(pivot.rotation.y),rz=-Math.sin(pivot.rotation.y),pushDir=direction*(frame===1?1:-1),reach=direction*(frame===1?.48:.37),bx=x+rx*reach,bz=z+rz*reach;for(const leaf of petals){const p=leaf.mesh.position;if(Math.hypot(p.x-bx,p.z-bz)<.30){leaf.vx+=rx*pushDir*.07;leaf.vz+=rz*pushDir*.07+.008;leaf.moved++;pushed++;}}}
 for(const leaf of petals){leaf.mesh.position.x=T.MathUtils.clamp(leaf.mesh.position.x+leaf.vx*dt,-1.95,1.95);leaf.mesh.position.z=T.MathUtils.clamp(leaf.mesh.position.z+leaf.vz*dt,4.1,8);leaf.mesh.position.y=ground(leaf.mesh.position.x,leaf.mesh.position.z)+.014;leaf.vx*=Math.exp(-dt*4);leaf.vz*=Math.exp(-dt*4);}
 lastCycle=cycle;lastFrame=frame;lastT=t;Object.assign(state,{phase,cycle,frame,facing:direction,ground:gy,height:h,pushed,position:pivot.position.toArray(),shadowY:shadow.position.y,shadowOpacity:sm.opacity,shadowScale:sf,travelProjection:projected});}
 update(0,0);
 return {update,state,atlas,pivot,actor,shadow,ground,petals,get time(){return lastT;}};
}
