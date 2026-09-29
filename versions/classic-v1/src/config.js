export const FIXED_DT = 1 / 120;
export const COURT = Object.freeze({ halfLength: 9, width: 9, netHeight: 2.43, ballRadius: 0.105 });
export const DEFAULTS = Object.freeze({
  gravity: 9.81, drag: 0.025, restitution: 0.58, playerSpeed: 5.8,
  jumpSpeed: 4.8, hitPower: 1, gameSpeed: 1, assist: true,
  scoring: 'sideout', targetScore: 15, difficulty: 'normal', trajectory: false,
});
export const PRESETS = {
  arcade: { ...DEFAULTS },
  physical: { ...DEFAULTS, drag: 0.055, playerSpeed: 5.2, jumpSpeed: 4.4, assist: false, scoring: 'rally' },
};
export const LIMITS = {
  gravity: [5, 16], drag: [0, 0.1], restitution: [0.2, 0.9], playerSpeed: [3, 8],
  jumpSpeed: [3, 6.5], hitPower: [0.7, 1.4], gameSpeed: [0.5, 1.5], targetScore: [5, 25],
};
export const TEAMS = [
  { id: 'japan', name: 'Япония', short: 'JPN', color: '#e8553e', dark: '#a32f39', light: '#ffaf78', flag: 'jp' },
  { id: 'brazil', name: 'Бразилия', short: 'BRA', color: '#f1c946', dark: '#c58632', light: '#fff2ac', flag: 'br' },
  { id: 'usa', name: 'США', short: 'USA', color: '#548cc4', dark: '#2d497b', light: '#9cd5f4', flag: 'us' },
  { id: 'ussr', name: 'СССР', short: 'URS', color: '#d44849', dark: '#922f40', light: '#f68f86', flag: 'su' },
  { id: 'italy', name: 'Италия', short: 'ITA', color: '#5c9eeb', dark: '#3454a6', light: '#a9dfff', flag: 'it' },
  { id: 'netherlands', name: 'Нидерланды', short: 'NED', color: '#f39442', dark: '#b35634', light: '#ffc981', flag: 'nl' },
  { id: 'france', name: 'Франция', short: 'FRA', color: '#7a88d6', dark: '#484f96', light: '#c3c9ff', flag: 'fr' },
  { id: 'china', name: 'Китай', short: 'CHN', color: '#d96068', dark: '#923d55', light: '#f99d91', flag: 'cn' },
];
export function sanitizeConfig(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ожидается объект с настройками');
  const result = { ...DEFAULTS };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    if (Number.isFinite(value[key])) result[key] = Math.max(min, Math.min(max, value[key]));
  }
  result.targetScore = Math.round(result.targetScore);
  for (const key of ['assist', 'trajectory']) if (typeof value[key] === 'boolean') result[key] = value[key];
  if (['sideout', 'rally'].includes(value.scoring)) result.scoring = value.scoring;
  if (['easy', 'normal', 'hard'].includes(value.difficulty)) result.difficulty = value.difficulty;
  return result;
}
