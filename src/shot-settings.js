import { LEGACY_BACK } from './legacy-profile.js';
// Shared schema for the game, JSON validation and the laboratory.
export const SHOT_BASES = {
  low: {
    speed: [5.8, 11.7],
    angle: 74,
    air: 74,
    floor: 74,
    ceiling: 90,
    spin: 0,
    min: 0.16,
    max: 1.35,
    reach: 1.15,
  },
  back: LEGACY_BACK,
  loft: {
    speed: [5.8, 11.8],
    angle: 71,
    air: 71,
    floor: -90,
    ceiling: 90,
    spin: 0,
    min: 1.65,
    max: 2.45,
    reach: 1,
  },
  drive: {
    speed: [7.4, 18],
    angle: 18,
    air: -5,
    floor: -90,
    ceiling: 45,
    spin: 0.5,
    min: 0.8,
    max: 2.6,
    reach: 1.12,
  },
};
export const SHOT_FIELDS = {
  SpeedMin: ['Скорость · 0%', 0, 30, 0.1, 'м/с', 'endpoints'],
  SpeedMax: ['Скорость · 100%', 0, 30, 0.1, 'м/с', 'endpoints'],
  AngleMin: ['Угол с земли · 0%', -90, 90, 1, '°', 'endpoints'],
  AngleMax: ['Угол с земли · 100%', -90, 90, 1, '°', 'endpoints'],
  AirAngleMin: ['Угол в воздухе · 0%', -90, 90, 1, '°', 'endpoints'],
  AirAngleMax: ['Угол в воздухе · 100%', -90, 90, 1, '°', 'endpoints'],
  SpinMin: ['Вращение · 0%', -2, 2, 0.05, '', 'endpoints'],
  SpinMax: ['Вращение · 100%', -2, 2, 0.05, '', 'endpoints'],
  PowerCurve: ['Кривая силы', 0.25, 3, 0.05, '×', 'direction'],
  AimBlend: ['Влияние ручного угла', 0, 1, 0.05, '×', 'direction'],
  ElevationMin: ['Нижний предел угла', -90, 90, 1, '°', 'direction'],
  ElevationMax: ['Верхний предел угла', -90, 90, 1, '°', 'direction'],
  AssistAngle: ['Максимальная коррекция', 0, 12, 0.5, '°', 'assist'],
  AssistRadius: ['Допуск к партнёру', 0, 3, 0.05, 'м', 'assist'],
  ContactMin: ['Нижняя высота контакта', 0.12, 3, 0.05, 'м', 'contact'],
  ContactMax: ['Верхняя высота контакта', 0.12, 3, 0.05, 'м', 'contact'],
  Reach: ['Дальность контакта', 0.2, 1.5, 0.05, 'м', 'contact'],
};
// Manual direction is defined by the input, not by the automatic angle/spin profile.
export const MANUAL_SHOT_FIELDS = new Set([
  'SpeedMin',
  'SpeedMax',
  'PowerCurve',
  'ContactMin',
  'ContactMax',
  'Reach',
]);
export const SHOT_DEFAULTS = {};
export const SHOT_LIMITS = {};
for (const [kind, b] of Object.entries(SHOT_BASES)) {
  const values = {
    SpeedMin: b.speed[0],
    SpeedMax: b.speed[1],
    AngleMin: b.angle,
    AngleMax: b.angle,
    AirAngleMin: b.air,
    AirAngleMax: b.air,
    SpinMin: b.spin,
    SpinMax: b.spin,
    PowerCurve: 1,
    AimBlend: 1,
    ElevationMin: b.floor,
    ElevationMax: b.ceiling,
    AssistAngle: 6,
    AssistRadius: 1.65,
    ContactMin: b.min,
    ContactMax: b.max,
    Reach: b.reach,
  };
  for (const [suffix, value] of Object.entries(values)) {
    SHOT_DEFAULTS[kind + suffix] = value;
    SHOT_LIMITS[kind + suffix] = SHOT_FIELDS[suffix].slice(1, 3);
  }
}
export function shotSettings(config, kind) {
  return Object.fromEntries(
    Object.keys(SHOT_FIELDS).map((suffix) => [
      suffix,
      config[kind + suffix] ?? SHOT_DEFAULTS[kind + suffix],
    ]),
  );
}
