import { activeEmotion } from './emotions.js';
// Editable, hand-authored pixel frames. Body frames are cached as 64×64 sprites;
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
      return f();
    }),
  },
  run: {
    label: 'Бег',
    fps: 12,
    loop: true,
    frames: [
      f(0, 1, 5, 0, -5, -3),
      f(-1, 1, 1, 0, -3, -5),
      f(0, 1, -4, 0, 2, -3),
      f(0, 1, -5, -3, 5, 0),
      f(-1, 1, -3, -5, 1, 0),
      f(0, 1, 2, -3, -4, 0),
    ],
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
    frames: [f(1, -2, -6, 0, 5), f(-1, -1, -6, -1, 5), f(0, 2, -5, 0, 6), f(2, 2, -6, 0, 5), f()],
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
  if (m.phase === 'serve-motion' && p.id === m.selected[m.server])
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
  const action = m.controls
    ? m.controls[p.team].charge || (!m.isHuman(p.team) ? m.actionFor(p.team) : null)
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
  const pending = m.controls ? m.controls[p.team].pending : m.pending;
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
    const t = p.runTime ?? m.time;
    return frameOf('run', p.vx * (p.facing || 1) < 0 ? (6 - ((t * 12) % 6)) / 12 : t);
  }
  return frameOf('idle', m.time + p.id * 2.73);
}

export function paintBody(c, frame, skinId, team, playerId = 0) {
  const skin = SKINS[skinId] || SKINS.club,
    ink = '#665d62',
    flesh = '#f4cfac',
    pose = frame.pose;
  const r = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  // 15-pixel torso and 17-pixel head: subtly slimmer than the old 17/19 silhouette.
  for (const [x, y] of [
    [pose.l, pose.ly],
    [pose.r, pose.ry],
  ]) {
    r(x, -8 + y, 3, 7, flesh);
    r(x, -4 + y, 3, 3, '#f8eed6');
    r(x - 1, -2 + y, 6, 3, ink);
    r(x - 1, -2 + y, 5, 2, '#fff6e1');
  }
  const y = pose.y;
  if (pose.squat) {
    for (const side of [-1, 1]) {
      const knee = side * (5 + Math.round(pose.squat * 6));
      r(knee - 1, -9 + Math.round(pose.squat * 3), 4, 4, flesh);
      r(side < 0 ? knee : 3, -10 + Math.round(pose.squat * 4), Math.abs(knee) - 1, 3, flesh);
    }
  }
  r(-6, -12 + y, 13, 6, team.dark);
  r(-5, -9 + y, 4, 4, team.dark);
  r(3, -9 + y, 4, 4, team.dark);
  r(-7, -22 + y, 15, 13, ink);
  r(-6, -21 + y, 13, 11, team.color);
  r(-6, -20 + y, 2, 10, team.dark);
  r(5, -20 + y, 2, 10, team.light);
  r(-3, -21 + y, 7, 2, '#fff2dd');
  r(-5, -11 + y, 10, 1, team.light);
  if (skin.detail === 'cap') {
    r(-5, -18 + y, 11, 2, skin.accent);
    r(-5, -14 + y, 11, 1, team.dark);
  }
  if (skin.detail === 'fox') {
    r(-3, -20 + y, 7, 7, team.light);
    r(-1, -14 + y, 3, 2, '#fff1d8');
  }
  if (pose.shoulders) {
    r(-7, -22 + y + pose.shoulders, 4, 5, team.color);
    r(4, -22 + y + pose.shoulders, 4, 5, team.light);
  }
  const h = pose.h;
  r(-8 + h, -34 + y, 17, 13, ink);
  r(-7 + h, -35 + y, 15, 13, flesh);
  r(-6 + h, -36 + y, 13, 5, skin.hair);
  r(-8 + h, -33 + y, 3, 7, skin.hair);
  r(6 + h, -33 + y, 3, 7, skin.hair);
  if (skin.detail === 'band') {
    r(-7 + h, -34 + y, 15, 2, skin.accent);
    r(7 + h, -33 + y, 3, 2, team.color);
    r(-4 + h, -37 + y, 6, 2, skin.hair);
  }
  if (skin.detail === 'cap') {
    r(-7 + h, -38 + y, 15, 5, team.dark);
    r(-5 + h, -39 + y, 11, 2, team.dark);
    r(5 + h, -34 + y, 7, 2, skin.accent);
    r(-4 + h, -37 + y, 3, 2, team.light);
  }
  if (skin.ears) {
    r(-7 + h, -37 + y, 14, 5, team.color);
    r(-7 + h, -42 + y, 5, 7, team.dark);
    r(3 + h, -42 + y, 5, 7, team.dark);
    r(-6 + h, -40 + y, 3, 4, skin.accent);
    r(4 + h, -40 + y, 3, 4, skin.accent);
  }
  r(-3 + h, -29 + y, 2, pose.eye ? 1 : 3, ink);
  r(3 + h, -29 + y, 2, pose.eye ? 1 : 3, ink);
  r(-5 + h, -26 + y, 2, 2, '#eaa096');
  r(5 + h, -26 + y, 2, 2, '#eaa096');
  r(h, -24 + y, 3, 1, '#b57670');
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
  get(frame, skin, team, playerId) {
    const key = [frame.state, frame.index, skin, team.id, team.color, team.dark, team.light].join(
      ':',
    );
    if (!this.cache.has(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const c = canvas.getContext('2d');
      c.translate(32, 54);
      paintBody(c, frame, skin, team, playerId);
      this.cache.set(key, canvas);
    }
    return this.cache.get(key);
  }
}
