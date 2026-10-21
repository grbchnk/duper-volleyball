// Curated club identities and uniforms. Appearance never changes match physics.
export const UNIFORM_COLORS = [
  ['#ee967d', 'Персик'],
  ['#80bda8', 'Мята'],
  ['#ddc173', 'Ваниль'],
  ['#b0a2cb', 'Лаванда'],
  ['#8bb6cd', 'Небо'],
  ['#dba6bd', 'Роза'],
  ['#a7b98a', 'Шалфей'],
  ['#d5ac88', 'Песок'],
  ['#94bfc2', 'Лагуна'],
  ['#a6accb', 'Барвинок'],
];
export const HAIR_COLORS = [
  ['#302b32', 'Тёмный'],
  ['#654537', 'Каштан'],
  ['#a76a3e', 'Медь'],
  ['#d7b46a', 'Мёд'],
  ['#843f38', 'Вишня'],
  ['#a884aa', 'Сирень'],
  ['#729a9c', 'Бирюза'],
];
export const FEMALE_HEADS = ['ponytail', 'bun', 'bob', 'longhair', 'braids', 'doublebun'];
const player = (head, body = 'classic', tone = '#f4cfac', hair = '#302b32') =>
  Object.freeze({ headShape: 'square', head, body, tone, hair });
// Hand-picked footwear complements each club, including CPU opponents.
const CLUB_SHOES = {
  peach: [
    ['classic', '#ee967d'],
    ['high', '#fff6e1'],
    ['sport', '#364755'],
  ],
  mint: [
    ['sandals', '#80bda8'],
    ['sandals', '#fff6e1'],
    ['sport', '#8bb6cd'],
  ],
  lemon: [
    ['runner', '#e5bd62'],
    ['sport', '#fff6e1'],
    ['runner', '#ee967d'],
  ],
  lilac: [
    ['high', '#b0a2cb'],
    ['neon', '#b0a2cb'],
    ['high', '#364755'],
  ],
  sakura: [
    ['sport', '#dba6bd'],
    ['runner', '#fff6e1'],
    ['high', '#b0a2cb'],
  ],
  nigeria: [
    ['runner', '#80bda8'],
    ['sport', '#364755'],
    ['runner', '#e5bd62'],
  ],
  bears: [
    ['boots', '#e5bd62'],
    ['boots', '#364755'],
    ['high', '#ee967d'],
  ],
  pumpkins: [
    ['boots', '#364755'],
    ['high', '#ee967d'],
    ['neon', '#e5bd62'],
  ],
  rabbits: [
    ['runner', '#fff6e1'],
    ['sport', '#8bb6cd'],
    ['high', '#fff6e1'],
  ],
  robots: [
    ['neon', '#8bb6cd'],
    ['neon', '#b0a2cb'],
    ['boots', '#364755'],
  ],
};
const club = (id, name, short, color, description, roster, extra = {}) =>
  Object.freeze({
    id,
    name,
    short,
    color,
    description,
    roster: Object.freeze(
      roster.map((p, i) => {
        const [shoes, shoeColor] = CLUB_SHOES[id][i];
        return Object.freeze({ ...p, shoes, shoeColor });
      }),
    ),
    ...uniformPalette(color),
    ...extra,
  });
export function uniformPalette(color) {
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const tint = (amount, white = 0) =>
    '#' +
    rgb
      .map((v) =>
        Math.round(v * amount + white)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return { color, dark: tint(0.65), light: tint(0.55, 115) };
}
export const TEAMS = Object.freeze([
  club('peach', 'План Б', 'PLAN B', '#ee967d', 'Городская команда · короткие стрижки', [
    player('crop'),
    player('sidepart', 'stripes', '#edba91', '#654537'),
    player('quiff', 'classic', '#d79b70', '#a76a3e'),
  ]),
  club('mint', 'Без паники', 'CALM', '#80bda8', 'Пляжный клуб · козырьки и панамы', [
    player('cap', 'sleeveless'),
    player('visor', 'sleeveless', '#edba91'),
    player('bucket', 'sleeveless', '#d79b70'),
  ]),
  club('lemon', 'Третий лишний', '3RD', '#ddc173', 'Солнечная команда · повязки и светлые волосы', [
    player('band', 'stripes', '#edba91', '#d7b46a'),
    player('buzz', 'stripes', '#f4cfac', '#d7b46a'),
    player('spikes', 'stripes', '#d79b70', '#a76a3e'),
  ]),
  club('lilac', 'По расписанию', 'ONTIME', '#b0a2cb', 'Уличный клуб · бини и наушники', [
    player('beanie', 'longsleeve'),
    player('headphones', 'longsleeve', '#d79b70'),
    player('backwardcap', 'longsleeve', '#edba91'),
  ]),
  club(
    'sakura',
    'Сакура',
    'SAKURA',
    '#dba6bd',
    'Женская команда · хвост, пучок и двойные пучки',
    [
      player('ponytail', 'sleeveless', '#f4cfac', '#654537'),
      player('bun', 'sleeveless', '#d79b70'),
      player('doublebun', 'sleeveless', '#edba91', '#843f38'),
    ],
    { women: true },
  ),
  club(
    'nigeria',
    'Нигерия · Лагос',
    'LAGOS',
    '#a7b98a',
    'Нигерия · афро, косички и дреды',
    [
      player('afro', 'chevron', '#633f30'),
      player('braids', 'chevron', '#925b3d'),
      player('dreads', 'chevron', '#633f30'),
    ],
    { country: 'Нигерия', flag: 'ng' },
  ),
  club('bears', 'Лесные мишки', 'BEARS', '#d5ac88', 'Три медведя · тёплые оттенки шерсти', [
    player('bear', 'longsleeve', '#f4cfac', '#654537'),
    player('bear', 'stripes', '#edba91', '#a76a3e'),
    player('bear', 'classic', '#d79b70', '#d7b46a'),
  ]),
  club('pumpkins', 'Тыквенный клуб', 'PUMPKIN', '#94bfc2', 'Тыквенные головы · полосатая форма', [
    player('pumpkin', 'stripes'),
    player('pumpkin', 'chevron', '#edba91'),
    player('pumpkin', 'sleeveless', '#d79b70'),
  ]),
  club('rabbits', 'Лунные зайцы', 'MOON', '#8bb6cd', 'Заячьи головы · светлая форма', [
    player('rabbit', 'sleeveless'),
    player('rabbit', 'stripes', '#edba91'),
    player('rabbit', 'classic', '#d79b70'),
  ]),
  club('robots', 'Орбита', 'ORBIT', '#a6accb', 'Роботы · металлические головы и антенны', [
    player('robot', 'chevron'),
    player('robot', 'stripes', '#edba91'),
    player('robot', 'longsleeve', '#d79b70'),
  ]),
]);

export function configuredTeam(config, team = 0) {
  const preset = TEAMS.find((t) => t.id === config[team ? 'awayTeam' : 'homeTeam']) || TEAMS[team];
  return { ...preset, ...uniformPalette(config[team ? 'awayColor' : 'homeColor'] || preset.color) };
}
