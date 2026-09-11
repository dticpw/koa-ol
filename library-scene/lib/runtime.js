import * as THREE from 'three';
import { OrbitControls } from '../../shrine/vendor/OrbitControls.js';

/** Standalone or container-sized viewer. Call fit(model) after building geometry. */
export function createRuntime({canvas, background='#eee9df', embedded=false, onFrame=()=>{}}) {
  const host = canvas.parentElement;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias:true,alpha:embedded}); }
  catch (error) {
    const notice=document.createElement('p');
    notice.textContent='三维场景需要 WebGL。请开启浏览器硬件加速，或查看提供的静态预览。';
    notice.setAttribute('role','status');host.append(notice);throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.75));
  renderer.setClearColor(background,embedded?0:1);
  if(embedded){document.documentElement.style.background="transparent";document.body.style.background="transparent";}
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-12,12,12,-12,.1,150);
  camera.position.set(24,21,30);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;controls.dampingFactor=.065;
  controls.enablePan=false;controls.enableZoom=!embedded;
  controls.minZoom=.72;controls.maxZoom=3;
  controls.minPolarAngle=.18;controls.maxPolarAngle=Math.PI/2-.035;
  controls.rotateSpeed=.65;controls.target.set(0,2,0);controls.update();
  if(embedded)canvas.style.touchAction='pan-y';
  scene.add(new THREE.HemisphereLight(0xfff9ed,0x8c9f8a,2.25));
  const sun=new THREE.DirectionalLight(0xffeed6,3);
  sun.position.set(-8,26,10);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:65});
  sun.shadow.bias=-.00035;sun.shadow.normalBias=.035;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xc8e2e6,.55);fill.position.set(12,8,-8);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshBasicMaterial({color:background,toneMapped:false}));
  floor.visible=!embedded;floor.rotation.x=-Math.PI/2;floor.position.y=-.51;scene.add(floor);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({color:'#635a4c',opacity:.23}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-.505;shadow.receiveShadow=true;scene.add(shadow);
  let bounds=null,visible=true,hostVisible=true,lost=false,disposed=false,raf=0,previous=0,time=0;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const active=()=>!disposed&&!lost&&visible&&hostVisible&&!document.hidden;
  function tick(now) {
    raf=0;if(!active())return;
    const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;
    if(!motion.matches)time+=dt;
    onFrame({time,dt:motion.matches?0:dt,reducedMotion:motion.matches});
    controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(tick);
  }
  function schedule() {
    if(!active()){cancelAnimationFrame(raf);raf=0;previous=0;return;}
    if(!raf)raf=requestAnimationFrame(tick);
  }
  function resize() {
    if(disposed)return;
    const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight),aspect=w/h;
    let halfW=12,halfH=12;
    if(bounds){
      // Project all eight bounds corners into the chosen camera basis. Add a
      // radial width allowance so the square base still fits while orbiting.
      camera.updateMatrixWorld();halfW=0;halfH=0;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        const p=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
        halfW=Math.max(halfW,Math.abs(p.x));halfH=Math.max(halfH,Math.abs(p.y));
      }
      const size=bounds.getSize(new THREE.Vector3());halfW=Math.max(halfW,Math.hypot(size.x,size.z)/2);
    }
    const span=Math.max(halfH,halfW/aspect)*1.12;
    camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;
    camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    if(!lost)renderer.render(scene,camera);
    schedule();
  }
  function fit(model){
    bounds=new THREE.Box3().setFromObject(model);
    if(bounds.isEmpty())throw new Error('Cannot fit an empty model');
    const center=bounds.getCenter(new THREE.Vector3());
    const view=camera.position.clone().sub(controls.target);
    controls.target.copy(center);camera.position.copy(center).add(view);controls.update();
    floor.position.y=bounds.min.y-.02;shadow.position.y=bounds.min.y-.015;
    sun.target.position.copy(center);scene.add(sun.target);
    const size=bounds.getSize(new THREE.Vector3()).length();
    const radius=Math.max(12,size*.7);
    Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius});sun.shadow.camera.updateProjectionMatrix();
    controls.saveState();resize();
  }
  function reset(){controls.enableDamping=false;controls.update();controls.reset();controls.enableDamping=true;resize();}
  function key(e){
    if(e.key==='Home'){reset();e.preventDefault();return;}
    if(!embedded&&['+','=','-','_'].includes(e.key)){
      camera.zoom=THREE.MathUtils.clamp(camera.zoom*(['-','_'].includes(e.key)?.88:1.12),controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();e.preventDefault();
    }
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if(e.key==='ArrowLeft')s.theta-=.11;if(e.key==='ArrowRight')s.theta+=.11;
      if(e.key==='ArrowUp')s.phi-=.08;if(e.key==='ArrowDown')s.phi+=.08;
      s.phi=THREE.MathUtils.clamp(s.phi,controls.minPolarAngle,controls.maxPolarAngle);
      camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(controls.target));controls.update();e.preventDefault();
    }
  }
  const ro=new ResizeObserver(resize);ro.observe(host);
  const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();});io.observe(canvas);
  const contextLost=e=>{e.preventDefault();lost=true;schedule();};
  const contextRestored=()=>{lost=false;resize();schedule();};
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
  canvas.addEventListener('keydown',key);document.addEventListener('visibilitychange',schedule);
  motion.addEventListener('change',schedule);resize();
  function dispose(){
    disposed=true;cancelAnimationFrame(raf);controls.dispose();ro.disconnect();io.disconnect();
    canvas.removeEventListener('keydown',key);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);
    document.removeEventListener('visibilitychange',schedule);motion.removeEventListener('change',schedule);
    const resources=new Set();
    scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:o.material?[o.material]:[])){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});
    resources.forEach(r=>r.dispose());sun.shadow.dispose();renderer.dispose();
  }
  return {scene,camera,controls,renderer,fit,reset,dispose,setVisible(value){hostVisible=!!value;schedule();},get paused(){return !active();}};
}
