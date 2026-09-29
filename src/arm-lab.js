import {ARM_STYLES} from './arms.js';
import {Match} from './engine.js';
import {Renderer} from './renderer.js';
import {TEAMS} from './config.js';
import {jumpProfile,sampleJump,jumpDuration} from './motion.js';
import {expressivePose} from './arm-motion.js';

// A visual comparison uses the game's actual player renderer; no game state is changed.
export function createArmLab(dialog,getConfig,choose){
 const cards=[],root=dialog.querySelector('#arm-cards');let clock=0;
 const collection=dialog.querySelector('#arm-collection'),powerInput=dialog.querySelector('#arm-preview-power');
 const updateCollection=()=>{for(const {card,id} of cards)card.hidden=collection.value==='new'?!ARM_STYLES[id].motion:collection.value==='original'?!!ARM_STYLES[id].motion:false;clock=0;};
 collection.onchange=updateCollection;powerInput.oninput=()=>{dialog.querySelector('#arm-preview-value').textContent=powerInput.value+'%';};
 dialog.querySelector('#arm-pose').onchange=()=>{clock=0;};
 for(const [id,spec] of Object.entries(ARM_STYLES)){
  const card=document.createElement('section');card.className='arm-card';
  const title=document.createElement('h3');title.textContent=spec.name;
  const canvas=document.createElement('canvas');canvas.width=280;canvas.height=240;canvas.setAttribute('aria-label',spec.name+' — анимация');
  const hint=document.createElement('p');hint.textContent=spec.hint;
  const button=document.createElement('button');button.className='secondary';button.textContent='Играть с этим вариантом';button.onclick=()=>choose(id);
  const status=document.createElement('p');status.className='arm-stage';
  card.append(title,canvas,status,hint,button);root.append(card);
  const renderer=new Renderer(canvas);renderer.spriteScale=2.7;renderer.project=(x,y=0)=>({x:140+(x+1)*51.4,y:218-y*54});
  const m=new Match({...getConfig(),armStyle:id});m.phase='rally';m.players[0].x=-1;m.selected[0]=0;m.lastTouch=1;m.lastPlayer=3;
  cards.push({id,card,m,renderer,status});
 }
 updateCollection();
 return dt=>{
  if(!dialog.open)return;dt*=dialog.querySelector('#arm-slow').checked?.35:1;clock+=dt;
  const kind=dialog.querySelector('#arm-pose').value,phase=clock%2.2,cycle=Math.floor(clock/2.2),power=Number(powerInput.value)/100;
  for(const {id,card,m,renderer,status} of cards){
   if(card.hidden)continue;
   m.config={...getConfig(),armStyle:id};m.time=clock;const p=m.players[0];
   Object.assign(p,{y:0,vy:0,vx:0,block:0,blockUsed:false,contact:null,armSwing:null,pose:'idle',animation:0,jumpProfile:null,jumpTime:0});m.charge=null;m.pending=null;
   if(kind==='jump'||kind==='block'){
    const profile=jumpProfile(m.config),t=phase-.2;
    if(t>=0&&t<jumpDuration(profile)){p.jumpProfile=profile;p.jumpTime=t;Object.assign(p,sampleJump(profile,t));p.pose=t<profile.windup?'crouch':kind==='block'?'block':'jump';if(kind==='block')p.block=jumpDuration(profile)-t;}
   }else{
    if(phase>.12&&phase<.65){m.charge={kind,power:power*Math.min(1,(phase-.12)/.35),age:phase-.12,playerId:0};p.pose='ready-'+({low:'bump',loft:'set',drive:'spike'}[kind]);}
    if(phase>=.65&&phase<.71){m.pending={kind,power,playerId:0};p.armSwing={kind,power,age:phase-.65,hit:false};}
    if(phase>=.71&&phase<.95)p.contact={kind,power,x:-.55,y:kind==='low'?.8:2.05,life:.95-phase,at:cycle*2.2+.71};
    if(phase>=.71&&phase<1.46)p.armSwing={kind,power,x:-.55,y:kind==='low'?.8:2.05,age:phase-.71,hit:true};
   }
   m.ball={x:phase<.71?-.55+Math.max(0,(.71-phase)*4):-.55+(phase-.71)*(3+power*4),y:kind==='low'?.8:2.05,z:4.5,vx:0,vy:0,spin:0};
   const c=renderer.ctx;c.fillStyle='#edf1df';c.fillRect(0,0,280,240);c.fillStyle='#d6c4a1';c.fillRect(25,219,230,3);renderer.drawPlayer(p,TEAMS[0],m,dt);
   if(kind!=='jump'&&kind!=='block'&&phase>.4&&phase<1.05){const b=renderer.project(m.ball.x,m.ball.y);c.fillStyle='#f9d78b';c.strokeStyle='#91765e';c.lineWidth=2;c.beginPath();c.arc(b.x,b.y,7,0,Math.PI*2);c.fill();c.stroke();}
   card.classList.toggle('chosen',getConfig().armStyle===id);
   card.querySelector('button').setAttribute('aria-pressed',getConfig().armStyle===id?'true':'false');
   status.textContent=ARM_STYLES[id].motion?expressivePose({spec:ARM_STYLES[id],config:m.config,kind,charge:m.charge,swing:p.armSwing,jump:p.jumpProfile?{profile:p.jumpProfile,time:p.jumpTime}:null,block:p.block>0&&p.pose!=='crouch'}).stage:'Оригинальная анимация';
  }
  dialog.querySelector('#arm-choice').textContent='Сейчас в игре: '+ARM_STYLES[getConfig().armStyle].name;
 };
}
