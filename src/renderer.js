import { CeilingVFX, ballAboveCeiling, ballShadowOpacity } from './ceiling-vfx.js';
import { preparedHands } from './held-contact.js';
import { isZoneReceive } from './zone-receive.js';
import { drawZoneSpectator } from './zone-crowd.js';
import {
  isZone,
  drawZoneSky,
  drawZoneDistance,
  drawZoneArchitecture,
  drawZoneForeground,
  drawZoneLife,
  zoneSeats,
} from './zone-scene.js';
import { skinPalette } from './appearance.js';
import { netVisual, netMesh, diamondMesh } from './net-visual.js';
import { constrainRenderedJoint } from './net-reach.js';
import { drawOutCross } from './landing-visual.js';
import { drawArenaBackdrop } from './arenas.js';
import { activeEmotion } from './emotions.js';
import { pixelPresent, drawBallDesign, compositePixels } from './display.js';
import { BodySprites, playerFrame, frameOf } from './sprites.js';
import { bodyOffset, verticalBodyOffset } from './movement-feel.js';
import { serveSupport } from './serve-support.js';
import { serveCue } from './serve-cue.js';
import { COURT } from './config.js';
import { clamp, traceBall } from './physics.js';
import { springPoint, blockWindow } from './motion.js';
import { ARM_STYLES } from './arms.js';
import { expressivePose } from './arm-motion.js';
import { armContour, blendAngle, drawOpenArm } from './arm-contour.js';
import { playerArmConfig } from './player-arms.js';
import { diveHands } from './dive-pose.js';
import { drawFlame, contactAccent, drawContactAccent } from './contact-vfx.js';
import { localReceiveAim } from './receive-pose.js';
import {
  projectCourt,
  projectStreetNet,
  NET_BOTTOM,
  usesPerspectiveCourt,
} from './court-visual.js';
import {
  drawStreetSky,
  drawStreetCity,
  drawStreetArchitecture,
  drawStreetForeground,
  drawStreetLife,
  STREET_SEATS,
  pixelTools,
} from './street-scene.js';

function shotChargeColor(power) {
  const progress = clamp(power, 0, 1) * 2;
  const green = [131, 230, 195],
    yellow = [255, 232, 150],
    red = [220, 128, 109];
  const from = progress <= 1 ? green : yellow;
  const to = progress <= 1 ? yellow : red;
  const blend = progress <= 1 ? progress : progress - 1;
  return `rgb(${from.map((channel, i) => Math.round(channel + (to[i] - channel) * blend)).join(', ')})`;
}

export class Renderer {
  constructor(canvas, { scene = true } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bodySprites = new BodySprites();
    this.camera = 0;
    this.particles = [];
    this.ceiling = new CeilingVFX();
    this.impacts = [];
    this.ballSquash = null;
    this.contactAccents = [];
    this.floorRipples = [];
    this.armRigs = new Map();
    this.shake = 0;
    this.netRipple = null;
    this.pixelGraphics = true;
    this.textSprites = new Map();
    this.foreground = document.createElement('canvas');
    this.foreground.width = 960;
    this.foreground.height = 540;
    this.foregroundContext = this.foreground.getContext('2d', { willReadFrequently: true });
    if (scene) {
      this.background = document.createElement('canvas');
      this.background.width = 960;
      this.background.height = 540;
    }
    this.actor = document.createElement('canvas');
    this.actor.width = 180;
    this.actor.height = 200;
    // Keep sprite and silhouette buffers on the CPU, like the pixel-composite
    // layer. Otherwise each player forces a GPU readback before compositing.
    this.actorContext = this.actor.getContext('2d', { willReadFrequently: true });
    this.shadow = document.createElement('canvas');
    this.shadow.width = 180;
    this.shadow.height = 200;
    this.shadowContext = this.shadow.getContext('2d', { willReadFrequently: true });
    if (scene) {
      this.cityLayer = document.createElement('canvas');
      this.cityLayer.width = 980;
      this.cityLayer.height = 550;
      this.frontLayer = document.createElement('canvas');
      this.frontLayer.width = 980;
      this.frontLayer.height = 550;
      this.makeBackground();
    }
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
        if (this.textSprites.size >= 400)
          this.textSprites.delete(this.textSprites.keys().next().value);
        this.textSprites.set(key, image);
      } else {
        this.textSprites.delete(key);
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
    const c = this.background.getContext('2d');
    c.clearRect(0, 0, 960, 540);
    if (isZone(theme)) drawZoneArchitecture(c, theme);
    else if (theme === 'miami') drawStreetArchitecture(c);
    else drawArenaBackdrop(c, theme);
    for (const [layer, draw] of [
      [this.cityLayer, isZone(theme) ? drawZoneDistance : drawStreetCity],
      [this.frontLayer, isZone(theme) ? drawZoneForeground : drawStreetForeground],
    ]) {
      const context = layer.getContext('2d');
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, layer.width, layer.height);
      context.save();
      context.translate(10, 5);
      draw(context, theme);
      context.restore();
    }
  }
  project(x, y = 0) {
    return projectCourt(x, y);
  }
  logicalTransform(context) {
    const matrix = context.getTransform();
    if (this.renderingActor)
      return new DOMMatrix([
        matrix.a / this.actorScaleX,
        matrix.b / this.actorScaleY,
        matrix.c / this.actorScaleX,
        matrix.d / this.actorScaleY,
        matrix.e / this.actorScaleX + this.actorOrigin.x,
        matrix.f / this.actorScaleY + this.actorOrigin.y,
      ]);
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
    this.drawStreetCrowd(m, teams);
  }
  drawStreetCrowd(m, teams) {
    const live = m.config.livelyBackground;
    const time = live ? m.time : 0;
    const ball = this.project(m.ball.x, m.ball.y);
    const celebrate = live && ['point', 'set-end', 'finished'].includes(m.phase);
    const seats = isZone(m.config.arenaTheme) ? zoneSeats(m.config.arenaTheme) : STREET_SEATS;
    for (let i = 0; i < seats.length; i++) {
      const [x, seat] = seats[i];
      const team = i < 4 || i === 10 || i === 12 ? 0 : 1;
      const happy = celebrate && m.pointWinner === team;
      const disappointed = celebrate && !happy;
      const y = seat - (happy ? Math.max(0, Math.sin(time * 9 + i)) * 5 : 0);
      const look = live ? Math.round(clamp((ball.x - x) / 180, -2, 2)) : 0;
      const tilt = live ? Math.round(clamp((ball.y - y) / 160, -1, 1)) : 0;
      if (isZone(m.config.arenaTheme)) {
        drawZoneSpectator(this.ctx, m.config.arenaTheme, i, x, y, {
          time,
          look,
          happy,
          disappointed,
          live,
        });
        continue;
      }
      const skin = ['#efc39a', '#d19a73', '#e6b58c', '#b67e59'][i % 4];
      const shirt =
        i % 3 === 0 ? teams[team].dark : ['#d8b7a5', '#789692', '#b7a4ab', '#d6baa2'][i % 4];
      const ink = '#52515b';
      this.rect(x - 9, y - 14, 19, 18, ink);
      this.rect(x - 8, y - 13, 17, 16, shirt);
      this.rect(x - 5, y - 12, 11, 4, skin);
      this.rect(x - 7, y - 26 + tilt, 15, 14, ink);
      this.rect(x - 6 + look, y - 25 + tilt, 13, 12, skin);
      this.rect(
        x - 7 + look,
        y - 28 + tilt,
        15,
        5,
        ['#4c454c', '#876a54', '#466e70', '#b39773'][i % 4],
      );
      if (i % 4 === 2) this.rect(x - 8 + look, y - 25 + tilt, 18, 2, '#ead3b0');
      const blink = live && Math.floor(time * 6 + i * 13) % 97 === 0;
      this.rect(x - 3 + look * 2, y - 21 + tilt, 2, blink ? 1 : 3, ink);
      this.rect(x + 3 + look * 2, y - 21 + tilt, 2, blink ? 1 : 3, ink);
      this.rect(x + look, y - 16 + tilt, 3, happy ? 2 : 1, '#9c7061');
      // Sitting legs, shorts, socks and lit toe caps.
      this.rect(x - 8, y + 1, 17, 5, '#626b78');
      for (const dx of [-7, 4]) {
        this.rect(x + dx, y + 5, 5, 14, skin);
        this.rect(x + dx, y + 17, 5, 4, '#ddd9c8');
        this.rect(x + dx - 1, y + 20, 8, 3, '#4e5768');
        this.rect(x + dx - 1, y + 20, 7, 2, '#eee3cf');
      }
      const c = this.ctx;
      c.strokeStyle = skin;
      c.lineWidth = 4;
      c.lineCap = 'round';
      c.beginPath();
      if (happy) {
        c.moveTo(x - 10, y - 10);
        c.lineTo(x - 13, y - 28 - Math.sin(time * 11 + i) * 3);
        c.moveTo(x + 10, y - 10);
        c.lineTo(x + 13, y - 29 + Math.sin(time * 11 + i) * 3);
      } else if (disappointed) {
        c.moveTo(x - 10, y - 9);
        c.lineTo(x - 10, y - 17);
        c.lineTo(x - 5, y - 22);
        c.moveTo(x + 10, y - 9);
        c.lineTo(x + 10, y - 17);
        c.lineTo(x + 5, y - 22);
      } else {
        c.moveTo(x - 10, y - 9);
        c.lineTo(x - 10, y + 3);
        c.lineTo(x - 4, y + 3);
        c.moveTo(x + 10, y - 9);
        c.lineTo(x + 10, y + 3);
        c.lineTo(x + 4, y + 3);
      }
      c.stroke();
    }
  }
  drawSpriteShadow(p, pos, floor) {
    const mask = this.shadowContext;
    const { x, y } = this.actorOrigin;
    const width = this.actor.width,
      height = this.actor.height;
    if (this.shadow.width !== width || this.shadow.height !== height) {
      this.shadow.width = width;
      this.shadow.height = height;
    }
    mask.clearRect(0, 0, width, height);
    mask.globalCompositeOperation = 'source-over';
    mask.drawImage(this.actor, 0, 0);
    mask.globalCompositeOperation = 'source-in';
    mask.fillStyle = '#514f68';
    mask.fillRect(0, 0, width, height);
    mask.globalCompositeOperation = 'source-over';
    const c = this.canvas.getContext('2d');
    c.save();
    c.globalAlpha = clamp(0.31 - p.y * 0.035, 0.12, 0.31);
    c.translate(floor.x - p.y * 13, floor.y + 3 + p.y * 6);
    // Project the CURRENT raster silhouette (including rigged arms) away from
    // the setting sun. Jump height separates the shadow from the player's feet.
    c.transform(1, 0, 0.65, -0.34, 0, 0);
    c.translate(-pos.x, -pos.y);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.shadow, x, y, width / this.actorScaleX, height / this.actorScaleY);
    c.restore();
  }
  draw(m, teams, dt = 1 / 60) {
    this.pixelGraphics = m.config.pixelGraphics;
    const ceilingEvent = this.ceiling.update(m);
    if (ceilingEvent) this.onCeilingBreak?.(ceilingEvent);
    const ballVisible = !ballAboveCeiling(m.ball);
    const c = this.ctx;
    const sx = this.canvas.width / 960,
      sy = this.canvas.height / 540;
    this.renderScaleX = sx;
    this.renderScaleY = sy;
    c.setTransform(sx, 0, 0, sy, 0, 0);
    c.imageSmoothingEnabled = false;
    if (
      this.foreground.width !== this.canvas.width ||
      this.foreground.height !== this.canvas.height
    ) {
      this.foreground.width = this.canvas.width;
      this.foreground.height = this.canvas.height;
    }
    this.foregroundContext.setTransform(sx, 0, 0, sy, 0, 0);
    this.foregroundContext.imageSmoothingEnabled = false;
    if (this.arenaTheme !== m.config.arenaTheme) this.makeBackground(m.config.arenaTheme);
    const street = usesPerspectiveCourt(m.config.arenaTheme);
    const live = m.config.livelyBackground;
    if (street) {
      if (isZone(m.config.arenaTheme)) drawZoneSky(c, m.config.arenaTheme, live ? m.time : 0);
      else drawStreetSky(c, live ? m.time : 0);
      c.drawImage(this.cityLayer, -10, -5);
    }
    c.drawImage(this.background, 0, 0);
    if (m.config.arenaTheme === 'miami')
      drawStreetLife(c, m.time, this.project(m.ball.x, m.ball.y), m.config.livelyBackground);
    if (isZone(m.config.arenaTheme)) drawZoneLife(c, m.config.arenaTheme, m.time, live, m.score);
    this.drawAtmosphere(m, teams);
    this.drawFloorRipples(dt);
    this.drawBallSmoke(m);
    this.drawBallShadow(m);
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
    if (!usesPerspectiveCourt(m.config.arenaTheme)) {
      for (const x of [-COURT.halfLength, -3, 0, 3, COURT.halfLength]) {
        const p = this.project(x);
        this.rect(p.x - 1, 423, 2, 59, '#fff8df');
      }
      this.rect(479, 422, 2, 60, '#fff8df');
    }
    this.drawChallenge(m);
    const previews = ballVisible ? (m.controls || [m]).filter((state) => state.aimPreview) : [];
    for (const state of previews) this.trajectory(state.aimPreview, m.config, true);
    if (
      ballVisible &&
      !m.tutorialNoBall &&
      !previews.length &&
      m.config.trajectory &&
      m.phase === 'rally'
    )
      this.trajectory(m.ball, m.config, false);
    if (ballVisible && !m.tutorialNoBall && m.config.trajectory && m.phase === 'rally')
      this.text(
        m.aimPreview ? 'ЦВЕТНОЙ ПУНКТИР: УДАР СЕЙЧАС' : 'СВЕТЛЫЙ ПУНКТИР: ТЕКУЩИЙ ПОЛЁТ',
        480,
        122,
        9,
        '#547260',
        'center',
      );
    if (ballVisible && !m.tutorialNoBall && m.prediction && m.phase === 'rally' && m.ball.x < 0) {
      const p = this.project(m.prediction.x);
      c.strokeStyle = '#698c8070';
      c.setLineDash([3, 3]);
      c.strokeRect(p.x - 12, 449, 24, 8);
      c.setLineDash([]);
    }
    const players = m.players.filter((p) => !p.benched);
    for (const p of players.filter((p) => p.x >= 0)) this.drawPlayer(p, teams[p.team], m, dt);
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
    if (m.ball.x >= 0) this.drawBall(m);
    this.drawNet(m);
    for (const p of players.filter((p) => p.x < 0)) this.drawPlayer(p, teams[p.team], m, dt);
    if (m.ball.x < 0) this.drawBall(m);
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
    if (street) c.drawImage(this.frontLayer, -10, -5);
    this.canvas.style.imageRendering = 'pixelated';
    if (!this.learning) this.drawHUD(m, teams);
    const combination = m.combinations?.[0];
    const complete = m.visualCombo && m.time - m.visualCombo.at < 1.8;
    if (complete && !this.learning) {
      this.rect(310, 116, 340, 34, '#fff2c9ee');
      this.text('★ ПРИЁМ · НАВЕС · УДАР ★', 480, 138, 15, '#a3762e', 'center');
    } else if (combination && m.time - combination.at < 4 && !this.learning)
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
    if (!this.learning && m.noticeTime > 0 && m.phase === 'rally') {
      const width = Math.min(510, m.notice.length * 7.2 + 25);
      this.rect(480 - width / 2, 83, width, 25, '#fff8e9e8');
      this.text(m.notice, 480, 100, 12, '#62796a', 'center');
    }
    if (!this.learning && ['point', 'set-end'].includes(m.phase)) {
      this.rect(290, 176, 380, 126, '#fff9eaf2');
      this.rect(300, 186, 360, 3, teams[m.pointWinner].color);
      this.text(m.notice, 480, 216, 24, '#476756', 'center');
      this.text(teams[m.pointWinner].name, 480, 249, 15, teams[m.pointWinner].dark, 'center');
      this.text(m.pointReason, 480, 281, 11, '#a48675', 'center');
    }
    this.ceiling.draw(c, dt);
    pixelPresent(this.canvas, this.pixelGraphics && this.canvas.width === 960, 2);
  }
  drawPlayer(p, team, m, dt) {
    let c = this.ctx;
    const pos = this.project(p.x, p.y),
      floor = this.project(p.x),
      dir = p.diving ? Math.sign(p.diveVelocity) : p.facing || (p.team === 0 ? 1 : -1);
    const humanSlot = m.humanSlot(p);
    const selected = humanSlot !== null;
    const coopColor =
      m.mode === 'coop' && selected ? (humanSlot === 2 ? '#368fff' : '#f04444') : null;
    if (selected) {
      c.save();
      c.fillStyle = coopColor ? `${coopColor}66` : '#fff1a54d';
      c.strokeStyle = coopColor || '#f5dfae';
      c.lineWidth = coopColor ? 3 : 1.5;
      c.beginPath();
      c.ellipse(floor.x, floor.y + 3, 24, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.restore();
    }
    const destination = c;
    this.actorScaleX = this.renderScaleX || 1;
    this.actorScaleY = this.renderScaleY || 1;
    const logicalWidth = Math.ceil(Math.max(180, (this.spriteScale || 2.1) * 70));
    const logicalHeight = Math.ceil(Math.max(200, (this.spriteScale || 2.1) * 80));
    const width = Math.ceil(logicalWidth * this.actorScaleX);
    const height = Math.ceil(logicalHeight * this.actorScaleY);
    if (this.actor.width !== width || this.actor.height !== height) {
      this.actor.width = width;
      this.actor.height = height;
    }
    this.actorOrigin = {
      x: Math.round(pos.x - logicalWidth / 2),
      y: Math.round(pos.y - logicalHeight + 30),
    };
    this.actorContext.setTransform(1, 0, 0, 1, 0, 0);
    this.actorContext.clearRect(0, 0, width, height);
    this.actorContext.scale(this.actorScaleX, this.actorScaleY);
    this.actorContext.translate(-this.actorOrigin.x, -this.actorOrigin.y);
    c = this.ctx = this.actorContext;
    this.renderingActor = true;
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
    const vertical = verticalBodyOffset(p);
    c.drawImage(
      this.bodySprites.get(frame, skin, team, p.id, 'feet', p.appearance),
      -32,
      -54 + vertical.feet,
    );
    c.drawImage(
      this.bodySprites.get(frame, skin, team, p.id, 'torso', p.appearance),
      -32 + motion.torso * dir,
      -54 + motion.drop,
    );
    if (!p.headDetached)
      c.drawImage(
        this.bodySprites.get(frame, skin, team, p.id, 'head', p.appearance),
        -32 + motion.head * dir,
        -54 + motion.drop + vertical.head - vertical.torso,
      );
    c.save();
    c.translate(motion.torso * dir, pose.y + motion.drop);
    const step = frame.state === 'run' ? (pose.r - pose.l) * 0.5 : 0;
    this.drawArms(p, m, dt, step, frame, team);
    c.restore();
    c.restore();
    this.renderingActor = false;
    this.ctx = c = destination;
    this.drawSpriteShadow(p, pos, floor);
    c.drawImage(
      this.actor,
      this.actorOrigin.x,
      this.actorOrigin.y,
      width / this.actorScaleX,
      height / this.actorScaleY,
    );
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
    if (selected) {
      const y = floor.y + 14;
      c.fillStyle = coopColor || (humanSlot === 2 ? '#457fbd' : p.team ? '#497f7c' : '#bc645d');
      c.beginPath();
      c.moveTo(floor.x - 6, y + 8);
      c.lineTo(floor.x + 6, y + 8);
      c.lineTo(floor.x, y);
      c.fill();
      if (m.mode === 'coop' && p.team === 0)
        this.text(humanSlot === 2 ? 'P2' : 'P1', floor.x, y + 26, 10, c.fillStyle, 'center');
      const action = m.actionForPlayer(p);
      if (action?.playerId === p.id) {
        this.rect(pos.x - 22, pos.y - 91, 44, 4, '#314e64');
        this.rect(pos.x - 21, pos.y - 90, 42 * action.power, 2, shotChargeColor(action.power));
      }
    }
    const run = m.teamRuns?.[p.team];
    if (run?.feint && run.serial === m.shotSerial && !run.cancelled && m.time < run.at + 0.3) {
      if (run.decoyId === p.id && !run.decoyCancelled && p.jumpProfile)
        this.text('ОБМАНКА', pos.x, pos.y - 105, 9, '#ffe896', 'center');
      else if (run.playerId === p.id)
        this.text('АТАКА', pos.x, pos.y - 105, 9, '#83e6c3', 'center');
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
  drawArms(p, m, dt, step, bodyFrame = null, team = null) {
    const c = this.ctx,
      spec = ARM_STYLES.whip;
    let config = playerArmConfig(p, m.config);
    const action = m.actionForPlayer?.(p) || m.actionFor?.(p.team) || m.charge || m.pending;
    let charge = m.phase !== 'serve' && action?.playerId === p.id ? action : null;
    const zonePreparation = charge && m.isHuman(p.team) && isZoneReceive(m, charge, p);
    if (zonePreparation) {
      charge = {
        ...charge,
        age:
          charge.receiveReadyAt == null
            ? charge.age
            : Math.max(0, m.config.armWindup - Math.max(0, charge.receiveReadyAt - m.time)),
      };
    }
    const serving =
      m.phase === 'serve-motion' && p.id === (m.serverPlayer?.()?.id ?? m.selected?.[m.server]);
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
      rig = {
        player: p,
        wrists: null,
        elbows: null,
        contours: [],
        contactKey: null,
        contactPoint: null,
      };
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
    const waitingToServe =
      m.phase === 'serve' && p.id === (m.serverPlayer?.()?.id ?? m.selected?.[m.server]);
    const servePose = waitingToServe || serving || !!support || !!swing?.serve;
    if (servePose) {
      const type = serving ? m.serveAction?.kind : swing?.serve ? swing.kind : 'low';
      const progress =
        serving && ['loft', 'drive'].includes(type)
          ? clamp(m.phaseTime / 0.4, 0, 1)
          : swing?.serve && ['loft', 'drive'].includes(type)
            ? 1
            : 0;
      const blend = progress * progress * (3 - 2 * progress);
      config = {
        ...config,
        armBend: 1 + (config.armBend - 1) * blend,
        elbowHeight: config.elbowHeight * blend,
        armPowerMotion: 1 + (config.armPowerMotion - 1) * blend,
      };
    }
    rig.serveBend = servePose ? 1 : Math.max(0, (rig.serveBend || 0) - dt / 0.18);
    const supportScreen = support ? this.project(m.ball.x, m.ball.y) : null;
    if (support) {
      supportScreen.y +=
        10 * (m.config.ballSize || 1.2) * 1.18 +
        spec.hand * config.armScale * (this.spriteScale || 2.1) * 0.65;
      support.point = this.logicalTransform(c).inverse().transformPoint(supportScreen);
    }
    const pose = expressivePose({
      receiveHoldPoint: charge?.receiveHold
        ? this.logicalTransform(c).inverse().transformPoint(this.project(m.ball.x, m.ball.y))
        : null,
      serveSupport: support,
      diveTarget: p.diving
        ? this.logicalTransform(c)
            .inverse()
            .transformPoint(
              this.project(diveHands(p, m.ball, config).x, diveHands(p, m.ball, config).y),
            )
        : null,
      receiveAim: localReceiveAim(p, charge || swing, m.ball, bodyFrame, config),
      emotion: activeEmotion(p),
      shoulderLift: bodyFrame?.pose.shoulders || 0,
      localVelocity: swing?.hit ? rig.localVelocity : null,
      localIncomingVelocity:
        swing?.hit && swing.incomingVelocity
          ? (() => {
              const velocity = swing.incomingVelocity;
              const origin = this.logicalTransform(c)
                .inverse()
                .transformPoint(this.project(swing.x, swing.y));
              const end = this.logicalTransform(c)
                .inverse()
                .transformPoint(this.project(swing.x + velocity.x, swing.y + velocity.y));
              return { x: end.x - origin.x, y: end.y - origin.y };
            })()
          : null,
      actionDirection:
        Math.sign(
          (serving ? m.serveAction?.aim?.axis : charge?.aim?.vector?.x || charge?.aim?.axis) ||
            (p.team === 0 ? 1 : -1) * (!serving && kind === 'back' ? -1 : 1),
        ) / (p.facing || 1),
      spec,
      config,
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
    if (charge && !servePose && !p.diving && !charge.receiveHold) {
      const anchors = preparedHands(p, m, charge);
      const inverse = this.logicalTransform(c).inverse();
      for (const [j, i] of pose.activeHands.entries())
        if (anchors[j]) {
          const point = inverse.transformPoint(this.project(anchors[j].x, anchors[j].y));
          pose.wrists[i] = { x: point.x, y: point.y };
        }
    }

    if (!rig.wrists) {
      rig.wrists = pose.wrists.map((w) => ({ ...w, vx: 0, vy: 0 }));
      rig.elbows = pose.elbows.map((w) => ({ ...w, vx: 0, vy: 0 }));
    }
    rig.stage = pose.stage;
    // The overhead return already has an eased, authored path. A second spring
    // delayed the wrists and elbows until the hands dropped across the face.
    const overheadReturn =
      kind === 'loft' && swing?.hit && !swing.serve && !charge && !p.diving && pose.cup > 0;
    const tint =
      { back: '#e8c35c', low: '#78b6c9', loft: '#8aad77', drive: '#e89a70', block: '#b7a0ce' }[
        kind
      ] || '#fff1da';
    // Draw the right arm first so the left arm stays in front at crossings.
    for (const i of [1, 0]) {
      const wrist = rig.wrists[i],
        target = pose.wrists[i];
      if (
        (support?.attached && i === support.hand) ||
        !!charge?.receiveHold ||
        overheadReturn ||
        (newContact && pose.snap) ||
        (swing?.hit && rig.localVelocity && swing.age < 0.09)
      )
        Object.assign(wrist, target, { vx: 0, vy: 0 });
      else
        springPoint(
          wrist,
          target,
          dt,
          spec.spring * config.armSpring * (kind === 'loft' ? 1.65 : 1 + pose.power * 0.3),
          spec.damping * Math.sqrt(config.armSpring) * (kind === 'loft' ? 1.25 : 1),
        );
      const shoulder = pose.shoulders[i],
        elbow = rig.elbows[i];
      if (overheadReturn) Object.assign(elbow, pose.elbows[i], { vx: 0, vy: 0 });
      else
        springPoint(
          elbow,
          pose.elbows[i],
          dt,
          spec.spring * config.armSpring * (kind === 'loft' ? 2 : 1.35),
          spec.damping * Math.sqrt(config.armSpring) * 1.2,
        );
      const transform = this.logicalTransform(c);
      const over = kind === 'drive' || kind === 'block';
      if (Math.abs(this.project(p.x).x - this.project(0).x) > 1) {
        constrainRenderedJoint(wrist, transform, this.project.bind(this), p.team, m.ball, over);
        constrainRenderedJoint(elbow, transform, this.project.bind(this), p.team, m.ball, over);
      }
      const width = spec.width * config.armScale * config.armRoundness;
      const contour = armContour(
        shoulder,
        elbow,
        wrist,
        width,
        rig.serveBend,
        rig.contours[i],
        config.elbowHeight,
      );
      rig.contours[i] = contour;
      drawOpenArm(
        c,
        contour,
        width,
        pose.snap ? '#fff7dc' : p.appearance?.tone || '#f4cfac',
        p.appearance ? skinPalette(p.appearance.tone).outline : '#665d62',
        p.appearance?.body === 'sleeveless' ? null : team?.color,
        p.appearance?.body === 'longsleeve' ? 0.72 : 0.32,
      );
      const hand = spec.hand * config.armScale;
      c.save();
      c.translate(wrist.x, wrist.y);
      // Overhead fingers face inward/up, forming a small cup instead of two parallel poles.
      const neutralAngle = blendAngle(
        contour.handAngle,
        0,
        support?.hand === i ? support.weight : 0,
      );
      const palmAngle = blendAngle(neutralAngle, i ? -0.55 : 0.55, pose.cup);
      c.rotate(palmAngle);
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
      if (m.config.ballFire && p.handEmbers?.until > m.time) {
        const remaining = clamp((p.handEmbers.until - m.time) / 1.8, 0, 1);
        const size = 2.6 * remaining * remaining * (3 - 2 * remaining);
        // Anchor at the rotated palm centre, rather than above the wrist joint.
        drawFlame(
          c,
          wrist.x + Math.sin(palmAngle) * hand * 0.4,
          wrist.y - Math.cos(palmAngle) * hand * 0.4,
          Math.PI / 2,
          size,
          m.time * 0.4 + i * 0.31,
        );
      }
    }
  }
  drawNet(m) {
    const c = this.ctx,
      x = 480,
      top = Math.round(this.project(0, COURT.netHeight).y / 2) * 2;
    this.netRipple = netVisual(this.netRipple, m?.ball.netImpact, m.time);
    const wave = this.netRipple.wave;
    if (usesPerspectiveCourt(m.config.arenaTheme)) {
      const { line, rect } = pixelTools(c);
      const far = projectStreetNet(0, COURT.netHeight);
      const near = projectStreetNet(1, COURT.netHeight);
      const farX = far.x,
        nearX = near.x,
        farTop = far.y,
        nearTop = near.y;
      const farBottom = projectStreetNet(0, NET_BOTTOM).y;
      const nearBottom = projectStreetNet(1, NET_BOTTOM).y;
      const farFloor = projectStreetNet(0, 0).y;
      const nearFloor = projectStreetNet(1, 0).y;
      const meshHeight = nearBottom - nearTop;
      const meshPoint = ({ u, v }) => ({
        x: farX + (nearX - farX) * u + Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * wave,
        y: farTop + (nearTop - farTop) * u + ((farBottom - farTop) * (1 - u) + meshHeight * u) * v,
      });
      for (const [a, b] of diamondMesh(2, 5)) {
        const from = meshPoint(a),
          to = meshPoint(b);
        line(from.x, from.y, to.x, to.y, '#667e718f', 1);
      }
      line(farX, farTop, nearX, nearTop, '#fff1d0', 3);
      line(farX, farBottom, nearX, nearBottom, '#a6b4ac', 1);
      line(farX, farTop, farX, farBottom, '#e7dfc3', 2);
      line(nearX, nearTop, nearX, nearBottom, '#e7dfc3', 2);
      rect(farX - 3, farTop - 14, 4, 17, '#e5ba92');
      rect(farX - 3, farTop - 14, 4, 5, '#c57c75');
      rect(farX - 4, farTop, 6, farFloor - farTop, '#4f8d94');
      rect(nearX - 5, nearTop - 3, 9, nearFloor - nearTop + 3, '#3f7e8a');
      rect(nearX - 4, nearTop, 3, nearFloor - nearTop, '#71b2b0');
      rect(nearX - 4, nearTop + 8, 8, 3, '#e1c3a0');
      rect(nearX - 6, nearFloor - 2, 12, 4, '#497681');
      return;
    }
    this.rect(x - 4, top, 2, 116, '#6b8a8099');
    this.rect(x + 4, top, 2, 116, '#6b8a8099');
    for (const [px, py, w, h] of netMesh(wave, top, this.project(0, NET_BOTTOM).y))
      this.rect(px, py, w, h, '#87a69980');
    this.rect(x - 4, top, 10, 2, '#fffbee');
    this.rect(x + 4, top - 18, 2, 20, '#d3897c');
    this.rect(x - 6, 462, 14, 2, '#d29d82');
  }
  drawBallShadow(m) {
    if (m.tutorialNoBall || ballAboveCeiling(m.ball)) return;
    const c = this.ctx,
      floor = this.project(m.ball.x, 0),
      height = Math.max(0, m.ball.y - COURT.ballRadius),
      size = m.config.ballSize || 1.2,
      spread = Math.min(height, 10);
    c.save();
    // Keep the ground position legible, with the same light direction as the players.
    c.translate(floor.x - spread * 4, floor.y + 2 + spread * 1.5);
    c.fillStyle = '#514f68';
    c.globalAlpha = clamp(0.28 - height * 0.012, 0.14, 0.28) * ballShadowOpacity(m.ball);
    c.beginPath();
    c.ellipse(0, 0, (8 + spread * 0.4) * size, (2.8 + spread * 0.16) * size, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha *= 0.45;
    c.beginPath();
    c.ellipse(0, 0, (5.5 + spread * 0.2) * size, (1.8 + spread * 0.08) * size, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  drawBallSmoke(m) {
    if (m.tutorialNoBall || ballAboveCeiling(m.ball)) return;
    const opacity = m.config.smokeTrailOpacity;
    if (!opacity || !m.smokeTrail?.length) return;
    const c = this.ctx;
    c.save();
    c.fillStyle = '#657c79';
    for (const point of m.smokeTrail) {
      const fade = clamp(point.life / point.duration, 0, 1);
      const at = this.project(point.x, point.y);
      c.globalAlpha = opacity * fade;
      c.beginPath();
      c.ellipse(at.x, at.y, 4.5 + (1 - fade) * 1.5, 3.5 + (1 - fade), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
  drawBall(m) {
    if (m.tutorialNoBall || ballAboveCeiling(m.ball)) return;
    const c = this.ctx,
      p = this.project(m.ball.x, m.ball.y),
      y = p.y;
    if (Math.hypot(m.ball.vx, m.ball.vy) > 5)
      for (let i = 0; i < m.trail.length; i += 4) {
        const t = this.project(m.trail[i].x, m.trail[i].y);
        this.rect(t.x - 3, t.y - 3, 6, 6, '#fff4d480');
      }
    const readyControl = m.controls?.find(
      (state) => state.contactWindow && m.isHuman(state.team) && (state.charge || state.pending),
    );
    const serveReady =
      m.phase === 'serve-motion' &&
      m.isHuman(m.server) &&
      m.controls?.[m.serverSlot()]?.contactWindow;
    const cue = serveCue(m);
    if (cue && ['waiting', 'ready'].includes(cue.stage)) {
      c.save();
      c.lineCap = 'round';
      c.strokeStyle = cue.color;
      c.lineWidth = cue.width;
      c.beginPath();
      c.arc(p.x, y, cue.radius, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    const readyKind =
      m.mode === 'demo'
        ? null
        : serveReady
          ? m.serveAction?.kind
          : m.phase === 'rally'
            ? (readyControl?.charge || readyControl?.pending)?.kind
            : null;
    const burning = m.config.ballFire && Math.hypot(m.ball.vx, m.ball.vy) >= m.config.fireSpeed;
    if (burning) {
      drawFlame(
        c,
        p.x,
        y,
        Math.atan2(-m.ball.vy, m.ball.vx),
        11 * (m.config.ballSize || 1.2),
        m.time,
      );
    }
    c.save();
    c.translate(Math.round(p.x), Math.round(y));
    c.scale(m.config.ballSize || 1.2, m.config.ballSize || 1.2);
    const squashEffect = this.ballSquash;
    const age = squashEffect ? squashEffect.duration - squashEffect.life : 0;
    const compression = clamp((age - 0.04) / 0.11, 0, 1);
    const recovery = clamp((age - 0.15) / 0.13, 0, 1);
    const envelope = !squashEffect
      ? 0
      : age <= 0.15
        ? 1 - compression * compression * (3 - 2 * compression)
        : -0.16 * Math.sin(Math.PI * recovery) ** 2;
    const squash = (squashEffect?.amount || 0) * envelope;
    const flightBlend = squashEffect ? recovery * recovery * (3 - 2 * recovery) : 1;
    const speed = Math.hypot(m.ball.vx, m.ball.vy),
      stretch = Math.abs(m.ball.x) < 1 ? 1 : 1 + clamp((speed - 5) / 30, 0, 0.3) * flightBlend;
    const direction = Math.atan2(-m.ball.vy, m.ball.vx);
    if (squashEffect && Math.abs(squash) > 1e-6) {
      // Keep the floor-facing edge in place as the ball flattens and springs back.
      if (squashEffect.floor) c.translate(0, 11.8 * squash);
      c.rotate(squashEffect.angle);
      c.scale(1 - squash, 1 / (1 - squash));
      c.rotate(-squashEffect.angle);
    }
    c.rotate(direction);
    c.scale(stretch * 1.18, 1.18 / stretch);
    c.rotate(-direction);
    c.rotate(m.ball.angle);
    drawBallDesign(c, m.config.ballSkin, this.pixelGraphics);
    if (readyKind) {
      c.save();
      c.globalAlpha *= 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(m.time * Math.PI * 4));
      c.fillStyle =
        { low: '#a4edff', back: '#c6e5ff', loft: '#c7ffb5', drive: '#ffe292' }[readyKind] ||
        '#e0c6ff';
      c.beginPath();
      c.arc(0, 0, 8.2, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    c.restore();
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
    this.rect(0, 0, 960, 58, '#fff5e4');
    this.rect(0, 57, 960, 1, '#d8c5bb');
    this.rect(30, 10, 9, 38, teams[0].color);
    this.text(teams[0].short, 49, 30, 20, teams[0].dark);
    this.text(m.mode === 'demo' ? 'CPU' : 'ВАША КОМАНДА', 50, 44, 9, '#ae827b');
    this.rect(920, 10, 9, 38, teams[1].dark);
    this.text(teams[1].short, 908, 30, 20, teams[1].dark, 'right');
    this.text(
      m.mode === 'versus' ? 'ИГРОК 2' : m.challenge ? 'ИСПЫТАНИЕ' : 'КОМПЬЮТЕР',
      908,
      44,
      9,
      '#587c80',
      'right',
    );
    const score = m.challenge
      ? String(m.challenge.score)
      : `${String(m.score[0]).padStart(2, '0')}:${String(m.score[1]).padStart(2, '0')}`;
    this.drawScore(score, 480, 10);
    this.text(
      m.challenge
        ? `МЯЧ ${m.challenge.attempt} / ${m.challenge.total}`
        : `СЕТ ${m.sets[0] + m.sets[1] + 1}  /  ${m.sets.join(' — ')}`,
      480,
      50,
      9,
      '#596979',
      'center',
    );
    const phase = m.mode === 'test' ? 'ТЕСТ ∞' : m.teamPhases[0] === 'attack' ? 'АТАКА' : 'ЗАЩИТА';
    this.text(m.phase === 'serve' ? 'ПОДАЧА' : phase, 274, 27, 11, '#5d6280', 'center');
    for (let i = 0; i < 3; i++) {
      const x = 251 + i * 19;
      this.rect(x, 35, 11, 8, '#77748c');
      this.rect(x + 2, 43, 7, 3, '#77748c');
      this.rect(x + 1, 36, 9, 6, i < m.touches[0] ? '#817aa4' : '#fff5e4');
      this.rect(x + 3, 42, 5, 2, i < m.touches[0] ? '#817aa4' : '#fff5e4');
    }
  }
  drawScore(value, center, y) {
    const glyphs = {
      0: ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
      1: ['00110', '01110', '00110', '00110', '00110', '00110', '01111'],
      2: ['01110', '11011', '00011', '00110', '01100', '11000', '11111'],
      3: ['11110', '00011', '00011', '01110', '00011', '00011', '11110'],
      4: ['11011', '11011', '11011', '11111', '00011', '00011', '00011'],
      5: ['11111', '11000', '11000', '11110', '00011', '00011', '11110'],
      6: ['01110', '11000', '11000', '11110', '11011', '11011', '01110'],
      7: ['11111', '00011', '00011', '00110', '01100', '01100', '01100'],
      8: ['01110', '11011', '11011', '01110', '11011', '11011', '01110'],
      9: ['01110', '11011', '11011', '01111', '00011', '00011', '01110'],
      ':': ['000', '010', '010', '000', '010', '010', '000'],
    };
    const cell = 3.4;
    const width = [...value].reduce((sum, digit) => sum + (digit === ':' ? 5 : 6) * cell, -cell);
    let x = center - width / 2;
    for (const digit of value) {
      const glyph = glyphs[digit] || glyphs[0];
      glyph.forEach((row, iy) =>
        [...row].forEach((pixel, ix) => {
          if (pixel === '1') {
            const left = Math.round(x + ix * cell),
              top = Math.round(y + iy * cell);
            this.rect(
              left,
              top,
              Math.round(x + (ix + 1) * cell) - left,
              Math.round(y + (iy + 1) * cell) - top,
              '#285563',
            );
          }
        }),
      );
      x += (digit === ':' ? 5 : 6) * cell;
    }
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
    if (e.type === 'serve-ready') {
      this.impacts = [];
      this.ballSquash = null;
      this.contactAccents = [];
      this.floorRipples = [];
    }
    if (e.type === 'point' && Number.isFinite(e.groundX)) this.winningLanding(e.groundX, e.out);
    if (e.type === 'floor-touch') {
      this.squashBall(e.speed, Math.PI / 2, true);
      const at = this.project(e.x ?? m.ball.x, 0);
      this.floorRipples.push({
        ...at,
        life: 0.55,
        strength: clamp((e.speed || 4) / 8, 0.6, 1.2),
        color: e.out ? '#ff625c' : '#ffffff',
      });
      if (e.winning) this.winningLanding(e.x ?? m.ball.x, e.out);
    }
    if (e.type === 'floor') this.squashBall(e.speed, Math.PI / 2, true);
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
    if (e.type === 'hit' || e.type === 'block') {
      const incoming = e.incomingVelocity;
      const incomingSpeed =
        e.incomingSpeed ??
        (incoming && Math.hypot(incoming.x || 0, incoming.y || 0, incoming.z || 0));
      const angle =
        incoming && (incoming.x || incoming.y)
          ? Math.atan2(-incoming.y, incoming.x)
          : Math.atan2(-m.ball.vy, m.ball.vx);
      this.squashBall(incomingSpeed, angle);
      const p = this.project(e.x ?? m.ball.x, e.y ?? m.ball.y),
        color =
          { low: '#a4edff', back: '#c6e5ff', loft: '#c7ffb5', drive: '#ffe292', block: '#e0c6ff' }[
            e.kind
          ] || '#e0c6ff';
      this.impacts.push({
        ...p,
        life: 0.16,
        color,
        radius: 10 * (m.config.ballSize || 1.2) * 1.18 + 2,
      });
      const accent = contactAccent(e, m.config);
      if (accent) {
        this.contactAccents.push({ ...p, ...accent, life: accent.duration });
        if (this.contactAccents.length > 24) this.contactAccents.shift();
      }
    }
  }
  squashBall(speed, angle, floor = false) {
    const amount = 0.48 * (1 - Math.exp(-Math.max(0, (speed || 0) - 1) / 13));
    // Every new contact owns the deformation direction, even after a stronger impact.
    this.ballSquash = amount ? { amount, angle, floor, life: 0.28, duration: 0.28 } : null;
  }
  winningLanding(x, out) {
    const at = this.project(x, 0);
    const ripple = this.floorRipples.findLast((p) => Math.abs(p.x - at.x) < 1 && p.life > 0.4);
    if (ripple?.winning) return;
    if (ripple) Object.assign(ripple, { winning: true, strength: 1.4 });
    else
      this.floorRipples.push({
        ...at,
        winning: true,
        life: 0.55,
        strength: 1.4,
        color: out ? '#ff625c' : '#ffffff',
      });
    // Small anchored dust burst: six motes, no persistent emitter.
    for (let i = 0; i < 6; i++) {
      const direction = i % 2 ? 1 : -1;
      this.particles.push({
        ...at,
        vx: direction * (18 + i * 7),
        vy: -9 - (i % 3) * 8,
        life: 0.24 + (i % 3) * 0.05,
        duration: 0.34,
        dust: true,
        color: out ? '#dd9b83' : '#ead6ac',
      });
    }
  }
  drawFloorRipples(dt) {
    this.floorRipples = this.floorRipples.filter((p) => p.life > 0);
    const c = this.ctx;
    for (const p of this.floorRipples) {
      const t = clamp(1 - p.life / 0.55, 0, 1);
      const radius = 6 + (1 - (1 - t) ** 2) * 38 * p.strength;
      c.save();
      c.globalAlpha = (1 - t) * 0.9;
      c.lineWidth = 3;
      c.strokeStyle = p.color;
      c.beginPath();
      c.ellipse(p.x, p.y, radius, radius * 0.28, 0, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha *= 0.6;
      c.strokeStyle = p.color;
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(p.x, p.y, radius * 0.7, radius * 0.196, 0, 0, Math.PI * 2);
      c.stroke();
      if (p.winning) {
        c.globalAlpha = (1 - t) * 0.45;
        c.fillStyle = p.color;
        c.beginPath();
        c.ellipse(p.x, p.y, radius * 0.55, radius * 0.12, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      p.life -= dt;
    }
  }
  drawParticles(dt) {
    if (this.ballSquash) {
      this.ballSquash.life -= dt;
      if (this.ballSquash.life <= 0) this.ballSquash = null;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.dust) {
        const c = this.ctx;
        c.save();
        c.globalAlpha = clamp(p.life / p.duration, 0, 1) * 0.7;
        c.fillStyle = p.color;
        c.beginPath();
        c.ellipse(p.x, p.y, 3 + (1 - p.life / p.duration) * 3, 2.2, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      } else this.rect(p.x, p.y, 3, 3, p.color);
    }
    this.contactAccents = this.contactAccents.filter((p) => p.life > 0);
    for (const effect of this.contactAccents) {
      drawContactAccent(this.ctx, effect);
      effect.life -= dt;
    }
    this.impacts = this.impacts.filter((p) => p.life > 0);
    for (const p of this.impacts) {
      p.life -= dt;
      const c = this.ctx;
      c.save();
      const progress = clamp(1 - p.life / 0.16, 0, 1);
      c.globalAlpha = 0.85 * (1 - progress * 0.75);
      c.strokeStyle = p.color;
      c.lineWidth = 1.25;
      const radius = p.radius + progress * 7;
      c.beginPath();
      c.arc(p.x, p.y, radius, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }
}
