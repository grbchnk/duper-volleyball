import { SHOT_DEFAULTS, SHOT_LIMITS, SHOT_BASES } from './shot-settings.js';
import { SERVE_DEFAULTS, SERVE_LIMITS, SERVE_BASES, serveKey } from './serve-settings.js';
import { SKINS } from './sprites.js';
import { ARM_STYLES } from './arms.js';
export const FIXED_DT = 1 / 120;
export const COURT = Object.freeze({ halfLength: 9, width: 9, netHeight: 2.43, ballRadius: 0.105 });
export const DEFAULTS = Object.freeze({
  gravity: 9.81,
  drag: 0.018,
  restitution: 0.58,
  playerSpeed: 5.6,
  airMoveSpeed: 1.4,
  jumpSpeed: 5.2,
  hitPower: 1,
  ...SHOT_DEFAULTS,
  ...SERVE_DEFAULTS,
  gameSpeed: 0.7,
  cartoonFlight: 0,
  ballSpeed: 1,
  cartoonStart: 0.55,
  cartoonEnd: 1.35,
  cartoonRamp: 0.85,
  cartoonHang: 0.4,
  assist: true,
  passAssist: 1,
  driveAssist: 1,
  variableJump: false,
  scoring: 'sideout',
  targetScore: 15,
  difficulty: 'normal',
  cpuSkill: 55,
  trajectory: true,
  armStyle: 'whip',
  skin: 'club',
  awaySkin: 'club',
  homeColor: '#ee967d',
  awayColor: '#80bda8',
  ballSize: 1.2,
  ballSkin: 'classic',
  ballFire: true,
  fireSpeed: 14,
  rightStickAim: false,
  pixelGraphics: false,
  livelyBackground: true,
  soundMuted: false,
  homeTeam: 'peach',
  awayTeam: 'mint',
  backArmMin: -75,
  backArmMax: 10,
  releaseWindow: 0.06,
  chargeSeconds: 0.41,
  maxHold: 0.56,
  chargeMove: 0.65,
  jumpWindup: 0.085,
  jumpRise: 0.54,
  jumpHang: 0.12,
  jumpBallHang: 0.12,
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
  ballSize: [0.7, 1.8],
  fireSpeed: [8, 25],
  backArmMin: [-90, 90],
  backArmMax: [-90, 90],
  cpuSkill: [0, 100],
  passAssist: [0, 1],
  driveAssist: [0, 1],
  gravity: [5, 16],
  drag: [0, 0.1],
  restitution: [0.2, 0.9],
  playerSpeed: [3, 8],
  airMoveSpeed: [0, 3],
  jumpSpeed: [3, 6.5],
  hitPower: [0.7, 1.4],
  ...SHOT_LIMITS,
  ...SERVE_LIMITS,
  gameSpeed: [0.5, 1.5],
  cartoonFlight: [0, 1],
  ballSpeed: [0.6, 1.4],
  cartoonStart: [0.2, 1],
  cartoonEnd: [1, 1.8],
  cartoonRamp: [0.2, 1.6],
  cartoonHang: [0, 0.85],
  targetScore: [5, 25],
  releaseWindow: [0, 0.35],
  chargeSeconds: [0.15, 0.9],
  maxHold: [0.2, 1.5],
  chargeMove: [0, 1],
  jumpWindup: [0, 0.25],
  jumpRise: [0.3, 0.9],
  jumpHang: [0, 0.4],
  jumpBallHang: [0, 0.5],
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
  // Migrate the first laboratory's multiplier and single angle once.
  for (const [kind, base] of Object.entries(SHOT_BASES)) {
    for (const [suffix, fallback] of [
      ['SpeedMin', base.speed[0]],
      ['SpeedMax', base.speed[1]],
    ]) {
      if (!Number.isFinite(value[kind + suffix]) && Number.isFinite(value[kind + 'Speed']))
        result[kind + suffix] = Math.max(0, Math.min(30, fallback * value[kind + 'Speed']));
    }
    for (const suffix of ['AngleMin', 'AngleMax', 'AirAngleMin', 'AirAngleMax']) {
      if (!Number.isFinite(value[kind + suffix]) && Number.isFinite(value[kind + 'Angle']))
        result[kind + suffix] = Math.max(-90, Math.min(90, value[kind + 'Angle']));
    }
    for (const [low, high] of [
      ['ElevationMin', 'ElevationMax'],
      ['ContactMin', 'ContactMax'],
    ]) {
      result[kind + high] = Math.max(result[kind + low], result[kind + high]);
    }
  }
  result.targetScore = Math.round(result.targetScore);
  for (const kind of Object.keys(SERVE_BASES)) {
    const key = (suffix) => serveKey(kind, suffix);
    result[key('Targeted')] = Math.round(result[key('Targeted')]);
    result[key('NetAssist')] = Math.round(result[key('NetAssist')]);
    result[key('ElevationMax')] = Math.max(
      result[key('ElevationMin')],
      result[key('ElevationMax')],
    );
    result[key('HitWindow')] = Math.max(result[key('PerfectWindow')], result[key('HitWindow')]);
  }
  result.maxHold = Math.max(result.maxHold, result.chargeSeconds * 0.92 + 0.05);
  result.backArmMax = Math.max(result.backArmMin, result.backArmMax);
  for (const key of [
    'assist',
    'trajectory',
    'variableJump',
    'ballFire',
    'rightStickAim',
    'pixelGraphics',
    'livelyBackground',
    'soundMuted',
  ])
    if (typeof value[key] === 'boolean') result[key] = value[key];
  if (['sideout', 'rally'].includes(value.scoring)) result.scoring = value.scoring;
  if (['easy', 'normal', 'hard'].includes(value.difficulty)) result.difficulty = value.difficulty;
  if (
    !Number.isFinite(value.cpuSkill) ||
    (value.cpuSkill === DEFAULTS.cpuSkill && value.difficulty && value.difficulty !== 'normal')
  )
    result.cpuSkill = { easy: 20, normal: 55, hard: 90 }[result.difficulty];
  result.cpuSkill = Math.round(result.cpuSkill);
  if (Object.hasOwn(ARM_STYLES, value.armStyle)) result.armStyle = value.armStyle;
  if (Object.hasOwn(SKINS, value.skin)) result.skin = value.skin;
  if (Object.hasOwn(SKINS, value.awaySkin)) result.awaySkin = value.awaySkin;
  if (['classic', 'ocean', 'neon', 'mono', 'plain'].includes(value.ballSkin))
    result.ballSkin = value.ballSkin;
  for (const key of ['homeColor', 'awayColor'])
    if (/^#[0-9a-f]{6}$/i.test(value[key])) result[key] = value[key];
  for (const key of ['homeTeam', 'awayTeam'])
    if (TEAMS.some((team) => team.id === value[key])) result[key] = value[key];
  result.ballFire = true;
  result.livelyBackground = true;
  return result;
}
