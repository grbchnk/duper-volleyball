import { activeEmotion } from './emotions.js';
import { BodySprites, playerFrame } from './sprites.js';
import { COURT } from './config.js';
import { clamp, traceBall } from './physics.js';
import { springPoint, blockWindow } from './motion.js';
import { ARM_STYLES } from './arms.js';
import { expressivePose } from './arm-motion.js';
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bodySprites = new BodySprites();
    this.camera = 0;
    this.particles = [];
    this.impacts = [];
    this.armRigs = new Map();
    this.shake = 0;
    this.background = document.createElement('canvas');
    this.background.width = 960;
    this.background.height = 540;
    this.makeBackground();
  }
  rect(x, y, w, h, color, ctx = this.ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  text(str, x, y, size = 12, color = '#454b47', align = 'left', ctx = this.ctx) {
    ctx.font = `bold ${size}px "Consolas",monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, Math.round(x), Math.round(y));
  }
  makeBackground() {
    const c = this.background.getContext('2d'),
      r = (x, y, w, h, col) => this.rect(x, y, w, h, col, c);
    r(0, 0, 960, 540, '#d0e9df');
    r(0, 80, 960, 230, '#dceee7');
    for (const [x, y, s] of [
      [35, 117, 1],
      [300, 103, 0.7],
      [730, 142, 1.2],
      [540, 83, 0.6],
    ]) {
      r(x + 12 * s, y - 10 * s, 44 * s, 26 * s, '#fdf9e9');
      r(x, y, 90 * s, 17 * s, '#fdf9e9');
      r(x + 18 * s, y + 17 * s, 54 * s, 4 * s, '#c9ded7');
    }
    r(814, 96, 38, 38, '#f3d8a0');
    r(805, 107, 56, 18, '#f3d8a0');
    r(824, 86, 18, 58, '#f3d8a0');
    r(825, 109, 3, 4, '#b69f7f');
    r(841, 109, 3, 4, '#b69f7f');
    r(830, 121, 8, 2, '#cda77d');
    for (let x = -20; x < 990; x += 85) {
      const h = 30 + Math.sin(x * 2) * 15;
      r(x, 264 - h, 90, h + 90, '#b4d2b6');
      r(x + 15, 255 - h, 60, 20, '#b4d2b6');
    }
    r(0, 328, 960, 212, '#9ebd91');
    for (const x of [27, 145, 805, 925]) {
      r(x + 9, 245, 10, 98, '#b69673');
      r(x - 22, 213, 67, 57, '#82b99a');
      r(x - 32, 225, 87, 25, '#82b99a');
      r(x - 13, 201, 48, 14, '#94c7a5');
      r(x - 15, 218, 26, 11, '#a5d1ab');
      r(x + 26, 249, 7, 12, '#73a58c');
    }
    // Bunting, fence and little spectators, all original pixel drawings.
    c.strokeStyle = '#7eaa97';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 202);
    c.quadraticCurveTo(470, 295, 960, 202);
    c.stroke();
    for (let x = 15; x < 960; x += 44) {
      const y = 202 + Math.sin((x / 960) * Math.PI) * 43;
      c.fillStyle = ['#e9a49a', '#e8d399', '#9fbdc1', '#bbafd0'][Math.floor(x / 44) % 4];
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 20, y + 2);
      c.lineTo(x + 10, y + 24);
      c.fill();
    }
    r(0, 356, 960, 5, '#f4edd6');
    r(0, 376, 960, 5, '#f4edd6');
    for (let x = 10; x < 960; x += 32) r(x, 346, 5, 48, '#f9f3df');
    for (let i = 0; i < 18; i++) {
      const x = 65 + i * 47,
        y = 338 + (i % 2) * 8;
      const colors = ['#d4acb6', '#b0b8d2', '#d6c488', '#a4c5b0'];
      r(x - 8, y, 17, 14, colors[i % 4]);
      r(x - 6, y - 12, 13, 13, '#f3d2ac');
      r(x - 7, y - 15, 15, 6, i % 3 === 0 ? '#b2886d' : '#79786e');
      r(x - 3, y - 7, 2, 2, '#6d615e');
      r(x + 3, y - 7, 2, 2, '#6d615e');
      r(x - 3, y + 14, 4, 4, '#786d6b');
      r(x + 4, y + 14, 4, 4, '#786d6b');
    }
    r(52, 389, 856, 117, '#e6b99a');
    r(60, 396, 840, 102, '#ebc6a4');
    r(60, 401, 840, 4, '#f2d7b5');
    for (let x = 65; x < 900; x += 46) r(x, 406, 1, 86, '#dfb995');
    r(78, 422, 804, 3, '#fff8db');
    r(78, 480, 804, 3, '#fff8db');
    r(0, 506, 960, 34, '#a6c29a');
    for (let x = 13; x < 960; x += 31) {
      r(x, 516, 2, 6, '#8eaf8c');
      r(x + 3, 513, 2, 7, '#8eaf8c');
      if (x % 4 === 1) {
        r(x + 7, 522, 5, 2, '#faeed0');
        r(x + 9, 520, 2, 6, '#faeed0');
      }
    }
    this.text('S U P E R   V O L L E Y   C L U B', 480, 524, 11, '#557969', 'center', c);
  }
  project(x, y = 0) {
    return { x: 480 + x * 40, y: 450 - y * 42 };
  }
  draw(m, teams, dt = 1 / 60) {
    const c = this.ctx;
    c.drawImage(this.background, 0, 0);
    c.save();
    for (const x of [-9, -3, 0, 3, 9]) {
      const p = this.project(x);
      this.rect(p.x - 1, 423, 3, 59, '#fff8df');
    }
    this.rect(478, 422, 5, 60, '#fff8df');
    if (m.aimPreview) this.trajectory(m.aimPreview, m.config, true);
    else if (m.config.trajectory && m.phase === 'rally') this.trajectory(m.ball, m.config, false);
    if (m.config.trajectory && m.phase === 'rally')
      this.text(
        m.aimPreview ? 'ЦВЕТНОЙ ПУНКТИР: УДАР СЕЙЧАС' : 'СВЕТЛЫЙ ПУНКТИР: ТЕКУЩИЙ ПОЛЁТ',
        480,
        122,
        9,
        '#547260',
        'center',
      );
    const b = this.project(m.ball.x);
    c.fillStyle = '#af99736b';
    c.beginPath();
    c.ellipse(b.x, 456, 9, 3, 0, 0, Math.PI * 2);
    c.fill();
    if (m.prediction && m.phase === 'rally' && m.ball.x < 0) {
      const p = this.project(m.prediction.x);
      c.strokeStyle = '#698c8070';
      c.setLineDash([3, 3]);
      c.strokeRect(p.x - 12, 449, 24, 8);
      c.setLineDash([]);
    }
    for (const p of m.players) this.drawPlayer(p, teams[p.team], m, dt);
    this.drawNet();
    this.drawBall(m);
    this.drawParticles(dt);
    c.restore();
    this.drawHUD(m, teams);
    if (m.noticeTime > 0 && m.phase === 'rally') {
      const width = Math.min(510, m.notice.length * 7.2 + 25);
      this.rect(480 - width / 2, 83, width, 25, '#fff8e9e8');
      this.text(m.notice, 480, 100, 12, '#62796a', 'center');
    }
    if (['point', 'set-end'].includes(m.phase)) {
      this.rect(290, 176, 380, 126, '#fff9eaf2');
      this.rect(300, 186, 360, 3, teams[m.pointWinner].color);
      this.text(m.notice, 480, 216, 24, '#476756', 'center');
      this.text(teams[m.pointWinner].name, 480, 249, 15, teams[m.pointWinner].dark, 'center');
      this.text(m.pointReason, 480, 281, 11, '#a48675', 'center');
    }
    if (m.charge || m.pending) {
      const a = m.charge || m.pending;
      const p = this.project(m.players[a.playerId].x, m.players[a.playerId].y);
      this.rect(p.x - 28, p.y - 86, 56, 8, '#fff9e9');
      this.rect(p.x - 26, p.y - 84, 52 * a.power, 4, a.power > 0.88 ? '#dc806d' : '#709f82');
    }
  }
  drawPlayer(p, team, m, dt) {
    const c = this.ctx,
      pos = this.project(p.x, p.y),
      floor = this.project(p.x),
      dir = p.diving ? Math.sign(p.diveVelocity) : p.facing || (p.team === 0 ? 1 : -1);
    const selected = p.id === m.selected[0] && m.mode !== 'demo';
    if (selected) {
      c.save();
      c.fillStyle = '#fff1a54d';
      c.strokeStyle = '#395c74';
      c.lineWidth = 5;
      c.beginPath();
      c.ellipse(floor.x, floor.y + 3, 24, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = '#ffe896';
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    }
    c.fillStyle = '#b08e6a50';
    c.beginPath();
    c.ellipse(floor.x, floor.y + 6, 13, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.translate(Math.round(pos.x), Math.round(pos.y));
    c.scale(dir * (this.spriteScale || 2.1), this.spriteScale || 2.1);
    const frame = playerFrame(p, m),
      skin = m.config.skin || 'club',
      pose = frame.pose;
    if (p.diving || p.recovery > 0) {
      const tilt = pose.tilt;
      c.translate(-3 * Math.sin(tilt), -5 * Math.sin(tilt));
      c.rotate(tilt);
    }
    c.imageSmoothingEnabled = false;
    c.drawImage(this.bodySprites.get(frame, skin, team, p.id), -32, -54);
    c.save();
    c.translate(0, pose.y);
    const step = frame.state === 'run' ? (pose.r - pose.l - 9) * 0.5 : 0;
    this.drawArms(p, m, dt, step, frame);
    c.save();
    c.scale(dir, 1);
    this.text(String(p.number), dir, -13, 7, '#fff7e4', 'center');
    c.restore();
    c.restore();
    c.restore();
    if (p.id === m.selected[0] && m.mode !== 'demo') {
      const y = pos.y - 105;
      this.rect(pos.x - 32, y - 24, 64, 22, '#314e64');
      this.rect(pos.x - 30, y - 22, 60, 18, '#ffe896');
      this.text('ТЫ · ' + p.number, pos.x, y - 9, 13, '#314e64', 'center');
      c.fillStyle = '#314e64';
      c.beginPath();
      c.moveTo(pos.x - 9, y - 2);
      c.lineTo(pos.x + 9, y - 2);
      c.lineTo(pos.x, y + 8);
      c.fill();
    }
    if (p.recovery > 0) {
      this.text('···', pos.x, pos.y - 25, 15, '#a27970', 'center');
    }
  }
  drawArms(p, m, dt, step, bodyFrame = null) {
    const c = this.ctx,
      spec = ARM_STYLES.whip;
    const charge = m.phase !== 'serve' && m.charge?.playerId === p.id ? m.charge : null;
    const serving = m.phase === 'serve-motion' && p.id === m.selected[m.server];
    const swing = p.armSwing,
      kind =
        p.block > 0
          ? 'block'
          : charge?.kind ||
            (serving ? m.serveAction?.kind : null) ||
            swing?.kind ||
            (p.diving ? 'low' : null);
    let rig = this.armRigs.get(p.id);
    if (!rig || rig.player !== p) {
      rig = { player: p, wrists: null, elbows: null, contactKey: null, contactPoint: null };
      this.armRigs.set(p.id, rig);
    }
    const newContact = swing?.hit && rig.contactKey !== (swing.at ?? swing);
    if (newContact) {
      const screen = this.project(swing.x, swing.y);
      const local = c.getTransform().inverse().transformPoint(screen);
      // DOMPoint coordinates live on its prototype; object spread drops them.
      rig.contactPoint = { x: local.x, y: local.y };
      rig.contactKey = swing.at ?? swing;
      if (Number.isFinite(swing.vx) && Number.isFinite(swing.vy)) {
        const end = c
          .getTransform()
          .inverse()
          .transformPoint(this.project(swing.x + swing.vx, swing.y + swing.vy));
        rig.localVelocity = { x: end.x - local.x, y: end.y - local.y };
      } else rig.localVelocity = null;
    }
    const pose = expressivePose({
      emotion: activeEmotion(p),
      shoulderLift: bodyFrame?.pose.shoulders || 0,
      localVelocity: swing?.hit ? rig.localVelocity : null,
      actionDirection:
        Math.sign(
          (serving ? m.serveAction?.aim?.axis : charge?.aim?.axis) || (p.team === 0 ? 1 : -1),
        ) / (p.facing || 1),
      spec,
      config: m.config,
      kind,
      serve: serving ? { ...m.serveAction, age: m.phaseTime } : null,
      charge: charge || (p.diving && !swing ? { kind: 'low', power: 0.2, age: 0.1 } : null),
      swing,
      jump: p.jumpProfile ? { profile: p.jumpProfile, time: p.jumpTime } : null,
      block: p.block > 0 && p.pose !== 'crouch',
      diving: p.diving,
      diveForward: p.diveVelocity * (p.team === 0 ? 1 : -1) > 0,
      bodyTilt: bodyFrame?.pose.tilt || 0,
      bodyOffsetY: bodyFrame?.pose.y || 0,
      recoveryPose:
        p.recovery > 0
          ? { progress: bodyFrame?.state === 'getup' ? bodyFrame.index / 5 : 0 }
          : null,
      step,
      contactPoint: swing?.hit ? rig.contactPoint : null,
    });
    if (!rig.wrists) {
      rig.wrists = pose.wrists.map((w) => ({ ...w, vx: 0, vy: 0 }));
      rig.elbows = pose.elbows.map((w) => ({ ...w, vx: 0, vy: 0 }));
    }
    rig.stage = pose.stage;
    const tint =
      { low: '#78b6c9', loft: '#8aad77', drive: '#e89a70', block: '#b7a0ce' }[kind] || '#fff1da';
    for (let i = 0; i < 2; i++) {
      const wrist = rig.wrists[i],
        target = pose.wrists[i];
      if ((newContact && pose.snap) || (swing?.hit && rig.localVelocity && swing.age < 0.09))
        Object.assign(wrist, target, { vx: 0, vy: 0 });
      else
        springPoint(
          wrist,
          target,
          dt,
          spec.spring * m.config.armSpring * (kind === 'loft' ? 1.65 : 1 + pose.power * 0.3),
          spec.damping * Math.sqrt(m.config.armSpring) * (kind === 'loft' ? 1.25 : 1),
        );
      const shoulder = pose.shoulders[i],
        elbow = rig.elbows[i];
      springPoint(
        elbow,
        pose.elbows[i],
        dt,
        spec.spring * m.config.armSpring * (kind === 'loft' ? 2 : 1.35),
        spec.damping * Math.sqrt(m.config.armSpring) * 1.2,
      );
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = spec.width * m.config.armScale * m.config.armRoundness;
      c.strokeStyle = '#665d62';
      c.beginPath();
      c.moveTo(shoulder.x, shoulder.y);
      c.quadraticCurveTo(elbow.x, elbow.y, wrist.x, wrist.y);
      c.stroke();
      c.lineWidth = Math.max(1, spec.width * m.config.armScale * m.config.armRoundness - 2);
      c.strokeStyle = pose.snap ? '#fff7dc' : '#f4cfac';
      c.stroke();
      const hand = spec.hand * m.config.armScale;
      c.save();
      c.translate(wrist.x, wrist.y);
      // Overhead fingers face inward/up, forming a small cup instead of two parallel poles.
      const neutralAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) + Math.PI / 2;
      c.rotate(neutralAngle * (1 - pose.cup) + (i ? -0.55 : 0.55) * pose.cup);
      this.rect(
        -hand / 2,
        0,
        hand,
        2,
        kind === 'block' && blockWindow(p, m.config) ? '#f8da75' : tint,
      );
      this.rect(-hand / 2, -hand * 0.8, hand, hand * 0.8, '#665d62');
      this.rect(-hand / 2 + 0.6, -hand * 0.8, hand - 1.2, hand * 0.8, '#f4cfac');
      if (pose.cup) {
        this.rect(-hand / 2, -hand * 1.15, 1.3, hand * 0.5, '#f4cfac');
        this.rect(hand / 2 - 1.3, -hand * 1.15, 1.3, hand * 0.5, '#f4cfac');
      }
      c.restore();
    }
  }
  drawNet() {
    const c = this.ctx,
      x = 480,
      top = 450 - COURT.netHeight * 42;
    this.rect(x - 4, top, 8, 111, '#718b83');
    this.rect(x - 2, top, 3, 113, '#f7f2dd');
    this.rect(x - 10, top, 22, 3, '#fffbee');
    this.rect(x + 8, top - 19, 2, 22, '#d3897c');
    for (let y = top + 8; y < 461; y += 8) this.rect(x - 7, y, 17, 1, '#a9b9a7');
    this.rect(x - 10, 461, 24, 5, '#d29d82');
  }
  drawBall(m) {
    const c = this.ctx,
      p = this.project(m.ball.x, m.ball.y),
      y = Math.max(84, p.y);
    if (Math.hypot(m.ball.vx, m.ball.vy) > 5)
      for (let i = 0; i < m.trail.length; i += 4) {
        const t = this.project(m.trail[i].x, m.trail[i].y);
        this.rect(t.x - 3, t.y - 3, 6, 6, '#fff4d480');
      }
    if (p.y < 84) this.text('↑', clamp(p.x, 15, 945), 81, 15, '#bb776b', 'center');
    if (m.contactWindow && (m.phase !== 'serve-motion' || Math.floor(m.phaseTime * 20) % 2 === 0)) {
      c.strokeStyle = '#cc7967';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, y, 16, 0, Math.PI * 2);
      c.stroke();
    }
    c.save();
    c.translate(Math.round(p.x), Math.round(y));
    const speed = Math.hypot(m.ball.vx, m.ball.vy),
      stretch = 1 + clamp((speed - 5) / 30, 0, 0.3);
    const direction = Math.atan2(-m.ball.vy, m.ball.vx),
      impact = this.impacts.length ? Math.max(...this.impacts.map((e) => e.life)) : 0;
    const squash = impact > 0.34 ? 1 - (impact - 0.34) * 2 : 1;
    c.rotate(direction);
    c.scale(stretch * 1.18 * squash, 1.18 / (stretch * squash));
    c.rotate(-direction);
    c.rotate(m.ball.angle);
    c.fillStyle = '#788b83';
    c.beginPath();
    c.arc(0, 0, 10, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff9d9';
    c.beginPath();
    c.arc(0, 0, 8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#d6957f';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-7, -2);
    c.quadraticCurveTo(0, -5, 7, 1);
    c.moveTo(0, -8);
    c.quadraticCurveTo(-2, 0, 3, 7);
    c.stroke();
    c.restore();
    if (m.contactWindow && m.mode !== 'demo')
      this.text(
        m.phase === 'serve-motion' ? 'НАЖМИ!' : m.charge ? 'ОТПУСТИТЕ' : 'КАСАНИЕ',
        p.x,
        y - 22,
        9,
        '#9e665b',
        'center',
      );
  }
  trajectory(ball, config, preview) {
    const points = traceBall(ball, config),
      color = preview
        ? { low: '#568ca6', loft: '#638e56', drive: '#c78055' }[ball.kind] || '#698d7f'
        : '#fff5d299';
    for (let i = 0; i < points.length; i += 16) {
      const p = this.project(points[i].x, points[i].y);
      this.rect(p.x - 2, p.y - 2, 4, 4, color);
    }
    const end = points.at(-1);
    if (end.y <= COURT.ballRadius) {
      const p = this.project(end.x);
      this.rect(p.x - 6, 456, 12, 3, color);
    }
  }
  drawHUD(m, teams) {
    this.rect(0, 0, 960, 73, '#fff8e9');
    this.rect(0, 71, 960, 2, '#c5d0b8');
    this.rect(29, 17, 8, 34, teams[0].color);
    this.text(teams[0].short, 48, 34, 17, teams[0].dark);
    this.text(m.mode === 'demo' ? 'CPU' : 'ВАША КОМАНДА', 48, 51, 9, '#839286');
    this.rect(923, 17, 8, 34, teams[1].color);
    this.text(teams[1].short, 912, 34, 17, teams[1].dark, 'right');
    this.text('КОМПЬЮТЕР', 912, 51, 9, '#839286', 'right');
    this.text(
      `${String(m.score[0]).padStart(2, '0')} : ${String(m.score[1]).padStart(2, '0')}`,
      480,
      41,
      32,
      '#526e5f',
      'center',
    );
    this.text(
      `СЕТ ${m.sets[0] + m.sets[1] + 1}  /  ${m.sets.join(' — ')}`,
      480,
      61,
      9,
      '#8d9b84',
      'center',
    );
    const phase = m.mode === 'test' ? 'ТЕСТ ∞' : m.teamPhases[0] === 'attack' ? 'АТАКА' : 'ЗАЩИТА';
    this.text(m.phase === 'serve' ? 'ПОДАЧА' : phase, 265, 34, 11, '#8d7867', 'center');
    this.text(`${m.touches[0]} / 3 КАСАНИЯ`, 265, 51, 9, '#8b998a', 'center');
    this.text('A  W  D', 697, 32, 13, '#7d917a', 'center');
    this.text('ЗАЖМИ → ОТПУСТИ', 697, 51, 8, '#8b998a', 'center');
  }
  effect(e, m) {
    if (e.type === 'hit' || e.type === 'block') {
      const p = this.project(e.x ?? m.ball.x, e.y ?? m.ball.y),
        color =
          { low: '#568ca6', loft: '#638e56', drive: '#c78055', block: '#947aaf' }[e.kind] ||
          '#947aaf';
      for (let i = 0; i < 10; i++)
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(i) * 65,
          vy: Math.sin(i) * 65,
          life: 0.27,
          color,
        });
      this.impacts.push({
        ...p,
        life: 0.4,
        color,
        label: { low: 'СНИЗУ', loft: 'ПАС', drive: 'УДАР', block: 'БЛОК' }[e.kind] || 'БЛОК',
      });
    }
  }
  drawParticles(dt) {
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.rect(p.x, p.y, 3, 3, p.color);
    }
    this.impacts = this.impacts.filter((p) => p.life > 0);
    for (const p of this.impacts) {
      p.life -= dt;
      const c = this.ctx;
      c.save();
      c.globalAlpha = Math.min(1, p.life * 5);
      c.strokeStyle = p.color;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y, 7 + (0.4 - p.life) * 45, 0, Math.PI * 2);
      c.stroke();
      this.text(p.label, p.x, p.y - 22 - (0.4 - p.life) * 20, 11, p.color, 'center');
      c.restore();
    }
  }
}
