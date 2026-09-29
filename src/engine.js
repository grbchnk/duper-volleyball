import { DEFAULTS, COURT, FIXED_DT, sanitizeConfig } from './config.js';
import { integrateBall, launchTo, predictAtHeight, collideNet, isInside, clamp } from './physics.js';
import { SHOTS, SERVES, CHARGE_SECONDS, RELEASE_WINDOW, shotImpulse } from './moves.js';
import { awardRally } from './rules.js';
const HOMES=[7,4.6,2.5,.7], ROLES=['receiver','open','quick','setter'];
export const EMPTY_INPUT=Object.freeze({axis:0,up:false,down:false,low:false,loft:false,drive:false,block:false,jump:false,dive:false,switch:false});
const aimOf=i=>({axis:i.axis,up:i.up,down:i.down});
const grounded=p=>p.y<=0&&p.vy<=0&&p.recovery<=0&&!p.diving;
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
    this.players=[0,1].flatMap(team=>ROLES.map((role,i)=>({id:team*4+i,team,role,number:i+1,x:this.sign(team)*HOMES[i],z:4.5,y:0,vy:0,vx:0,pose:'idle',animation:0,block:0,recovery:0,diving:false,diveVelocity:0,blockCooldown:0})));
    this.stats={serves:[0,0],attacks:[0,0],blocks:[0,0],passes:[0,0]};this.selected=[0,4];this.previousInput={...EMPTY_INPUT};this.label('Ваш маленький большой матч');this.startServe();
  }
  startServe(){
    this.phase='serve';this.phaseTime=0;this.possession=this.server;this.teamPhases=['defense','defense'];this.teamPhases[this.server]='attack';
    this.touches=[0,0];this.lastTouch=null;this.lastPlayer=null;this.shotSerial=0;this.cooldown=0;this.incomingShot='serve';
    this.charge=null;this.pending=null;this.serveAction=null;this.contactWindow=false;this.trail=[];this.aimPreview=null;this.cpuBlockPlan=null;
    this.selected=[0,4];this.cpuMiss=[false,false];this.lastAction='Выберите J, L или I и зажмите';this.assistLabel='Помощь только в направлении паса';
    for(const p of this.players)Object.assign(p,{x:this.sign(p.team)*HOMES[p.id%4],y:0,vy:0,vx:0,pose:'idle',animation:0,block:0,recovery:0,diving:false,diveVelocity:0,blockCooldown:0});
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
      const p=this.active(this.server);this.ball.x=p.x;this.ball.y=1.4+p.y+Math.min(.5,this.phaseTime*3);
      if(this.phaseTime>=.27)this.executeServe();this.previousInput=input;return;
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
    if(this.pending){this.pending.ttl-=dt;if(this.pending.ttl<=0){this.pending=null;this.label('Мимо: отпускайте кнопку ближе к мячу',1.2);}}
    const action=this.charge||this.pending;
    this.contactWindow=action?this.canContact(this.players[action.playerId],action.kind):Object.keys(SHOTS).some(k=>this.canContact(this.active(0),k));
    this.updatePreview();this.previousInput=input;
  }
  updateCharge(dt,input,press){
    if(this.phase==='serve'&&this.server!==0)return;if(!['serve','rally'].includes(this.phase))return;
    if(this.charge){this.charge.aim=aimOf(input);if(input[this.charge.kind])this.charge.power=clamp(this.charge.power+dt/CHARGE_SECONDS,.08,1);else{const action={...this.charge,aim:{...this.charge.aim},ttl:RELEASE_WINDOW};this.charge=null;if(this.phase==='serve')this.beginServe(action);else this.pending=action;}}
    else if(!this.pending){const kind=Object.keys(SHOTS).find(press);if(kind&&this.active(0).recovery<=0)this.charge={kind,power:.08,aim:aimOf(input),playerId:this.active(0).id};}
  }
  beginServe(action){this.serveAction=action;this.phase='serve-motion';this.phaseTime=0;const p=this.active(this.server);if(action.kind==='drive')this.jump(p);p.pose=action.kind==='low'?'bump':'set';p.animation=.38;this.emit('toss');this.label(SERVES[action.kind].name);}
  startDrill(drill='receive'){
    this.drill=drill;this.server=0;this.startServe();if(drill==='serve')return;
    this.phase='rally';this.lastTouch=1;this.lastPlayer=4;this.teamPhases=['defense','defense'];this.players[0].x=-7;
    if(drill==='set'){this.selected[0]=1;this.teamPhases[0]='attack';Object.assign(this.ball,{x:-4.6,y:4.5,vx:0,vy:0});}
    else if(drill==='block'){Object.assign(this.ball,{x:3.2,y:3.6});launchTo(this.ball,{x:-5,y:.2,z:4.5},1.15,this.config);this.incomingShot='drive';this.selected[0]=2;}
    else{Object.assign(this.ball,{x:5,y:5});launchTo(this.ball,{x:-7,y:.9,z:4.5},2.1,this.config);this.incomingShot='serve';}
    this.label('РАЗМИНКА · каждый контакт — ваш');
  }
  executeServe(){
    const p=this.active(this.server),a=this.serveAction;Object.assign(this.ball,shotImpulse(this.ball,p,a.kind,a.power,a.aim,this.players,this.config,true));
    this.phase='rally';this.phaseTime=0;this.lastTouch=this.server;this.lastPlayer=p.id;this.touches=[0,0];this.cooldown=.2;this.incomingShot='serve';this.stats.serves[this.server]++;
    this.teamPhases=['defense','defense'];p.pose=a.kind==='low'?'bump':'spike';p.animation=.35;this.shotSerial++;this.autoSelect(1-this.server);
    this.lastAction=`${SERVES[a.kind].name} · ${Math.round(a.power*100)}%`;this.emit('hit',{kind:a.kind,power:a.power,team:this.server,serve:true});this.serveAction=null;this.aimPreview=null;
  }
  switchPlayer(){const current=this.selected[0];for(let i=1;i<=4;i++){const next=(current+i)%4;if(this.players[next].recovery<=0){this.selected[0]=next;return;}}}
  autoSelect(team,preferred=null){
    if(team===0&&(this.charge||this.pending))return;
    if(!this.isHuman(team)&&this.lastTouch!==team)this.cpuMiss[team]=this.random()<{easy:.18,normal:.09,hard:.035}[this.config.difficulty];
    if(preferred!==null&&this.players[preferred].team===team){this.selected[team]=preferred;return;}
    const target=predictAtHeight(this.ball,1.45,this.config),players=this.players.filter(p=>p.team===team);
    players.sort((a,b)=>(Math.abs(a.x-target.x)+a.recovery*4+a.y)-(Math.abs(b.x-target.x)+b.recovery*4+b.y));this.selected[team]=players[0].id;
  }
  jump(p,block=false){if(!grounded(p))return false;p.vy=this.config.jumpSpeed;p.vx=0;p.pose=block?'block':'jump';p.animation=.18;if(block){p.block=2*this.config.jumpSpeed/this.config.gravity;p.blockCooldown=1.5;}return true;}
  requestBlock(team){const front=this.players.filter(p=>p.team===team&&Math.abs(p.x)<3.25&&grounded(p)&&p.blockCooldown<=0).sort((a,b)=>Math.abs(a.x)-Math.abs(b.x));if(!front.length)return false;this.jump(front[0],true);this.emit('jump',{team,playerId:front[0].id});return true;}
  dive(p,axis){if(!grounded(p))return false;p.diving=true;p.vy=2.3;p.diveVelocity=(axis||Math.sign(this.ball.x-p.x)||-this.sign(p.team))*6.5;p.vx=p.diveVelocity;p.pose='dive';p.animation=.5;return true;}
  animatePlayers(dt){
    for(const p of this.players){
      p.animation=Math.max(0,p.animation-dt);p.block=Math.max(0,p.block-dt);p.blockCooldown=Math.max(0,p.blockCooldown-dt);p.recovery=Math.max(0,p.recovery-dt);
      if(p.y>0||p.vy>0){p.y=Math.max(0,p.y+p.vy*dt-.5*this.config.gravity*dt*dt);p.vy-=this.config.gravity*dt;if(p.diving)p.x+=p.diveVelocity*dt;
        if(p.y===0){p.vy=0;p.block=0;if(p.diving){p.diving=false;p.recovery=.92;p.pose='belly';p.animation=.92;p.diveVelocity=0;}else{p.pose='land';p.animation=.14;}}}
      if(p.recovery>0)p.pose=p.recovery>.32?'belly':'getup';else if(!p.animation)p.pose=p.diving?'dive':p.block>0?'block':p.y>0?'jump':Math.abs(p.vx)>.1?'run':'idle';
      p.x=clamp(p.x,p.team===0?-10.5:.32,p.team===0?-.32:10.5);
    }
  }
  movePlayers(dt,input){
    for(const p of this.players){if(!grounded(p)){if(!p.diving)p.vx=0;continue;}const old=p.x;
      if(this.isHuman(p.team)){if(p.id===this.selected[0]&&!this.charge&&!this.pending)p.x+=input.axis*this.config.playerSpeed*dt;}
      else{let target=this.sign(p.team)*HOMES[p.id%4];if(this.possession===p.team&&this.ball.vy<4&&this.active(p.team).id===p.id)target=this.prediction.x;p.x+=clamp(target-p.x,-this.config.playerSpeed*dt,this.config.playerSpeed*dt);}
      p.x=clamp(p.x,p.team===0?-10.5:.32,p.team===0?-.32:10.5);p.vx=(p.x-old)/dt;
    }
  }
  canContact(p,kind){
    if(!p||p.recovery>0||p.block>0||this.phase!=='rally'||this.cooldown>0)return false;
    if((this.ball.x<-.08&&p.team!==0)||(this.ball.x>.08&&p.team!==1))return false;
    if(this.lastPlayer===p.id&&this.lastTouch===p.team)return false;
    const shot=SHOTS[kind];let min=shot.min+p.y,max=shot.max+p.y,reach=shot.reach;
    if(p.diving){if(kind!=='low')return false;min=.12;max=1.2;reach=1.65;}
    return Math.abs(this.ball.x-p.x)<=reach&&this.ball.y>=min&&this.ball.y<=max;
  }
  tryPending(){const a=this.pending,p=this.players[a.playerId];if(!this.canContact(p,a.kind))return false;this.pending=null;return this.makeContact(p,a.kind,a.power,shotImpulse(this.ball,p,a.kind,a.power,a.aim,this.players,this.config));}
  makeContact(p,kind,power,impulse){
    const team=p.team;if(this.lastTouch!==team)this.touches[team]=0;
    if(this.lastTouch===team&&this.lastPlayer===p.id){this.point(1-team,'ДВА КАСАНИЯ ОДНОГО ИГРОКА');return false;}
    this.touches[team]++;if(this.touches[team]>3){this.point(1-team,'ЧЕТВЁРТОЕ КАСАНИЕ');return false;}
    this.lastTouch=team;this.lastPlayer=p.id;this.contacts++;this.cooldown=.13;this.incomingShot=kind;this.shotSerial++;
    Object.assign(this.ball,impulse);p.pose=p.diving?'dive':SHOTS[kind].pose;p.animation=.32;
    const landing=predictAtHeight(this.ball,.15,this.config),crosses=landing.x*this.sign(team)<0;
    this.teamPhases[team]=crosses?'defense':'attack';this.teamPhases[1-team]='defense';
    if(kind==='drive')this.stats.attacks[team]++;else this.stats.passes[team]++;
    this.lastAction=`${SHOTS[kind].name} · ${Math.round(power*100)}%`;this.assistLabel=impulse.assisted?'Пас слегка скорректирован':'Свободная траектория';this.label(this.lastAction);
    if(crosses){this.autoSelect(1-team);this.scheduleCPUBlock(1-team);}
    else{const candidates=this.players.filter(other=>other.team===team&&other.id!==p.id).sort((a,b)=>Math.abs(a.x-landing.x)-Math.abs(b.x-landing.x));this.autoSelect(team,impulse.targetId??candidates[0]?.id);this.cpuBlockPlan=null;}
    this.emit('hit',{kind,power,team,assisted:impulse.assisted});this.aimPreview=null;return true;
  }
  scheduleCPUBlock(team){
    this.cpuBlockPlan=null;if(this.isHuman(team)||this.random()>{easy:.15,normal:.32,hard:.52}[this.config.difficulty])return;
    const b={...this.ball};let crossing=null;for(let n=1;n<240;n++){const old=b.x;integrateBall(b,FIXED_DT,this.config);if(old*b.x<=0){crossing={t:n*FIXED_DT,y:b.y};break;}}
    if(crossing&&crossing.y>2.35&&crossing.y<3.7)this.cpuBlockPlan={team,at:this.time+Math.max(.08,crossing.t-.3),serial:this.shotSerial};
  }
  updateCPU(){
    if(this.cpuBlockPlan&&this.time>=this.cpuBlockPlan.at){const plan=this.cpuBlockPlan;this.cpuBlockPlan=null;if(plan.serial===this.shotSerial)this.requestBlock(plan.team);}
    for(const team of [0,1]){if(this.isHuman(team)||this.possession!==team)continue;const p=this.active(team);if(this.touches[team]>=2&&this.lastTouch===team){const target=predictAtHeight(this.ball,3,this.config);if(target.time<.33&&this.ball.vy<2&&Math.abs(p.x-target.x)<.6)this.jump(p);}}
  }
  tryCPUContact(team){
    if(this.possession!==team)return;const p=this.active(team),count=this.lastTouch===team?this.touches[team]:0,kind=count>=2?'drive':count===1?'loft':'low';
    if(!this.canContact(p,kind)||this.ball.vy>0.2||(count===0&&this.cpuMiss[team]))return;
    const s=this.sign(team);let target,seconds;
    if(count===0){target={x:this.player(team,'setter').x,y:2.2,z:4.5};seconds=1.25;}
    else if(count===1){target={x:this.player(team,'open').x,y:3,z:4.5};seconds=1.25;}
    else{target={x:-s*(4+this.random()*4),y:.15,z:4.5};seconds=1.15;}
    const shot={...this.ball};launchTo(shot,target,seconds,this.config,count===2?.3:0);
    this.makeContact(p,kind,.55,{vx:shot.vx,vy:shot.vy,vz:0,spin:shot.spin,assisted:false,targetId:count===0?this.player(team,'setter').id:count===1?this.player(team,'open').id:null});
  }
  tryBlocks(){
    if(this.cooldown>0||this.incomingShot==='serve')return false;
    for(const p of this.players){if(p.team===this.lastTouch||p.block<=0||p.y<.1)continue;
      if(Math.abs(this.ball.x-p.x)<.65&&this.ball.y>2.2&&this.ball.y<p.y+2.65){
        const attacker=1-p.team;this.ball.vx=-this.sign(p.team)*Math.max(3.5,Math.abs(this.ball.vx)*.57);this.ball.vy=-.65;
        // Opponent contact resets the touch sequence even without a centre crossing.
        this.lastTouch=p.team;this.lastPlayer=null;this.touches=[0,0];this.cooldown=.07;this.incomingShot='block';this.shotSerial++;
        this.teamPhases=['defense','defense'];this.stats.blocks[p.team]++;this.cpuBlockPlan=null;this.autoSelect(attacker);this.label('БЛОК! Новый приём — J снизу');this.emit('block',{team:p.team});return true;
      }
    }return false;
  }
  updatePreview(){const action=this.charge||this.pending;if(!action){this.aimPreview=null;return;}const p=this.players[action.playerId],origin={...this.ball};if(this.phase==='serve')origin.y=action.kind==='drive'?3:1.9;this.aimPreview={...origin,...shotImpulse(origin,p,action.kind,action.power,action.aim,this.players,this.config,this.phase==='serve')};}
  point(winner,reason){
    if(['point','set-end','finished'].includes(this.phase))return;this.rallies++;const result=this.mode==='practice'?{scored:false,setWon:false,matchWon:false}:awardRally(this,winner,this.config);
    this.phase=result.matchWon?'finished':result.setWon?'set-end':'point';this.phaseTime=0;this.pointWinner=winner;this.pointReason=reason;this.charge=null;this.pending=null;this.aimPreview=null;this.cpuBlockPlan=null;
    this.ball.vx=this.ball.vy=this.ball.vz=0;this.contactWindow=false;this.label(this.mode==='practice'?'ПОПРОБУЕМ ЕЩЁ':result.matchWon?'ОТЛИЧНЫЙ МАТЧ!':result.setWon?'СЕТ ЗАВЕРШЁН':result.scored?'ОЧКО!':'ПЕРЕХОД ПОДАЧИ',3);this.emit('point',{winner,reason,...result});
  }
}
