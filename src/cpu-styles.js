// Personality is independent of skill: difficulty changes execution, not this profile.
export const CPU_STYLES = Object.freeze({
  patient: {
    name: 'Классик',
    rank: 1,
    description: 'Высокие передачи и надёжные переводы. Предсказуемый ритм, длинные розыгрыши.',
    homes: [7.2, 4.2, 1.8],
    block: 0.7,
    blockLead: 0.08,
    bias: { high: 2.2, free: 1.6, power: 0.4 },
    serves: { low: 4, loft: 3, drive: 1, back: 1 },
  },
  deep: {
    name: 'Контратака',
    rank: 2,
    description:
      'Страхует глубину, спасает сложные мячи и отвечает длинным ударом. Короткие мячи опасны для него.',
    homes: [8, 5.2, 2.5],
    block: 0.55,
    blockLead: 0.04,
    bias: { high: 1, pipe: 1.8, power: 1.6, free: 0.5 },
    serves: { low: 3, drive: 4, loft: 2, back: 1 },
  },
  blocker: {
    name: 'Стена',
    rank: 3,
    description:
      'Держит игрока у сетки, рано ставит блок и атакует силой. Его блок можно обмануть.',
    homes: [6.8, 3.6, 0.8],
    block: 1.15,
    blockLead: -0.2,
    bias: { high: 1, quick: 0.7, power: 1.8, steep: 1.5 },
    serves: { drive: 5, loft: 2, low: 2, back: 1 },
  },
  balanced: {
    name: 'Универсал',
    rank: 4,
    description:
      'Чередует короткие и глубокие атаки, передачи и блок. У него нет одной постоянной схемы.',
    homes: [7, 4, 1.4],
    block: 0.9,
    blockLead: -0.04,
    bias: { high: 0.6, quick: 0.6, back: 0.6, pipe: 0.6, power: 0.6, roll: 0.6, tip: 0.6 },
    serves: { low: 2, loft: 2, drive: 3, back: 2 },
  },
  quick: {
    name: 'Первый темп',
    rank: 5,
    description:
      'Мягкий приём L2 ближнему, низкая быстрая передача и удар в свободное место. Срывайте первый пас.',
    homes: [6.4, 3.3, 1.2],
    block: 0.9,
    blockLead: -0.07,
    bias: { 'soft-receive': 3, quick: 3, power: 1.5, steep: 1.5 },
    serves: { low: 2, drive: 4, loft: 2, back: 1 },
  },
  trickster: {
    name: 'Иллюзионист',
    rank: 6,
    description:
      'Скидки, пас за голову, ложные прыжки и смена темпа. Не раскрывайте защиту раньше контакта.',
    homes: [7.2, 4.1, 1.3],
    block: 0.85,
    blockLead: 0.03,
    bias: { back: 1.8, pipe: 1.5, feint: 2.5, dump: 1.6, tip: 1.8, roll: 1.6 },
    serves: { back: 4, loft: 3, low: 2, drive: 2 },
  },
  adaptive: {
    name: 'Маэстро',
    rank: 7,
    description:
      'Читает свободные зоны, меняет комбинации, использует L2/R2 и не повторяет удобные для вас атаки.',
    homes: [7.1, 4.1, 1.1],
    block: 1,
    blockLead: -0.02,
    bias: {},
    serves: { low: 2, loft: 2, drive: 3, back: 2 },
  },
});
export const STYLES = Object.freeze(
  Object.fromEntries(Object.entries(CPU_STYLES).map(([id, style]) => [id, style.name])),
);
export const cpuStyle = (config) => CPU_STYLES[config.cpuStyle] || CPU_STYLES.balanced;

export function chooseServeKind(match) {
  const weights = Object.entries(cpuStyle(match.config).serves);
  let value = match.random() * weights.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of weights) {
    value -= weight;
    if (value <= 0) return kind;
  }
  return weights.at(-1)[0];
}
