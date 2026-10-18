import { drawBallDesign, pixelPresent, compositePixels } from './display.js';
import { EMOTIONS } from './emotions.js';
import { Match } from './engine.js';
import { Renderer } from './renderer.js';
import { TEAMS } from './config.js';
import { jumpProfile, sampleJump, jumpDuration } from './motion.js';
import { playerFrame } from './sprites.js';
import { preparedHands } from './held-contact.js';

// Uses the match renderer, including its springs and contact-to-recovery transition.
export function createArmLab(dialog, getConfig) {
  const poseSelect = dialog.querySelector('#arm-pose');
  for (const [value, label] of Object.entries({
    ...EMOTIONS,
    back: 'Сейв одной рукой',
    squat: 'Приседание',
    'serve-low-left': 'Подача снизу · левая',
    'serve-low-right': 'Подача снизу · правая',
    'serve-back-left': 'Подсечка снизу · левая',
    'serve-back-right': 'Подсечка снизу · правая',
    'serve-drive-left': 'Подача в прыжке · левая',
    'serve-drive-right': 'Подача в прыжке · правая',
    'serve-loft-left': 'Подача сверху · левая',
    'serve-loft-right': 'Подача сверху · правая',
  })) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    poseSelect.append(option);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 280;
  canvas.setAttribute('aria-label', 'Хлёсткие — просмотр движения');
  const card = document.createElement('section');
  card.className = 'arm-card';
  const status = document.createElement('p');
  status.className = 'arm-stage';
  card.append(canvas, status);
  dialog.querySelector('#arm-cards').append(card);
  const renderer = new Renderer(canvas);
  renderer.spriteScale = 3;
  renderer.project = (x, y = 0) => ({ x: 200 + (x + 1) * 60, y: 254 - y * 60 });
  const m = new Match(getConfig());
  m.phase = 'rally';
  m.players[0].x = -1;
  m.selected[0] = 0;
  m.lastTouch = 1;
  m.lastPlayer = 3;
  const powerInput = dialog.querySelector('#arm-preview-power'),
    frame = dialog.querySelector('#arm-frame'),
    freeze = dialog.querySelector('#arm-freeze');
  let clock = 0;
  const restart = () => {
    clock = 0;
    freeze.checked = false;
    renderer.armRigs.clear();
  };
  dialog.querySelector('#arm-pose').onchange = restart;
  dialog.querySelector('#arm-replay').onclick = restart;
  powerInput.oninput = () => {
    dialog.querySelector('#arm-preview-value').textContent = powerInput.value + '%';
    renderer.armRigs.clear();
  };
  frame.oninput = () => {
    clock = Number(frame.value);
    freeze.checked = true;
    renderer.armRigs.clear();
  };
  return (dt) => {
    if (!dialog.open) return;
    dt = freeze.checked ? 0 : dt * (dialog.querySelector('#arm-slow').checked ? 0.35 : 1);
    clock += dt;
    const kind = dialog.querySelector('#arm-pose').value,
      phase = freeze.checked ? clock % 2.200001 : clock % 2.2,
      cycle = Math.floor(clock / 2.2),
      power = Number(powerInput.value) / 100;
    frame.value = phase;
    dialog.querySelector('#arm-frame-value').textContent = phase.toFixed(2) + ' с';
    m.config = { ...getConfig() };
    m.time = clock;
    const p = m.players[0];
    Object.assign(p, {
      x: -1,
      y: 0,
      vy: 0,
      vx: 0,
      facing: 1,
      diving: false,
      diveArmed: false,
      diveAge: 0,
      diveVelocity: 0,
      recovery: 0,
      block: 0,
      blockUsed: false,
      contact: null,
      armSwing: null,
      pose: 'idle',
      animation: 0,
      jumpProfile: null,
      jumpTime: 0,
      crouchAmount: 0,
    });
    m.charge = null;
    m.pending = null;
    m.phase = 'rally';
    m.serveAction = null;
    p.emotion = null;
    let rescueBall = null;
    if (EMOTIONS[kind]) {
      p.emotion = { kind, age: phase, duration: 2.2 };
    } else if (kind.startsWith('serve-')) {
      const type = kind.split('-')[1],
        hand = kind.endsWith('left') ? 0 : 1;
      if (type === 'drive') {
        const profile = jumpProfile(m.config);
        const time = phase - 0.9 + profile.windup + profile.rise;
        if (time >= 0 && time < jumpDuration(profile)) {
          p.jumpProfile = profile;
          p.jumpTime = time;
          Object.assign(p, sampleJump(profile, time));
        }
      }
      const vx = 5 + power * 9,
        vy = vx * (type === 'low' ? 0.8 : type === 'back' ? 0.3 : type === 'drive' ? 0.15 : 0.5),
        hitY =
          type === 'low'
            ? 0.85
            : type === 'back'
              ? 0.95
              : 2.05 + (type === 'drive' ? jumpProfile(m.config).height : 0);
      if (phase < 0.9) {
        m.phase = 'serve-motion';
        m.server = 0;
        m.serveAction = { kind: type, hand, power, aim: { axis: 1 } };
        m.phaseTime = phase;
        rescueBall = {
          x: -0.5,
          y:
            (type === 'back' ? 0.85 : 1.3) +
            ((hitY - (type === 'back' ? 0.85 : 1.3)) * phase) / 0.9 +
            Math.sin((phase / 0.9) * Math.PI) * (type === 'back' ? 0.5 : 0.7),
        };
      } else {
        const age = phase - 0.9;
        p.armSwing = {
          kind: type,
          serve: true,
          hand,
          power,
          hit: true,
          age,
          at: cycle * 2.2 + 0.9,
          x: -0.5,
          y: hitY,
          vx,
          vy,
        };
        rescueBall = { x: -0.5 + vx * age, y: hitY + vy * age - 4.9 * age * age };
      }
    } else if (kind === 'jump' || kind === 'block') {
      const profile = jumpProfile(m.config),
        t = phase - 0.2;
      if (t >= 0 && t < jumpDuration(profile)) {
        p.jumpProfile = profile;
        p.jumpTime = t;
        Object.assign(p, sampleJump(profile, t));
        p.pose = t < profile.windup ? 'crouch' : kind === 'block' ? 'block' : 'jump';
        if (kind === 'block') p.block = jumpDuration(profile) - t;
      }
    } else if (kind === 'run') {
      p.vx = 3;
      p.runTime = clock;
      p.pose = 'run';
    } else if (kind === 'squat') {
      p.crouchAmount = Math.max(0, Math.min(1, phase / 0.3, (1.7 - phase) / 0.3));
    } else if (kind === 'getup') {
      p.recovery = Math.max(0, 1 - phase);
      p.recoveryTotal = 1;
      p.pose = p.recovery > 0.32 ? 'belly' : 'getup';
    } else if (kind.startsWith('dive-')) {
      const direction = kind === 'dive-forward' ? 1 : -1,
        t = Math.max(0, phase - 0.2),
        duration = (2 * m.config.diveLift) / m.config.gravity;
      p.facing = direction;
      p.x = -1 + direction * (-1 + Math.min(t, duration) * m.config.diveSpeed * 0.65);
      if (phase >= 0.2 && t < duration) {
        p.diving = true;
        p.diveAge = t;
        p.diveVelocity = direction * m.config.diveSpeed;
        p.vx = p.diveVelocity;
        p.y = m.config.diveLift * t - 0.5 * m.config.gravity * t * t;
        p.pose = 'dive';
        p.diveArmed = t < 0.18;
      } else if (t >= duration && t < duration + m.config.diveRecovery) {
        p.recovery = duration + m.config.diveRecovery - t;
        p.recoveryTotal = m.config.diveRecovery;
        p.pose = p.recovery > 0.32 ? 'belly' : 'getup';
      }
      const hitX = -1 + direction * (-1 + 0.18 * m.config.diveSpeed * 0.65 + 1.8);
      if (t >= 0.18 && t < 0.93) {
        p.armSwing = {
          kind: 'low',
          power: m.config.divePower,
          x: hitX,
          y: 0.65,
          hit: true,
          age: t - 0.18,
          at: cycle * 2.2 + 0.38,
        };
      }
      rescueBall = {
        x: t < 0.18 ? hitX : hitX + (t - 0.18) * 3,
        y: t < 0.18 ? 0.65 : 0.65 + (t - 0.18) * 4,
      };
    } else if (['low', 'back', 'loft', 'drive'].includes(kind)) {
      if (phase > 0.12 && phase < 0.65) {
        m.charge = {
          kind,
          power: power * Math.min(1, (phase - 0.12) / 0.35),
          age: phase - 0.12,
          playerId: 0,
        };
        p.pose = 'ready-' + { low: 'bump', back: 'backset', loft: 'set', drive: 'spike' }[kind];
      }
      if (phase >= 0.65 && phase < 0.71) {
        m.pending = { kind, power, playerId: 0 };
        p.armSwing = { kind, power, age: phase - 0.65, hit: false };
      }
      if (phase >= 0.71 && phase < 0.95)
        p.contact = {
          kind,
          power,
          x: -0.55,
          y: kind === 'low' ? 0.8 : 2.05,
          life: 0.95 - phase,
          at: cycle * 2.2 + 0.71,
        };
      if (phase >= 0.71 && phase < 1.46)
        p.armSwing = {
          kind,
          power,
          x: -0.55,
          y: kind === 'low' ? 0.8 : 2.05,
          age: phase - 0.71,
          at: cycle * 2.2 + 0.71,
          hit: true,
          vx: (kind === 'back' ? -1 : 1) * (3 + power * 4),
          vy: kind === 'drive' ? -3 : 4,
        };
    }
    m.ball = {
      x:
        phase < 0.71
          ? -0.55 + Math.max(0, (0.71 - phase) * 4)
          : -0.55 + (phase - 0.71) * (3 + power * 4),
      y: kind === 'low' ? 0.8 : 2.05,
      z: 4.5,
      vx: 0,
      vy: 0,
      spin: 0,
    };
    if (kind === 'back') {
      const hand = preparedHands(
        p,
        { ...m, ball: { x: p.x - 1, y: 1, vx: 0, vy: 0 } },
        { kind, power, age: 0.3, playerId: p.id },
      )[0];
      if (p.contact) Object.assign(p.contact, hand);
      if (p.armSwing?.hit) Object.assign(p.armSwing, hand, { hand: 0 });
      m.ball.x = hand.x - Math.abs(phase - 0.71) * (3 + power * 4);
      m.ball.y = hand.y + (phase < 0.71 ? (0.71 - phase) * 3 : (phase - 0.71) * 4);
    }
    if (rescueBall) Object.assign(m.ball, rescueBall);
    renderer.pixelGraphics = getConfig().pixelGraphics;
    const c = renderer.ctx;
    c.fillStyle = '#edf1df';
    c.fillRect(0, 0, 400, 280);
    c.fillStyle = '#d6c4a1';
    c.fillRect(45, 255, 310, 3);
    renderer.foregroundContext.clearRect(0, 0, 960, 540);
    renderer.ctx = renderer.foregroundContext;
    renderer.drawPlayer(p, TEAMS[0], m, dt);
    renderer.ctx = c;
    compositePixels(c, renderer.foreground, getConfig().pixelGraphics);
    if (
      (['low', 'back', 'loft', 'drive'].includes(kind) || rescueBall) &&
      phase > 0.3 &&
      phase < 1.05
    ) {
      const b = renderer.project(m.ball.x, m.ball.y);
      c.save();
      c.translate(b.x, b.y);
      c.scale(0.7 * getConfig().ballSize, 0.7 * getConfig().ballSize);
      c.rotate(m.ball.angle || 0);
      drawBallDesign(c, getConfig().ballSkin, getConfig().pixelGraphics);
      c.restore();
    }
    pixelPresent(renderer.canvas, getConfig().pixelGraphics);
    const body = playerFrame(p, m);
    status.textContent = `${body.label} · кадр ${body.index + 1}/${body.total} · ${renderer.armRigs.get(p.id)?.stage || 'Покой'}`;
  };
}
