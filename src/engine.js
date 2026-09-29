import { DEFAULTS, COURT, FIXED_DT, sanitizeConfig } from './config.js';
import { integrateBall, launchTo, predictAtHeight, collideNet, isInside, clamp } from './physics.js';
import { SHOTS, SERVES, shotImpulse } from './moves.js';
import { awardRally } from './rules.js';
import { jumpProfile, sampleJump, jumpDuration, serveOrigin, SERVE_WINDUP, blockWindow } from './motion.js';
const HOMES=[7,3.7,.8], ROLES=['receiver','setter','open'], TEAM_SIZE=ROLES.length;
export const EMPTY_INPUT=Object.freeze({axis:0,up:false,down:false,low:false,loft:false,drive:false,block:false,jump:false,dive:false,switch:false,select:0});
const aimOf=i=>({axis:i.axis,up:i.up,down:i.down});
const grounded=p=>p.y<=0&&p.vy<=0&&p.recovery<=0&&!p.diving&&!p.jumpProfile;
export class Match {
  constructor(config=DEFAULTS,seed=2026){this.config=sanitizeConfig(config);this.seed=seed;this.events=[];this.mode='match';this.reset();}
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  sign(team){return team===0?-1:1;}
  isHuman(team){return team===0&&this.mode!=='demo';}
  player(team,role){return this.players.find(p=>p.team===team&&p.role===role);}
  active(team=0){return this.players[this.selected[team]];}
  emit(type,data={}){this.events.push({type,time:this.time,...data});if(this.events.length>80)this.events.shift();}
  label(text,duration=1.6){this.notice=text;this.noticeTime=duration;}
  updateConfig(config){this.config=sanitizeConfig(config);}
  reset(mode=this.mode){
    this.mode=mode;this.time=0;this.rallies=0;this.contacts=0;this.server=0;this.score=[0,0];this.sets=[0,0];this.events=[];
    this.players=[0,1].flatMap(team=>ROLES.map((role,i)=>({id:team*TEAM_SIZE+i,team,role,number:i+1,x:this.sign(team)*HOMES[i],z:4.5,y:0,vy:0,vx:0,pose:'idle',animation:0,block:0,recovery:0,diving:false,diveVelocity:0,blockCooldown:0})));
    this.stats={serves:[0,0],attacks:[0,0],passes:[0,0],blocks:[0,0],softBlocks:[0,0]};this.selected=[0,TEAM_SIZE];this.previousInput={...EMPTY_INPUT};this.label('Ваш маленький большой матч');this.startServe();
  }
  startServe(){
    this.phase='serve';this.phaseTime=0;this.possession=this.server;this.teamPhases=['defense','defense'];this.teamPhases[this.server]='attack';
    this.touches=[0,0];this.lastTouch=null;this.lastPlayer=null;this.shotSerial=0;this.cooldown=0;this.incomingShot='serve';
    this.charge=null;this.pending=null;this.chargeLock=false;this.serveAction=null;this.contactWindow=false;this.trail=[];this.aimPreview=null;this.cpuBlockPlan=null;
    this.selected=[0,TEAM_SIZE];this.cpuMiss=[false,false];this.lastAction='Выберите A, W или D и зажмите';this.assistLabel='Помощь только в направлении паса';
    for(const p of this.players)Object.assign(p,{x:this.sign(p.team)*HOMES[p.id%TEAM_SIZE],y:0,vy:0,vx:0,pose:'idle',animation:0,block:0,recovery:0,diving:false,diveVelocity:0,blockCooldown:0,jumpProfile:null,jumpTime:0,contact:null,facing:-this.sign(p.team),blockUsed:false,swingCooldown:0});
    this.active(this.server).x=this.sign(this.server)*9.4;
    this.ball={x:this.active(this.server).x,y:1.3,z:4.5,vx:0,vy:0,vz:0,spin:0,angle:0};this.emit('serve-ready',{team:this.server});
  }
  tick(dt=FIXED_DT,raw={}){
    const input={...EMPTY_INPUT,...raw},press=key=>input[key]&&!this.previousInput[key];
    if(this.phase==='finished'){this.previousInput=input;return;}
    this.time+=dt;this.phaseTime+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.noticeTime=Math.max(0,this.noticeTime-dt);this.contactWindow=false;
    this.animatePlayers(dt);
    if(['point','set-end'].includes(this.phase)){if(this.phaseTime>2.3){if(this.phase==='set-end')this.score=[0,0];if(this.mode==='practice')this.startDrill(this.drill);else this.startServe();}this.previousInput=input;return;}
    if(this.isHuman(0)){
      if(press('switch')&&this.phase==='rally'&&!this.charge&&!this.pending)this.switchPlayer();
      if(input.select&&input.select!==this.previousInput.select&&this.phase==='rally'&&!this.charge&&!this.pending&&this.players[input.select-1]?.recovery<=0)this.selected[0]=input.select-1;
      if(press('block')&&this.phase==='rally'&&this.teamPhases[0]==='defense')this.requestBlock(0);
      if(press('jump')&&this.phase==='rally')this.jump(this.active(0));
      if(press('dive')&&this.phase==='rally')this.dive(this.active(0),input.axis);
      this.updateCharge(dt,input,press);
    }
    if(this.phase==='serve'){
      if(!this.isHuman(this.server)&&this.phaseTime>1.3)this.beginServe({kind:['low','loft','drive'][Math.floor(this.random()*3)],power:.54,aim:{axis:-this.sign(this.server),up:false,down:false}});
      this.updatePreview();this.previousInput=input;return;
    }
    if(this.phase==='serve-motion'){
      const p=this.active(this.server),origin=serveOrigin(p,this.serveAction.kind,this.config),t=clamp(this.phaseTime/SERVE_WINDUP,0,1);
      this.ball.x=p.x+(origin.x-p.x)*t;this.ball.y=1.3+(origin.y-1.3)*t+Math.sin(Math.PI*t)*.35;
      if(this.phaseTime+1e-9>=SERVE_WINDUP){Object.assign(this.ball,origin);this.executeServe();}this.previousInput=input;return;
    }
    const previous={...this.ball};integrateBall(this.ball,dt,this.config);
    if(collideNet(this.ball,previous,this.config.restitution)){this.emit('net');this.label('Мяч от сетки — ещё можно спасти');}
    this.trail.push({x:this.ball.x,y:this.ball.y});if(this.trail.length>15)this.trail.shift();
    if(this.ball.y<=COURT.ballRadius){this.ball.y=COURT.ballRadius;const inside=isInside(this.ball),side=this.ball.x<0?0:1;this.point(inside?1-side:1-(this.lastTouch??this.server),inside?'МЯЧ КОСНУЛСЯ ПЛОЩАДКИ':this.incomingShot==='block'?'АУТ ОТ БЛОКА':'АУТ');this.previousInput=input;return;}
    if(Math.abs(this.ball.x)>16||this.ball.y>28){this.point(1-(this.lastTouch??this.server),'АУТ');this.previousInput=input;return;}
    this.possession=this.ball.x<0?0:1;this.prediction=predictAtHeight(this.ball,1.4,this.config);
    this.movePlayers(dt,input);this.updateCPU();this.tryBlocks();
    if(this.pending&&this.cooldown<=0)this.tryPending();
    for(const team of [0,1])if(!this.isHuman(team)&&this.cooldown<=0)this.tryCPUContact(team);
    if(this.pending){this.pending.ttl-=dt;if(this.pending.ttl<=0){this.players[this.pending.playerId].swingCooldown=.16;this.pending=null;this.label('Мимо: отпускайте кнопку у мяча',1.2);}}
    const action=this.charge||this.pending;
    this.contactWindow=action?this.canContact(this.players[action.playerId],action.kind):Object.keys(SHOTS).some(k=>this.canContact(this.active(0),k));
    this.updatePreview();this.previousInput=input;
  }
  updateCharge(dt,input,press){
    if(this.phase==='serve'&&this.server!==0)return;if(!['serve','rally'].includes(this.phase))return;
    if(!input.low&&!input.loft&&!input.drive)this.chargeLock=false;
    if(this.charge){
      const a=this.charge,p=this.players[a.playerId];a.aim=aimOf(input);a.age=(a.age||0)+dt;
      if(a.age>this.config.maxHold){this.charge=null;this.chargeLock=true;p.swingCooldown=.22;p.pose='whiff';p.animation=.18;this.label('Передержал! Отпусти кнопку и начни новый замах');}
      else if(input[a.kind])a.power=clamp(a.power+dt/this.config.chargeSeconds,.08,1);
      else{this.charge=null;const action={...a,aim:{...a.aim},ttl:this.config.releaseWindow};if(this.phase==='serve')this.beginServe(action);else{this.pending=action;if(!this.tryPending()&&action.ttl<=0){this.pending=null;p.swingCooldown=.16;this.label('Мимо: касание только у мяча');}}}
    }
    else if(!this.pending&&!this.chargeLock){const kind=Object.keys(SHOTS).find(press),p=this.active(0);if(kind&&p.recovery<=0&&p.swingCooldown<=0&&p.block<=0)this.charge={kind,power:.08,age:0,aim:aimOf(input),playerId:p.id};}
    const preparing=this.charge||this.pending;
    if(preparing){const p=this.players[preparing.playerId];if(!p.diving&&p.block<=0&&!(p.jumpProfile&&p.jumpTime<p.jumpProfile.windup)){p.pose='ready-'+SHOTS[preparing.kind].pose;p.animation=.08;}}
  }
  beginServe(action){this.serveAction=action;this.phase='serve-motion';this.phaseTime=0;const p=this.active(this.server);if(action.kind==='drive')this.jump(p);p.pose=action.kind==='low'?'bump':'set';p.animation=.38;this.emit('toss');this.label(SERVES[action.kind].name);}
  startDrill(drill='receive'){
    this.drill=drill;this.server=0;this.startServe();if(drill==='serve')return;
    this.phase='rally';this.lastTouch=1;this.lastPlayer=TEAM_SIZE;this.teamPhases=['defense','defense'];this.players[0].x=-7;
    if(drill==='set'){this.selected[0]=1;this.teamPhases[0]='attack';Object.assign(this.ball,{x:-3.7,y:4.5,vx:0,vy:0});}
    else if(drill==='spike'){this.selected[0]=0;this.lastTouch=0;this.lastPlayer=1;this.touches[0]=2;this.teamPhases[0]='attack';Object.assign(this.ball,{x:-.8,y:5.4,vx:0,vy:0});}
    else if(drill==='block'){Object.assign(this.ball,{x:3.2,y:3.6});launchTo(this.ball,{x:-5,y:.2,z:4.5},1.15,this.config);this.incomingShot='drive';this.selected[0]=2;}
    else{Object.assign(this.ball,{x:5,y:5});launchTo(this.ball,{x:-7,y:.9,z:4.5},2.1,this.config);this.incomingShot='serve';}
    this.label(drill==='spike'?'3 → ↑ → D: атакуй навес у сетки':'РАЗМИНКА · каждый контакт — ваш');
  }
  executeServe(){
    const p=this.active(this.server),a=this.serveAction;Object.assign(this.ball,shotImpulse(this.ball,p,a.kind,a.power,a.aim,this.players,this.config,true));
    this.phase='rally';this.phaseTime=0;this.lastTouch=this.server;this.lastPlayer=p.id;this.touches=[0,0];this.cooldown=.2;this.incomingShot='serve';this.stats.serves[this.server]++;
    this.teamPhases=['defense','defense'];this.recordContact(p,a.kind,a.power);this.shotSerial++;this.autoSelect(1-this.server);
    this.lastAction=`${SERVES[a.kind].name} · ${Math.round(a.power*100)}%`;this.emit('hit',{kind:a.kind,power:a.power,team:this.server,serve:true,x:this.ball.x,y:this.ball.y,playerId:p.id});this.serveAction=null;this.aimPreview=null;
  }
  switchPlayer(){const current=this.selected[0];for(let i=1;i<=TEAM_SIZE;i++){const next=(current+i)%TEAM_SIZE;if(this.players[next].recovery<=0){this.selected[0]=next;return;}}}
  autoSelect(team,preferred=null){
    if(team===0&&(this.charge||this.pending))return;
    if(!this.isHuman(team)&&this.lastTouch!==team)this.cpuMiss[team]=this.random()<{easy:.18,normal:.09,hard:.035}[this.config.difficulty];
    if(preferred!==null&&this.players[preferred].team===team){this.selected[team]=preferred;return;}
    const target=predictAtHeight(this.ball,1.45,this.config),players=this.players.filter(p=>p.team===team);
    players.sort((a,b)=>(Math.abs(a.x-target.x)+a.recovery*4+a.y)-(Math.abs(b.x-target.x)+b.recovery*4+b.y));this.selected[team]=players[0].id;
  }
  jump(p,block=false){if(!grounded(p))return false;p.jumpProfile=jumpProfile(this.config);p.jumpTime=0;p.vy=0;p.vx=0;p.pose='crouch';p.animation=p.jumpProfile.windup;p.blockUsed=false;if(block){p.block=jumpDuration(p.jumpProfile);p.blockCooldown=this.config.blockCooldown;}return true;}
  requestBlock(team){const front=this.players.filter(p=>p.team===team&&Math.abs(p.x)<3.25&&grounded(p)&&p.blockCooldown<=0).sort((a,b)=>Math.abs(a.x)-Math.abs(b.x));if(!front.length)return false;this.jump(front[0],true);this.emit('jump',{team,playerId:front[0].id});return true;}
  dive(p,axis){if(!grounded(p))return false;p.diving=true;p.vy=2.3;p.diveVelocity=(axis||Math.sign(this.ball.x-p.x)||-this.sign(p.team))*6.5;p.vx=p.diveVelocity;p.pose='dive';p.animation=.5;return true;}
  animatePlayers(dt){
    for(const p of this.players){
      p.animation=Math.max(0,p.animation-dt);p.block=Math.max(0,p.block-dt);p.blockCooldown=Math.max(0,p.blockCooldown-dt);p.recovery=Math.max(0,p.recovery-dt);
      p.swingCooldown=Math.max(0,(p.swingCooldown||0)-dt);
      if(p.contact){p.contact.life-=dt;if(p.contact.life<=0)p.contact=null;}
      if(p.jumpProfile){p.jumpTime+=dt;Object.assign(p,sampleJump(p.jumpProfile,p.jumpTime));if(p.jumpTime>=jumpDuration(p.jumpProfile)){p.jumpProfile=null;p.y=0;p.vy=0;p.block=0;p.pose='land';p.animation=.12;}}
      else if(p.y>0||p.vy>0){p.y=Math.max(0,p.y+p.vy*dt-.5*this.config.gravity*dt*dt);p.vy-=this.config.gravity*dt;if(p.diving)p.x+=p.diveVelocity*dt;
        if(p.y===0){p.vy=0;p.block=0;if(p.diving){p.diving=false;p.recovery=.92;p.pose='belly';p.animation=.92;p.diveVelocity=0;}else{p.pose='land';p.animation=.14;}}}
      if(p.jumpProfile&&p.jumpTime<p.jumpProfile.windup)p.pose='crouch';else if(p.recovery>0)p.pose=p.recovery>.32?'belly':'getup';else if(!p.animation)p.pose=p.diving?'dive':p.block>0?'block':p.y>0?'jump':Math.abs(p.vx)>.1?'run':'idle';
      p.x=clamp(p.x,p.team===0?-10.5:.32,p.team===0?-.32:10.5);
    }
  }
  movePlayers(dt,input){
    for(const p of this.players){if(!grounded(p)){if(!p.diving)p.vx=0;continue;}const old=p.x;
      if(this.isHuman(p.team)){if(p.id===this.selected[0]){p.x+=input.axis*this.config.playerSpeed*dt*(this.charge?this.config.chargeMove:1);if(input.axis)p.facing=input.axis;}}
      else{let target=this.sign(p.team)*HOMES[p.id%TEAM_SIZE];if(this.possession===p.team&&this.ball.vy<4&&this.active(p.team).id===p.id)target=this.prediction.x;p.x+=clamp(target-p.x,-this.config.playerSpeed*dt,this.config.playerSpeed*dt);}
      p.x=clamp(p.x,p.team===0?-10.5:.32,p.team===0?-.32:10.5);p.vx=(p.x-old)/dt;
    }
  }
  canContact(p,kind){
    if(!p||p.recovery>0||p.block>0||this.phase!=='rally'||this.cooldown>0||(p.jumpProfile&&p.jumpTime<p.jumpProfile.windup))return false;
    if((this.ball.x<-.08&&p.team!==0)||(this.ball.x>.08&&p.team!==1))return false;
    if(this.lastPlayer===p.id&&this.lastTouch===p.team)return false;
    const shot=SHOTS[kind];let min=shot.min+p.y,max=shot.max+p.y,reach=shot.reach;
    if(p.diving){if(kind!=='low')return false;min=.12;max=1.2;reach=1.65;}
    return Math.abs(this.ball.x-p.x)<=reach&&this.ball.y>=min&&this.ball.y<=max;
  }
  tryPending(){const a=this.pending,p=this.players[a.playerId];if(!this.canContact(p,a.kind))return false;this.pending=null;return this.makeContact(p,a.kind,a.power,shotImpulse(this.ball,p,a.kind,a.power,a.aim,this.players,this.config));}
  recordContact(p,kind,power){
    p.contact={kind,power,x:this.ball.x,y:this.ball.y,life:.24,at:this.time};
    p.pose=p.diving?'dive':SHOTS[kind]?.pose||'block';p.animation=.24;
  }
  makeContact(p,kind,power,impulse){
    const team=p.team;if(this.lastTouch!==team)this.touches[team]=0;
    if(this.lastTouch===team&&this.lastPlayer===p.id){this.point(1-team,'ДВА КАСАНИЯ ОДНОГО ИГРОКА');return false;}
    this.touches[team]++;if(this.touches[team]>3){this.point(1-team,'ЧЕТВЁРТОЕ КАСАНИЕ');return false;}
    this.lastTouch=team;this.lastPlayer=p.id;this.contacts++;this.cooldown=.13;this.incomingShot=kind;this.shotSerial++;
    Object.assign(this.ball,impulse);this.recordContact(p,kind,power);
    const landing=predictAtHeight(this.ball,.15,this.config),crosses=landing.x*this.sign(team)<0;
    this.teamPhases[team]=crosses?'defense':'attack';this.teamPhases[1-team]='defense';
    if(kind==='drive')this.stats.attacks[team]++;else this.stats.passes[team]++;
    this.lastAction=`${SHOTS[kind].name} · ${Math.round(power*100)}%`;this.assistLabel=impulse.assisted?'Пас слегка скорректирован':'Свободная траектория';this.label(this.lastAction);
    if(crosses){this.autoSelect(1-team);this.scheduleCPUBlock(1-team);}
    else{const candidates=this.players.filter(other=>other.team===team&&other.id!==p.id).sort((a,b)=>Math.abs(a.x-landing.x)-Math.abs(b.x-landing.x));this.autoSelect(team,impulse.targetId??candidates[0]?.id);this.cpuBlockPlan=null;}
    this.emit('hit',{kind,power,team,assisted:impulse.assisted,x:this.ball.x,y:this.ball.y,playerId:p.id});this.aimPreview=null;return true;
  }
  scheduleCPUBlock(team){
    this.cpuBlockPlan=null;if(this.isHuman(team)||this.random()>{easy:.15,normal:.32,hard:.52}[this.config.difficulty])return;
    const b={...this.ball};let crossing=null;for(let n=1;n<240;n++){const old=b.x;integrateBall(b,FIXED_DT,this.config);if(old*b.x<=0){crossing={t:n*FIXED_DT,y:b.y};break;}}
    const profile=jumpProfile(this.config),lead=profile.windup+profile.rise+profile.hang/2;
    if(crossing&&crossing.y>2.7&&crossing.y<3.8)this.cpuBlockPlan={team,at:this.time+Math.max(.02,crossing.t+.045-lead),serial:this.shotSerial};
  }
  updateCPU(){
    if(this.cpuBlockPlan&&this.time>=this.cpuBlockPlan.at){const plan=this.cpuBlockPlan;this.cpuBlockPlan=null;if(plan.serial===this.shotSerial)this.requestBlock(plan.team);}
    for(const team of [0,1]){if(this.isHuman(team)||this.possession!==team)continue;const p=this.active(team);if(this.touches[team]>=2&&this.lastTouch===team){const target=predictAtHeight(this.ball,3,this.config);if(target.time<.33+this.config.jumpWindup&&this.ball.vy<2&&Math.abs(p.x-target.x)<.6)this.jump(p);}}
  }
  tryCPUContact(team){
    if(this.possession!==team)return;const p=this.active(team),count=this.lastTouch===team?this.touches[team]:0,kind=count>=2?'drive':count===1?'loft':'low';
    if(!this.canContact(p,kind)||this.ball.vy>0.2||(count===0&&this.cpuMiss[team]))return;
    const s=this.sign(team);let target,seconds,next;
    if(count<2){next=this.player(team,count===0?'setter':'open');if(next.id===p.id)next=this.players.find(other=>other.team===team&&other.id!==p.id&&other.role!=='receiver')||this.player(team,'receiver');target={x:next.x,y:count===0?2.2:3,z:4.5};seconds=1.25;}
    else{const blocker=this.players.some(other=>other.team!==team&&other.block>0);target={x:-s*(4+this.random()*4),y:.15,z:4.5};seconds=blocker||this.random()<.22?1.7:1.15;}
    const shot={...this.ball};launchTo(shot,target,seconds,this.config,count===2?.3:0);
    this.makeContact(p,kind,.55,{vx:shot.vx,vy:shot.vy,vz:0,spin:shot.spin,assisted:false,targetId:next?.id??null});
  }
  tryBlocks(){
    if(this.cooldown>0||this.incomingShot==='serve')return false;
    for(const p of this.players){if(p.team===this.lastTouch||!blockWindow(p,this.config))continue;
      const handX=p.x-this.sign(p.team)*.22,handY=p.y+2.05;
      if(Math.abs(this.ball.x-handX)<this.config.blockReach&&Math.abs(this.ball.y-handY)<.4&&this.ball.y>COURT.netHeight){
        const attacker=1-p.team,apex=p.jumpProfile.windup+p.jumpProfile.rise+p.jumpProfile.hang/2;
        const perfect=Math.abs(p.jumpTime-apex)<this.config.blockWindow*.19&&Math.abs(this.ball.y-handY)<.2;
        p.blockUsed=true;this.ball.vx=-this.sign(p.team)*Math.max(3,Math.abs(this.ball.vx)*this.config.blockDeflect);this.ball.vy=perfect?-1.4:2.4;
        // Opponent contact resets the touch sequence even without a centre crossing.
        this.lastTouch=p.team;this.lastPlayer=null;this.touches=[0,0];this.cooldown=.07;this.incomingShot='block';this.shotSerial++;
        this.teamPhases=['defense','defense'];this.stats.blocks[p.team]++;if(!perfect)this.stats.softBlocks[p.team]++;this.cpuBlockPlan=null;this.recordContact(p,'block',.6);this.autoSelect(attacker);this.label(perfect?'ТОЧНЫЙ БЛОК!':'СМЯГЧЕНИЕ — розыгрыш продолжается');this.emit('block',{team:p.team,kind:'block',perfect,x:this.ball.x,y:this.ball.y,playerId:p.id});return true;
      }
    }return false;
  }
  updatePreview(){
    this.aimPreview=null;const action=this.charge||this.pending;if(!action||!this.config.trajectory)return;
    const p=this.players[action.playerId],serving=this.phase==='serve';
    if(!serving&&!this.canContact(p,action.kind))return;
    const origin=serving?{...this.ball,...serveOrigin(p,action.kind,this.config,true)}:{...this.ball};
    this.aimPreview={...origin,...shotImpulse(origin,p,action.kind,action.power,action.aim,this.players,this.config,serving),kind:action.kind};
  }
  point(winner,reason){
    if(['point','set-end','finished'].includes(this.phase))return;this.rallies++;const result=this.mode==='practice'?{scored:false,setWon:false,matchWon:false}:awardRally(this,winner,this.config);
    this.phase=result.matchWon?'finished':result.setWon?'set-end':'point';this.phaseTime=0;this.pointWinner=winner;this.pointReason=reason;this.charge=null;this.pending=null;this.aimPreview=null;this.cpuBlockPlan=null;
    this.ball.vx=this.ball.vy=this.ball.vz=0;this.contactWindow=false;this.label(this.mode==='practice'?'ПОПРОБУЕМ ЕЩЁ':result.matchWon?'ОТЛИЧНЫЙ МАТЧ!':result.setWon?'СЕТ ЗАВЕРШЁН':result.scored?'ОЧКО!':'ПЕРЕХОД ПОДАЧИ',3);this.emit('point',{winner,reason,...result});
  }
}
