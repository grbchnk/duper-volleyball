import { skinPalette } from './appearance.js';
import { netVisual, netMesh } from './net-visual.js';
import { constrainRenderedJoint } from './net-reach.js';
import { drawOutCross } from './landing-visual.js';
import { drawArenaBackdrop, spectatorPlace } from './arenas.js';
import { activeEmotion } from './emotions.js';
import { pixelPresent, drawBallDesign, compositePixels } from './display.js';
import { BodySprites, playerFrame, frameOf } from './sprites.js';
import { bodyOffset } from './movement-feel.js';
import { serveSupport } from './serve-support.js';
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
  makeBackground(theme = 'miami') {
    this.arenaTheme = theme;
    drawArenaBackdrop(this.background.getContext('2d'), theme);
  }
  project(x, y = 0) {
    return { x: 480 + x * 40, y: 450 - y * 42 };
  }
  logicalTransform(context) {
    const matrix = context.getTransform();
    const sx = this.renderScaleX || 1,
      sy = this.renderScaleY || 1;
    return sx === 1 && sy === 1
      ? matrix
      : new DOMMatrix([
          matrix.a / sx,
          matrix.b / sy,
          matrix.c / sx,
          matrix.d / sy,
          matrix.e / sx,
          matrix.f / sy,
        ]);
  }
  drawAtmosphere(m, teams) {
    const c = this.ctx,
      live = m.config.livelyBackground;
    const time = live ? m.time : 0;
    const point = ['point', 'set-end', 'finished'].includes(m.phase);
    const ball = this.project(m.ball.x, m.ball.y);
    const celebrate = live && ['point', 'set-end', 'finished'].includes(m.phase);
    for (let i = 0; i < 18; i++) {
      const { x, y: seatY } = spectatorPlace(i),
        fanTeam = i < 9 ? 0 : 1;
      const happy = celebrate && m.pointWinner === fanTeam;
      const jump = happy ? Math.max(0, Math.sin(time * 10 + i)) * 6 : 0;
      const y = seatY - jump;
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
      if (m.config.arenaTheme === 'miami') {
        this.rect(x - 3, y + 14, 4, 8, '#8b9691');
        this.rect(x + 4, y + 14, 4, 8, '#8b9691');
        this.rect(x - 4, y + 21, 6, 3, '#786d6b');
        this.rect(x + 4, y + 21, 6, 3, '#786d6b');
      } else {
        this.rect(x - 3, y + 14, 4, 4, '#786d6b');
        this.rect(x + 4, y + 14, 4, 4, '#786d6b');
      }
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
    const sx = this.canvas.width / 960,
      sy = this.canvas.height / 540;
    this.renderScaleX = sx;
    this.renderScaleY = sy;
    c.setTransform(sx, 0, 0, sy, 0, 0);
    if (
      this.foreground.width !== this.canvas.width ||
      this.foreground.height !== this.canvas.height
    ) {
      this.foreground.width = this.canvas.width;
      this.foreground.height = this.canvas.height;
    }
    this.foregroundContext.setTransform(sx, 0, 0, sy, 0, 0);
    if (this.arenaTheme !== m.config.arenaTheme) this.makeBackground(m.config.arenaTheme);
    c.drawImage(this.background, 0, 0);
    this.drawAtmosphere(m, teams);
    if (m.cupStage != null) {
      c.save();
      c.globalAlpha = 0.1;
      c.fillStyle =
        ['#d9ae74', '#7d71c0', '#ffe291', '#4d6197', '#7c88ac', '#c2a35b', '#e2b655'][m.cupStage] ||
        '#d9ae74';
      c.fillRect(0, 73, 960, 467);
      c.restore();
      this.rect(16, 150, 85, 28, '#315847');
      this.text(`АРЕНА ${m.cupStage + 1} / 7`, 58, 168, 10, '#f4d68d', 'center');
    }
    this.foregroundContext.clearRect(0, 0, 960, 540);
    this.ctx = this.foregroundContext;
    c.save();
    for (const x of [-COURT.halfLength, -3, 0, 3, COURT.halfLength]) {
      const p = this.project(x);
      this.rect(p.x - 1, 423, 2, 59, '#fff8df');
    }
    this.rect(479, 422, 2, 60, '#fff8df');
    this.drawChallenge(m);
    const previews = (m.controls || [m]).filter((state) => state.aimPreview);
    for (const state of previews) this.trajectory(state.aimPreview, m.config, true);
    if (!previews.length && m.config.trajectory && m.phase === 'rally')
      this.trajectory(m.ball, m.config, false);
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
    c.fillStyle = `rgba(175,153,115,${Math.max(0.12, 0.38 - m.ball.y * 0.035)})`;
    c.beginPath();
    c.ellipse(
      b.x,
      456,
      Math.max(4, 9 - m.ball.y * 0.55),
      Math.max(1.5, 3 - m.ball.y * 0.12),
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
    if (m.prediction && m.phase === 'rally' && m.ball.x < 0) {
      const p = this.project(m.prediction.x);
      c.strokeStyle = '#698c8070';
      c.setLineDash([3, 3]);
      c.strokeRect(p.x - 12, 449, 24, 8);
      c.setLineDash([]);
    }
    for (const p of m.players.filter((p) => !p.benched)) this.drawPlayer(p, teams[p.team], m, dt);
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
    if (m.outMarker) {
      const marker = this.project(m.outMarker.x, 0);
      const x = clamp(marker.x, 16, 944);
      drawOutCross(this.ctx, x, marker.y);
      this.text('АУТ', x, marker.y - 16, 11, '#b75e51', 'center');
    }
    this.drawParticles(dt);
    c.restore();
    this.ctx = c;
    compositePixels(c, this.foreground, this.pixelGraphics, 960, 540);
    this.canvas.style.imageRendering = 'pixelated';
    this.drawHUD(m, teams);
    const combination = m.combinations?.[0];
    const complete = m.visualCombo && m.time - m.visualCombo.at < 1.8;
    if (complete) {
      this.rect(310, 116, 340, 34, '#fff2c9ee');
      this.text('★ ПРИЁМ · НАВЕС · УДАР ★', 480, 138, 15, '#a3762e', 'center');
    } else if (combination && m.time - combination.at < 4)
      this.text(
        combination.stage === 1 ? '◆ ПРИЁМ → ◇ НАВЕС → ◇ УДАР' : '◆ ПРИЁМ → ◆ НАВЕС → ◇ УДАР',
        480,
        133,
        11,
        '#8b8760',
        'center',
      );
    if (m.challenge?.ready > 0) {
      this.rect(320, 180, 320, 108, '#fff9eaf2');
      this.text('ПРИГОТОВЬСЯ', 480, 209, 15, '#627755', 'center');
      this.text(String(Math.ceil(m.challenge.ready)), 480, 265, 48, '#a9813e', 'center');
    }
    if (m.challenge?.waiting > 0) {
      const hit = m.challenge.results.at(-1)?.hit;
      this.rect(290, 168, 380, 78, '#fff9eaf2');
      this.text(m.challenge.message, 480, 204, 23, hit ? '#3a7958' : '#ac6c53', 'center');
      this.text(
        `СЕРИЯ ${m.challenge.combo}  ·  ${m.challenge.score} ОЧКОВ`,
        480,
        229,
        12,
        '#66775e',
        'center',
      );
    }
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
    pixelPresent(this.canvas, this.pixelGraphics && this.canvas.width === 960, 2);
  }
  drawPlayer(p, team, m, dt) {
    const c = this.ctx,
      pos = this.project(p.x, p.y),
      floor = this.project(p.x),
      dir = p.diving ? Math.sign(p.diveVelocity) : p.facing || (p.team === 0 ? 1 : -1);
    const selected = m.humanSlot(p) !== null;
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
    c.fillStyle = `rgba(176,142,106,${Math.max(0.12, 0.31 - p.y * 0.08)})`;
    c.beginPath();
    c.ellipse(
      floor.x,
      floor.y + 6,
      Math.max(7, 13 - p.y * 2),
      Math.max(2, 3 - p.y * 0.3),
      0,
      0,
      Math.PI * 2,
    );
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
    const motion = bodyOffset(p);
    c.drawImage(this.bodySprites.get(frame, skin, team, p.id, 'feet', p.appearance), -32, -54);
    c.drawImage(
      this.bodySprites.get(frame, skin, team, p.id, 'torso', p.appearance),
      -32 + motion.torso * dir,
      -54 + motion.drop,
    );
    if (!p.headFly)
      c.drawImage(
        this.bodySprites.get(frame, skin, team, p.id, 'head', p.appearance),
        -32 + motion.head * dir,
        -54 + motion.drop,
      );
    c.save();
    c.translate(motion.torso * dir, pose.y + motion.drop);
    const step = frame.state === 'run' ? (pose.r - pose.l) * 0.5 : 0;
    this.drawArms(p, m, dt, step, frame);
    c.save();
    c.scale(dir, 1);
    this.text(String(p.number), dir, -13, 7, '#fff7e4', 'center');
    c.restore();
    c.restore();
    c.restore();
    if (p.headFly) {
      const fly = p.headFly,
        age = fly.age;
      const head = this.project(
        fly.x + fly.vx * age,
        Math.max(0.32, fly.y + fly.vy * age - 5.05 * age * age),
      );
      c.save();
      c.translate(head.x, head.y);
      c.rotate(age * fly.vx * 0.9);
      c.scale(dir * (this.spriteScale || 2.1), this.spriteScale || 2.1);
      const headImage = this.bodySprites.get(
        frameOf('idle'),
        skin,
        team,
        p.id,
        'head',
        p.appearance,
      );
      c.drawImage(headImage, 0, 0, 64, 31, -32, -24, 64, 31);
      c.restore();
    }
    if (m.humanSlot(p) !== null) {
      const y = floor.y + 14;
      c.fillStyle = m.humanSlot(p) === 2 ? '#457fbd' : p.team ? '#497f7c' : '#bc645d';
      c.beginPath();
      c.moveTo(floor.x - 6, y + 8);
      c.lineTo(floor.x + 6, y + 8);
      c.lineTo(floor.x, y);
      c.fill();
      if (m.mode === 'coop' && p.team === 0)
        this.text(m.humanSlot(p) === 2 ? 'P2' : 'P1', floor.x, y + 26, 10, c.fillStyle, 'center');
      const action = m.actionForPlayer(p);
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
    if (p.stunned > 0 && !p.headFly) {
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
    const action = m.actionForPlayer?.(p) || m.actionFor?.(p.team) || m.charge || m.pending;
    const charge = m.phase !== 'serve' && action?.playerId === p.id ? action : null;
    const serving =
      m.phase === 'serve-motion' && p.id === (m.serverPlayer?.().id ?? m.selected[m.server]);
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
      const local = this.logicalTransform(c).inverse().transformPoint(screen);
      // DOMPoint coordinates live on its prototype; object spread drops them.
      rig.contactPoint = { x: local.x, y: local.y };
      rig.contactKey = swing.at ?? swing;
      if (Number.isFinite(swing.vx) && Number.isFinite(swing.vy)) {
        const end = this.logicalTransform(c)
          .inverse()
          .transformPoint(this.project(swing.x + swing.vx, swing.y + swing.vy));
        rig.localVelocity = { x: end.x - local.x, y: end.y - local.y };
      } else rig.localVelocity = null;
    }
    const support =
      Math.abs(this.project(p.x).x - this.project(0).x) > 1 ? serveSupport(m, p) : null;
    const supportScreen = support ? this.project(m.ball.x, m.ball.y) : null;
    if (support) {
      supportScreen.y +=
        10 * (m.config.ballSize || 1.2) * 1.18 +
        spec.hand * m.config.armScale * (this.spriteScale || 2.1) * 0.65;
      support.point = this.logicalTransform(c).inverse().transformPoint(supportScreen);
    }
    const pose = expressivePose({
      serveSupport: support,
      diveTarget: p.diving
        ? this.logicalTransform(c)
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
      if (
        (support?.attached && i === support.hand) ||
        (newContact && pose.snap) ||
        (swing?.hit && rig.localVelocity && swing.age < 0.09)
      )
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
      const transform = this.logicalTransform(c);
      const over = kind === 'drive' || kind === 'block';
      if (Math.abs(this.project(p.x).x - this.project(0).x) > 1) {
        constrainRenderedJoint(wrist, transform, this.project.bind(this), p.team, m.ball, over);
        constrainRenderedJoint(elbow, transform, this.project.bind(this), p.team, m.ball, over);
      }
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = spec.width * m.config.armScale * m.config.armRoundness;
      c.strokeStyle = p.appearance ? skinPalette(p.appearance.tone).outline : '#665d62';
      c.beginPath();
      c.moveTo(shoulder.x, shoulder.y);
      c.quadraticCurveTo(elbow.x, elbow.y, wrist.x, wrist.y);
      c.stroke();
      c.lineWidth = Math.max(1, spec.width * m.config.armScale * m.config.armRoundness - 2);
      c.strokeStyle = pose.snap ? '#fff7dc' : p.appearance?.tone || '#f4cfac';
      c.stroke();
      const hand = spec.hand * m.config.armScale;
      c.save();
      c.translate(wrist.x, wrist.y);
      // Overhead fingers face inward/up, forming a small cup instead of two parallel poles.
      const neutralAngle =
        (Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) + Math.PI / 2) *
        (support?.hand === i ? 1 - support.weight : 1);
      c.rotate(neutralAngle * (1 - pose.cup) + (i ? -0.55 : 0.55) * pose.cup);
      this.rect(
        -hand / 2,
        0,
        hand,
        2,
        kind === 'block' && blockWindow(p, m.config) ? '#f8da75' : tint,
      );
      this.rect(
        -hand / 2,
        -hand * 0.8,
        hand,
        hand * 0.8,
        p.appearance ? skinPalette(p.appearance.tone).outline : '#665d62',
      );
      this.rect(
        -hand / 2 + 0.6,
        -hand * 0.8,
        hand - 1.2,
        hand * 0.8,
        p.appearance?.tone || '#f4cfac',
      );
      if (pose.cup) {
        this.rect(-hand / 2, -hand * 1.15, 1.3, hand * 0.5, p.appearance?.tone || '#f4cfac');
        this.rect(hand / 2 - 1.3, -hand * 1.15, 1.3, hand * 0.5, p.appearance?.tone || '#f4cfac');
      }
      c.restore();
    }
  }
  drawNet(m) {
    const c = this.ctx,
      x = 480,
      top = Math.round((450 - COURT.netHeight * 42) / 2) * 2;
    this.netRipple = netVisual(this.netRipple, m?.ball.netImpact, m.time);
    const wave = this.netRipple.wave;
    this.rect(x - 4, top, 2, 116, '#6b8a8099');
    this.rect(x + 4, top, 2, 116, '#6b8a8099');
    for (const [px, py, w, h] of netMesh(wave, top)) this.rect(px, py, w, h, '#87a69980');
    this.rect(x - 4, top, 10, 2, '#fffbee');
    this.rect(x + 4, top - 18, 2, 20, '#d3897c');
    this.rect(x - 6, 462, 14, 2, '#d29d82');
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
    const burning = m.config.ballFire && Math.hypot(m.ball.vx, m.ball.vy) >= m.config.fireSpeed;
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
    this.text(
      m.mode === 'versus' ? 'ИГРОК 2' : m.challenge ? 'ИСПЫТАНИЕ' : 'КОМПЬЮТЕР',
      912,
      51,
      9,
      '#839286',
      'right',
    );
    this.text(
      m.challenge
        ? `${m.challenge.score}`
        : `${String(m.score[0]).padStart(2, '0')} : ${String(m.score[1]).padStart(2, '0')}`,
      480,
      41,
      32,
      '#526e5f',
      'center',
    );
    this.text(
      m.challenge
        ? `МЯЧ ${m.challenge.attempt} / ${m.challenge.total}`
        : `СЕТ ${m.sets[0] + m.sets[1] + 1}  /  ${m.sets.join(' — ')}`,
      480,
      61,
      9,
      '#8d9b84',
      'center',
    );
    const phase = m.mode === 'test' ? 'ТЕСТ ∞' : m.teamPhases[0] === 'attack' ? 'АТАКА' : 'ЗАЩИТА';
    this.text(m.phase === 'serve' ? 'ПОДАЧА' : phase, 265, 34, 11, '#8d7867', 'center');
    this.text(`${m.touches[0]} / 3 КАСАНИЯ`, 265, 51, 9, '#8b998a', 'center');
    this.text('S  W  D', 697, 32, 13, '#7d917a', 'center');
    this.text('ЗАЖМИ → ОТПУСТИ', 697, 51, 8, '#8b998a', 'center');
  }
  drawChallenge(m) {
    const trial = m.challenge;
    if (!trial || trial.done) return;
    const c = this.ctx;
    if (trial.id === 'rescue') {
      if (trial.waiting) return;
      const p = this.project(m.ball.x);
      c.save();
      c.strokeStyle = '#b68142';
      c.lineWidth = 3;
      c.setLineDash([5, 4]);
      c.beginPath();
      c.ellipse(p.x, 456, 22, 7, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      this.text(
        trial.direction < 0 ? '← Q / БРОСОК' : 'E / БРОСОК →',
        p.x,
        490,
        11,
        '#8e6337',
        'center',
      );
      return;
    }
    const center = this.project(trial.target).x;
    const width = trial.width * 40;
    c.save();
    c.globalAlpha = 0.62 + Math.sin(m.time * 5) * 0.12;
    this.rect(center - width / 2, 425, width, 56, '#e8b650');
    this.rect(center - 12, 425, 24, 56, '#fff0b0');
    c.globalAlpha = 1;
    c.strokeStyle = '#a46e2c';
    c.lineWidth = 2;
    c.strokeRect(center - width / 2, 425, width, 56);
    c.beginPath();
    c.ellipse(center, 452, 10, 5, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    this.text('ЦЕЛЬ', center, 414, 10, '#986928', 'center');
    const last = trial.results.at(-1);
    if (trial.waiting && last && Number.isFinite(last.x)) {
      const x = this.project(Math.max(-10, Math.min(10, last.x))).x;
      this.text('×', x, 461, 26, last.hit ? '#3c7955' : '#b65d4b', 'center');
    }
  }
  effect(e, m) {
    if (e.type === 'skid' || e.type === 'land') {
      const at = this.project(e.x, 0);
      for (let i = 0; i < (e.type === 'skid' ? 5 : 3); i++)
        this.particles.push({
          x: at.x + (i - 2) * 3,
          y: at.y,
          vx: (e.direction || (i % 2 ? 1 : -1)) * (12 + i * 6),
          vy: -12 - i * 4,
          life: 0.18 + i * 0.025,
          color: i % 2 ? '#fff0d1' : '#cfae89',
        });
    }
    if (e.type === 'combination') {
      const p = this.project(e.x, e.y);
      for (let i = 0; i < 18; i++) {
        const angle = (i * Math.PI * 2) / 18;
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(angle) * 90,
          vy: Math.sin(angle) * 70 - 20,
          life: 0.65,
          color: i % 2 ? '#e6be57' : '#fff3bd',
        });
      }
    }
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
