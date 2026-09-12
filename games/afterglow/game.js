'use strict';
const $=s=>document.querySelector(s),canvas=$('#game'),ctx=canvas.getContext('2d');
let W=innerWidth,H=innerHeight,dpr=1,state='intro',paused=false,auto=false,t=0,last=0,spawn=0,shot=0,score=0,kills=0,wave=0,bossSpawned=false,shake=0,noticeTime=0,sound=false,audioCtx;
let trail=[];
let player,enemies=[],bullets=[],particles=[],rings=[],gems=[],keys={},touch={x:0,y:0},mouse={x:0,y:0,active:false},stars=[];
let controlMode=matchMedia('(pointer:coarse)').matches?'touch':'mouse';
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){trail=[];W=canvas.clientWidth;H=canvas.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);if(player){player.x=clamp(player.x,25,W-25);player.y=clamp(player.y,180,H-50)}stars=Array.from({length:190},()=>({x:Math.random(),y:Math.random(),r:rand(.3,1.6),a:rand(.1,.8)}));}addEventListener('resize',resize);resize();
function tone(freq,duration=.08,type='sine',gain=.035){if(!sound)return;try{audioCtx??=new AudioContext();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.4),audioCtx.currentTime+duration);g.gain.setValueAtTime(gain,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch{}}
function burst(x,y,color,n=18,speed=170){for(let i=0;i<n;i++){let a=rand(0,Math.PI*2),v=rand(25,speed);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.25,.85),max:.85,color,r:rand(1,3)});}rings.push({x,y,r:5,life:.5,color});}
function notify(s){$('#notice').textContent=s;noticeTime=3;}
function reset(demo){auto=demo;state='playing';paused=false;t=0;score=0;kills=0;wave=0;bossSpawned=false;spawn=1.5;shot=0;trail=[];enemies=[];bullets=[];particles=[];rings=[];gems=[];keys={};touch={x:0,y:0};player={x:W*.5,y:H*.62,a:-Math.PI/2,hp:6,inv:1,dash:0,cool:0,speed:0,dashAngle:-Math.PI/2};clearInput();$('#intro').hidden=true;$('#result').hidden=true;$('#hud').hidden=false;$('#pauseOverlay').hidden=true;$('#touch').hidden=controlMode!=='touch'||demo;$('#mode').textContent=demo?'自动演示 · 同一飞行规则':modeLabel();$('#pause').textContent='暂停';$('#footerRight').textContent=demo?'自动驾驶演示中':'SPACE 冲刺 · P 暂停';canvas.focus();notify(demo?'01 / 追光者来袭':controlMode==='mouse'?'移动鼠标驾驶 · 靠近飞船刹车':'沿机头射击 · 空格冲刺');updateHud();}
function updateHud(){saveBest();$('#health').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i>=player.hp?'empty':''}"></i>`).join('');$('#score').textContent=String(score).padStart(6,'0');$('#dashbar').style.width=`${(1-player.cool/3)*100}%`;$('#dashLabel').textContent=player.cool>0?'冲刺充能中':'冲刺就绪 · SPACE';$('#wave').textContent=['第一波 · 追光者','第二波 · 猎手群','第三波 · 最后封锁','旗舰 · 守门人'][wave];const boss=enemies.find(e=>e.type===3);$('#progress i').style.width=(boss?boss.hp/boss.maxhp*100:Math.min(100,(t%20)/20*100))+'%';$('#objective').textContent=boss?'摧毁旗舰核心':`旗舰抵达倒计时 ${Math.max(0,Math.ceil(60-t))}s`;}
function end(win){saveBest();state='result';$('#result').hidden=false;$('#touch').hidden=true;$('#resultLabel').textContent=win?'SIGNAL RECEIVED / 信号已抵达':'SIGNAL LOST / 信号中断';$('#resultTitle').textContent=win?'我们看见了你的光。':'星海记得你的航迹。';$('#resultText').textContent=`${auto?'自动演示':'本次航行'} · 坚持 ${Math.floor(t)} 秒 · 击破 ${kills} 艘 · 积分 ${score}。${win?'封锁已解除，欢迎回家。':'再试一次，利用冲刺的短暂无敌穿过包围。'}`;tone(win?650:150,.7,'sine',.08);}
function dash(){if(state!=='playing'||paused||player.cool>0)return;player.dash=.2;player.dashAngle=player.a;player.cool=3;player.inv=Math.max(player.inv,.32);burst(player.x,player.y,'#c5ffe0',12,80);tone(300,.2,'triangle');}
function addEnemy(type){const a=rand(0,Math.PI*2),r=Math.hypot(W,H)*.55;const hp=[2,4,7,120][type];enemies.push({x:W/2+Math.cos(a)*r,y:H/2+Math.sin(a)*r,a:0,type,hp,maxhp:hp,r:[13,18,23,65][type],speed:[64,90,45,28][type],fire:rand(1,3),phase:rand(0,6)});}
function modeLabel(){return {mouse:'鼠标驾驶',keyboard:'键盘驾驶',touch:'触屏驾驶'}[controlMode];}
function clearInput(){
  keys={};touch={x:0,y:0};mouse.active=false;
  const knob=document.querySelector('#stick i');if(knob)knob.style.transform='';
  if(player){player.speed=0;player.dash=0;}
}
function flightIntent(){
  if(auto){
    const target=enemies.reduce((best,e)=>!best||dist(player,e)<dist(player,best)?e:best,null);
    let x=target?target.x:W*.5+Math.cos(t*.35)*W*.25;
    let y=target?target.y:H*.55+Math.sin(t*.4)*H*.2;
    let threat=enemies.find(e=>dist(player,e)<110)||bullets.find(b=>b.hostile&&dist(player,b)<75);
    if(threat){x=player.x+(player.x-threat.x)*5;y=player.y+(player.y-threat.y)*5;if(dist(player,threat)<60)dash();}
    return {x,y,active:true,throttle:threat?1:target?clamp((dist(player,target)-160)/170,0,1):.6,arrive:false};
  }
  if(controlMode==='mouse')return {...mouse};
  const x=controlMode==='touch'?touch.x:(keys.d||keys.ArrowRight?1:0)-(keys.a||keys.ArrowLeft?1:0);
  const y=controlMode==='touch'?touch.y:(keys.s||keys.ArrowDown?1:0)-(keys.w||keys.ArrowUp?1:0);
  return {x:player.x+x*220,y:player.y+y*220,active:Math.hypot(x,y)>.05,throttle:Math.min(1,Math.hypot(x,y)),arrive:false};
}
function update(dt){
  t+=dt;player.inv=Math.max(0,player.inv-dt);player.cool=Math.max(0,player.cool-dt);
  Flight.step(player,flightIntent(),Math.min(dt,player.dash>0?player.dash:dt));
  player.dash=Math.max(0,player.dash-dt);
  player.x=clamp(player.x,22,W-22);player.y=clamp(player.y,170,H-45);
  sampleTrail();
  const dx=Math.cos(player.a)*player.speed/245,dy=Math.sin(player.a)*player.speed/245;
if(Math.random()<.75){particles.push({x:player.x-Math.cos(player.a)*19,y:player.y-Math.sin(player.a)*19,vx:-Math.cos(player.a)*rand(40,100)-dx*40,vy:-Math.sin(player.a)*rand(40,100)-dy*40,r:rand(1,3),life:.45,max:.45,color:'#92e8d6'});}
shot-=dt;if(shot<=0){shot=.16;for(const a of [player.a-.055,player.a+.055])bullets.push({x:player.x+Math.cos(a)*22,y:player.y+Math.sin(a)*22,vx:Math.cos(a)*620,vy:Math.sin(a)*620,life:1.8,hostile:false});tone(650,.05,'triangle',.012);}
let next=Math.min(3,Math.floor(t/20));if(next!==wave){wave=next;notify(['','02 / 猎手正在集结','03 / 穿过最后封锁','守门人抵达 · 摧毁旗舰'][wave]);if(wave<3){player.hp=Math.min(6,player.hp+2);burst(player.x,player.y,'#b9ffdb');}}
if(wave===3&&!bossSpawned){addEnemy(3);bossSpawned=true;}
spawn-=dt;if(spawn<=0){spawn=[1.9,1.2,.85,2][wave];if(enemies.length<[10,18,24,24][wave])addEnemy(wave===0?0:Math.random()<.2+wave*.12?Math.min(2,wave+1):0);}
for(const e of enemies){e.a=Math.atan2(player.y-e.y,player.x-e.x);const d=dist(e,player);let travel=e.type===3&&d<280?0:1;e.x+=Math.cos(e.a)*e.speed*travel*dt;e.y+=Math.sin(e.a)*e.speed*travel*dt;e.fire-=dt;if(e.type>=2&&e.fire<=0){e.fire=e.type===3?1.25:2.8;let count=e.type===3?12:1;for(let j=0;j<count;j++){let a=e.type===3?j/count*Math.PI*2+t*.22:e.a;bullets.push({x:e.x,y:e.y,vx:Math.cos(a)*140,vy:Math.sin(a)*140,life:6,hostile:true});}}
if(d<e.r+13&&player.inv<=0){hurt();e.hp-=3;}}
for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.hostile){if(dist(b,player)<15&&player.inv<=0){b.life=0;hurt();}}else{for(const e of enemies){if(e.hp>0&&dist(b,e)<e.r+5){e.hp--;b.life=0;burst(b.x,b.y,'#eed7a1',2,40);break;}}}}
for(const e of enemies){if(e.hp<=0){kills++;score+=e.type===3?5000:(e.type+1)*100;burst(e.x,e.y,e.type===3?'#ffe2ac':'#f9ac82',e.type===3?90:25,e.type===3?330:160);shake=reduced?0:e.type===3?16:4;tone(e.type===3?80:120,.22,'sawtooth',.025);gems.push({x:e.x,y:e.y,life:12,heal:kills%12===0});if(e.type===3)end(true);}}
enemies=enemies.filter(e=>e.hp>0);bullets=bullets.filter(b=>b.life>0&&b.x>-150&&b.x<W+150&&b.y>-150&&b.y<H+150);
for(const g of gems){g.life-=dt;let d=dist(g,player);if(d<160){g.x+=(player.x-g.x)*dt*6;g.y+=(player.y-g.y)*dt*6;}if(d<20){score+=25;g.life=0;if(g.heal){player.hp=Math.min(6,player.hp+1);notify('修复胶囊 · 护盾恢复');}tone(1000,.09,'sine',.02);}}gems=gems.filter(g=>g.life>0);if(player.hp<=0&&state==='playing')end(false);updateHud();}
function hurt(){player.hp--;player.inv=1.2;shake=reduced?0:12;burst(player.x,player.y,'#ffad87',20);tone(100,.25,'sawtooth',.05);}
function background(time){ctx.fillStyle='#08151f';ctx.fillRect(0,0,W,H);let g=ctx.createRadialGradient(W*.74,H*.44,0,W*.74,H*.44,W*.65);g.addColorStop(0,'#214e5b');g.addColorStop(.38,'#112e3d');g.addColorStop(1,'#07131d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(W*.7,H*.43);ctx.rotate(-.4);for(let i=0;i<8;i++){ctx.strokeStyle=`rgba(116,177,176,${.025-i*.002})`;ctx.lineWidth=20+i*6;ctx.beginPath();ctx.ellipse(0,0,W*.42+i*9,H*.17+i*10,0,0,7);ctx.stroke();}ctx.restore();for(const s of stars){ctx.globalAlpha=s.a*(.8+.2*Math.sin(time*.4+s.x*70));ctx.fillStyle='#d8e9e3';ctx.beginPath();ctx.arc((s.x*W-time*(s.r*1.3))%W+ (s.x*W-time*s.r*1.3<0?W:0),s.y*H,s.r,0,7);ctx.fill();}ctx.globalAlpha=1;
const px=W*.78,py=H*.39,r=Math.min(W*.21,H*.31);ctx.save();ctx.translate(px,py);ctx.rotate(-.32);ctx.strokeStyle='#94c9c933';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,r*1.66,r*.36,0,0,7);ctx.stroke();let glow=ctx.createRadialGradient(0,0,r*.9,0,0,r*1.15);glow.addColorStop(0,'#97d2c128');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,r*1.15,0,7);ctx.fill();let planet=ctx.createRadialGradient(-r*.5,-r*.5,0,r*.2,r*.2,r*1.35);planet.addColorStop(0,'#709a99');planet.addColorStop(.36,'#315f6b');planet.addColorStop(.72,'#112f40');planet.addColorStop(1,'#071320');ctx.fillStyle=planet;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.save();ctx.beginPath();ctx.arc(0,0,r-.5,0,7);ctx.clip();for(let i=0;i<14;i++){ctx.strokeStyle=i%3===0?'#a6c9b61b':'#082a3c22';ctx.lineWidth=randStable(i,4,13);ctx.beginPath();ctx.ellipse(-r*.1,-r+i*r*.15,r*1.3,r*.22,.12,0,7);ctx.stroke();}ctx.restore();ctx.strokeStyle='#d7dfbb66';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,r*1.66,r*.36,0,0,Math.PI);ctx.stroke();ctx.restore();if(state==='intro'){let shade=ctx.createLinearGradient(0,0,W,0);shade.addColorStop(0,'#061219d9');shade.addColorStop(.5,'#06121970');shade.addColorStop(1,'transparent');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);}}
function randStable(i,a,b){return a+(Math.sin(i*37)*.5+.5)*(b-a);}
function ship(x,y,a,scale=1,enemy=-1,inv=false){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.scale(scale,scale);ctx.globalAlpha=inv?.5+Math.sin(t*35)*.25:1;const col=enemy<0?'#c5ffe5':enemy===3?'#f4c38e':'#ee987c';ctx.shadowColor=col;ctx.shadowBlur=reduced?0:14;ctx.fillStyle=enemy<0?'#a9cece':'#432b30';ctx.strokeStyle=col;ctx.lineWidth=1.4;ctx.beginPath();if(enemy===3){ctx.moveTo(42,0);ctx.lineTo(10,-22);ctx.lineTo(-26,-35);ctx.lineTo(-15,-10);ctx.lineTo(-35,0);ctx.lineTo(-15,10);ctx.lineTo(-26,35);ctx.lineTo(10,22);}else{ctx.moveTo(22,0);ctx.lineTo(-15,-13);ctx.lineTo(-8,0);ctx.lineTo(-15,13);}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=enemy<0?'#f1ffef':'#ffc898';ctx.beginPath();ctx.ellipse(1,0,7,3,0,0,7);ctx.fill();ctx.fillStyle='#a9ffe1';ctx.beginPath();ctx.moveTo(-11,-4);ctx.lineTo(-25-Math.sin(t*45)*7,0);ctx.lineTo(-11,4);ctx.fill();ctx.restore();}
function draw(dt,time){background(time);ctx.save();if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake,shake));shake=Math.max(0,shake-dt*35);}if(state==='intro'){ship(W*.72,H*.72,-.45,2.7);ctx.strokeStyle='#b9ffdb20';ctx.setLineDash([3,9]);ctx.beginPath();ctx.moveTo(W*.52,H*.92);ctx.quadraticCurveTo(W*.59,H*.81,W*.68,H*.75);ctx.stroke();ctx.setLineDash([]);}for(const g of gems){ctx.save();ctx.translate(g.x,g.y);ctx.rotate(time*2);ctx.fillStyle=g.heal?'#a7ffd0':'#dbd6a0';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;ctx.fillRect(-4,-4,g.heal?10:6,g.heal?10:6);ctx.restore();}for(const b of bullets){ctx.strokeStyle=b.hostile?'#ff9f89':'#d9ffe4';ctx.lineWidth=b.hostile?4:2;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.023,b.y-b.vy*.023);ctx.stroke();}ctx.shadowBlur=0;for(const e of enemies){ship(e.x,e.y,e.a,e.type===3?1.65:1+e.type*.25,e.type);if(e.hp<e.maxhp){ctx.fillStyle='#e6a58c';ctx.fillRect(e.x-e.r,e.y-e.r-10,e.r*2*e.hp/e.maxhp,2);}}drawTrail(dt);drawFlightGuide();if(player)ship(player.x,player.y,player.a,1,-1,player.inv>0);for(const p of particles){if(!paused){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);for(const r of rings){if(!paused){r.r+=dt*150;r.life-=dt;}ctx.globalAlpha=Math.max(0,r.life*1.5);ctx.strokeStyle=r.color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,7);ctx.stroke();}rings=rings.filter(r=>r.life>0);ctx.globalAlpha=1;ctx.restore();}
function frame(ms){const dt=Math.min((ms-last)/1000,.033);last=ms;if(!document.hidden){if(!paused&&state==='playing')update(dt);if(!paused&&noticeTime>0){noticeTime-=dt;if(noticeTime<=0)$('#notice').textContent='';}draw(paused?0:dt,reduced?0:ms/1000);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
function drawFlightGuide(){
  if(!player||state!=='playing'||auto||controlMode!=='mouse'||!mouse.active||paused)return;
  ctx.save();ctx.strokeStyle='#b9ffdb70';ctx.lineWidth=1;ctx.setLineDash([3,6]);
  ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(mouse.x,mouse.y);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.arc(player.x,player.y,Flight.deadZone,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#c9ffe2';ctx.beginPath();ctx.arc(mouse.x,mouse.y,7,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function togglePause(){if(state!=='playing')return;paused=!paused;clearInput();$('#pauseOverlay').hidden=!paused;$('#pause').textContent=paused?'继续':'暂停';if(!paused)canvas.focus();}
function pauseForFocus(){if(state==='playing'&&!paused)togglePause();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForFocus();});
addEventListener('blur',pauseForFocus);
document.addEventListener('mouseout',e=>{if(!e.relatedTarget&&controlMode==='mouse')pauseForFocus();});
$('#shell').addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'||e.target.closest('button,a,select,input')||controlMode!=='mouse')return;
  const r=canvas.getBoundingClientRect();
  mouse={x:clamp((e.clientX-r.left)*W/r.width,22,W-22),y:clamp((e.clientY-r.top)*H/r.height,170,H-45),active:true};
});
addEventListener('keydown',e=>{
  if(e.target.closest('button,a,input,textarea,select'))return;
  if(e.code==='Escape'&&document.fullscreenElement)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&state==='playing')e.preventDefault();
  keys[e.key.length===1?e.key.toLowerCase():e.key]=true;if(e.repeat)return;
  if(e.code==='Space')dash();if(e.code==='KeyP'||e.code==='Escape')togglePause();
});
addEventListener('keyup',e=>keys[e.key.length===1?e.key.toLowerCase():e.key]=false);
$('#play').onclick=()=>reset(false);$('#demo').onclick=()=>reset(true);$('#restart').onclick=()=>reset(auto);$('#home').onclick=()=>{state='intro';trail=[];clearInput();player=null;enemies=[];bullets=[];gems=[];$('#result').hidden=true;$('#hud').hidden=true;$('#intro').hidden=false;$('#notice').textContent='';$('#footerRight').textContent='一艘船。一线生机。';};$('#pause').onclick=togglePause;$('#resume').onclick=togglePause;$('#dash').onclick=dash;$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=`声音：${sound?'开':'关'}`;$('#sound').setAttribute('aria-pressed',String(sound));if(sound){audioCtx??=new AudioContext();audioCtx.resume();tone(540,.15);}};
const stick=$('#stick');function moveStick(e){const r=stick.getBoundingClientRect();touch.x=clamp((e.clientX-r.left-r.width/2)/40,-1,1);touch.y=clamp((e.clientY-r.top-r.height/2)/40,-1,1);stick.firstElementChild.style.transform=`translate(${touch.x*27}px,${touch.y*27}px)`;}stick.onpointerdown=e=>{stick.setPointerCapture(e.pointerId);moveStick(e);};stick.onpointermove=e=>{if(stick.hasPointerCapture(e.pointerId))moveStick(e);};stick.onpointerup=stick.onpointercancel=()=>{touch={x:0,y:0};stick.firstElementChild.style.transform='';};
window.gameStatus=()=>({version:'0.2',controlMode,state,paused,auto,time:t,hp:player?.hp,score,kills,wave,enemies:enemies.length,bullets:bullets.length,player:player?{x:player.x,y:player.y,cool:player.cool,a:player.a,speed:player.speed}:null});


// Only manual runs count. Storage failure must never interrupt a flight.
const bestKey=()=>`koa.afterglow.best.v2.${controlMode}`;
let best=0,storageAvailable=true;
function readBest(){try{const value=Number(localStorage.getItem(bestKey()));return Number.isSafeInteger(value)&&value>=0?value:0;}catch{storageAvailable=false;return 0;}}
function renderBest(){document.querySelectorAll('[data-best]').forEach(el=>el.textContent=String(best).padStart(6,'0'));document.querySelectorAll('[data-best-label]').forEach(el=>el.textContent=storageAvailable?'v0.2 '+modeLabel()+'最高分':'本次会话最高分');const hint=document.querySelector('.best-score small');if(hint)hint.textContent=storageAvailable?'仅手动试玩计分 · 保存在此浏览器':'浏览器存储不可用 · 仅本次会话保留';}
function saveBest(){if(auto||score<=best)return;best=Math.max(score,readBest());try{localStorage.setItem(bestKey(),String(best));}catch{storageAvailable=false;}renderBest();}
best=readBest();renderBest();
addEventListener('storage',event=>{if(event.key===bestKey()||event.key===null){best=readBest();renderBest();}});
const fullscreenButton=$('#fullscreen');
function fullscreenLabel(){fullscreenButton.textContent=document.fullscreenElement?'退出全屏':'全屏';fullscreenButton.setAttribute('aria-pressed',String(Boolean(document.fullscreenElement)));}
if(!document.fullscreenEnabled||!$('#shell').requestFullscreen){fullscreenButton.disabled=true;fullscreenButton.textContent='全屏不可用';fullscreenButton.title='当前浏览器不支持页面全屏';}
fullscreenButton.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#shell').requestFullscreen();}catch{notify('未能进入全屏，请使用浏览器全屏功能');}};
document.addEventListener('fullscreenchange',()=>{fullscreenLabel();resize();});

const modeSelect=$('#controlMode');modeSelect.value=controlMode;
modeSelect.onchange=()=>{controlMode=modeSelect.value;clearInput();best=readBest();renderBest();updateControlHint();};
function updateControlHint(){
  $('#controlHint').textContent=controlMode==='mouse'?'鼠标转向 · 拉远加速 · 靠近停车':controlMode==='keyboard'?'WASD / 方向键控制航向 · 松开刹车':'左下摇杆控制航向 · 松开刹车';
}
updateControlHint();

// A bounded path follows the engine's actual world-space movement.
function sampleTrail(){
  const intensity=player.dash>0?1.65:clamp(player.speed/245,0,1);
  if(intensity<.025)return;
  const point={x:player.x-Math.cos(player.a)*14,y:player.y-Math.sin(player.a)*14,age:0,intensity};
  const previous=trail[trail.length-1];
  if(!previous||Math.hypot(point.x-previous.x,point.y-previous.y)>=2){trail.push(point);if(trail.length>80)trail.shift();}
}
function drawTrail(dt){
  const lifetime=reduced?.3:1.1;
  if(!paused){for(const point of trail)point.age+=dt;trail=trail.filter(point=>point.age<lifetime);}
  if(trail.length<2)return;
  // Wide translucent outer stroke + bright core; no per-segment shadow rasterization.
  ctx.save();ctx.shadowBlur=0;ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
  for(let i=1;i<trail.length;i++){
    const a=trail[i-1],b=trail[i];
    const fade=Math.pow(Math.max(0,1-b.age/lifetime),1.4);
    const width=(2+6*b.intensity)*fade;
    const segment=(color,w,alpha)=>{ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=Math.max(.2,w);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
    if(!reduced)segment('#a79cff',width*2.3,fade*.15);
    segment('#69edcf',width,fade*.46);
    segment('#e3fff6',width*.28,fade*.8);
  }
  ctx.restore();
}
