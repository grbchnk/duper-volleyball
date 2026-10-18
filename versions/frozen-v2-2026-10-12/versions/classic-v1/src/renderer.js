import { COURT } from './config.js';
import { clamp, integrateBall, collideNet } from './physics.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.camera = -2.5; this.shake = 0; this.particles = [];
    this.background = document.createElement('canvas'); this.background.width = 960; this.background.height = 540;
    this.makeBackground();
  }
  rect(x, y, w, h, color, ctx = this.ctx) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  text(text, x, y, size = 12, color = '#f4ecd3', align = 'left', ctx = this.ctx) {
    ctx.font = `bold ${size}px "Consolas", monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, Math.round(x), Math.round(y));
  }
  makeBackground() {
    const c = this.background.getContext('2d');
    this.rect(0, 0, 960, 540, '#112b34', c);
    const gradient = c.createLinearGradient(0, 45, 0, 380); gradient.addColorStop(0, '#123644'); gradient.addColorStop(1, '#285259'); c.fillStyle = gradient; c.fillRect(0, 60, 960, 380);
    for (let x = 0; x < 960; x += 96) {
      this.rect(x, 80, 3, 160, '#30545b', c); this.rect(x + 50, 80, 1, 170, '#213f48', c);
      c.strokeStyle = '#244750'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 80); c.lineTo(x + 96, 180); c.moveTo(x + 96, 80); c.lineTo(x, 180); c.stroke();
      this.rect(x, 180, 96, 4, '#284b51', c);
      this.rect(x + 31, 105, 30, 4, '#637d79', c); this.rect(x + 28, 109, 36, 6, '#c6e0c7', c); this.rect(x + 32, 115, 28, 3, '#ebf5d7', c);
      c.fillStyle = '#c2e2ad06'; c.beginPath(); c.moveTo(x + 28, 116); c.lineTo(x - 10, 280); c.lineTo(x + 100, 280); c.lineTo(x + 64, 116); c.fill();
    }
    for (const [y, col] of [[229, '#162f38'], [284, '#173a40'], [344, '#1b4146']]) {
      this.rect(0, y, 960, 45, col, c);
      for (let row = 0; row < 4; row++) for (let x = -10; x < 965; x += 13) {
        const n = Math.abs(Math.sin(x * 123.7 + row * 21.9 + y)) * 999;
        const colors = ['#597d76', '#586779', '#b58460', '#ab7157', '#486e7a', '#849373', '#765c5b'];
        const xx = x + (row % 2) * 6, yy = y + row * 10;
        this.rect(xx + 2, yy, 4, 4, n % 3 > 1 ? '#aa9175' : '#667e72', c);
        this.rect(xx, yy + 4, 8, 6, colors[Math.floor(n) % colors.length], c);
      }
      this.rect(0, y + 41, 960, 5, '#64827b', c); this.rect(0, y + 46, 960, 3, '#102c35', c);
    }
    this.rect(0, 274, 960, 12, '#193740', c);
    for (let x = 0; x < 960; x += 160) { this.rect(x + 4, 276, 151, 7, '#496563', c); }
    this.rect(0, 390, 960, 53, '#123d40', c);
    for (let x = 0; x < 960; x += 195) {
      this.rect(x + 7, 397, 181, 33, '#315853', c);
      this.rect(x + 10, 400, 175, 27, x % 390 === 0 ? '#d7d4ac' : '#1a4549', c);
      this.text(x % 390 === 0 ? 'SUPER VOLLEY' : 'WORLD LEAGUE', x + 97, 418, 13, x % 390 === 0 ? '#4b7568' : '#91b6a2', 'center', c);
    }
    this.rect(0, 443, 960, 97, '#b66d40', c);
    for (let y = 445; y < 540; y += 16) {
      this.rect(0, y, 960, 14, y % 32 ? '#bf7e49' : '#c78750', c);
      for (let x = (y % 32) * 7; x < 960; x += 110) this.rect(x, y, 1, 15, '#a46a42', c);
    }
    this.rect(0, 446, 960, 2, '#e2b477', c);
    this.rect(0, 499, 960, 41, '#196561', c); this.rect(0, 500, 960, 3, '#80a991', c);
    this.text('S U P E R   V O L L E Y B A L L', 480, 526, 13, '#8bb49a', 'center', c);
  }
  project(x, y = 0) { return { x: 480 + (x - this.camera) * 49, y: 457 - y * 43 }; }
  draw(match, teams, dt = 1 / 60) {
    const c = this.ctx;
    const target = clamp(match.ball.x * 0.46, -3.6, 3.6);
    this.camera += (target - this.camera) * Math.min(1, dt * 4.5);
    c.drawImage(this.background, 0, 0);
    c.save();
    if (this.shake > 0) { this.shake -= dt; c.translate(Math.sin(this.shake * 140) * this.shake * 8, 0); }
    this.drawCourt();
    if (match.config.trajectory && !['serve', 'point', 'set-end', 'finished'].includes(match.phase)) this.drawTrajectory(match);
    const b = this.project(match.ball.x);
    c.fillStyle = '#493e3880'; c.beginPath(); c.ellipse(b.x, 465, Math.max(3, 9 - match.ball.y * .5), 3, 0, 0, Math.PI * 2); c.fill();
    if (match.mode !== 'demo' && match.phase === 'receive' && match.possession === 0 && match.prediction) {
      const p = this.project(match.prediction.x);
      c.strokeStyle = '#e4eaba65'; c.setLineDash([4, 4]); c.strokeRect(p.x - 14, 461, 28, 7); c.setLineDash([]);
    }
    for (const p of [...match.players].sort((a, b) => a.x - b.x)) this.drawPlayer(p, teams[p.team], match);
    this.drawNet();
    this.drawBall(match);
    this.drawParticles(dt);
    c.restore();
    this.drawHUD(match, teams);
    if (match.noticeTime > 0 && !['serve', 'toss', 'point', 'set-end', 'finished'].includes(match.phase)) {
      c.fillStyle = '#0e242ccc'; c.fillRect(480 - Math.min(240, match.notice.length * 4.6), 84, Math.min(480, match.notice.length * 9.2), 25);
      this.text(match.notice, 480, 101, 12, '#e7e4bc', 'center');
    }
    if (match.phase === 'point' || match.phase === 'set-end') {
      this.rect(282, 191, 396, 115, '#102d32e8'); this.rect(282, 191, 4, 115, teams[match.pointWinner].color);
      this.text(match.notice, 480, 227, 24, '#f3edcc', 'center');
      this.text(teams[match.pointWinner].name.toUpperCase(), 480, 258, 18, teams[match.pointWinner].light, 'center');
      this.text(match.pointReason, 480, 284, 11, '#94b2a6', 'center');
    }
    // Very subtle scanlines, drawn locally rather than a downloaded texture.
    c.fillStyle = '#0000000a'; for (let y = 0; y < 540; y += 3) c.fillRect(0, y, 960, 1);
  }
  drawCourt() {
    const c = this.ctx;
    for (const x of [-9, -3, 0, 3, 9]) {
      const p = this.project(x); c.fillStyle = x === 0 ? '#f8db9a' : '#f2d49b';
      c.beginPath(); c.moveTo(p.x - 2, 449); c.lineTo(p.x + 2, 449); c.lineTo(p.x + 8, 498); c.lineTo(p.x + 4, 498); c.fill();
    }
    this.rect(0, 486, 960, 3, '#ecd198');
    for (const x of [-6, 6]) { const p = this.project(x); this.text('SV', p.x, 479, 16, '#dfa367', 'center'); }
  }
  drawNet() {
    const p = this.project(0);
    this.rect(p.x - 5, p.y - COURT.netHeight * 43, 9, COURT.netHeight * 43 + 14, '#103134');
    this.rect(p.x - 3, p.y - COURT.netHeight * 43 - 7, 4, COURT.netHeight * 43 + 19, '#b3c9b4');
    this.rect(p.x + 1, p.y - COURT.netHeight * 43 - 7, 3, COURT.netHeight * 43 + 19, '#f2efd6');
    this.rect(p.x - 7, p.y - COURT.netHeight * 43 - 3, 15, 4, '#ffffe7');
    for (let y = p.y - COURT.netHeight * 43; y < p.y + 9; y += 8) this.rect(p.x - 5, y, 12, 1, '#608d85');
    this.rect(p.x + 6, p.y - COURT.netHeight * 43 - 23, 2, 26, '#ffab7b');
    this.rect(p.x - 8, p.y + 11, 22, 4, '#173b3d');
  }
  drawPlayer(player, team, match) {
    const c = this.ctx, p = this.project(player.x, player.y);
    const floor = this.project(player.x, 0);
    c.fillStyle = '#553d3570'; c.beginPath(); c.ellipse(floor.x + 1, 464, 14, 3, 0, 0, Math.PI * 2); c.fill();
    const active = player.team === 0 && match.mode !== 'demo' && ((match.possession === 0 && player.role === match.activeRole) || (match.possession === 1 && player.role === 'quick'));
    const dir = player.team === 0 ? 1 : -1;
    c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.scale(dir * 2, 2);
    const r = (x, y, w, h, color) => this.rect(x, y, w, h, color);
    const skin = '#dfab79', light = '#ffd19a', shade = '#ad7458', shoe = '#e2e9d4', outline = '#16333d';
    const run = player.pose === 'run' ? Math.sin(match.time * 17) * 3 : 0;
    const crouch = player.pose === 'receive' ? 4 : player.stun > 0 ? 9 : 0;
    c.translate(0, crouch);
    // Legs, knee pads, socks and trainers. A 20 x 38 pixel handmade sprite.
    r(-6, -15, 6, 7, outline); r(2, -15, 6, 7, outline);
    r(-5 - run, -11, 4, 7 - crouch / 2, skin); r(3 + run, -11, 4, 7 - crouch / 2, light);
    r(-6 - run, -9, 5, 3, '#283d49'); r(3 + run, -8, 5, 3, '#273c49');
    r(-5 - run, -5, 4, 4, '#c5d3c8'); r(4 + run, -5, 4, 4, '#f0eee0');
    r(-6 - run, -2, 7, 3, outline); r(3 + run, -2, 8, 3, outline);
    r(-5 - run, -2, 6, 2, shoe); r(4 + run, -2, 7, 2, '#f6f2de');
    r(-7, -19, 15, 7, outline); r(-6, -19, 13, 5, team.dark); r(-6, -19, 4, 5, '#eff0ce');
    r(-8, -30, 15, 12, outline); r(-6, -30, 12, 12, team.color); r(-6, -28, 4, 10, team.dark); r(4, -28, 2, 8, team.light);
    r(-4, -31, 8, 3, '#edead4'); r(-1, -31, 4, 3, shade);
    // Head looks toward the net.
    r(-4, -39, 10, 9, outline); r(-3, -37, 8, 6, skin); r(3, -36, 4, 3, light); r(3, -32, 2, 2, shade);
    r(-4, -40, 9, 4, '#182d33'); r(-4, -37, 3, 4, '#26363b'); r(4, -36, 1, 1, '#16303a');
    const arm = (x1, y1, x2, y2, x3, y3) => {
      c.lineCap = 'square'; c.lineJoin = 'miter'; c.strokeStyle = outline; c.lineWidth = 5;
      c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.lineTo(x3,y3); c.stroke();
      c.strokeStyle = skin; c.lineWidth = 3; c.stroke(); r(x3 - 1,y3 - 1,3,3,light);
    };
    if (player.pose === 'block' || player.block > 0) { arm(-5,-28,-8,-38,-7,-47); arm(5,-28,8,-39,8,-47); }
    else if (player.pose === 'set') { arm(-5,-28,-8,-36,2,-41); arm(5,-28,10,-34,7,-41); }
    else if (player.pose === 'spike') { arm(-5,-28,-8,-34,-3,-41); arm(5,-28,10,-37,4,-45); }
    else if (player.pose === 'receive') { arm(-5,-28,2,-24,12,-25); arm(5,-28,9,-25,14,-25); }
    else { arm(-6,-27,-8-run/2,-22,-4-run,-20); arm(5,-27,9+run/2,-22,12+run,-25); }
    this.text(String(player.number), 1, -21, 6, '#fff4dd', 'center');
    c.restore();
    if (active) {
      c.fillStyle = '#d7f895'; c.beginPath(); c.moveTo(p.x - 5, p.y - 88); c.lineTo(p.x + 5, p.y - 88); c.lineTo(p.x, p.y - 81); c.fill();
    }
  }
  drawBall(match) {
    const c = this.ctx, ball = match.ball;
    if (Math.hypot(ball.vx, ball.vy) > 8) for (let i = 0; i < match.trail.length; i += 3) {
      const p = this.project(match.trail[i].x, match.trail[i].y);
      c.fillStyle = `rgba(244,229,156,${i / match.trail.length * .3})`; c.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    const p = this.project(ball.x, ball.y);
    const yy = Math.max(86, p.y);
    if (p.y < 86) { this.text('↑', clamp(p.x, 15, 945), 81, 16, '#f5e1a0', 'center'); }
    if (match.contactWindow) {
      c.strokeStyle = '#ff7c68'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, yy, 13 + Math.sin(match.time * 15) * 2, 0, Math.PI * 2); c.stroke();
    }
    c.save(); c.translate(Math.round(p.x), Math.round(yy)); c.rotate(ball.angle);
    c.fillStyle = '#113239'; c.beginPath(); c.arc(0,0,8,0,Math.PI*2); c.fill();
    c.fillStyle = match.contactWindow ? '#ff6859' : '#f3efc9'; c.beginPath(); c.arc(0,0,6.5,0,Math.PI*2); c.fill();
    c.strokeStyle = match.contactWindow ? '#ffb49a' : '#769c9b'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-6,0); c.quadraticCurveTo(0,-5,6,0); c.moveTo(0,-6); c.quadraticCurveTo(-3,0,3,6); c.stroke(); c.restore();
    if (match.contactWindow && match.mode !== 'demo') this.text('J', p.x, yy - 20, 12, '#ffb69a', 'center');
  }
  drawTrajectory(match) {
    const c = this.ctx, b = { ...match.ball }; c.fillStyle = '#c2ed8799';
    for (let i = 0; i < 150; i++) {
      const prev = { ...b }; integrateBall(b, 1 / 60, match.config); collideNet(b, prev, match.config.restitution);
      if (b.y < 0) break;
      if (i % 6 === 0) { const p = this.project(b.x,b.y); c.fillRect(p.x - 1, p.y - 1, 3, 3); }
    }
  }
  flag(team, x, y) {
    const c = this.ctx;
    this.rect(x, y, 29, 18, '#ecede0');
    if (team.flag === 'jp') { c.fillStyle='#d84a48'; c.beginPath(); c.arc(x+14,y+9,5,0,Math.PI*2); c.fill(); }
    if (team.flag === 'br') { this.rect(x,y,29,18,'#327555'); c.fillStyle='#e6c34d'; c.beginPath(); c.moveTo(x+14,y+2); c.lineTo(x+27,y+9); c.lineTo(x+14,y+16); c.lineTo(x+2,y+9); c.fill(); c.fillStyle='#3c6f92'; c.beginPath(); c.arc(x+14,y+9,4,0,Math.PI*2); c.fill(); }
    if (team.flag === 'us') { for(let i=0;i<6;i++) this.rect(x,y+i*3,29,1.5,'#bd5652'); this.rect(x,y,13,10,'#496382'); }
    if (team.flag === 'su' || team.flag === 'cn') { this.rect(x,y,29,18,'#bb4846'); this.text('★',x+7,y+10,9,'#edd272','center'); }
    if (team.flag === 'fr' || team.flag === 'it') { this.rect(x,y,9,18,team.flag==='fr'?'#456b9b':'#4e9672'); this.rect(x+20,y,9,18,'#c96359'); }
    if (team.flag === 'nl') { this.rect(x,y,29,6,'#be635b'); this.rect(x,y+12,29,6,'#486c9b'); }
  }
  drawHUD(match, teams) {
    this.rect(0,0,960,72,'#0b2029'); this.rect(0,70,960,2,'#477166');
    this.flag(teams[0], 311, 16); this.flag(teams[1], 621, 16);
    this.text(teams[0].short, 353, 30, 17); this.text(teams[1].short, 608, 30, 17, '#f4ecd3', 'right');
    this.text(`${String(match.score[0]).padStart(2,'0')}  :  ${String(match.score[1]).padStart(2,'0')}`, 480, 45, 32, '#f7efce','center');
    this.text(`SET ${match.sets[0]+match.sets[1]+1}  ·  ${match.sets[0]} — ${match.sets[1]}`, 480, 62, 9, '#9ab9a8', 'center');
    this.text(match.mode === 'demo' ? 'CPU' : '1P', 325, 53, 10, '#bfe88a','center'); this.text('CPU',635,53,10,'#c9b48b','center');
    this.rect(match.server === 0 ? 297 : 658, 20, 5, 5, '#c4ed87');
    for (const team of [0, 1]) {
      const x = team === 0 ? 34 : 754;
      this.rect(x,44,172,2,'#427b8a'); this.rect(x+86,27,2,19,'#a2bda6');
      for (const p of match.players) {
        const px = x+86+p.x*8.5;
        this.rect(px-2,34-p.y*3,4,9,p.team===0?teams[0].color:teams[1].color);
        this.rect(px-1,31-p.y*3,3,3,'#dcbf83');
      }
      const bx=x+86+match.ball.x*8.5; this.rect(bx,39-clamp(match.ball.y,0,6)*2,3,3,'#e8eec1');
      this.text(team===0?'POSITION RADAR':'CLASSIC / 120 HZ',x,61,8,'#70968e');
    }
  }
  effect(event, match) {
    if (event.type === 'hit' || event.type === 'block') {
      const p = this.project(match.ball.x, match.ball.y);
      for (let i=0;i<7;i++) this.particles.push({x:p.x,y:p.y,vx:Math.cos(i)*45,vy:Math.sin(i)*45,life:.27});
      if (event.kind === 'super' || event.type === 'block') this.shake = .17;
    }
  }
  drawParticles(dt) {
    this.particles = this.particles.filter(p => p.life>0);
    for (const p of this.particles) { p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;this.rect(p.x,p.y,2,2,'#fff4c1'); }
  }
}
