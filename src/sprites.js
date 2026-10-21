import { paintSpecialHead } from './special-heads.js';
import { activeEmotion } from './emotions.js';
import { skinPalette } from './appearance.js';
import { paintExtraHead } from './head-styles.js';
import { paintShoe, paintJerseyPrint } from './player-accessories.js';
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
    const t = p.runTime ?? m.time;
    return frameOf('run', p.vx * (p.facing || 1) < 0 ? (6 - ((t * 12) % 6)) / 12 : t);
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
  // 15-pixel torso and 17-pixel head: subtly slimmer than the old 17/19 silhouette.
  if (layer === 'all' || layer === 'feet')
    for (const [x, y] of [
      [pose.l, pose.ly],
      [pose.r, pose.ry],
    ]) {
      r(x, -8 + y, 3, 7, flesh);
      r(x, -4 + y, 3, 3, '#f8eed6');
      paintShoe(r, x, y, appearance, ink, team);
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
    if (appearance?.body === 'stripes') {
      for (const x of [-4, 0, 4]) r(x, -20 + y, 2, 9, team.light);
    }
    if (appearance?.body === 'sleeveless') {
      r(-6, -21 + y, 3, 6, flesh);
      r(4, -21 + y, 3, 6, flesh);
      r(-2, -21 + y, 5, 2, team.dark);
    }
    if (appearance?.body === 'chevron') {
      for (let i = 0; i < 6; i++) {
        r(-6 + i, -20 + y + Math.floor(i / 2), 2, 2, team.light);
        r(5 - i, -20 + y + Math.floor(i / 2), 2, 2, team.light);
      }
    }
    if (appearance?.body === 'longsleeve') {
      // Sleeves follow the animated arm contour; only their garment roots live here.
      r(-7, -21 + y, 2, 2, team.color);
      r(6, -21 + y, 2, 2, team.color);
      r(-5, -12 + y, 11, 2, team.light);
    }
    if (pose.shoulders) {
      r(-7, -22 + y + pose.shoulders, 4, 5, team.color);
      r(4, -22 + y + pose.shoulders, 4, 5, team.light);
    }
    paintJerseyPrint(r, appearance?.jerseyPrint, appearance?.printColor, y);
  }
  if (layer === 'torso') return;
  const h = pose.h;
  if (
    appearance &&
    paintSpecialHead(
      (x, dy, w, height, color) => r(x + h, dy + y, w, height, color),
      appearance.head,
      skin.hair,
      ink,
      pose.eye,
    )
  ) {
    return;
  }
  // Square for new matches, previews and old replay appearances alike.
  r(-7 + h, -36 + y, 15, 15, ink);
  r(-6 + h, -35 + y, 13, 13, flesh);
  if (!appearance) {
    r(-6 + h, -36 + y, 13, 5, skin.hair);
    r(-8 + h, -33 + y, 3, 7, skin.hair);
    r(6 + h, -33 + y, 3, 7, skin.hair);
  }
  if (appearance) {
    if (['crop', 'band', 'fox'].includes(appearance.head)) {
      r(-5 + h, -36 + y, 11, 3, skin.hair);
      r(-7 + h, -33 + y, 2, 4, skin.hair);
      r(6 + h, -33 + y, 2, 3, skin.hair);
    } else if (appearance.head === 'cap') {
      r(-7 + h, -32 + y, 2, 4, skin.hair);
    }
  }
  if (skin.detail === 'band') {
    r(-7 + h, -34 + y, 15, 2, skin.accent);
    r(7 + h, -33 + y, 3, 2, team.color);
    r(-4 + h, -36 + y, 6, 2, skin.hair);
  }
  if (skin.detail === 'cap') {
    r(-7 + h, -37 + y, 15, 4, team.dark);
    r(-5 + h, -38 + y, 11, 2, team.dark);
    r(5 + h, -34 + y, 7, 2, skin.accent);
    r(-4 + h, -37 + y, 3, 2, team.light);
  }
  if (skin.ears) {
    r(-7 + h, -37 + y, 14, 5, team.color);
    r(-7 + h, -40 + y, 4, 5, team.dark);
    r(4 + h, -40 + y, 4, 5, team.dark);
    r(-6 + h, -38 + y, 2, 3, skin.accent);
    r(5 + h, -38 + y, 2, 3, skin.accent);
  }
  if (appearance)
    paintExtraHead(
      (x, dy, w, height, color) => r(x + h, dy + y, w, height, color),
      appearance.head,
      skin.hair,
      team,
      ink,
    );
  r(-3 + h, -29 + y, 2, pose.eye ? 1 : 3, ink);
  r(3 + h, -29 + y, 2, pose.eye ? 1 : 3, ink);
  r(-5 + h, -26 + y, 2, 2, appearance ? palette.blush : '#eaa096');
  r(5 + h, -26 + y, 2, 2, appearance ? palette.blush : '#eaa096');
  r(h, -24 + y, 3, 1, appearance ? palette.mouth : '#b57670');
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
    // 16 MiB of raw 64x64 RGBA pixels, independent of matches and cosmetics.
    this.maxEntries = 1024;
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
      canvas.width = 64;
      canvas.height = 64;
      const c = canvas.getContext('2d');
      c.translate(32, 54);
      paintBody(c, frame, skin, team, playerId, layer, appearance);
      if (this.cache.size >= this.maxEntries) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, canvas);
    } else {
      const canvas = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, canvas);
    }
    return this.cache.get(key);
  }
}
