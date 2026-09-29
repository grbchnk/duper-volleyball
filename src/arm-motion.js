// Presentation only. These poses never delay a hit or change collision geometry.
// Original styles 01–04 bypass this module entirely.
const clamp = (v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const ease = v=>{const t=clamp(v);return t*t*(3-2*t);};
const mix = (a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const pairMix = (a,b,t)=>a.map((point,i)=>mix(point,b[i],t));
const idle = [{x:-9,y:-12},{x:10,y:-12}];

export function expressivePose({spec,config,kind,charge,swing,jump,block=false,step=0,contactPoint=null}){
 const power=clamp(charge?.power??swing?.power??.35),strength=power*config.armPowerMotion;
 const whip=spec.motion==='whip',amp=(whip?1.3:1)*strength;
 let wrists=idle.map((p,i)=>({...p,x:p.x+(i?1:-1)*step*.5})),stage='Покой',spin=0;
 // The takeoff sweep remains visible when no shot is being prepared.
 if(jump){
  const {profile,time}=jump,air=time-profile.windup;
  let jumpPose;
  if(air<0){const t=ease(time/Math.max(.001,profile.windup));jumpPose=[{x:-16*t-8,y:-11+5*t},{x:8-9*t,y:-11+5*t}];stage='Толчок';}
  else if(air<profile.rise){const t=ease(air/profile.rise);jumpPose=pairMix([{x:-22,y:-7},{x:-1,y:-6}],[{x:-10,y:-39},{x:11,y:-41}],t);stage='Взлёт';}
  else{const t=ease((air-profile.rise-profile.hang)/profile.fall);jumpPose=pairMix([{x:-10,y:-39},{x:11,y:-41}],[{x:-15,y:-16},{x:16,y:-16}],t);stage='Приземление';}
  wrists=pairMix(wrists,jumpPose,config.armJumpMotion);
 }
 if(block){wrists=[{x:-10,y:-43},{x:11,y:-43}];stage='Блок';}
 const ready=kind==='low'?[{x:10,y:-9-amp*2},{x:14,y:-9-amp*2}]:kind==='loft'?[{x:0,y:-36+amp*2},{x:7,y:-36+amp*2}]:[{x:12,y:-27},{x:-13-amp*7,y:-33-amp*4}];
 if(charge){wrists=pairMix(wrists,ready,ease((charge.age??.1)/config.armWindup));stage='Подготовка';}
 if(swing&&!charge&&kind!=='block'){
  const age=swing.age;
  if(!swing.hit){
   // Release accent during a miss / early release; a real contact always takes priority.
   const recoil=kind==='drive'?[{x:11,y:-28},{x:-21-amp*7,y:-38}]:kind==='loft'?[{x:0,y:-33},{x:7,y:-33}]:[{x:6,y:-6},{x:10,y:-6}];
   const end=kind==='drive'?[{x:10,y:-23},{x:22,y:-28}]:kind==='loft'?[{x:1,y:-44},{x:8,y:-44}]:[{x:18,y:-17},{x:22,y:-17}];
   wrists=age<.035?pairMix(ready,recoil,ease(age/.035)):pairMix(recoil,end,ease((age-.035)/.065));
   if(age>.1)wrists=pairMix(wrists,idle,ease((age-.1)/.15));
   stage=age<.1?'Взмах после отпускания':'Возврат';
  }else{
   const point=contactPoint||{x:10,y:kind==='low'?-14:-40};
   const hit=kind==='drive'?[{x:11,y:-25},{...point}]:kind==='low'?[{x:point.x-2,y:point.y+3},{x:point.x+2,y:point.y+3}]:[{x:point.x-3.5,y:point.y+2},{x:point.x+3.5,y:point.y+2}];
   const follow=kind==='drive'?[{x:9,y:-20},{x:point.x+9+amp*12,y:point.y+11+amp*15}]:kind==='loft'?[{x:point.x-3,y:point.y-4-amp*7},{x:point.x+4,y:point.y-4-amp*7}]:[{x:point.x+4,y:point.y-3-amp*8},{x:point.x+8,y:point.y-3-amp*8}];
   wrists=pairMix(hit,follow,ease(age/(.14-.045*power)));
   if(age>.14)wrists=pairMix(wrists,idle,ease((age-.14)/(.16+.09*power)));
   stage=age<.055?'Контакт!':age<.3?'Проводка':'Возврат';
   // Comic flourish happens AFTER the contact, and cannot create additional hits.
   if(['windmill','propeller'].includes(spec.motion)&&power>.7&&config.armFlourish>0&&age>.065&&age<.65){
    const u=(age-.065)/.585,fade=Math.sin(Math.PI*u),turns=spec.motion==='propeller'?2:1;
    spin=fade*clamp((power-.7)/.3)*config.armFlourish;
    for(let i=0;i<2;i++)if(i===1||spec.motion==='propeller'){
     const angle=-Math.PI/2+u*Math.PI*2*turns*(i?-1:1),radius=20+amp*4;
     wrists[i]=mix(wrists[i],{x:(i?6:-6)+Math.cos(angle)*radius,y:-20+Math.sin(angle)*radius},clamp(spin));
    }
    stage='Мельница!';
   }
  }
 }
 const scale=spec.size*config.armScale;
 // Preserve the exact contact point; size affects idle/preparation poses only.
 if(!swing?.hit)wrists=wrists.map((p,i)=>({x:(i?6:-6)+(p.x-(i?6:-6))*scale,y:-20+(p.y+20)*scale}));
 const elbows=wrists.map((p,i)=>{
  const shoulder={x:i?spec.shoulder:-spec.shoulder,y:-20};
  if(kind==='loft')return {x:(i?15:-12)*config.armBend,y:-27+amp};
  if(whip)return {x:(shoulder.x+p.x)/2+(i?1:-1)*(6+amp*3)*config.armBend,y:(shoulder.y+p.y)/2+5*config.armBend};
  return {x:(shoulder.x+p.x)/2+(i?1:-1)*5*config.armBend,y:(shoulder.y+p.y)/2+3*config.armBend};
 });
 return {wrists,elbows,power,spin,stage,cup:kind==='loft',snap:!!swing?.hit&&swing.age<.055};
}
