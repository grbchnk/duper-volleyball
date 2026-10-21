// PlayStation symbols are the shared teaching language. Keyboard bindings stay in InputBuffer.
export const COACH_STEPS = {
  walk: [
    'Левый стик — ходить',
    'Отклони стик в любую сторону. Пройди до отметки.',
    ['stick'],
    'walk',
  ],
  jump: [
    '✕ — прыгнуть',
    'Нажми крестик один раз. Длительность нажатия не меняет высоту.',
    ['cross'],
    'jump',
  ],
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
    'Направляй стик к партнёру и принимай треугольником. Ошибка обнулит серию.',
    ['stick', 'triangle'],
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
  const [title, hint, controls, motion] =
    COACH_STEPS[objective.exchange ? 'exchange' : objective.id];
  return { title, hint, controls, motion };
}

const faceButtons = [
  ['triangle', 186, 57, '<path d="M0 -6 L-6 5 H6 Z"/>'],
  ['square', 164, 80, '<rect x="-5" y="-5" width="10" height="10"/>'],
  ['circle', 208, 80, '<circle r="5.5"/>'],
  ['cross', 186, 103, '<path d="M-5 -5 L5 5 M5 -5 L-5 5"/>'],
];
export function controllerGraphic(coach) {
  const active = new Set(coach.controls);
  return `<svg class="coach-controller ${coach.sequence ? 'is-sequence' : ''}" viewBox="0 0 260 160" role="img" aria-label="${coach.title}">
    <path class="pad-body" d="M67 40 Q40 30 29 56 L12 125 Q8 148 30 146 L68 119 H192 L229 146 Q252 149 247 125 L230 56 Q218 31 193 40 Z"/>
    ${[
      ['l2', 57, 16],
      ['r2', 189, 16],
      ['l1', 57, 34],
      ['r1', 189, 34],
    ]
      .map(
        ([id, x, y]) =>
          `<g class="pad-button ${active.has(id) ? 'is-taught' : ''}" data-control="${id}" transform="translate(${x} ${y})"><rect x="-20" y="-9" width="40" height="18" rx="6"/><text y="4">${id.toUpperCase()}</text></g>`,
      )
      .join('')}
    <path class="pad-dpad" d="M52 52 H63 V65 H76 V76 H63 V89 H52 V76 H39 V65 H52 Z"/>
    <g class="pad-stick ${active.has('stick') ? 'is-taught' : ''}" data-control="stick">
      <circle class="stick-ring" cx="88" cy="105" r="24"/>
      <g class="stick-thumb"><circle cx="88" cy="105" r="15"/><circle cx="88" cy="105" r="10"/><text x="88" y="109">L</text></g>
    </g>
    <circle class="pad-idle-stick" cx="146" cy="110" r="14"/>
    ${faceButtons.map(([id, x, y, glyph]) => `<g class="pad-button pad-${id} ${active.has(id) ? 'is-taught' : ''}" style="--press-delay:${Math.max(0, coach.controls.indexOf(id)) * 0.75}s" data-control="${id}" transform="translate(${x} ${y})"><circle class="pad-button-base" r="15"/><g class="pad-glyph">${glyph}</g></g>`).join('')}
    <path class="pad-touch" d="M99 46 H160 V73 H99 Z"/>
  </svg>`;
}

export function resultGraphic(coach) {
  const { motion } = coach;
  const moving = ['walk', 'switch', 'crouch', 'jump'].includes(motion);
  const diving = motion.startsWith('dive');
  const path =
    motion === 'rally'
      ? 'M45 100 Q130 -5 220 100 Q130 -5 45 100'
      : motion === 'serve'
        ? 'M45 98 Q45 4 65 58 Q135 10 224 111'
        : motion === 'block'
          ? 'M225 55 Q151 17 131 48 Q164 66 224 109'
          : motion === 'attack' || motion === 'tip'
            ? 'M42 106 Q87 4 132 45 L225 112'
            : diving
              ? 'M210 40 Q156 51 119 110'
              : motion === 'high'
                ? 'M45 103 Q126 -30 220 100'
                : 'M45 103 Q126 20 220 100';
  const upper = ['high', 'rally', 'attack'].includes(motion);
  return `<svg class="coach-result" viewBox="0 0 260 156" role="img" aria-label="Ожидаемый результат: ${coach.title}">
    <path class="demo-floor" d="M18 125 H242"/>
    ${['serve', 'attack', 'block', 'tip'].includes(motion) ? '<path class="demo-net" d="M145 125 V45 M145 50 H158 M155 50 V125"/>' : ''}
    <g class="demo-player ${motion === 'jump' ? 'demo-jumping' : ''} ${motion === 'walk' ? 'demo-walking' : ''} ${motion === 'crouch' ? 'demo-crouching' : ''} ${diving ? 'demo-diving' : ''}" transform="translate(46 110)">
      <rect class="demo-head" x="-8" y="-37" width="16" height="16" rx="1"/><path class="demo-eyes" d="M-4 -30 h2 M3 -30 h2"/>
      <path class="demo-body" d="M-7 -20 H7 V-3 H-7 Z"/>
      <path class="demo-limbs" d="M-4 -3 L-9 14 M4 -3 L9 14 ${upper ? 'M-6 -17 L-9 -35 M6 -17 L9 -35' : 'M-6 -17 L-13 -10 M6 -17 L18 -12'}"/>
    </g>
    ${motion === 'block' ? '<path class="demo-blocker" d="M130 100 V75 M130 80 L122 43 M130 80 L138 43 M130 100 L120 120 M130 100 L140 120"/><rect class="demo-head" x="122" y="58" width="16" height="16"/>' : ''}
    ${motion === 'rally' ? '<g transform="translate(218 110)"><rect class="demo-head" x="-8" y="-37" width="16" height="16"/><path class="demo-body" d="M-7 -20 H7 V-3 H-7 Z"/><path class="demo-limbs" d="M-4 -3 L-9 14 M4 -3 L9 14 M-6 -17 L-9 -35 M6 -17 L9 -35"/></g>' : ''}
    ${!moving ? `<path class="demo-trajectory" d="${path}"/><circle class="demo-ball" r="6"><animateMotion dur="${motion === 'rally' ? '5' : '3.2'}s" repeatCount="indefinite" path="${path}"/></circle>` : ''}
    ${motion === 'serve' ? '<circle class="demo-serve-ring" cx="65" cy="58" r="22"><animate attributeName="r" values="24;24;7;24" keyTimes="0;0.3;0.62;1" dur="3.2s" repeatCount="indefinite"/></circle>' : ''}
    ${!moving && motion !== 'rally' ? '<rect class="demo-target" x="200" y="93" width="33" height="32" rx="5"/>' : ''}
    <text class="demo-caption" x="130" y="150">${moving ? 'Повтори выбранным игроком' : motion === 'rally' ? '△ → партнёру → △ обратно' : motion === 'serve' ? 'Заряд → подброс → удар' : motion === 'block' ? 'Встреть мяч над сеткой' : 'Направь мяч в цель'}</text>
  </svg>`;
}
