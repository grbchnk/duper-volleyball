// Editable, hand-authored pixel frames. Body frames are cached as 64×64 sprites;
// the existing spring-driven arms are drawn above them without changing their rig.
export const SKINS = {
  club:{name:'Клубный',description:'Короткая стрижка, повязка и классическая форма. Без ушек.',hair:'#725953',accent:'#fff3d4',detail:'band',ears:false},
  street:{name:'Уличный',description:'Тёмные волосы, козырёк и полосы на форме. Без ушек.',hair:'#454c62',accent:'#e9db9d',detail:'cap',ears:false},
  fox:{name:'Лисёнок',description:'Рыжая шапочка с ушками и светлая манишка.',hair:'#a97051',accent:'#ffd9a6',detail:'fox',ears:true},
};
// [body offset y, head offset x, left foot x/y, right foot x/y, eye expression, dive tilt]
const f=(y=0,h=0,l=-5,ly=0,r=4,ry=0,eye=0,tilt=0)=>({y,h,l,ly,r,ry,eye,tilt});
export const BODY_CLIPS = {
  idle:{label:'Стойка',fps:4,loop:true,frames:[f(),f(-1),f(),f(0,0,-5,0,4,0,1)]},
  run:{label:'Бег',fps:12,loop:true,frames:[f(0,1,-8,0,6,-3),f(-1,1,-6,-2,5,-5),f(-2,1,-3,-4,3,-1),f(0,1,-2,-3,8,0),f(-1,1,-3,-5,6,-2),f(-2,1,-5,-1,3,-4)]},
  crouch:{label:'Толчок',fps:30,frames:[f(1,1,-6),f(3,1,-7,0,6),f(5,1,-7,0,6)]},
  jump:{label:'Взлёт',fps:14,frames:[f(-1,1,-5,-2,4,-1),f(-2,1,-6,-4,5,-2),f(-2,0,-6,-5,5,-4)]},
  apex:{label:'Вершина',fps:12,frames:[f(-2,0,-6,-5,5,-4),f(-1,0,-5,-4,4,-4)]},
  fall:{label:'Падение',fps:14,frames:[f(-1,0,-5,-4,4,-3),f(0,0,-5,-2,4,-2),f(1,0,-6,0,5,0)]},
  land:{label:'Приземление',fps:25,frames:[f(5,1,-7,0,6),f(3,0,-6,0,5),f(1),f()]},
  bump:{label:'Приём снизу',fps:14,frames:[f(3,1,-6,0,5),f(4,2,-7,0,6),f(2,1,-6,0,5),f()]},
  set:{label:'Верхний пас',fps:14,frames:[f(2,0,-6,0,5),f(1,0,-5,0,4),f(-2,0,-5,-1,4,-1),f()]},
  spike:{label:'Удар',fps:16,frames:[f(1,-2,-6,0,5),f(-1,-1,-6,-1,5),f(0,2,-5,0,6),f(2,2,-6,0,5),f()]},
  block:{label:'Блок',fps:12,frames:[f(0,0,-5,-1,4,-1),f(-1,0,-6,-3,5,-3),f(0,0,-6,-2,5,-2)]},
  dive:{label:'Бросок',fps:14,frames:[f(2,2,-7,0,5,-2,0,.2),f(0,2,-7,-2,4,-4,0,.55),f(0,1,-6,-3,4,-5,0,1.05),f(0,1,-5,-4,4,-4,0,1.38)]},
  belly:{label:'На площадке',fps:10,frames:[f(0,1,-5,-3,4,-3,1,1.49),f(0,0,-5,-2,4,-2,1,1.49)]},
  getup:{label:'Подъём',fps:12,frames:[f(1,0,-5,-2,4,-2,0,1.15),f(3,1,-6,0,5,0,0,.7),f(5,1,-7,0,6,0,0,.3),f(2,0,-6,0,5)]},
  serve:{label:'Подача',fps:10,frames:[f(1,-1,-6,0,5),f(0,0,-5,0,4),f(-1,1,-5,-1,4),f(1,2,-5,0,5)]},
};
export function frameOf(state,time=0){
  const clip=BODY_CLIPS[state]||BODY_CLIPS.idle;
  const raw=Math.max(0,Math.floor(time*clip.fps));
  const index=clip.loop?raw%clip.frames.length:Math.min(raw,clip.frames.length-1);
  return {state:BODY_CLIPS[state]?state:'idle',index,pose:clip.frames[index],label:clip.label,total:clip.frames.length};
}
export function playerFrame(p,m){
  if(p.recovery>0)return p.recovery>.32?frameOf('belly',(p.recoveryTotal||.92)-p.recovery):frameOf('getup',.32-p.recovery);
  if(p.diving)return frameOf('dive',p.diveAge||0);
  if(p.jumpProfile){
    const t=p.jumpTime,j=p.jumpProfile;
    if(t<j.windup)return frameOf('crouch',t/Math.max(.001,j.windup)*.099);
    if(p.block>0)return frameOf('block',t-j.windup);
    if(p.contact)return frameOf(p.contact.kind==='drive'?'spike':p.contact.kind==='loft'?'set':'bump',.24-p.contact.life);
    if(t<j.windup+j.rise)return frameOf('jump',(t-j.windup)/j.rise*.21);
    if(t<j.windup+j.rise+j.hang)return frameOf('apex',t-j.windup-j.rise);
    return frameOf('fall',(t-j.windup-j.rise-j.hang)/j.fall*.21);
  }
  if(m.phase==='serve-motion'&&p.id===m.selected[m.server])return frameOf('serve',m.phaseTime);
  if(p.contact)return frameOf(p.contact.kind==='drive'?'spike':p.contact.kind==='loft'?'set':p.contact.kind==='block'?'block':'bump',.24-p.contact.life);
  const charge=m.charge?.playerId===p.id?m.charge:null;
  if(charge)return frameOf(charge.kind==='drive'?'spike':charge.kind==='loft'?'set':'bump',Math.min(.07,charge.age||0));
  if(p.pose==='land'&&p.animation>0)return frameOf('land',.14-p.animation);
  if(Math.abs(p.vx)>.1)return frameOf('run',p.runTime??m.time);
  return frameOf('idle',m.time+p.id*.17);
}

export function paintBody(c,frame,skinId,team,playerId=0){
  const skin=SKINS[skinId]||SKINS.club,ink='#665d62',flesh='#f4cfac',pose=frame.pose;
  const r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  // 15-pixel torso and 17-pixel head: subtly slimmer than the old 17/19 silhouette.
  for(const [x,y]of [[pose.l,pose.ly],[pose.r,pose.ry]]){
    r(x,-8+y,3,7,flesh);r(x,-4+y,3,3,'#f8eed6');r(x-1,-2+y,6,3,ink);r(x-1,-2+y,5,2,'#fff6e1');
  }
  const y=pose.y;
  r(-6,-12+y,13,6,team.dark);r(-5,-9+y,4,4,team.dark);r(3,-9+y,4,4,team.dark);
  r(-7,-22+y,15,13,ink);r(-6,-21+y,13,11,team.color);r(-6,-20+y,2,10,team.dark);r(5,-20+y,2,10,team.light);
  r(-3,-21+y,7,2,'#fff2dd');r(-5,-11+y,10,1,team.light);
  if(skin.detail==='cap'){r(-5,-18+y,11,2,skin.accent);r(-5,-14+y,11,1,team.dark);}
  if(skin.detail==='fox'){r(-3,-20+y,7,7,team.light);r(-1,-14+y,3,2,'#fff1d8');}
  const h=pose.h;
  r(-8+h,-34+y,17,13,ink);r(-7+h,-35+y,15,13,flesh);
  r(-6+h,-36+y,13,5,skin.hair);r(-8+h,-33+y,3,7,skin.hair);r(6+h,-33+y,3,7,skin.hair);
  if(skin.detail==='band'){r(-7+h,-34+y,15,2,skin.accent);r(7+h,-33+y,3,2,team.color);r(-4+h,-37+y,6,2,skin.hair);}
  if(skin.detail==='cap'){r(-7+h,-38+y,15,5,team.dark);r(-5+h,-39+y,11,2,team.dark);r(5+h,-34+y,7,2,skin.accent);r(-4+h,-37+y,3,2,team.light);}
  if(skin.ears){r(-7+h,-37+y,14,5,team.color);r(-7+h,-42+y,5,7,team.dark);r(3+h,-42+y,5,7,team.dark);r(-6+h,-40+y,3,4,skin.accent);r(4+h,-40+y,3,4,skin.accent);}
  r(-3+h,-29+y,2,pose.eye?1:3,ink);r(3+h,-29+y,2,pose.eye?1:3,ink);r(-5+h,-26+y,2,2,'#eaa096');r(5+h,-26+y,2,2,'#eaa096');r(h,-24+y,3,1,'#b57670');
}
export class BodySprites{
  constructor(){this.cache=new Map();}
  get(frame,skin,team,playerId){
    const key=[frame.state,frame.index,skin,team.id].join(':');
    if(!this.cache.has(key)){
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
      const c=canvas.getContext('2d');c.translate(32,54);paintBody(c,frame,skin,team,playerId);this.cache.set(key,canvas);
    }
    return this.cache.get(key);
  }
}
