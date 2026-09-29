import { COURT } from './config.js';
import { clamp, integrateBall, collideNet } from './physics.js';
export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.camera=0;this.particles=[];this.shake=0;this.background=document.createElement('canvas');this.background.width=960;this.background.height=540;this.makeBackground();}
  rect(x,y,w,h,color,ctx=this.ctx){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  text(str,x,y,size=12,color='#454b47',align='left',ctx=this.ctx){ctx.font=`bold ${size}px "Consolas",monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(str,Math.round(x),Math.round(y));}
  makeBackground(){
    const c=this.background.getContext('2d'),r=(x,y,w,h,col)=>this.rect(x,y,w,h,col,c);
    r(0,0,960,540,'#d0e9df');r(0,80,960,230,'#dceee7');
    for(const [x,y,s]of[[35,117,1],[300,103,.7],[730,142,1.2],[540,83,.6]]){r(x+12*s,y-10*s,44*s,26*s,'#fdf9e9');r(x,y,90*s,17*s,'#fdf9e9');r(x+18*s,y+17*s,54*s,4*s,'#c9ded7');}
    r(814,96,38,38,'#f3d8a0');r(805,107,56,18,'#f3d8a0');r(824,86,18,58,'#f3d8a0');r(825,109,3,4,'#b69f7f');r(841,109,3,4,'#b69f7f');r(830,121,8,2,'#cda77d');
    for(let x=-20;x<990;x+=85){const h=30+Math.sin(x*2)*15;r(x,264-h,90,h+90,'#b4d2b6');r(x+15,255-h,60,20,'#b4d2b6');}
    r(0,328,960,212,'#9ebd91');
    for(const x of[27,145,805,925]){r(x+9,245,10,98,'#b69673');r(x-22,213,67,57,'#82b99a');r(x-32,225,87,25,'#82b99a');r(x-13,201,48,14,'#94c7a5');r(x-15,218,26,11,'#a5d1ab');r(x+26,249,7,12,'#73a58c');}
    // Bunting, fence and little spectators, all original pixel drawings.
    c.strokeStyle='#7eaa97';c.lineWidth=2;c.beginPath();c.moveTo(0,202);c.quadraticCurveTo(470,295,960,202);c.stroke();
    for(let x=15;x<960;x+=44){const y=202+Math.sin(x/960*Math.PI)*43;c.fillStyle=['#e9a49a','#e8d399','#9fbdc1','#bbafd0'][Math.floor(x/44)%4];c.beginPath();c.moveTo(x,y);c.lineTo(x+20,y+2);c.lineTo(x+10,y+24);c.fill();}
    r(0,356,960,5,'#f4edd6');r(0,376,960,5,'#f4edd6');for(let x=10;x<960;x+=32)r(x,346,5,48,'#f9f3df');
    for(let i=0;i<18;i++){const x=65+i*47,y=338+(i%2)*8;const colors=['#d4acb6','#b0b8d2','#d6c488','#a4c5b0'];r(x-8,y,17,14,colors[i%4]);r(x-6,y-12,13,13,'#f3d2ac');r(x-7,y-15,15,6,i%3===0?'#b2886d':'#79786e');r(x-3,y-7,2,2,'#6d615e');r(x+3,y-7,2,2,'#6d615e');r(x-3,y+14,4,4,'#786d6b');r(x+4,y+14,4,4,'#786d6b');}
    r(52,389,856,117,'#e6b99a');r(60,396,840,102,'#ebc6a4');r(60,401,840,4,'#f2d7b5');
    for(let x=65;x<900;x+=46)r(x,406,1,86,'#dfb995');
    r(78,422,804,3,'#fff8db');r(78,480,804,3,'#fff8db');
    r(0,506,960,34,'#a6c29a');for(let x=13;x<960;x+=31){r(x,516,2,6,'#8eaf8c');r(x+3,513,2,7,'#8eaf8c');if(x%4===1){r(x+7,522,5,2,'#faeed0');r(x+9,520,2,6,'#faeed0');}}
    this.text('S U N N Y S I D E   V O L L E Y   C L U B',480,524,11,'#557969','center',c);
  }
  project(x,y=0){return{x:480+x*40,y:450-y*42};}
  draw(m,teams,dt=1/60){
    const c=this.ctx;c.drawImage(this.background,0,0);c.save();
    for(const x of[-9,-3,0,3,9]){const p=this.project(x);this.rect(p.x-1,423,3,59,'#fff8df');}
    this.rect(478,422,5,60,'#fff8df');
    if(m.aimPreview)this.trajectory(m.aimPreview,m.config,true);
    else if(m.config.trajectory&&m.phase==='rally')this.trajectory(m.ball,m.config,false);
    const b=this.project(m.ball.x);c.fillStyle='#af99736b';c.beginPath();c.ellipse(b.x,456,9,3,0,0,Math.PI*2);c.fill();
    if(m.prediction&&m.phase==='rally'&&m.ball.x<0){const p=this.project(m.prediction.x);c.strokeStyle='#698c8070';c.setLineDash([3,3]);c.strokeRect(p.x-12,449,24,8);c.setLineDash([]);}
    for(const p of m.players)this.drawPlayer(p,teams[p.team],m);
    this.drawNet();this.drawBall(m);this.drawParticles(dt);c.restore();this.drawHUD(m,teams);
    if(m.noticeTime>0&&m.phase==='rally'){const width=Math.min(510,m.notice.length*7.2+25);this.rect(480-width/2,83,width,25,'#fff8e9e8');this.text(m.notice,480,100,12,'#62796a','center');}
    if(['point','set-end'].includes(m.phase)){
      this.rect(290,176,380,126,'#fff9eaf2');this.rect(300,186,360,3,teams[m.pointWinner].color);this.text(m.notice,480,216,24,'#476756','center');this.text(teams[m.pointWinner].name,480,249,15,teams[m.pointWinner].dark,'center');this.text(m.pointReason,480,281,11,'#a48675','center');
    }
    if(m.charge||m.pending){const a=m.charge||m.pending;const p=this.project(m.players[a.playerId].x,m.players[a.playerId].y);this.rect(p.x-28,p.y-86,56,8,'#fff9e9');this.rect(p.x-26,p.y-84,52*a.power,4,a.power>.88?'#dc806d':'#709f82');}
  }
  drawPlayer(p,team,m){
    const c=this.ctx,pos=this.project(p.x,p.y),floor=this.project(p.x),dir=p.diving?Math.sign(p.diveVelocity):p.team===0?1:-1;
    c.fillStyle='#b08e6a50';c.beginPath();c.ellipse(floor.x,457,14,4,0,0,Math.PI*2);c.fill();
    c.save();c.translate(Math.round(pos.x),Math.round(pos.y));c.scale(dir*2.1,2.1);
    const r=(x,y,w,h,col)=>this.rect(x,y,w,h,col),ink='#665d62',skin='#f4cfac',hair=['#765f5a','#b38465','#695d6c','#aa826b'][p.id%4];
    const diving=p.diving||p.pose==='belly';
    if(diving){c.translate(-3,-5);c.rotate(Math.PI/2-.12);}
    const bob=p.pose==='run'?Math.sin(m.time*17)*1.3:p.pose==='idle'?Math.sin(m.time*3+p.id)*.4:0;
    const step=p.pose==='run'?Math.sin(m.time*17)*2.5:0;const crouch=p.pose==='bump'||p.pose==='land'?2:p.pose==='getup'?4:0;c.translate(0,bob+crouch);
    // Chibi proportions: large head, tiny limbs, jersey and animal-eared cap.
    r(-6-step,-7,4,6,skin);r(3+step,-7,4,6,skin);r(-7-step,-2,7,3,ink);r(3+step,-2,7,3,ink);r(-6-step,-2,6,2,'#fff5dd');r(4+step,-2,6,2,'#fff5dd');
    r(-7,-11,15,5,team.dark);r(-5,-10,4,5,team.dark);r(3,-10,4,5,team.dark);
    r(-8,-22,17,13,ink);r(-7,-21,15,11,team.color);r(-7,-21,3,11,team.dark);r(5,-20,3,9,team.light);r(-3,-21,7,2,'#fff2dd');
    r(-9,-34,19,13,ink);r(-8,-35,17,13,skin);r(-7,-36,15,5,hair);r(-9,-33,4,7,hair);r(7,-33,3,7,hair);r(-7,-37,14,5,team.color);
    r(-8,-41,5,6,team.dark);r(4,-41,5,6,team.dark);r(-7,-40,3,4,team.light);r(5,-40,3,4,team.light);
    r(-3,-29,2,3,ink);r(4,-29,2,3,ink);r(-6,-26,3,2,'#eaa096');r(6,-26,3,2,'#eaa096');r(0,-24,3,1,'#b57670');
    const arm=(x1,y1,x2,y2,x3,y3)=>{c.lineCap='square';c.lineWidth=5;c.strokeStyle=ink;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x3,y3);c.stroke();c.lineWidth=3;c.strokeStyle=skin;c.stroke();r(x3-1,y3-1,3,3,skin);};
    if(p.pose==='block'||p.block>0){arm(-7,-20,-10,-30,-10,-39);arm(7,-20,12,-30,12,-39);}
    else if(p.pose==='set'){arm(-7,-20,-12,-29,-5,-36);arm(7,-20,13,-29,7,-36);}
    else if(p.pose==='bump'||p.diving){arm(-7,-20,2,-17,14,-19);arm(7,-20,10,-18,16,-19);r(12,-20,6,3,'#fff0dd');}
    else if(p.pose==='spike'){arm(-7,-20,-12,-23,-12,-28);arm(7,-20,13,-30,7,-38);}
    else if(p.pose==='jump'){arm(-7,-20,-12,-26,-13,-30);arm(7,-20,12,-26,14,-30);}
    else{arm(-7,-20,-10-step,-16,-7-step,-13);arm(7,-20,11+step,-16,10+step,-13);}
    c.save();c.scale(dir,1);this.text(String(p.number),dir,-13,7,'#fff7e4','center');c.restore();c.restore();
    if(p.id===m.selected[0]&&m.mode!=='demo'){
      const y=pos.y-99;c.fillStyle='#5f8470';c.beginPath();c.moveTo(pos.x-5,y);c.lineTo(pos.x+5,y);c.lineTo(pos.x,y+6);c.fill();this.text('YOU',pos.x,y-4,8,'#426c5b','center');
    }
    if(p.recovery>0){this.text('···',pos.x,pos.y-25,15,'#a27970','center');}
  }
  drawNet(){const c=this.ctx,x=480,top=450-COURT.netHeight*42;this.rect(x-4,top,8,111,'#718b83');this.rect(x-2,top,3,113,'#f7f2dd');this.rect(x-10,top,22,3,'#fffbee');this.rect(x+8,top-19,2,22,'#d3897c');for(let y=top+8;y<461;y+=8)this.rect(x-7,y,17,1,'#a9b9a7');this.rect(x-10,461,24,5,'#d29d82');}
  drawBall(m){
    const c=this.ctx,p=this.project(m.ball.x,m.ball.y),y=Math.max(84,p.y);
    if(Math.hypot(m.ball.vx,m.ball.vy)>5)for(let i=0;i<m.trail.length;i+=4){const t=this.project(m.trail[i].x,m.trail[i].y);this.rect(t.x-3,t.y-3,6,6,'#fff4d480');}
    if(p.y<84)this.text('↑',clamp(p.x,15,945),81,15,'#bb776b','center');
    if(m.contactWindow){c.strokeStyle='#cc7967';c.lineWidth=2;c.beginPath();c.arc(p.x,y,16,0,Math.PI*2);c.stroke();}
    c.save();c.translate(Math.round(p.x),Math.round(y));c.rotate(m.ball.angle);c.fillStyle='#788b83';c.beginPath();c.arc(0,0,10,0,Math.PI*2);c.fill();c.fillStyle='#fff9d9';c.beginPath();c.arc(0,0,8,0,Math.PI*2);c.fill();c.strokeStyle='#d6957f';c.lineWidth=3;c.beginPath();c.moveTo(-7,-2);c.quadraticCurveTo(0,-5,7,1);c.moveTo(0,-8);c.quadraticCurveTo(-2,0,3,7);c.stroke();c.restore();
    if(m.contactWindow&&m.mode!=='demo')this.text(m.charge?'ОТПУСТИТЕ':'КАСАНИЕ',p.x,y-22,9,'#9e665b','center');
  }
  trajectory(ball,config,preview){const b={...ball},c=this.ctx;c.fillStyle=preview?'#698d7fc0':'#fff5d29c';for(let i=0;i<190;i++){const old={...b};integrateBall(b,1/60,config);collideNet(b,old,config.restitution);if(b.y<.1){const p=this.project(b.x);this.rect(p.x-6,456,12,3,preview?'#698d7f':'#fff5d2');break;}if(i%9===0){const p=this.project(b.x,b.y);c.fillRect(p.x-2,p.y-2,4,4);}}}
  drawHUD(m,teams){
    this.rect(0,0,960,73,'#fff8e9');this.rect(0,71,960,2,'#c5d0b8');
    this.rect(29,17,8,34,teams[0].color);this.text(teams[0].short,48,34,17,teams[0].dark);this.text(m.mode==='demo'?'CPU':'ВАША КОМАНДА',48,51,9,'#839286');
    this.rect(923,17,8,34,teams[1].color);this.text(teams[1].short,912,34,17,teams[1].dark,'right');this.text('КОМПЬЮТЕР',912,51,9,'#839286','right');
    this.text(`${String(m.score[0]).padStart(2,'0')} : ${String(m.score[1]).padStart(2,'0')}`,480,41,32,'#526e5f','center');this.text(`СЕТ ${m.sets[0]+m.sets[1]+1}  /  ${m.sets.join(' — ')}`,480,61,9,'#8d9b84','center');
    const phase=m.teamPhases[0]==='attack'?'АТАКА':'ЗАЩИТА';this.text(m.phase==='serve'?'ПОДАЧА':phase,265,34,11,'#8d7867','center');this.text(`${m.touches[0]} / 3 КАСАНИЯ`,265,51,9,'#8b998a','center');
    this.text('J  L  I',697,32,13,'#7d917a','center');this.text('ЗАЖМИ → ОТПУСТИ',697,51,8,'#8b998a','center');
  }
  effect(e,m){if(e.type==='hit'||e.type==='block'){const p=this.project(m.ball.x,m.ball.y);for(let i=0;i<8;i++)this.particles.push({x:p.x,y:p.y,vx:Math.cos(i)*40,vy:Math.sin(i)*40,life:.3});}}
  drawParticles(dt){this.particles=this.particles.filter(p=>p.life>0);for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;this.rect(p.x,p.y,3,3,'#fff5da');}}
}
