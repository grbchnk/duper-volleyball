// PlayStation symbols are the shared teaching language. Keyboard bindings stay in InputBuffer.
export const COACH_STEPS = {
  walk: [
    'Левый стик — ходить',
    'Отклони стик в любую сторону. Пройди до отметки.',
    ['stick'],
    'walk',
  ],
  jump: ['✕ — прыгнуть', '', ['cross'], 'jump'],
  weak: [
    'L2 + □ — мягкий приём',
    'Удерживай L2. Коротко нажми квадрат перед низким мячом.',
    ['l2', 'square'],
    'pass',
  ],
  high: [
    '△ — высокий навес',
    'Зажми треугольник заранее. Зелёная часть шкалы — нужная сила.',
    ['triangle'],
    'high',
  ],
  'soft-set': [
    'L2 + △ — мягкая передача',
    'Удерживай L2 и коротко нажми треугольник у мяча над головой.',
    ['l2', 'triangle'],
    'pass',
  ],
  exchange: [
    'Пять передач подряд',
    'Без стика — пас партнёру. Пять передач подряд.',
    ['triangle'],
    'rally',
  ],
  set: [
    '△ — навес партнёру',
    'Подними мяч треугольником. Затем крестик — прыжок, круг — атака.',
    ['triangle'],
    'attack',
  ],
  spike: [
    '✕ → ○ — атака',
    'Прыгни крестиком. Зажми круг и отпусти у мяча над сеткой.',
    ['cross', 'circle'],
    'attack',
  ],
  tip: [
    'L2 + ○ — скидка',
    'Прыгни и коснись мяча выше сетки, удерживая L2 и круг.',
    ['cross', 'l2', 'circle'],
    'tip',
  ],
  fast: [
    'R2 + ○ — быстрый удар',
    'Прыгни и направь удар через сетку. Удерживай R2 при контакте.',
    ['cross', 'r2', 'circle'],
    'attack',
  ],
  'serve-low': [
    '□ — нижняя подача',
    'Зажми, отпусти для подброса, нажми ещё раз, когда круг станет зелёным.',
    ['square'],
    'serve',
  ],
  'serve-loft': [
    '△ — верхняя подача',
    'Тот же ритм: заряд, подброс, второе нажатие у зелёного круга.',
    ['triangle'],
    'serve',
  ],
  'serve-drive': [
    '○ — силовая подача',
    'Заряди круг, отпусти для подброса. Ударь вторым нажатием.',
    ['circle'],
    'serve',
  ],
  'serve-back': [
    'L2 + □ — мягкая подача',
    'Удерживай L2. Подброс и второе нажатие выполняются квадратом.',
    ['l2', 'square'],
    'serve',
  ],
  block: [
    'R1 — блок',
    'Нажми R1, когда мяч приближается к сетке. Нужно встретить его руками.',
    ['r1'],
    'block',
  ],
  'one-hand': [
    'L2 + □ — одна рука',
    'Подготовь мягкий приём перед низким мячом. Рука должна встретить мяч.',
    ['l2', 'square'],
    'one-hand',
  ],
  'dive-right': [
    'Три отклонения вправо',
    'Трижды быстро отклони стик, возвращая его в центр. Руки примут мяч сами.',
    ['stick'],
    'dive-right',
  ],
  'dive-left': [
    'Три отклонения влево',
    'Трижды быстро отклони стик влево с возвратом в центр.',
    ['stick'],
    'dive-left',
  ],
  switch: [
    'L1 — сменить игрока',
    'Нажми L1. Кольцо управления перейдёт к другому игроку.',
    ['l1'],
    'switch',
  ],
  crouch: [
    'Стик вниз — низкая стойка',
    'Отклони стик вниз. Игрок пригнётся для низкого мяча.',
    ['stick'],
    'crouch',
  ],
};

export function coachFor(lesson, objective = lesson.goals[0]) {
  if (lesson.id === 'move')
    return { title: 'Движение и прыжок', hint: '', controls: ['stick', 'cross'], motion: 'walk' };
  if (lesson.id === 'receive')
    return {
      title: 'Три приёма',
      hint: '',
      controls: ['square', 'triangle', 'circle'],
      motion: 'pass',
    };
  if (lesson.id === 'streak')
    return {
      title: 'Пять мячей подряд',
      hint: 'Любой приём · пять подряд',
      controls: ['square', 'triangle', 'circle'],
      motion: 'pass',
    };
  if (lesson.id === 'power')
    return {
      title: 'Сила удара',
      hint: 'Зажми — сильнее · стик — направление · сбей алмазы',
      controls: ['triangle', 'stick'],
      motion: 'high',
    };
  if (objective.id === 'defend')
    return {
      title: 'Защита',
      hint: 'Задний игрок — нижний приём',
      controls: ['square'],
      motion: 'pass',
    };
  const [title, hint, controls, motion] =
    COACH_STEPS[objective.exchange ? 'exchange' : objective.id];
  return { title, hint, controls, motion };
}

// Geometry, not font glyphs: face buttons keep the same shape on every device.
export function controlIcon(id) {
  const shapes = {
    square: '<rect x="-6" y="-6" width="12" height="12"/>',
    triangle: '<path d="M0 -7 L-7 6 H7 Z"/>',
    circle: '<circle r="7"/>',
    cross: '<path d="M-6 -6 L6 6 M6 -6 L-6 6"/>',
  };
  if (id === 'stick')
    return '<svg class="control-icon stick-icon" viewBox="0 0 48 48" role="img" aria-label="Левый стик"><path class="stick-arrows" d="M8 20 L3 24 L8 28 M40 20 L45 24 L40 28"/><circle class="control-base" cx="24" cy="24" r="16"/><g class="cue-stick" data-control="stick"><circle cx="24" cy="24" r="10"/></g></svg>';
  return `<svg class="control-icon control-${id}" viewBox="0 0 48 48" role="img" aria-label="${id}"><g transform="translate(24 24)"><circle class="control-rim" r="19"/><g class="control-face" data-control="${id}"><circle class="control-base" r="16"/><g class="control-glyph">${shapes[id] || `<text y="4">${id.toUpperCase()}</text>`}</g></g></g></svg>`;
}
