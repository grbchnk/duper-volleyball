import { TEAMS } from './teams.js';
import { BALL_DESIGNS } from './ball-designs.js';
import { CPU_STYLES } from './cpu-styles.js';
import { sanitizeAppearance } from './appearance.js';
export { TEAMS } from './teams.js';
import {
  SHOT_DEFAULTS,
  SHOT_LIMITS,
  SHOT_BASES,
  VARIANT_DEFAULTS,
  VARIANT_LIMITS,
  variantKey,
} from './shot-settings.js';
import { SERVE_DEFAULTS, SERVE_LIMITS, SERVE_BASES, serveKey } from './serve-settings.js';
import { SKINS } from './sprites.js';
import { LEGACY_DEFAULTS, LEGACY_LIMITS } from './legacy-profile.js';
export const FIXED_DT = 1 / 120;
export const COURT = Object.freeze({
  halfLength: 9.25,
  playerBackLimit: 11.25,
  width: 9,
  netHeight: 2.43,
  netDepth: 1,
  ballRadius: 0.105,
});
export const DEFAULTS = Object.freeze({
  dynamic: true,
  duel: false,
  floorBounce: false,
  transferShotOnSwitch: true,
  passDirectionPreview: false,
  neutralPassError: 0.15,
  neutralPassSpeedError: 0.75,
  approachAssist: true,
  feintMode: 'manual',
  setsToWin: 1,
  cpuStyle: 'balanced',
  gravity: 10.1,
  drag: 0.018,
  restitution: 0.58,
  playerSpeed: 5.6,
  airMoveSpeed: 1.4,
  jumpSpeed: 5.2,
  hitPower: 1,
  ...Object.fromEntries(Object.entries(SHOT_DEFAULTS).filter(([key]) => !key.startsWith('back'))),
  ...SERVE_DEFAULTS,
  ...VARIANT_DEFAULTS,
  gameSpeed: 1,
  ballSpeed: 1.2,
  modifierTempo: false,
  modifierSlowdown: 0.15,
  modifierSpeedup: 0.15,
  attackDip: 12,
  assist: true,
  passAssist: 0.5,
  driveAssist: 1,
  neutralPassAssist: 0.65,
  neutralAttackAssist: 0,
  receiveMomentum: false,
  receiveTransfer: 0.25,
  receiveDamping: 0.85,
  thirdTouchSlowdown: 0,
  variableJump: false,
  scoring: 'rally',
  targetScore: 11,
  difficulty: 'normal',
  cpuSkill: 55,
  trajectory: false,
  randomArms: false,
  skin: 'club',
  awaySkin: 'club',
  homeColor: '#ee967d',
  awayColor: '#80bda8',
  ballSize: 1.2,
  ballSkin: 'ocean',
  ballFire: true,
  fireSpeed: 14,
  pixelGraphics: false,
  livelyBackground: true,
  soundMuted: false,
  musicTrack: 'boardwalk',
  musicVolume: 0.22,
  arenaTheme: 'miami',
  homeTeam: 'peach',
  customTeamAppearance: false,
  randomTeamAppearance: false,
  appearanceSeed: 1,
  teamPlayers: Object.freeze([]),
  awayTeam: 'mint',
  releaseWindow: 0.2,
  lowReceiveHoldTime: 0,
  loftReceiveHoldTime: 0.08,
  chargeSeconds: 0.3,
  maxHold: 0.326,
  chargeMove: 0.2,
  jumpWindup: 0.085,
  jumpRise: 0.54,
  jumpHang: 0.12,
  jumpHoldThreshold: 0.02,
  jumpHoldHang: 0,
  jumpBallHang: 0.12,
  jumpFall: 0.45,
  blockWindow: 0.13,
  blockReach: 0.42,
  blockHeight: 0.4,
  blockCooldown: 1.15,
  blockDeflect: 0.45,
  armScale: 1,
  armLength: 1,
  armSpring: 1,
  armFollowThrough: 5,
  armBend: 1,
  elbowHeight: 0,
  armRoundness: 1,
  diveSpeed: 6.5,
  diveLift: 2.3,
  diveRecovery: 0.92,
  divePower: 0.48,
  armWindup: 0.07,
  smokeTrailOpacity: 0.16,
  smokeTrailLife: 1.2,
  armPowerMotion: 1,
  armJumpMotion: 1,
  // User baseline supplied on 20 October 2026.
  ...{
    feintMode: 'queued',
    cpuStyle: 'adaptive',
    drag: 0.02,
    restitution: 0.9,
    playerSpeed: 4.5,
    airMoveSpeed: 2,
    jumpSpeed: 5.4,
    lowContactMin: 0.32,
    lowContactMax: 0.67,
    lowReach: 1.2,
    loftSpeedMin: 5.9,
    loftContactMin: 1.42,
    loftContactMax: 2.32,
    driveSpeedMin: 6,
    driveSpeedMax: 15,
    driveSpinMin: 0.5,
    driveSpinMax: 0.5,
    driveContactMin: 1,
    driveContactMax: 2,
    driveReach: 1,
    serveLowIdealMin: 0.46,
    serveLowPerfectWindow: 0.1,
    serveLowMistimePower: 1,
    lowSoftSpeedMax: 7.4,
    lowSoftTempo: 0.85,
    loftSoftTempo: 0.85,
    loftFastSpeedMin: 7.5520000000000005,
    driveNormalDip: 5,
    driveSoftTempo: 0.85,
    driveFastSpeedMin: 7,
    driveFastSpeedMax: 20,
    driveFastDip: 10,
    gameSpeed: 0.9,
    modifierSpeedup: 0,
    attackDip: 15,
    neutralPassAssist: 0.5,
    targetScore: 7,
    difficulty: 'easy',
    cpuSkill: 30,
    skin: 'street',
    homeColor: '#8bb6cd',
    ballSize: 1,
    ballSkin: 'classic',
    fireSpeed: 13,
    musicTrack: 'sunset',
    musicVolume: 0.5,
    arenaTheme: 'beach',
    homeTeam: 'pumpkins',
    customTeamAppearance: true,
    appearanceSeed: 440592611,
    teamPlayers: [
      {
        headShape: 'square',
        head: 'mohawk',
        body: 'stripes',
        tone: '#f4cfac',
        hair: '#302b32',
      },
      {
        headShape: 'square',
        head: 'visor',
        body: 'chevron',
        tone: '#edba91',
        hair: '#302b32',
      },
      {
        headShape: 'square',
        head: 'straw',
        body: 'sleeveless',
        tone: '#d79b70',
        hair: '#302b32',
      },
    ].map(sanitizeAppearance),
    loftReceiveHoldTime: 0.1,
    chargeSeconds: 0.25,
    maxHold: 0.3,
    jumpWindup: 0.05,
    jumpRise: 0.55,
    jumpHang: 0.15,
    jumpHoldThreshold: 0.01,
    jumpBallHang: 0.2,
    jumpFall: 0.5,
    blockWindow: 0.2,
    blockReach: 0.3,
    blockHeight: 0.45,
    blockDeflect: 0.5,
    armScale: 1.1,
    armLength: 1.1,
    smokeTrailOpacity: 0.35,
    smokeTrailLife: 1,
  },
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
  appearanceSeed: [1, 1000000000],
  neutralPassAssist: [0, 1],
  neutralPassError: [0, 1],
  neutralPassSpeedError: [0, 1],
  neutralAttackAssist: [0, 1],
  receiveTransfer: [0, 0.6],
  receiveDamping: [0, 1],
  musicVolume: [0, 0.5],
  attackDip: [0, 24],
  setsToWin: [1, 3],
  ballSize: [0.7, 1.8],
  fireSpeed: [8, 25],
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
  ...VARIANT_LIMITS,
  ...SERVE_LIMITS,
  gameSpeed: [0.5, 1.5],
  ballSpeed: [0.6, 1.4],
  modifierSlowdown: [0, 0.5],
  modifierSpeedup: [0, 0.5],
  targetScore: [5, 25],
  releaseWindow: [0, 0.35],
  lowReceiveHoldTime: [0, 0.25],
  loftReceiveHoldTime: [0, 0.25],
  chargeSeconds: [0.15, 0.9],
  maxHold: [0.2, 1.5],
  chargeMove: [0, 1],
  jumpWindup: [0, 0.25],
  jumpRise: [0.3, 0.9],
  jumpHang: [0, 0.4],
  jumpHoldThreshold: [0.01, 0.3],
  jumpHoldHang: [0, 0.25],
  jumpBallHang: [0, 0.5],
  thirdTouchSlowdown: [0, 0.45],
  jumpFall: [0.25, 0.85],
  blockWindow: [0.04, 0.35],
  blockReach: [0.2, 0.75],
  blockHeight: [0.15, 0.8],
  blockCooldown: [0.6, 2],
  blockDeflect: [0.25, 0.8],
  elbowHeight: [-12, 12],
  armRoundness: [0.5, 2],
  armScale: [0.65, 1.3],
  armLength: [0.7, 1.3],
  armFollowThrough: [0, 15],
  armSpring: [0.5, 2],
  armBend: [0, 1.5],
  diveSpeed: [4, 8],
  diveLift: [1.8, 3],
  diveRecovery: [0.5, 1.4],
  divePower: [0.2, 0.75],
  armWindup: [0.025, 0.15],
  smokeTrailOpacity: [0, 0.35],
  smokeTrailLife: [0.2, 2],
  armPowerMotion: [0, 1.5],
  armJumpMotion: [0, 1.5],
};
export function sanitizeConfig(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Ожидается объект с настройками');
  const historical = value.dynamic === false;
  const result = { ...DEFAULTS, ...(historical ? { ...SHOT_DEFAULTS, ...LEGACY_DEFAULTS } : {}) };
  // The original shared receive slider migrates only where no per-shot value exists.
  if (Number.isFinite(value.receiveHoldTime)) {
    for (const kind of ['low', 'loft']) {
      const key = kind + 'ReceiveHoldTime';
      if (!Number.isFinite(value[key]))
        result[key] = Math.max(0, Math.min(0.25, value.receiveHoldTime));
    }
  }
  for (const [key, [min, max]] of Object.entries(
    historical ? { ...LIMITS, ...LEGACY_LIMITS } : LIMITS,
  ).filter(([key]) => historical || !key.startsWith('back'))) {
    if (Number.isFinite(value[key])) result[key] = Math.max(min, Math.min(max, value[key]));
  }
  // Migrate the first laboratory's multiplier and single angle once.
  for (const [kind, base] of Object.entries(SHOT_BASES)) {
    if (kind === 'back' && !historical) continue;
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
  result.setsToWin = Math.round(result.setsToWin);
  if (Object.hasOwn(CPU_STYLES, value.cpuStyle)) result.cpuStyle = value.cpuStyle;
  if (['manual', 'queued'].includes(value.feintMode)) result.feintMode = value.feintMode;
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
  if (historical) result.backArmMax = Math.max(result.backArmMin, result.backArmMax);
  for (const key of [
    'dynamic',
    'duel',
    'floorBounce',
    'transferShotOnSwitch',
    'passDirectionPreview',
    'approachAssist',
    'assist',
    'receiveMomentum',
    'modifierTempo',
    'trajectory',
    'variableJump',
    'ballFire',
    'randomArms',
    'customTeamAppearance',
    'randomTeamAppearance',
    'pixelGraphics',
    'livelyBackground',
    'soundMuted',
  ])
    if (typeof value[key] === 'boolean') result[key] = value[key];
  if (['sideout', 'rally'].includes(value.scoring)) result.scoring = value.scoring;
  if (['off', 'sunset', 'boardwalk', 'ocean'].includes(value.musicTrack))
    result.musicTrack = value.musicTrack;
  if (['miami', 'beach', 'gym', 'farm', 'alpine', 'sky', 'championship'].includes(value.arenaTheme))
    result.arenaTheme = value.arenaTheme;
  if (['easy', 'normal', 'hard'].includes(value.difficulty)) result.difficulty = value.difficulty;
  if (!Number.isFinite(value.cpuSkill))
    result.cpuSkill = value.difficulty
      ? { easy: 20, normal: 55, hard: 90 }[result.difficulty]
      : DEFAULTS.cpuSkill;
  result.cpuSkill = Math.round(result.cpuSkill);
  if (Object.hasOwn(SKINS, value.skin)) result.skin = value.skin;
  if (Object.hasOwn(SKINS, value.awaySkin)) result.awaySkin = value.awaySkin;
  if (Object.hasOwn(BALL_DESIGNS, value.ballSkin)) result.ballSkin = value.ballSkin;
  for (const key of ['homeColor', 'awayColor'])
    if (/^#[0-9a-f]{6}$/i.test(value[key])) result[key] = value[key];
  for (const key of ['homeTeam', 'awayTeam'])
    if (TEAMS.some((team) => team.id === value[key])) result[key] = value[key];
  result.appearanceSeed = Math.round(result.appearanceSeed);
  if (!historical) {
    // Retired experiments cannot be reactivated by an old settings file.
    result.receiveMomentum = false;
    result.thirdTouchSlowdown = 0;
    result.variableJump = false;
    result.jumpHoldHang = 0;
    result.approachAssist = true;
    result.modifierTempo = false;
    if (!Number.isFinite(value.lowNormalGroundAngle) && Number.isFinite(value.neutralPassAssist))
      result.passAssist = Math.max(0, Math.min(1, value.neutralPassAssist));
    for (const kind of ['low', 'loft', 'drive'])
      for (const variant of ['normal', 'soft', 'fast']) {
        if (variant === 'fast')
          for (const suffix of ['SpeedMin', 'SpeedMax']) {
            const key = variantKey(kind, variant, suffix);
            if (!Number.isFinite(value[key]) && Number.isFinite(value[kind + suffix]))
              result[key] = Math.min(40, result[kind + suffix] * 1.28);
          }
        const curve = variantKey(kind, variant, 'PowerCurve');
        if (!Number.isFinite(value[curve]) && Number.isFinite(value[kind + 'PowerCurve']))
          result[curve] = result[kind + 'PowerCurve'];
        const tempo = variantKey(kind, variant, 'Tempo');
        if (!Number.isFinite(value[tempo]) && value.modifierTempo && variant !== 'normal')
          result[tempo] =
            variant === 'soft'
              ? 1 - (result.modifierSlowdown ?? 0.15)
              : 1 + (result.modifierSpeedup ?? 0.15);
        const low = variantKey(kind, variant, 'SpeedMin'),
          high = variantKey(kind, variant, 'SpeedMax');
        result[high] = Math.max(result[low], result[high]);
        if (
          kind === 'drive' &&
          variant !== 'soft' &&
          !Number.isFinite(value[variantKey(kind, variant, 'Dip')]) &&
          Number.isFinite(value.attackDip)
        )
          result[variantKey(kind, variant, 'Dip')] = result.attackDip;
      }
  }
  if (Array.isArray(value.teamPlayers))
    result.teamPlayers = value.teamPlayers.slice(0, 3).map((p) => sanitizeAppearance(p));
  return result;
}
