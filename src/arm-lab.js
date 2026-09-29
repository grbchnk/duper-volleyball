import {Match} from './engine.js';
import {Renderer} from './renderer.js';
import {TEAMS} from './config.js';
import {jumpProfile,sampleJump,jumpDuration} from './motion.js';

// Uses the match renderer, including its springs and contact-to-recovery transition.
export function createArmLab(dialog,getConfig){
 const canvas=document.createElement('canvas');canvas.width=400;canvas.height=280;canvas.setAttribute('aria-label','Хлёсткие — просмотр движения');
 const card=document.createElement('section');card.className='arm-card';
 const status=document.createElement('p');status.className='arm-stage';card.append(canvas,status);dialog.querySelector('#arm-cards').append(card);
 const renderer=new Renderer(canvas);renderer.spriteScale=3;renderer.project=(x,y=0)=>({x:200+(x+1)*60,y:254-y*60});
 const m=new Match(getConfig());m.phase='rally';m.players[0].x=-1;m.selected[0]=0;m.lastTouch=1;m.lastPlayer=3;
 const powerInput=dialog.querySelector('#arm-preview-power'),frame=dialog.querySelector('#arm-frame'),freeze=dialog.querySelector('#arm-freeze');
 let clock=0;
 const restart=()=>{clock=0;freeze.checked=false;renderer.armRigs.clear();};
 dialog.querySelector('#arm-pose').onchange=restart;dialog.querySelector('#arm-replay').onclick=restart;
 powerInput.oninput=()=>{dialog.querySelector('#arm-preview-value').textContent=powerInput.value+'%';renderer.armRigs.clear();};
 frame.oninput=()=>{clock=Number(frame.value);freeze.checked=true;renderer.armRigs.clear();};
 return dt=>{
  if(!dialog.open)return;
  dt=freeze.checked?0:dt*(dialog.querySelector('#arm-slow').checked?.35:1);clock+=dt;
  const kind=dialog.querySelector('#arm-pose').value,phase=freeze.checked?clock%2.200001:clock%2.2,cycle=Math.floor(clock/2.2),power=Number(powerInput.value)/100;
  frame.value=phase;dialog.querySelector('#arm-frame-value').textContent=phase.toFixed(2)+' с';
  m.config={...getConfig()};m.time=clock;const p=m.players[0];
  Object.assign(p,{y:0,vy:0,vx:0,block:0,blockUsed:false,contact:null,armSwing:null,pose:'idle',animation:0,jumpProfile:null,jumpTime:0});m.charge=null;m.pending=null;
  if(kind==='jump'||kind==='block'){
   const profile=jumpProfile(m.config),t=phase-.2;
   if(t>=0&&t<jumpDuration(profile)){p.jumpProfile=profile;p.jumpTime=t;Object.assign(p,sampleJump(profile,t));p.pose=t<profile.windup?'crouch':kind==='block'?'block':'jump';if(kind==='block')p.block=jumpDuration(profile)-t;}
  }else{
   if(phase>.12&&phase<.65){m.charge={kind,power:power*Math.min(1,(phase-.12)/.35),age:phase-.12,playerId:0};p.pose='ready-'+({low:'bump',loft:'set',drive:'spike'}[kind]);}
   if(phase>=.65&&phase<.71){m.pending={kind,power,playerId:0};p.armSwing={kind,power,age:phase-.65,hit:false};}
   if(phase>=.71&&phase<.95)p.contact={kind,power,x:-.55,y:kind==='low'?.8:2.05,life:.95-phase,at:cycle*2.2+.71};
   if(phase>=.71&&phase<1.46)p.armSwing={kind,power,x:-.55,y:kind==='low'?.8:2.05,age:phase-.71,at:cycle*2.2+.71,hit:true};
  }
  m.ball={x:phase<.71?-.55+Math.max(0,(.71-phase)*4):-.55+(phase-.71)*(3+power*4),y:kind==='low'?.8:2.05,z:4.5,vx:0,vy:0,spin:0};
  const c=renderer.ctx;c.fillStyle='#edf1df';c.fillRect(0,0,400,280);c.fillStyle='#d6c4a1';c.fillRect(45,255,310,3);renderer.drawPlayer(p,TEAMS[0],m,dt);
  if(kind!=='jump'&&kind!=='block'&&phase>.4&&phase<1.05){const b=renderer.project(m.ball.x,m.ball.y);c.fillStyle='#f9d78b';c.strokeStyle='#91765e';c.lineWidth=2;c.beginPath();c.arc(b.x,b.y,7,0,Math.PI*2);c.fill();c.stroke();}
  status.textContent=renderer.armRigs.get(p.id)?.stage||'Покой';
 };
}
