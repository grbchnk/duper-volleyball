import { activeEmotion } from './emotions.js';
import { pixelPresent, drawBallDesign, compositePixels } from './display.js';
import { BodySprites, playerFrame } from './sprites.js';
import { COURT } from './config.js';
import { clamp, traceBall } from './physics.js';
import { springPoint, blockWindow } from './motion.js';
import { ARM_STYLES } from './arms.js';
import { expressivePose } from './arm-motion.js';
import { diveHands } from './dive-pose.js';
import { localReceiveAim } from './receive-pose.js';
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
    this.netRipple = null;
    this.pixelGraphics = true;
    this.textSprites = new Map();
    this.foreground = document.createElement('canvas');
    this.foreground.width = 960;
    this.foreground.height = 540;
    this.foregroundContext = this.foreground.getContext('2d', { willReadFrequently: true });
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
    if (this.pixelGraphics) {
      const key = [str, size, color].join('|');
      let image = this.textSprites.get(key);
      if (!image) {
        image = document.createElement('canvas');
        const c = image.getContext('2d', { willReadFrequently: true });
        c.font = `bold ${size}px "Consolas",monospace`;
        image.width = Math.ceil(c.measureText(str).width) + 2;
        image.height = Math.ceil(size * 1.7);
        c.font = `bold ${size}px "Consolas",monospace`;
        c.fillStyle = color;
        c.fillText(str, 0, size);
        const data = c.getImageData(0, 0, image.width, image.height);
        for (let i = 3; i < data.data.length; i += 4) data.data[i] = data.data[i] >= 110 ? 255 : 0;
        c.putImageData(data, 0, 0);
        if (this.textSprites.size > 400) this.textSprites.clear();
        this.textSprites.set(key, image);
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        image,
        Math.round(
          x - (align === 'center' ? image.width / 2 : align === 'right' ? image.width : 0),
        ),
        Math.round(y - size),
      );
      ctx.restore();
      return;
    }
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
    this.text('D U P E R   V O L L E Y B A L L', 480, 524, 11, '#557969', 'center', c);
  }
  project(x, y = 0) {
    return { x: 480 + x * 40, y: 450 - y * 42 };
  }
  drawAtmosphere(m, teams) {
    const c = this.ctx,
      live = true;
    const time = live ? m.time : 0;
    const point = ['point', 'set-end', 'finished'].includes(m.phase);
    const sunHappy = point && m.pointWinner === 0;
    const sunSad = point && m.pointWinner === 1;
    const sunY = 115 + (sunHappy ? Math.sin(time * 8) * 3 : Math.sin(time * 0.7));
    c.save();
    c.translate(833, sunY);
    c.strokeStyle = sunSad ? '#d9c698' : '#f6cf70';
    c.lineWidth = sunHappy ? 4 : 3;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6 + time * 0.08;
      const start = sunHappy ? 29 + Math.sin(time * 6) * 3 : 26;
      const end = start + (sunHappy ? 18 + Math.sin(time * 6 + i) * 4 : sunSad ? 5 : 9);
      c.beginPath();
      c.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
      c.lineTo(Math.cos(angle) * end, Math.sin(angle) * end);
      c.stroke();
    }
    c.fillStyle = sunSad ? '#e8d8ad' : sunHappy ? '#ffe493' : '#f3d8a0';
    c.beginPath();
    c.arc(0, 0, 23, 0, Math.PI * 2);
    c.fill();
    const look = clamp(m.ball.x / 5, -2, 2);
    this.rect(-9 + look, -6, 3, sunHappy ? 2 : 4, '#937d5e');
    this.rect(7 + look, -6, 3, sunHappy ? 2 : 4, '#937d5e');
    c.strokeStyle = '#b08760';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-7, sunSad ? 12 : 7);
    c.quadraticCurveTo(0, sunSad ? 3 : sunHappy ? 21 : 14, 7, sunSad ? 12 : 7);
    c.stroke();
    // The scarf identifies its favourite club even before the first point.
    this.rect(-15, 17, 30, 4, teams[0].color);
    c.restore();
    // Drifting birds, a refreshment kiosk and flower beds give the park depth.
    for (let i = 0; i < 4; i++) {
      const x = ((190 + i * 191 + time * (5 + i)) % 1000) - 20;
      const y = 156 + (i % 2) * 19 + Math.sin(time * 2 + i) * 3;
      this.rect(x, y, 3, 2, '#6a8f88');
      this.rect(x - 4, y - (Math.sin(time * 5 + i) > 0 ? 3 : -1), 4, 2, '#6a8f88');
      this.rect(x + 3, y - (Math.sin(time * 5 + i) > 0 ? 3 : -1), 4, 2, '#6a8f88');
    }
    this.rect(385, 282, 74, 46, '#c29877');
    this.rect(380, 278, 84, 10, '#f4e0b3');
    for (let i = 0; i < 7; i++) this.rect(380 + i * 12, 278, 6, 10, '#d78c79');
    this.rect(395, 292, 52, 19, '#5b8278');
    this.text('LEMON', 421, 306, 9, '#fff2cf', 'center');
    for (const x of [184, 750]) {
      this.rect(x, 307, 35, 18, '#b28b72');
      for (let j = 0; j < 5; j++) {
        this.rect(x + j * 7, 302, 3, 7, '#679c78');
        this.rect(x + j * 7 - 1, 299, 5, 4, j % 2 ? '#e8b678' : '#d48aa3');
      }
    }
    const ball = this.project(m.ball.x, m.ball.y);
    const celebrate = live && ['point', 'set-end', 'finished'].includes(m.phase);
    for (let i = 0; i < 18; i++) {
      const x = 65 + i * 47,
        fanTeam = i < 9 ? 0 : 1;
      const happy = celebrate && m.pointWinner === fanTeam;
      const jump = happy ? Math.max(0, Math.sin(time * 10 + i)) * 6 : 0;
      const y = 338 + (i % 2) * 8 - jump;
      const look = live ? Math.round(clamp((ball.x - x) / 90, -3, 3)) : 0;
      const lookY = live ? Math.round(clamp((ball.y - 330) / 100, -2, 1)) : 0;
      const shirt =
        i % 3 === 0 ? teams[fanTeam].color : ['#d4acb6', '#b0b8d2', '#d6c488', '#a4c5b0'][i % 4];
      this.rect(x - 8, y, 17, 14, shirt);
      const skin = ['#f3d2ac', '#c79270', '#e6b78e'][i % 3];
      this.rect(x - 6 + look, y - 12 + lookY, 13, 13, skin);
      this.rect(x - 7 + look, y - 15 + lookY, 15, 6, i % 3 === 0 ? '#b2886d' : '#575f5c');
      this.rect(x - 3 + look * 2, y - 7 + lookY, 2, 2, '#414d4a');
      this.rect(x + 3 + look * 2, y - 7 + lookY, 2, 2, '#414d4a');
      if (happy) {
        this.rect(x - 12, y - 11, 4, 18, skin);
        this.rect(x + 9, y - 13, 4, 20, skin);
        this.rect(x - 1 + look, y - 3, 4, 2, '#8f6457');
      } else {
        this.rect(x - 11, y + 3, 3, 9, skin);
        this.rect(x + 9, y + 3, 3, 9, skin);
      }
      this.rect(x - 3, y + 14, 4, 4, '#786d6b');
      this.rect(x + 4, y + 14, 4, 4, '#786d6b');
      if (happy && i % 2 === 0) {
        const flutter = Math.round(Math.sin(time * 9 + i) * 3);
        this.rect(x + 14, y - 26, 2, 28, '#786d6b');
        this.rect(x + 16, y - 26 + flutter, 16, 9, teams[fanTeam].color);
      }
    }
  }
  draw(m, teams, dt = 1 / 60) {
    this.pixelGraphics = m.config.pixelGraphics;
    const c = this.ctx;
    c.drawImage(this.background, 0, 0);
    this.drawAtmosphere(m, teams);
    this.foregroundContext.clearRect(0, 0, 960, 540);
    this.ctx = this.foregroundContext;
    c.save();
    for (const x of [-9, -3, 0, 3, 9]) {
      const p = this.project(x);
      this.rect(p.x - 1, 423, 3, 59, '#fff8df');
    }
    this.rect(478, 422, 5, 60, '#fff8df');
    for (const state of m.controls || [m])
      if (state.aimPreview) this.trajectory(state.aimPreview, m.config, true);
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
    if (m.mode === 'test' && m.testNext) {
      const server = m.players[m.testNext.playerId];
      const waiting = this.project(server.x - 0.35, 1.2);
      this.ctx.save();
      this.ctx.translate(waiting.x, waiting.y);
      this.ctx.scale(m.config.ballSize * 1.18, m.config.ballSize * 1.18);
      drawBallDesign(this.ctx, m.config.ballSkin, this.pixelGraphics);
      this.ctx.restore();
      this.text('СЛЕДУЮЩАЯ ПОДАЧА', waiting.x, waiting.y - 57, 8, '#526b68', 'center');
    }
    this.drawNet(m);
    this.drawBall(m);
    this.drawParticles(dt);
    c.restore();
    this.ctx = c;
    compositePixels(c, this.foreground, this.pixelGraphics);
    this.canvas.style.imageRendering = 'pixelated';
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
    pixelPresent(this.canvas, this.pixelGraphics, 2);
  }
  drawPlayer(p, team, m, dt) {
    const c = this.ctx,
      pos = this.project(p.x, p.y),
      floor = this.project(p.x),
      dir = p.diving ? Math.sign(p.diveVelocity) : p.facing || (p.team === 0 ? 1 : -1);
    const selected = p.id === m.selected[p.team] && m.isHuman(p.team);
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
      skin = (p.team ? m.config.awaySkin : m.config.skin) || 'club',
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
    const step = frame.state === 'run' ? (pose.r - pose.l) * 0.5 : 0;
    this.drawArms(p, m, dt, step, frame);
    c.save();
    c.scale(dir, 1);
    this.text(String(p.number), dir, -13, 7, '#fff7e4', 'center');
    c.restore();
    c.restore();
    c.restore();
    if (p.id === m.selected[p.team] && m.isHuman(p.team)) {
      const y = floor.y + 14;
      c.fillStyle = p.team ? '#497f7c' : '#bc645d';
      c.beginPath();
      c.moveTo(floor.x - 6, y + 8);
      c.lineTo(floor.x + 6, y + 8);
      c.lineTo(floor.x, y);
      c.fill();
      const action = m.actionFor(p.team);
      if (action?.playerId === p.id) {
        this.rect(pos.x - 22, pos.y - 91, 44, 4, '#314e64');
        this.rect(
          pos.x - 21,
          pos.y - 90,
          42 * action.power,
          2,
          action.power > 0.88 ? '#dc806d' : '#ffe896',
        );
      }
    }
    if (p.stunned > 0) {
      const scale = this.spriteScale || 2.1;
      const sin = Math.sin(pose.tilt),
        cos = Math.cos(pose.tilt);
      const headX = pos.x + dir * ((pose.h + 0.5) * cos - (pose.y - 25) * sin) * scale;
      const headY = pos.y + ((pose.h + 0.5) * sin + (pose.y - 28) * cos - 5 * sin) * scale - 20;
      for (let i = 0; i < 3; i++) {
        const angle = m.time * 5 + (i * Math.PI * 2) / 3;
        this.text(
          '★',
          headX + Math.cos(angle) * 18,
          headY + Math.sin(angle) * 6,
          15,
          '#ffe896',
          'center',
        );
      }
    } else if (p.recovery > 0) {
      this.text('···', pos.x, pos.y - 25, 15, '#a27970', 'center');
    }
  }
  drawArms(p, m, dt, step, bodyFrame = null) {
    const c = this.ctx,
      spec = ARM_STYLES.whip;
    const action = m.actionFor?.(p.team) || m.charge || m.pending;
    const charge = m.phase !== 'serve' && action?.playerId === p.id ? action : null;
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
      diveTarget: p.diving
        ? c
            .getTransform()
            .inverse()
            .transformPoint(
              this.project(diveHands(p, m.ball, m.config).x, diveHands(p, m.ball, m.config).y),
            )
        : null,
      receiveAim: localReceiveAim(p, charge || swing, m.ball, bodyFrame, m.config),
      emotion: activeEmotion(p),
      shoulderLift: bodyFrame?.pose.shoulders || 0,
      localVelocity: swing?.hit ? rig.localVelocity : null,
      actionDirection:
        Math.sign(
          (serving ? m.serveAction?.aim?.axis : charge?.aim?.vector?.x || charge?.aim?.axis) ||
            (p.team === 0 ? 1 : -1) * (!serving && kind === 'back' ? -1 : 1),
        ) / (p.facing || 1),
      spec,
      config: m.config,
      kind,
      serve: serving && !m.serveAction?.attempted ? { ...m.serveAction, age: m.phaseTime } : null,
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
      { back: '#e8c35c', low: '#78b6c9', loft: '#8aad77', drive: '#e89a70', block: '#b7a0ce' }[
        kind
      ] || '#fff1da';
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
  drawNet(m) {
    const c = this.ctx,
      x = 480,
      top = 450 - COURT.netHeight * 42;
    const hit = m?.ball.netImpact;
    if (hit && this.netRipple?.source !== hit) this.netRipple = { ...hit, source: hit, at: m.time };
    const age = this.netRipple ? m.time - this.netRipple.at : 10;
    const wave =
      age < 1.5
        ? Math.sin(age * 25) *
          Math.exp(-age * 3.5) *
          Math.min(11, this.netRipple.speed * 0.7) *
          this.netRipple.direction
        : 0;
    this.rect(x - 3, top, 1, 114, '#6b8a80');
    this.rect(x + 3, top, 1, 114, '#6b8a80');
    for (let y = top + 4; y < 461; y += 4) {
      const offset = wave * Math.sin(((y - top) / 113) * Math.PI);
      this.rect(x + offset, y, 1, 4, '#87a699');
      if (Math.round((y - top) / 4) % 2 === 0) this.rect(x - 2 + offset, y, 5, 1, '#87a699');
    }
    this.rect(x - 3 + wave * 0.35, top, 7, 2, '#fffbee');
    this.rect(x + 3, top - 19, 1, 22, '#d3897c');
    this.rect(x - 5, 461, 12, 3, '#d29d82');
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
    if (
      (m.controls?.some((state) => state.contactWindow) || m.contactWindow) &&
      (m.phase !== 'serve-motion' || Math.floor(m.time * 20) % 2 === 0)
    ) {
      c.strokeStyle = '#cc7967';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, y, 16, 0, Math.PI * 2);
      c.stroke();
    }
    const burning = Math.hypot(m.ball.vx, m.ball.vy) >= m.config.fireSpeed;
    if (burning) {
      c.save();
      c.translate(p.x, y);
      c.rotate(Math.atan2(-m.ball.vy, m.ball.vx));
      for (let i = 4; i > 0; i--) {
        c.fillStyle = i > 2 ? '#f4773060' : '#ffd957b0';
        c.beginPath();
        c.ellipse(-i * 9, Math.sin(m.time * 35 + i) * 3, 12 + i * 3, 11 - i, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    c.save();
    c.translate(Math.round(p.x), Math.round(y));
    c.scale(m.config.ballSize || 1.2, m.config.ballSize || 1.2);
    const speed = Math.hypot(m.ball.vx, m.ball.vy),
      stretch = Math.abs(m.ball.x) < 1 ? 1 : 1 + clamp((speed - 5) / 30, 0, 0.3);
    const direction = Math.atan2(-m.ball.vy, m.ball.vx),
      impact = this.impacts.length ? Math.max(...this.impacts.map((e) => e.life)) : 0;
    const squash = Math.abs(m.ball.x) >= 1 && impact > 0.34 ? 1 - (impact - 0.34) * 2 : 1;
    c.rotate(direction);
    c.scale(stretch * 1.18 * squash, 1.18 / (stretch * squash));
    c.rotate(-direction);
    c.rotate(m.ball.angle);
    drawBallDesign(c, m.config.ballSkin, this.pixelGraphics);
    c.restore();
    if ((m.controls?.some((state) => state.contactWindow) || m.contactWindow) && m.mode !== 'demo')
      this.text(
        m.phase === 'serve-motion' ? 'НАЖМИ!' : 'МЯЧ ДОСТУПЕН',
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
    this.text('X  A  W  D', 697, 32, 13, '#7d917a', 'center');
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
        label:
          { low: 'СНИЗУ', back: 'НАЗАД', loft: 'ПАС', drive: 'УДАР', block: 'БЛОК' }[e.kind] ||
          'БЛОК',
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
