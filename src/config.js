export const FIXED_DT = 1 / 120;
export const COURT = Object.freeze({ halfLength: 9, width: 9, netHeight: 2.43, ballRadius: 0.105 });
export const DEFAULTS = Object.freeze({
  gravity: 9.81, drag: 0.018, restitution: 0.58, playerSpeed: 5.6,
  jumpSpeed: 5.2, hitPower: 1, gameSpeed: 0.7, assist: true,
  scoring: 'sideout', targetScore: 15, difficulty: 'normal', trajectory: true,
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
  { id: 'peach', name: 'Персиковые лисы', short: 'PEACH', color: '#ee967d', dark: '#bc645d', light: '#ffd0a4', flag: 'jp' },
  { id: 'mint', name: 'Мятные котики', short: 'MINT', color: '#80bda8', dark: '#497f7c', light: '#c4e9c5', flag: 'br' },
  { id: 'lemon', name: 'Лимонные зайцы', short: 'LEMON', color: '#ddc173', dark: '#987d44', light: '#f6e3a7' },
  { id: 'lilac', name: 'Лавандовые совы', short: 'LILAC', color: '#b0a2cb', dark: '#78638f', light: '#ded1ed' },
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
