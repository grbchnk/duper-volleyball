// Each attack is a data record. Add a record + a selection rule to extend the game.
// Durations/heights are tunable approximations, not reverse-engineered ROM constants.
export const ATTACKS = Object.freeze({
  normal: { name: 'Обычная атака', role: 'open', x: 2.5, flight: 0.94, height: 3.25, power: 1, hint: 'J на приёме → J на красном мяче' },
  quick: { name: 'Быстрая атака', role: 'quick', x: 1.1, flight: 0.54, height: 2.95, power: 1.06, hint: 'S + J на приёме → J на ударе' },
  delayed: { name: 'Атака с задержкой', role: 'quick', x: 1.8, flight: 1.32, height: 3.4, power: 1.08, hint: 'S + J на приёме → K до паса → J' },
  open: { name: 'Открытая атака', role: 'open', x: 3.7, flight: 1.25, height: 3.5, power: 1.04, hint: 'W + J на приёме → J на ударе' },
  back: { name: 'Атака из глубины', role: 'receiver', x: 5.5, flight: 1.48, height: 3.55, power: 1.12, hint: 'W + J на приёме → K до паса → J' },
  dump: { name: 'Скидка со второго касания', role: 'setter', x: 0.9, flight: 0.85, height: 2.85, power: 0.6, hint: 'W + J на приёме → D + J перед пасом' },
  dink: { name: 'Обманный удар', power: 0.5, hint: 'W + J на ударе' },
  super: { name: 'Силовой удар', power: 1.3, hint: 'S + J + K на ударе (или S + Space)' },
});
export const SERVES = Object.freeze({
  float: { name: 'Обычная подача', toss: 4.2, flight: 1.7, height: 2.1 },
  under: { name: 'Нижняя подача', toss: 2.7, flight: 1.94, height: 1.45 },
  jump: { name: 'Подача в прыжке', toss: 6, flight: 1.5, height: 3.2 },
  over: { name: 'Верхняя подача', toss: 5, flight: 1.65, height: 2.65 },
  sky: { name: 'Высокая спецподача', toss: 2.7, flight: 2.45, height: 1.45 },
  thunder: { name: 'Силовая спецподача', toss: 2.7, flight: 1.4, height: 1.45 },
});
export const receptionChoice = input => input.up ? 'open' : input.down ? 'quick' : 'normal';
export function setChoice(attack, modifier) {
  if (!modifier) return attack;
  return attack === 'quick' ? 'delayed' : attack === 'open' ? 'back' : attack;
}
export function serveChoice(input, forward = 1) {
  if (input.up) return 'under';
  if (input.axis * forward > 0) return 'jump';
  if (input.axis * forward < 0) return 'over';
  return 'float';
}
