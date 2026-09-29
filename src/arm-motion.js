// Presentation only: a complete pose blends back to the current locomotion pose.
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const pairMix=(a,b,t)=>a.map((point,i)=>mix(point,b[i],t));
const idle=[{x:-9,y:-12},{x:10,y:-12}];

export function expressivePose({spec,config,kind,charge,swing,jump,block=false,diving=false,diveForward=false,bodyTilt=0,bodyOffsetY=0,recoveryPose=null,step=0,contactPoint=null}){
 const power=clamp(charge?.power??swing?.power??.35),amp=1.3*power*config.armPowerMotion;
 const scale=spec.size*config.armScale;
 const scaled=points=>points.map((p,i)=>({x:(i?6:-6)+(p.x-(i?6:-6))*scale,y:-20+(p.y+20)*scale}));
 let base=idle.map((p,i)=>({...p,x:p.x+(i?1:-1)*step*.5})),stage='Покой';
 if(jump){
  const {profile,time}=jump,air=time-profile.windup;let jumpPose;
  if(air<0){const t=ease(time/Math.max(.001,profile.windup));jumpPose=[{x:-9-t,y:-12+6*t},{x:10+t,y:-12+6*t}];stage='Толчок';}
  else if(air<profile.rise){const t=ease(air/profile.rise);jumpPose=pairMix([{x:-10,y:-6},{x:11,y:-6}],[{x:-10,y:-39},{x:11,y:-41}],t);stage='Взлёт';}
  else{const t=ease((air-profile.rise-profile.hang)/profile.fall);jumpPose=pairMix([{x:-10,y:-39},{x:11,y:-41}],idle,t);stage='Приземление';}
  base=pairMix(base,jumpPose,config.armJumpMotion);
 }
 if(block){base=[{x:-10,y:-43},{x:11,y:-43}];stage='Блок';}
 base=scaled(base);
 // Keep the reach horizontal in world space while the torso tips forward.
 if(diving&&diveForward){base=[-1,1].map(side=>({x:side*3+25*Math.cos(bodyTilt),y:-20-25*Math.sin(bodyTilt)}));stage='Руки вперёд';}
 if(recoveryPose){
  const t=clamp(recoveryPose.progress);
  const support=[8,16].map(x=>{const y=5*Math.sin(bodyTilt);return {x:x*Math.cos(bodyTilt)+y*Math.sin(bodyTilt),y:-x*Math.sin(bodyTilt)+y*Math.cos(bodyTilt)-bodyOffsetY};});
  base=pairMix(support,base,ease((t-.55)/.45));stage=t<.55?'Опора руками':'Подъём';
 }
 let wrists=base,activity=0;
 const ready=diving&&diveForward?base:scaled(diving?[{x:6,y:-39},{x:10,y:-40}]:kind==='low'?[{x:10,y:-9-amp*2},{x:14,y:-9-amp*2}]:kind==='loft'?[{x:0,y:-36+amp*2},{x:7,y:-36+amp*2}]:[{x:12,y:-27},{x:-13-amp*7,y:-33-amp*4}]);
 if(charge){activity=ease((charge.age??.1)/config.armWindup);wrists=pairMix(base,ready,activity);stage='Подготовка';}
 if(swing&&!charge&&!block&&kind!=='block'){
  const age=swing.age;
  if(!swing.hit){
   const recoil=scaled(kind==='drive'?[{x:11,y:-28},{x:-21-amp*7,y:-38}]:kind==='loft'?[{x:0,y:-33},{x:7,y:-33}]:[{x:6,y:-6},{x:10,y:-6}]);
   const end=scaled(kind==='drive'?[{x:10,y:-23},{x:22,y:-28}]:kind==='loft'?[{x:1,y:-44},{x:8,y:-44}]:[{x:18,y:-17},{x:22,y:-17}]);
   const stroke=age<.035?pairMix(ready,recoil,ease(age/.035)):pairMix(recoil,end,ease((age-.035)/.065));
   activity=1-ease((age-.1)/.15);wrists=pairMix(base,stroke,activity);
   stage=age<.1?'Взмах после отпускания':activity>0?'Возврат':stage;
  }else{
   const point=contactPoint||{x:10,y:kind==='low'?-14:-40};
   const hit=kind==='drive'?[{x:11,y:-25},{x:point.x,y:point.y}]:kind==='low'?[{x:point.x-2,y:point.y+3},{x:point.x+2,y:point.y+3}]:[{x:point.x-3.5,y:point.y+2},{x:point.x+3.5,y:point.y+2}];
   // The spike sweeps down across the body instead of extending indefinitely from the ball.
   const follow=kind==='drive'?scaled([{x:9,y:-20},{x:17+amp*5,y:-13+amp*5}]):kind==='loft'?[{x:point.x-3,y:point.y-4-amp*7},{x:point.x+4,y:point.y-4-amp*7}]:[{x:point.x+4,y:point.y-3-amp*8},{x:point.x+8,y:point.y-3-amp*8}];
   const stroke=pairMix(hit,follow,ease(age/(.14-.045*power)));
   activity=1-ease((age-.14)/(.16+.09*power));wrists=pairMix(base,stroke,activity);
   stage=age<.055?'Контакт!':age<.14?'Проводка':activity>0?'Возврат':stage;
  }
 }
 if(recoveryPose){wrists=base;activity=0;}
 const elbows=wrists.map((p,i)=>{
  const shoulder={x:i?spec.shoulder:-spec.shoulder,y:-20};
  const rest={x:(shoulder.x+p.x)/2+(i?1:-1)*6*config.armBend,y:(shoulder.y+p.y)/2+5*config.armBend};
  if(kind==='loft')return mix(rest,{x:(i?15:-12)*config.armBend,y:-27+amp},activity);
  return {...rest,x:rest.x+(i?1:-1)*amp*3*config.armBend*activity};
 });
 return {wrists,elbows,power:activity>0?power:.35,stage,cup:kind==='loft'?activity:0,snap:!!swing?.hit&&swing.age<.055};
}
