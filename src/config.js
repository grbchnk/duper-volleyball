import { SKINS } from './sprites.js';
import { ARM_STYLES } from './arms.js';
export const FIXED_DT = 1 / 120;
export const COURT = Object.freeze({ halfLength: 9, width: 9, netHeight: 2.43, ballRadius: 0.105 });
export const DEFAULTS = Object.freeze({
  gravity: 9.81,
  drag: 0.018,
  restitution: 0.58,
  playerSpeed: 5.6,
  jumpSpeed: 5.2,
  hitPower: 1,
  gameSpeed: 0.7,
  assist: true,
  scoring: 'sideout',
  targetScore: 15,
  difficulty: 'normal',
  trajectory: true,
  armStyle: 'whip',
  skin: 'club',
  releaseWindow: 0.06,
  chargeSeconds: 0.41,
  maxHold: 0.56,
  chargeMove: 0.65,
  jumpWindup: 0.085,
  jumpRise: 0.54,
  jumpHang: 0.04,
  jumpFall: 0.45,
  blockWindow: 0.13,
  blockReach: 0.42,
  blockCooldown: 1.15,
  blockDeflect: 0.45,
  armScale: 1,
  armSpring: 1,
  armBend: 1,
  elbowHeight: 0,
  armRoundness: 1,
  diveSpeed: 6.5,
  diveLift: 2.3,
  diveRecovery: 0.92,
  divePower: 0.48,
  armWindup: 0.07,
  armPowerMotion: 1,
  armJumpMotion: 1,
});
export const PRESETS = {
  arcade: { ...DEFAULTS },
  physical: {
    ...DEFAULTS,
    drag: 0.055,
    playerSpeed: 5.2,
    jumpSpeed: 4.4,
    assist: false,
    scoring: 'rally',
  },
};
export const LIMITS = {
  gravity: [5, 16],
  drag: [0, 0.1],
  restitution: [0.2, 0.9],
  playerSpeed: [3, 8],
  jumpSpeed: [3, 6.5],
  hitPower: [0.7, 1.4],
  gameSpeed: [0.5, 1.5],
  targetScore: [5, 25],
  releaseWindow: [0, 0.35],
  chargeSeconds: [0.15, 0.9],
  maxHold: [0.2, 1.5],
  chargeMove: [0, 1],
  jumpWindup: [0, 0.25],
  jumpRise: [0.3, 0.9],
  jumpHang: [0, 0.15],
  jumpFall: [0.25, 0.85],
  blockWindow: [0.04, 0.35],
  blockReach: [0.2, 0.75],
  blockCooldown: [0.6, 2],
  blockDeflect: [0.25, 0.8],
  elbowHeight: [-12, 12],
  armRoundness: [0.5, 2],
  armScale: [0.65, 1.3],
  armSpring: [0.5, 2],
  armBend: [0, 1.5],
  diveSpeed: [4, 8],
  diveLift: [1.8, 3],
  diveRecovery: [0.5, 1.4],
  divePower: [0.2, 0.75],
  armWindup: [0.025, 0.15],
  armPowerMotion: [0, 1.5],
  armJumpMotion: [0, 1.5],
};
export const TEAMS = [
  {
    id: 'peach',
    name: 'План Б',
    short: 'PLAN B',
    color: '#ee967d',
    dark: '#bc645d',
    light: '#ffd0a4',
    flag: 'jp',
  },
  {
    id: 'mint',
    name: 'Без паники',
    short: 'CALM',
    color: '#80bda8',
    dark: '#497f7c',
    light: '#c4e9c5',
    flag: 'br',
  },
  {
    id: 'lemon',
    name: 'Третий лишний',
    short: '3RD',
    color: '#ddc173',
    dark: '#987d44',
    light: '#f6e3a7',
  },
  {
    id: 'lilac',
    name: 'По расписанию',
    short: 'ONTIME',
    color: '#b0a2cb',
    dark: '#78638f',
    light: '#ded1ed',
  },
];
export function sanitizeConfig(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Ожидается объект с настройками');
  const result = { ...DEFAULTS };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    if (Number.isFinite(value[key])) result[key] = Math.max(min, Math.min(max, value[key]));
  }
  result.targetScore = Math.round(result.targetScore);
  result.maxHold = Math.max(result.maxHold, result.chargeSeconds * 0.92 + 0.05);
  for (const key of ['assist', 'trajectory'])
    if (typeof value[key] === 'boolean') result[key] = value[key];
  if (['sideout', 'rally'].includes(value.scoring)) result.scoring = value.scoring;
  if (['easy', 'normal', 'hard'].includes(value.difficulty)) result.difficulty = value.difficulty;
  if (Object.hasOwn(ARM_STYLES, value.armStyle)) result.armStyle = value.armStyle;
  if (Object.hasOwn(SKINS, value.skin)) result.skin = value.skin;
  return result;
}
