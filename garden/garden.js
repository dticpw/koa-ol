import * as THREE from 'three';
import {FIELD,corners,validPlacement,restoreLayout} from './placement.js';

const $=id=>document.getElementById(id),canvas=$('world');
const META=[
 {id:'hakurei-shrine',name:'博丽神社',size:22,x:-31,z:19,angle:.10},
 {id:'scarlet-library',name:'红魔馆图书馆',size:18,x:0,z:21,angle:0},
 {id:'scarlet-mansion',name:'红魔馆',size:24,x:-31,z:-20,angle:.08},
 {id:'eientei',name:'永远亭',size:23,x:31,z:20,angle:-.16},
 {id:'hakugyokurou-v3',name:'白玉楼',size:24,x:31,z:-20,angle:-.12},
 {id:'chireiden-v2',name:'地灵殿',size:24,x:0,z:-22,angle:0}
];
const KEY='koa-ol.garden.layout.v1';
const items=[],history=[],pointers=new Map();
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-70,70,60,-60,.1,650);
let renderer,meadow,selected=null,gesture=null,ready=false,lost=false,disposed=false,frame=0,renderNeeded=true;
let azimuth=.25,zoom=1,target=new THREE.Vector3(),span=128;
const raycaster=new THREE.Raycaster(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const outlineMaterial=new THREE.LineBasicMaterial({color:'#497b51',depthTest:false,transparent:true,opacity:.9});
const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:4},()=>new THREE.Vector3())),outlineMaterial);
outline.renderOrder=10;outline.visible=false;outline.frustumCulled=false;scene.add(outline);

// Non-WebGL navigation and dialogs remain available if rendering fails.
$('reload').onclick=()=>location.reload();
$('help-open').onclick=()=>{$('help').showModal();};
$('help-close').onclick=$('help-done').onclick=()=>$('help').close();
$('reset-layout').onclick=()=>{if(ready)$('reset-dialog').showModal();};
$('reset-cancel').onclick=()=>$('reset-dialog').close();
function status(message,invalid=false){$('status').textContent=message;$('status').classList.toggle('invalid',invalid);}
function snapshot(){return items.map(({id,x,z,angle})=>({id,x,z,angle}));}
function pushHistory(before){if(JSON.stringify(before)===JSON.stringify(snapshot()))return;history.push(before);if(history.length>50)history.shift();$('undo').disabled=false;}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({version:1,items:snapshot()}));$('save-state').textContent='已自动保存 · 仅当前浏览器';}catch{$('save-state').textContent='浏览器不允许保存 · 本次仍可摆放';}}
function apply(item){item.group.position.set(item.x,0,item.z);item.group.rotation.set(0,item.angle,0);item.group.updateMatrixWorld(true);renderNeeded=true;}
function applyRecords(records){for(const item of items){const p=records.find(p=>p.id===item.id);Object.assign(item,{x:p.x,z:p.z,angle:p.angle});apply(item);}updateSelection();}
function outlineAt(item,valid=true){const a=outline.geometry.attributes.position;corners(item).forEach((p,i)=>a.setXYZ(i,p.x,.20,p.z));a.needsUpdate=true;outlineMaterial.color.set(valid?'#497b51':'#ba4936');outline.visible=true;renderNeeded=true;}
function updateSelection(){
  $('selection').hidden=!selected;document.querySelector('.intro').classList.toggle('selected',!!selected);
  for(const button of $('catalog').children)button.setAttribute('aria-pressed',String(button.dataset.id===selected?.id));
  if(!selected){outline.visible=false;renderNeeded=true;return;}
  $('selected-name').textContent=selected.name;$('selected-index').textContent=`0${items.indexOf(selected)+1} / DIORAMA`;
  const degrees=Math.round(selected.angle*180/Math.PI);$('angle').value=degrees;$('angle-value').value=`${degrees}°`;outlineAt(selected);
}
function select(item,announce=true){selected=item;updateSelection();if(item&&announce)status(`已选中${item.name} · 拖动摆放，调整水平朝向`);else if(!item)status('拖动空地环绕，或选择一座模型。');}
function normalize(angle){return Math.atan2(Math.sin(angle),Math.cos(angle));}
function attempt(item,patch,preview=true){
  const candidate={...item,...patch};candidate.angle=normalize(candidate.angle);
  const result=validPlacement(candidate,items);
  if(result.ok){Object.assign(item,patch,{angle:candidate.angle});apply(item);updateSelection();status('位置可用 · 松手即可放下');}
  else {if(preview)outlineAt(candidate,false);status(`${result.reason} · 保留上一个可用位置`,true);}
  return result.ok;
}
function change(patch){if(!selected||!ready||gesture)return;const before=snapshot();if(attempt(selected,patch)){pushHistory(before);persist();}}
$('rotate-left').onclick=()=>selected&&change({angle:selected.angle-Math.PI/12});
$('rotate-right').onclick=()=>selected&&change({angle:selected.angle+Math.PI/12});
let sliderBefore=null;
$('angle').addEventListener('input',()=>{if(!selected)return;sliderBefore??=snapshot();const wanted=Number($('angle').value)*Math.PI/180;attempt(selected,{angle:wanted});$('angle').value=Math.round(selected.angle*180/Math.PI);});
function finishSlider(){if(!sliderBefore)return;pushHistory(sliderBefore);sliderBefore=null;persist();updateSelection();}
$('angle').addEventListener('change',finishSlider);$('angle').addEventListener('blur',finishSlider);
for(const button of document.querySelectorAll('[data-nudge]'))button.onclick=()=>{const [x,z]=button.dataset.nudge.split(',').map(Number);if(selected)change({x:selected.x+x,z:selected.z+z});};
$('deselect').onclick=()=>select(null);
$('undo').onclick=()=>{if(gesture)cancelGesture();const saved=history.pop();if(saved){applyRecords(saved);persist();status('已撤销上一次摆放');}$('undo').disabled=!history.length;};
$('reset-confirm').onclick=()=>{const before=snapshot();applyRecords(META);pushHistory(before);persist();select(null);overview();status('已还原六座模型的初始摆放');$('reset-dialog').close();};

function updateCamera(){
  const size=canvas.getBoundingClientRect(),aspect=size.width/size.height;
  // Fit the entire rectangular field, including at the diagonal, with clear room for the controls.
  span=Math.max(124,145/aspect);
  camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
  camera.zoom=zoom;camera.updateProjectionMatrix();
  const distance=190,polar=.72;
  camera.position.set(target.x+distance*Math.sin(polar)*Math.sin(azimuth),distance*Math.cos(polar),target.z+distance*Math.sin(polar)*Math.cos(azimuth));
  camera.lookAt(target.x,0,target.z);camera.updateMatrixWorld();renderNeeded=true;
}
function overview(){azimuth=.25;zoom=1;target.set(0,0,6);updateCamera();}
function setZoom(value){zoom=THREE.MathUtils.clamp(value,.65,7);updateCamera();}
$('zoom-in').onclick=()=>setZoom(zoom*1.22);$('zoom-out').onclick=()=>setZoom(zoom/1.22);$('overview').onclick=overview;
$('focus-model').onclick=()=>{if(!selected)return;target.set(selected.x,0,selected.z+selected.hz*.3);zoom=canvas.clientWidth<540?Math.min(6,span/56):3.0;updateCamera();status(`近看${selected.name} · 点 ⌂ 返回全景`);};
function pan(dx,dy){const scale=span/(canvas.clientHeight*zoom);target.x-=dx*scale*Math.cos(azimuth);target.z+=dx*scale*Math.sin(azimuth);target.x-=dy*scale*Math.sin(azimuth)/Math.cos(.72);target.z-=dy*scale*Math.cos(azimuth)/Math.cos(.72);target.x=THREE.MathUtils.clamp(target.x,-FIELD.width/2,FIELD.width/2);target.z=THREE.MathUtils.clamp(target.z,-FIELD.depth/2,FIELD.depth/2);updateCamera();}
function ray(e){const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);}
function point(e){ray(e);return raycaster.ray.intersectPlane(ground,new THREE.Vector3());}
function pick(e){ray(e);const hits=raycaster.intersectObjects(items.map(p=>p.group),true);for(const hit of hits){let o=hit.object;while(o&&!o.userData.item)o=o.parent;if(o?.userData.item)return o.userData.item;}return null;}
function pair(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)};}
function cancelGesture(){
  if(gesture?.before)applyRecords(gesture.before);
  gesture=pointers.size?{type:'blocked'}:null;canvas.classList.remove('dragging');updateSelection();status('已取消本次操作');
}
canvas.addEventListener('pointerdown',e=>{
  if(!ready||lost||e.button>2)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){if(gesture?.before)applyRecords(gesture.before);gesture={type:'pinch',...pair()};canvas.classList.remove('dragging');return;}
  if(pointers.size>2){cancelGesture();return;}
  const hit=e.button===0?pick(e):null;
  if(hit){select(hit);const p=point(e);if(!p)return;gesture={type:'drag',id:e.pointerId,before:snapshot(),offset:{x:hit.x-p.x,z:hit.z-p.z},startX:e.clientX,startY:e.clientY,moved:false};}
  else gesture={type:e.button===2||e.button===1||e.shiftKey?'pan':'orbit',id:e.pointerId,x:e.clientX,y:e.clientY};
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(gesture.type==='pinch'&&pointers.size===2){const next=pair();if(gesture.d>1)setZoom(zoom*next.d/gesture.d);pan(next.x-gesture.x,next.y-gesture.y);Object.assign(gesture,next);return;}
  if(e.pointerId!==gesture.id)return;
  if(gesture.type==='drag'){
    if(!gesture.moved&&Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)<4)return;
    gesture.moved=true;const p=point(e);if(p)attempt(selected,{x:p.x+gesture.offset.x,z:p.z+gesture.offset.z});
  }else if(gesture.type==='orbit'){azimuth-=(e.clientX-gesture.x)*.006;updateCamera();gesture.x=e.clientX;gesture.y=e.clientY;}
  else if(gesture.type==='pan'){pan(e.clientX-gesture.x,e.clientY-gesture.y);gesture.x=e.clientX;gesture.y=e.clientY;}
});
function release(e,cancel=false){
  if(!pointers.has(e.pointerId))return;
  if(cancel)cancelGesture();
  else if(gesture?.type==='drag'&&gesture.id===e.pointerId){pushHistory(gesture.before);persist();updateSelection();status(`${selected.name}已放好 · 可继续拖动或旋转`);}
  pointers.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  gesture=pointers.size?{type:'blocked'}:null;canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup',e=>release(e));canvas.addEventListener('pointercancel',e=>release(e,true));
canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))release(e,true);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();if(gesture)return;const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);setZoom(zoom*Math.exp(-THREE.MathUtils.clamp(delta,-150,150)*.0015));},{passive:false});
canvas.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();if(gesture)cancelGesture();else select(null);return;}
  if(e.key==='Home'){e.preventDefault();overview();return;}
  if(['+','=','-','_'].includes(e.key)){e.preventDefault();setZoom(zoom*(e.key==='-'||e.key==='_'?1/1.15:1.15));return;}
  if(!ready||gesture)return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();const step=e.shiftKey?2:.5;
    if(selected)change({x:selected.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),z:selected.z+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)});
    else{azimuth+=(e.key==='ArrowLeft'?-.08:e.key==='ArrowRight'?.08:0);updateCamera();}
  }
  if(selected&&['q','e'].includes(e.key.toLowerCase())){e.preventDefault();change({angle:selected.angle+(e.key.toLowerCase()==='q'?-1:1)*Math.PI/36});}
});
window.addEventListener('blur',()=>{if(gesture)cancelGesture();pointers.clear();gesture=null;});

function fail(error){console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error-text').textContent=lost?'图形连接已中断。可以重新加载草庭；已保存的布局会保留。':'草庭加载失败。请确认网络可用、浏览器已开启硬件加速，然后重新加载。';}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(frame);if(gesture)cancelGesture();fail(new Error('WebGL context lost'));});
canvas.addEventListener('webglcontextrestored',()=>{lost=false;$('error').hidden=true;renderNeeded=true;schedule();});
function render(){frame=0;if(disposed||document.hidden||lost)return;if(renderNeeded&&renderer){renderer.render(scene,camera);renderNeeded=false;}}
function schedule(){if(!frame&&!document.hidden&&!disposed&&!lost)frame=requestAnimationFrame(render);}
// Render on demand: static grass and models require no perpetual GPU work.
function invalidate(){renderNeeded=true;schedule();}
const observer=new ResizeObserver(()=>{if(renderer){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);updateCamera();schedule();}});observer.observe(canvas);
const watchEvents=['pointerdown','pointermove','pointerup','pointercancel','wheel','keydown','click','input','change'];
for(const type of watchEvents)document.addEventListener(type,()=>queueMicrotask(schedule));
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;if(gesture)cancelGesture();pointers.clear();gesture=null;}else invalidate();});
window.addEventListener('pageshow',()=>invalidate());
window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();meadow?.dispose();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});for(const m of materials)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer?.dispose();});

async function boot(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  renderer.setClearColor('#e5e8d8');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight('#fff5e1','#859575',2.0));
  const sun=new THREE.DirectionalLight('#fff1d4',2.8);sun.position.set(-48,90,45);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:220});sun.shadow.normalBias=.12;sun.shadow.bias=-.00012;scene.add(sun);
  const fill=new THREE.DirectionalLight('#d5e4e7',.9);fill.position.set(30,35,-35);scene.add(fill);
  const {createMeadow}=await import('./grass.js');meadow=createMeadow(FIELD);scene.add(meadow.group);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1500,1500),new THREE.MeshBasicMaterial({color:'#e5e8d8'}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.8;scene.add(floor);
  overview();renderer.render(scene,camera);
  for(const [index,meta] of META.entries()){
    $('load-text').textContent=`正在安放${meta.name} · ${index+1} / 6`;
    await new Promise(resolve=>setTimeout(resolve,0));
    const module=await import(`./generated/${meta.id}.js`),model=module.createModel();
    const bounds=new THREE.Box3().setFromObject(model,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const scale=meta.size/Math.max(size.x,size.z);model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale+.005,-center.z*scale);
    const group=new THREE.Group();group.add(model);scene.add(group);
    const item={...meta,hx:size.x*scale/2,hz:size.z*scale/2,group};group.userData.item=item;items.push(item);apply(item);
    const button=document.createElement('button');button.dataset.id=meta.id;button.setAttribute('aria-pressed','false');button.innerHTML=`<span class="model-no">0${index+1}</span><span class="model-name">${meta.name}</span>`;button.onclick=()=>{finishSlider();select(item);};$('catalog').append(button);
  }
  if(!items.every(p=>validPlacement(p,items).ok))throw new Error('Initial layout is not collision-free');
  try{const saved=localStorage.getItem(KEY);if(saved){const restored=restoreLayout(JSON.parse(saved),items);if(restored){applyRecords(restored);status('已恢复你上次摆放的草庭');}else status('旧布局不兼容，已恢复初始摆放');}}catch{$('save-state').textContent='暂时无法读取本机布局';}
  ready=true;$('loading').hidden=true;invalidate();
  // Read-only diagnostics used by browser checks; all mutations go through the UI.
  window.garden={get ready(){return ready;},get paused(){return document.hidden||lost;},get selected(){return selected?.id;},get layout(){return items.map(({id,name,x,z,angle,hx,hz})=>({id,name,x,z,angle,hx,hz}));},get collisions(){return items.filter(p=>!validPlacement(p,items).ok).map(p=>p.id);},get stats(){return {frames:renderer.info.render.frame,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio()};},get view(){return {azimuth,zoom,target:target.toArray(),polar:.72};},project(id){const item=items.find(p=>p.id===id);if(!item)return null;const b=new THREE.Box3().setFromObject(item.group);const v=new THREE.Vector3(item.x,b.max.y*.32,item.z).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}};
}
boot().catch(fail);
