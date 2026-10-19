// Separate profiles: changing a serve never changes the corresponding rally shot.
export const SERVE_BASES = {
  back: { name: 'Мягкая подсечка снизу', speed: [8, 14], angle: 50, ideal: 0.85, height: 0.95 },
  low: { name: 'Высокая подача снизу', speed: [10, 17], angle: 49, ideal: 1.15, height: 0.85 },
  loft: {
    name: 'Силовая подача сверху',
    speed: [10.5, 17.5],
    angle: 38,
    ideal: 1.15,
    height: 2.05,
  },
  drive: { name: 'Подача в прыжке', speed: [11.5, 18.5], angle: 13, ideal: 1.25, height: 2.05 },
};
export const SERVE_FIELDS = {
  SpeedMin: ['Скорость · 0%', 0, 30, 0.1, 'м/с', 'endpoints'],
  SpeedMax: ['Скорость · 100%', 0, 30, 0.1, 'м/с', 'endpoints'],
  AngleMin: ['Угол · 0%', -90, 90, 1, '°', 'endpoints'],
  AngleMax: ['Угол · 100%', -90, 90, 1, '°', 'endpoints'],
  SpinMin: ['Вращение · 0%', -2, 2, 0.05, '', 'endpoints'],
  SpinMax: ['Вращение · 100%', -2, 2, 0.05, '', 'endpoints'],
  PowerCurve: ['Кривая силы', 0.25, 3, 0.05, '×', 'direction'],
  AimBlend: ['Влияние ручного угла', 0, 1, 0.05, '×', 'direction'],
  ElevationMin: ['Нижний предел угла', -90, 90, 1, '°', 'direction'],
  ElevationMax: ['Верхний предел угла', -90, 90, 1, '°', 'direction'],
  TargetMin: ['Дальность за сеткой · 0%', -8, 18, 0.1, 'м', 'target'],
  TargetMax: ['Дальность за сеткой · 100%', -8, 18, 0.1, 'м', 'target'],
  TargetCurve: ['Кривая дальности', 0.25, 4, 0.05, '×', 'target'],
  FlightTimeMin: ['Время полёта · 0%', 0.5, 4, 0.05, 'с', 'target'],
  FlightTimeMax: ['Время полёта · 100%', 0.5, 4, 0.05, 'с', 'target'],
  NetAssist: ['Удлинять полёт для обхода сетки', 0, 1, 1, '0 / 1', 'target'],
  ChargeSeconds: ['Время зарядки до 100%', 0.15, 2, 0.01, 'с', 'timing'],
  IdealMin: ['До идеального удара · 0%', 0.3, 4, 0.01, 'с', 'timing'],
  IdealMax: ['До идеального удара · 100%', 0.3, 4, 0.01, 'с', 'timing'],
  PerfectWindow: ['Идеальное окно ±', 0.01, 0.4, 0.01, 'с', 'timing'],
  HitWindow: ['Допустимое окно ±', 0.02, 0.65, 0.01, 'с', 'timing'],
  MistimePower: ['Сила неточного удара', 0.05, 1, 0.05, '×', 'timing'],
  TossHeight: ['Высота начала подброса', 0.2, 2.5, 0.05, 'м', 'toss'],
  TossGravity: ['Ускорение подброса', 1, 16, 0.1, 'м/с²', 'toss'],
  ContactHeight: ['Высота кисти над стопами', 0.2, 3.5, 0.05, 'м', 'toss'],
  ContactReach: ['Допуск мяча к кисти', 0.1, 1.2, 0.01, 'м', 'toss'],
  Runup: ['Длина разбега в прыжке', 0, 2, 0.05, 'м', 'toss'],
};
export const serveKey = (kind, suffix = '') =>
  'serve' + kind[0].toUpperCase() + kind.slice(1) + suffix;
export const SERVE_DEFAULTS = {},
  SERVE_LIMITS = {};
for (const [kind, base] of Object.entries(SERVE_BASES)) {
  const values = {
    SpeedMin: base.speed[0],
    SpeedMax: base.speed[1],
    AngleMin: base.angle,
    AngleMax: base.angle,
    SpinMin: 0,
    SpinMax: 0,
    PowerCurve: 1,
    AimBlend: 1,
    ElevationMin: -90,
    ElevationMax: 90,
    TargetMin: 1.4,
    TargetMax: 13.4,
    TargetCurve: 3,
    FlightTimeMin: 1.9,
    FlightTimeMax: 2.2,
    NetAssist: 1,
    ChargeSeconds: 0.41,
    IdealMin: base.ideal,
    IdealMax: base.ideal,
    PerfectWindow: 0.12,
    HitWindow: 0.24,
    MistimePower: 0.3,
    TossHeight: kind === 'back' ? 0.85 : 1.3,
    TossGravity: 6,
    ContactHeight: base.height,
    ContactReach: 0.36,
    Runup: kind === 'drive' ? 1.05 : 0,
  };
  for (const [suffix, value] of Object.entries(values)) {
    SERVE_DEFAULTS[serveKey(kind, suffix)] = value;
    SERVE_LIMITS[serveKey(kind, suffix)] = SERVE_FIELDS[suffix].slice(1, 3);
  }
  SERVE_DEFAULTS[serveKey(kind, 'Targeted')] = kind === 'back' ? 1 : 0;
  SERVE_LIMITS[serveKey(kind, 'Targeted')] = [0, 1];
}
export function serveSettings(config, kind) {
  const settings = Object.fromEntries(
    [...Object.keys(SERVE_FIELDS), 'Targeted'].map((suffix) => [
      suffix,
      config[serveKey(kind, suffix)] ?? SERVE_DEFAULTS[serveKey(kind, suffix)],
    ]),
  );
  if (config.dynamic) settings.ChargeSeconds = 2 * (config.chargeSeconds ?? 0.3);
  return settings;
}
