import { activeEmotion } from './emotions.js';
import { skinPalette } from './appearance.js';
// Editable, hand-authored pixel frames. Frames use a 128×128 raster with
// half-unit detailing, presented in the original 64×64 rig coordinate system;
// the existing spring-driven arms are drawn above them without changing their rig.
export const SKINS = {
  club: {
    name: 'Клубный',
    description: 'Короткая стрижка, повязка и классическая форма.',
    hair: '#725953',
    accent: '#fff3d4',
    detail: 'band',
    ears: false,
  },
  street: {
    name: 'Уличный',
    description: 'Тёмные волосы, козырёк и полосы на форме.',
    hair: '#454c62',
    accent: '#e9db9d',
    detail: 'cap',
    ears: false,
  },
  fox: {
    name: 'Внештатный лис',
    description: 'Маска лисы и светлая спортивная форма.',
    hair: '#a97051',
    accent: '#ffd9a6',
    detail: 'fox',
    ears: true,
  },
};
// [body offset y, head offset x, left foot x/y, right foot x/y, eye expression, dive tilt]
const f = (y = 0, h = 0, l = -5, ly = 0, r = 4, ry = 0, eye = 0, tilt = 0) => ({
  y,
  h,
  l,
  ly,
  r,
  ry,
  eye,
  tilt,
});
export const BODY_CLIPS = {
  shrug: {
    label: 'Пожатие плечами',
    fps: 5,
    frames: [0, -2, -4, -4, -2, 0, 0].map((shoulders) => ({ ...f(), shoulders })),
  },
  sad: {
    label: 'Огорчение',
    fps: 5,
    frames: [
      f(),
      f(1),
      f(2, 1, -5, 0, 4, 0, 1),
      f(3, 1, -5, 0, 4, 0, 1),
      f(2, 0, -5, 0, 4, 0, 1),
      f(1),
      f(),
    ],
  },
  shake: {
    label: 'Качает головой',
    fps: 6,
    frames: [0, -2, 2, -2, 2, 0, 0].map((h) => f(1, h, -5, 0, 4, 0, 1)),
  },
  cheer: { label: 'Радость', fps: 7, frames: [f(), f(-2), f(-4), f(-1), f(-3), f(), f(-2), f()] },
  fist: {
    label: 'Победный кулак',
    fps: 6,
    frames: [f(), f(-1, 1), f(-2, 1), f(), f(-1, 1), f(), f()],
  },
  clap: { label: 'Аплодисменты', fps: 6, frames: [f(), f(-1), f(), f(-1), f(), f(-1), f()] },
  idle: {
    label: 'Стойка',
    fps: 6,
    loop: true,
    frames: Array.from({ length: 108 }, (_, i) => {
      // Quiet pauses, a glance, a weight shift and one brief blink per 18 seconds.
      if (i === 47) return f(0, 0, -5, 0, 4, 0, 1);
      if (i >= 18 && i < 29) return f(0, i < 26 ? 1 : 0);
      if (i >= 62 && i < 78) return f(i < 66 || i > 74 ? 0 : -1, -1, -6, 0, 3);
      if (i >= 90 && i < 96) return f(0, 1, -4, 0, 5);
      // One-pixel ribcage breath, with long held frames instead of jitter.
      return i % 30 >= 19 && i % 30 <= 24 ? f(-1) : f();
    }),
  },
  run: {
    label: 'Бег',
    fps: 24,
    loop: true,
    frames: [
      f(0, 1, 6, 0, -5, -5),
      f(1, 1, 4, 0, -4, -6),
      f(1, 2, 1, 0, -2, -7),
      f(0, 2, -2, 0, 1, -6),
      f(-1, 1, -5, -1, 4, -3),
      f(-1, 1, -6, -3, 6, -1),
      f(0, 1, -5, -5, 6, 0),
      f(1, 1, -4, -6, 4, 0),
      f(1, 2, -2, -7, 1, 0),
      f(0, 2, 1, -6, -2, 0),
      f(-1, 1, 4, -3, -5, -1),
      f(-1, 1, 6, -1, -6, -3),
    ].map((pose, i) => ({ ...pose, lean: i % 6 < 3 ? 0.12 : 0.09 })),
  },
  crouch: { label: 'Толчок', fps: 30, frames: [f(1, 1, -6), f(3, 1, -7, 0, 6), f(5, 1, -7, 0, 6)] },
  squat: {
    label: 'Приседание',
    fps: 20,
    frames: [0, 2, 4, 6, 8].map((y) => ({
      ...f(y, 1, -6 - Math.round(y * 0.4), 0, 5 + Math.round(y * 0.4)),
      squat: y / 8,
    })),
  },
  backset: {
    label: 'Сейв одной рукой',
    fps: 16,
    frames: [f(1, 0, -6, 0, 5), f(0, 0, -6, 0, 5), f(-1, 0, -7, 0, 4), f(-1, 0), f()],
  },
  jump: {
    label: 'Взлёт',
    fps: 14,
    frames: [f(-1, 1, -5, -2, 4, -1), f(-2, 1, -6, -4, 5, -2), f(-2, 0, -6, -5, 5, -4)],
  },
  apex: { label: 'Вершина', fps: 12, frames: [f(-2, 0, -6, -5, 5, -4), f(-1, 0, -5, -4, 4, -4)] },
  fall: {
    label: 'Падение',
    fps: 14,
    frames: [f(-1, 0, -5, -4, 4, -3), f(0, 0, -5, -2, 4, -2), f(1, 0, -6, 0, 5, 0)],
  },
  land: {
    label: 'Приземление',
    fps: 25,
    frames: [f(5, 1, -7, 0, 6), f(3, 0, -6, 0, 5), f(1), f()],
  },
  bump: {
    label: 'Приём снизу',
    fps: 14,
    frames: [f(3, 1, -6, 0, 5), f(4, 2, -7, 0, 6), f(2, 1, -6, 0, 5), f()],
  },
  airset: { label: 'Пас в прыжке', fps: 20, frames: [f(-1), f(-2), f(-1), f()] },
  set: {
    label: 'Верхний пас',
    fps: 14,
    frames: [f(2, 0, -6, 0, 5), f(1, 0, -5, 0, 4), f(-2, 0, -5, -1, 4, -1), f()],
  },
  spike: {
    label: 'Удар',
    fps: 16,
    frames: [
      f(1, -2, -6, 0, 5),
      f(-1, -1, -6, -1, 5),
      f(0, 2, -5, 0, 6),
      f(2, 2, -6, 0, 5),
      f(),
    ].map((pose, i) => ({ ...pose, lean: [-0.09, -0.05, 0.15, 0.12, 0][i] })),
  },
  block: {
    label: 'Блок',
    fps: 12,
    frames: [f(0, 0, -5, -1, 4, -1), f(-1, 0, -6, -3, 5, -3), f(0, 0, -6, -2, 5, -2)],
  },
  dive: {
    label: 'Бросок',
    fps: 14,
    frames: [
      f(2, 2, -7, 0, 5, -2, 0, 0.2),
      f(0, 2, -7, -2, 4, -4, 0, 0.55),
      f(0, 1, -6, -3, 4, -5, 0, 1.05),
      f(0, 1, -5, -4, 4, -4, 0, 1.38),
    ],
  },
  belly: {
    label: 'На площадке',
    fps: 10,
    frames: [f(0, 1, -5, -3, 4, -3, 1, 1.49), f(0, 0, -5, -2, 4, -2, 1, 1.49)],
  },
  getup: {
    label: 'Подъём',
    fps: 12,
    frames: [
      f(0, 1, -5, -2, 4, -2, 0, 1.49),
      f(2, 1, -4, -1, 3, -1, 0, 1.05),
      f(5, 1, -3, 0, 3, 0, 0, 0.65),
      f(6, 1, -7, 0, 6, 0, 0, 0.25),
      f(3, 1, -6, 0, 5),
      f(),
    ],
  },
  serve: {
    label: 'Подача',
    fps: 10,
    frames: [f(1, -1, -6, 0, 5), f(0, 0, -5, 0, 4), f(-1, 1, -5, -1, 4), f(1, 2, -5, 0, 5)],
  },
};
export function frameOf(state, time = 0) {
  const clip = BODY_CLIPS[state] || BODY_CLIPS.idle;
  const raw = Math.max(0, Math.floor(time * clip.fps));
  const index = clip.loop ? raw % clip.frames.length : Math.min(raw, clip.frames.length - 1);
  return {
    state: BODY_CLIPS[state] ? state : 'idle',
    index,
    pose: clip.frames[index],
    label: clip.label,
    total: clip.frames.length,
  };
}
export function playerFrame(p, m) {
  if (p.recovery > 0) {
    const duration = Math.min(0.5, (p.recoveryTotal || 0.92) * 0.7);
    return p.recovery > duration
      ? frameOf('belly', (p.recoveryTotal || 0.92) - p.recovery)
      : frameOf('getup', (1 - p.recovery / duration) * 0.5);
  }
  if (p.diving) return frameOf('dive', p.diveAge || 0);
  if (p.jumpProfile) {
    const t = p.jumpTime,
      j = p.jumpProfile;
    if (t < j.windup) return frameOf('crouch', (t / Math.max(0.001, j.windup)) * 0.099);
    if (p.block > 0) return frameOf('block', t - j.windup);
    if (p.contact)
      return frameOf(
        p.contact.kind === 'back'
          ? p.armSwing?.serve
            ? 'serve'
            : 'backset'
          : p.contact.kind === 'drive'
            ? 'spike'
            : p.contact.kind === 'loft'
              ? 'airset'
              : 'bump',
        0.24 - p.contact.life,
      );
    if (t < j.windup + j.rise) return frameOf('jump', ((t - j.windup) / j.rise) * 0.21);
    if (t < j.windup + j.rise + j.hang) return frameOf('apex', t - j.windup - j.rise);
    return frameOf('fall', ((t - j.windup - j.rise - j.hang) / j.fall) * 0.21);
  }
  const emotion = activeEmotion(p);
  if (emotion) return frameOf(emotion.kind, emotion.age);
  if (m.phase === 'serve-motion' && p.id === (m.serverPlayer?.().id ?? m.selected[m.server]))
    return frameOf(
      m.serveAction?.kind === 'drive' && Math.abs(p.vx) > 0.1 ? 'run' : 'serve',
      m.phaseTime,
    );
  if (p.crouchAmount > 0) return frameOf('squat', Math.min(0.2, p.crouchAmount * 0.2));
  if (p.contact)
    return frameOf(
      p.contact.kind === 'back'
        ? p.armSwing?.serve
          ? 'serve'
          : 'backset'
        : p.contact.kind === 'drive'
          ? 'spike'
          : p.contact.kind === 'loft'
            ? 'set'
            : p.contact.kind === 'block'
              ? 'block'
              : 'bump',
      0.24 - p.contact.life,
    );
  const control = m.controls?.[m.mode === 'coop' && p.id === m.coopSelected ? 2 : p.team];
  const action = m.controls
    ? control.charge || (!m.isHuman(p.team) ? m.actionFor(p.team) : null)
    : m.charge;
  const charge = m.phase !== 'serve' && action?.playerId === p.id ? action : null;
  if (charge)
    return frameOf(
      charge.kind === 'back'
        ? 'backset'
        : charge.kind === 'drive'
          ? 'spike'
          : charge.kind === 'loft'
            ? 'set'
            : 'bump',
      Math.min(0.07, charge.age || 0),
    );
  const pending = m.controls ? control.pending : m.pending;
  const released =
    pending?.playerId === p.id
      ? pending
      : p.armSwing && !p.armSwing.hit && p.armSwing.age < 0.1
        ? p.armSwing
        : null;
  if (released)
    return frameOf(
      released.kind === 'back'
        ? 'backset'
        : released.kind === 'drive'
          ? 'spike'
          : released.kind === 'loft'
            ? 'set'
            : 'bump',
      0.07,
    );
  if (p.pose === 'land' && p.animation > 0) return frameOf('land', 0.14 - p.animation);
  if (Math.abs(p.vx) > 0.1) {
    const t = p.runTime ?? m.time,
      clip = BODY_CLIPS.run;
    return frameOf(
      'run',
      p.vx * (p.facing || 1) < 0
        ? (clip.frames.length - ((t * clip.fps) % clip.frames.length)) / clip.fps
        : t,
    );
  }
  return frameOf('idle', m.time + p.id * 2.73);
}

export function paintBody(c, frame, skinId, team, playerId = 0, layer = 'all', appearance = null) {
  const skin = appearance
      ? {
          hair: appearance.hair,
          accent: '#fff3d4',
          detail: appearance.head,
          ears: appearance.head === 'fox',
        }
      : SKINS[skinId] || SKINS.club,
    palette = skinPalette(appearance?.tone),
    ink = appearance ? palette.outline : '#665d62',
    flesh = appearance?.tone || '#f4cfac',
    pose = frame.pose;
  const r = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  // Angled legs retain the animated foot positions and give the stance weight.
  if (layer === 'all' || layer === 'feet')
    for (const [foot, y, side] of [
      [pose.l, pose.ly, -1],
      [pose.r, pose.ry, 1],
    ]) {
      const x = Math.round(foot * 1.8);
      const hip = side * 4;
      const raised = y < -2;
      const knee = {
        x: raised ? (x > hip ? x + 2 : hip - 2) : Math.round((hip + x) * 0.5 + side),
        y: -11 + pose.y + (raised && x > hip ? 3 : 6),
      };
      const points = [];
      const joints = [
        [hip, -11 + pose.y],
        [knee.x, knee.y],
        [x, -1 + y],
      ];
      for (let segment = 0; segment < 2; segment++) {
        const [ax, ay] = joints[segment],
          [bx, by] = joints[segment + 1];
        const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
        for (let step = 0; step <= steps; step++)
          points.push([
            Math.round(ax + ((bx - ax) * step) / steps),
            Math.round(ay + ((by - ay) * step) / steps),
          ]);
      }
      for (const [px, py] of points) r(px - 2, py, 5, 2, ink);
      for (const [px, py] of points) {
        const sock = py >= -3 + y;
        r(px - 1, py, 3, 1, sock ? '#f7efdf' : flesh);
        if (!sock) r(px + 1, py, 1, 1, palette.blush);
      }
      r(x - 3, -3 + y, 8, 4, ink);
      r(x - 2, -3 + y, 6, 3, '#fff9e9');
      r(x - 2, y, 6, 1, '#b9c4bb');
    }
  const y = pose.y;
  if (layer === 'feet') return;
  if (layer !== 'head') {
    if (pose.squat) {
      for (const side of [-1, 1]) {
        const knee = side * (5 + Math.round(pose.squat * 6));
        r(knee - 1, -9 + Math.round(pose.squat * 3), 4, 4, flesh);
        r(side < 0 ? knee : 3, -10 + Math.round(pose.squat * 4), Math.abs(knee) - 1, 3, flesh);
      }
    }
    const shorts = team.id === 'mint' ? team.dark : '#fff2df';
    r(-7, -15 + y, 15, 6, ink);
    r(-6, -14 + y, 13, 4, shorts);
    r(-6, -10 + y, 5, 1, shorts);
    r(3, -10 + y, 5, 1, shorts);
    r(0, -12 + y, 2, 3, ink);
    if (appearance) {
      r(-5.5, -14 + y, 1, 3.5, '#fff8e7');
      r(6, -13.5 + y, 1, 3, '#fff8e7');
      r(-6, -10 + y, 4, 0.5, '#e6d5bb');
      r(3.5, -10 + y, 3, 0.5, '#e6d5bb');
    }
    r(-6, -26 + y, 13, 2, ink);
    r(-7, -24 + y, 15, 11, ink);
    r(-6, -25 + y, 13, 11, team.color);
    r(-6, -22 + y, 2, 8, team.dark);
    r(5, -22 + y, 2, 8, team.dark);
    r(4, -21 + y, 1, 7, team.light);
    r(-2, -25 + y, 7, 2, '#fff2dd');
    r(-1, -24 + y, 5, 1, team.dark);
    // Tank-top piping and small jersey folds catch the same light as the face.
    r(-6, -25 + y, 2, 4, '#fff2dd');
    r(5, -25 + y, 2, 4, '#fff2dd');
    r(-4, -17 + y, 2, 2, team.dark);
    r(-5, -14 + y, 10, 1, '#fff2dd');
    r(3, -16 + y, 2, 2, team.light);
    if (!appearance && skin.detail === 'cap') {
      r(-5, -21 + y, 11, 2, skin.accent);
      r(-5, -17 + y, 11, 1, team.dark);
    }
    if (!appearance && skin.detail === 'fox') {
      r(-3, -23 + y, 7, 7, team.light);
      r(-1, -17 + y, 3, 2, '#fff1d8');
    }
    if (appearance?.body === 'stripes') {
      for (const x of [-4, 0, 4]) r(x, -23 + y, 2, 9, team.light);
    }
    if (appearance?.body === 'sleeveless') {
      r(-6, -24 + y, 3, 6, flesh);
      r(4, -24 + y, 3, 6, flesh);
      r(-2, -24 + y, 5, 2, team.dark);
    }
    if (appearance?.body === 'chevron') {
      for (let i = 0; i < 6; i++) {
        r(-6 + i, -23 + y + Math.floor(i / 2), 2, 2, team.light);
        r(5 - i, -23 + y + Math.floor(i / 2), 2, 2, team.light);
      }
    }
    if (appearance?.body === 'longsleeve') {
      r(-8, -24 + y, 3, 10, team.dark);
      r(6, -24 + y, 3, 10, team.dark);
      r(-5, -15 + y, 11, 2, team.light);
    }
    if (pose.shoulders) {
      r(-7, -25 + y + pose.shoulders, 4, 5, team.color);
      r(4, -25 + y + pose.shoulders, 4, 5, team.light);
    }
  }
  if (layer === 'torso') return;
  const h = pose.h;
  if (appearance?.headShape === 'round') {
    // Scanlines retain crisp pixel edges and a genuinely circular face silhouette.
    for (let row = 0; row < 15; row++) {
      const dy = row - 7;
      const halfWidth = Math.floor(Math.sqrt(7.5 ** 2 - dy ** 2));
      r(h - halfWidth, -36 + y + row, halfWidth * 2 + 1, 1, ink);
      if (halfWidth > 1 && row > 0 && row < 14)
        r(h - halfWidth + 1, -36 + y + row, halfWidth * 2 - 1, 1, flesh);
    }
  } else if (appearance?.headShape === 'square') {
    r(-7 + h, -36 + y, 15, 15, ink);
    r(-6 + h, -35 + y, 13, 13, flesh);
  } else {
    r(-8 + h, -34 + y, 17, 13, ink);
    r(-7 + h, -35 + y, 15, 13, flesh);
  }
  if (!appearance) {
    r(-6 + h, -36 + y, 13, 5, skin.hair);
    r(-8 + h, -33 + y, 3, 7, skin.hair);
    r(6 + h, -33 + y, 3, 7, skin.hair);
  }
  // Directional sunset shading on the face; eyes remain on top of the light.
  r(-6 + h, -31 + y, 3, 8, palette.blush);
  r(5 + h, -32 + y, 1, 7, palette.highlight);
  r(-4 + h, -23 + y, 9, 1, palette.blush);
  if (appearance) {
    // A darker side plane, small ear and short sideburn turn the head in 3/4.
    r(-6.5 + h, -28.5 + y, 1.5, 3.5, flesh);
    r(-6 + h, -27.5 + y, 0.5, 1.5, palette.mouth);
    r(-5 + h, -33 + y, 1.5, 4, skin.hair);
    r(-3.5 + h, -33.5 + y, 8, 0.5, palette.highlight);
    if (['crop', 'band', 'fox'].includes(appearance.head)) {
      r(-5 + h, -36 + y, 11, 3, skin.hair);
      r(-7 + h, -33 + y, 2, 4, skin.hair);
      r(6 + h, -33 + y, 2, 3, skin.hair);
      r(-4 + h, -36 + y, 4, 1, '#665044');
      r(-6 + h, -35 + y, 2, 2, skin.hair);
    } else if (appearance.head === 'cap') {
      r(-7 + h, -32 + y, 2, 4, skin.hair);
    }
  }
  if (skin.detail === 'band') {
    if (appearance) {
      r(-7 + h, -38 + y, 14, 5, skin.hair);
      for (let x = -7; x < 7; x += 3) r(x + h, -39 + y + (x % 2 ? 0 : 1), 2, 2, skin.hair);
      r(-8 + h, -36 + y, 2, 3, skin.hair);
      r(6 + h, -36 + y, 2, 2, skin.hair);
    }
    r(-7 + h, -34 + y, 15, 2, skin.accent);
    r(7 + h, -33 + y, 3, 2, team.color);
    r(-4 + h, -36 + y, 6, 2, skin.hair);
  }
  if (skin.detail === 'cap') {
    r(-7 + h, -37 + y, 15, 4, team.dark);
    r(-5 + h, -38 + y, 11, 2, team.dark);
    r(5 + h, -34 + y, 7, 2, skin.accent);
    r(-4 + h, -37 + y, 3, 2, team.light);
    if (appearance) {
      r(-8 + h, -32 + y, 2, 6, team.dark);
      r(-9 + h, -30 + y, 2, 3, team.dark);
      r(-5 + h, -37.5 + y, 9, 1, team.color);
      r(5 + h, -35 + y, 6, 1, team.dark);
      r(-3 + h, -37 + y, 1, 0.5, team.light);
    }
  }
  if (skin.detail === 'bucket') {
    r(-8 + h, -36 + y, 17, 4, '#667c83');
    r(-6 + h, -41 + y, 13, 7, '#98adae');
    r(-4 + h, -42 + y, 9, 2, '#cbd5cb');
    r(-5 + h, -40 + y, 11, 5, '#f2eddb');
    r(-6 + h, -36 + y, 13, 1.5, '#b3c4bf');
    r(-10 + h, -34 + y, 21, 2, '#71888c');
    r(-8 + h, -35 + y, 17, 1.5, '#d8ded0');
    r(-8 + h, -32 + y, 2, 6, '#325c60');
  }
  if (skin.ears) {
    r(-7 + h, -37 + y, 14, 5, team.color);
    r(-7 + h, -40 + y, 4, 5, team.dark);
    r(4 + h, -40 + y, 4, 5, team.dark);
    r(-6 + h, -38 + y, 2, 3, skin.accent);
    r(5 + h, -38 + y, 2, 3, skin.accent);
    if (appearance) {
      r(-7 + h, -44 + y, 5, 9, team.dark);
      r(3 + h, -44 + y, 5, 9, team.dark);
      r(-6 + h, -43 + y, 3, 7, team.color);
      r(4 + h, -43 + y, 3, 7, team.color);
      r(-5.5 + h, -42 + y, 2, 5, '#fff1dc');
      r(4.5 + h, -42 + y, 2, 5, '#fff1dc');
      r(-7 + h, -36 + y, 15, 3, team.color);
      r(-5 + h, -37 + y, 11, 1.5, team.light);
    }
  }
  r(-2 + h, -29 + y, 1, pose.eye ? 1 : 3, ink);
  r(4 + h, -29 + y, 1, pose.eye ? 1 : 3, ink);
  r(3 + h, -26 + y, 2, 1, palette.blush);
  r(-5 + h, -26 + y, 2, 2, appearance ? palette.blush : '#eaa096');
  r(5 + h, -26 + y, 2, 2, appearance ? palette.blush : '#eaa096');
  r(h + 1, -24 + y, 3, 1, appearance ? palette.mouth : '#b57670');
  if (['sad', 'shake'].includes(frame.state)) {
    r(h - 1, -25 + y, 5, 1, ink);
    r(h - 2, -24 + y, 1, 1, ink);
    r(h + 4, -24 + y, 1, 1, ink);
  }
  if (['cheer', 'fist', 'clap'].includes(frame.state)) {
    r(h - 1, -25 + y, 5, 2, ink);
    r(h, -23 + y, 3, 1, ink);
  }
}
export class BodySprites {
  constructor() {
    this.cache = new Map();
  }
  get(frame, skin, team, playerId, layer = 'all', appearance = null) {
    const key = [
      frame.state,
      frame.index,
      skin,
      team.id,
      team.color,
      team.dark,
      team.light,
      layer,
      appearance ? JSON.stringify(appearance) : '',
    ].join(':');
    if (!this.cache.has(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const c = canvas.getContext('2d');
      c.scale(2, 2);
      c.translate(32, 54);
      paintBody(c, frame, skin, team, playerId, layer, appearance);
      this.cache.set(key, canvas);
    }
    return this.cache.get(key);
  }
}
