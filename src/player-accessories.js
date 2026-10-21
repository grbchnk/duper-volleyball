// Shared cosmetic catalogue: the editor, import validation and sprites use the same IDs.
export const SHOE_STYLES = {
  classic: 'Кеды',
  sport: 'Кроссовки',
  high: 'Высокие кеды',
  runner: 'Беговые',
  boots: 'Ботинки',
  sandals: 'Сандалии',
  neon: 'Неоновая подошва',
};
export const ACCESSORY_COLORS = [
  ['#fff6e1', 'Сливочный'],
  ['#364755', 'Графит'],
  ['#ee967d', 'Коралловый'],
  ['#80bda8', 'Мятный'],
  ['#8bb6cd', 'Голубой'],
  ['#b0a2cb', 'Лавандовый'],
  ['#e5bd62', 'Золотой'],
  ['#dba6bd', 'Розовый'],
];

// Each seven-by-seven glyph is drawn as integer pixels on the jersey front.
export const JERSEY_PRINTS = {
  none: { name: 'Без рисунка', pixels: [] },
  number1: {
    name: 'Номер 1',
    pixels: ['0001000', '0011000', '0101000', '0001000', '0001000', '0001000', '0111110'],
  },
  number2: {
    name: 'Номер 2',
    pixels: ['0111100', '1000010', '0000010', '0001100', '0010000', '0100000', '1111110'],
  },
  number3: {
    name: 'Номер 3',
    pixels: ['1111100', '0000010', '0000010', '0111100', '0000010', '0000010', '1111100'],
  },
  star: {
    name: 'Звезда',
    pixels: ['0001000', '0001000', '1111111', '0111110', '0011100', '0110110', '1100011'],
  },
  bolt: {
    name: 'Молния',
    pixels: ['0001100', '0011000', '0110000', '1111110', '0001100', '0011000', '0110000'],
  },
  heart: {
    name: 'Сердце',
    pixels: ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000', '0000000'],
  },
  ball: {
    name: 'Мяч',
    pixels: ['0011100', '0101010', '1001001', '1111111', '1001001', '0101010', '0011100'],
  },
  crown: {
    name: 'Корона',
    pixels: ['1001001', '1101011', '1111111', '0111110', '0111110', '0000000', '0111110'],
  },
  skull: {
    name: 'Череп',
    pixels: ['0111110', '1111111', '1001001', '1001001', '1111111', '0111110', '0101010'],
  },
  flower: {
    name: 'Цветок',
    pixels: ['0011100', '0011100', '1101011', '1110111', '1101011', '0011100', '0011100'],
  },
  alien: {
    name: 'Пришелец',
    pixels: ['0011100', '0111110', '1101011', '1101011', '0111110', '0011100', '0001000'],
  },
  waves: {
    name: 'Волны',
    pixels: ['0000000', '0110011', '1001100', '0000000', '0110011', '1001100', '0000000'],
  },
  checker: {
    name: 'Клетка',
    pixels: ['1100110', '1100110', '0011001', '0011001', '1100110', '1100110', '0011001'],
  },
  rocket: {
    name: 'Ракета',
    pixels: ['0001000', '0011100', '0010100', '0011100', '0111110', '1011101', '0001000'],
  },
  cat: {
    name: 'Котик',
    pixels: ['1100011', '1110111', '1111111', '1011101', '1110111', '0111110', '0011100'],
  },
};

export function paintJerseyPrint(r, print = 'none', color = '#fff6e1', y = 0) {
  const glyph = JERSEY_PRINTS[print] || JERSEY_PRINTS.none;
  glyph.pixels.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++)
      if (row[dx] === '1') r(dx - 3, dy - 19 + y, 1, 1, color);
  });
}

export function paintShoe(r, x, y, appearance, ink, team) {
  const style = appearance?.shoes || 'classic',
    color = appearance?.shoeColor || '#fff6e1';
  r(x - 1, -2 + y, 6, 3, ink);
  r(x - 1, -2 + y, 5, 2, color);
  if (style === 'sport') {
    r(x, -3 + y, 3, 1, color);
    r(x + 1, -2 + y, 2, 1, team.dark);
    r(x - 1, y, 6, 1, '#fff6e1');
  } else if (style === 'high') {
    r(x - 1, -5 + y, 4, 4, ink);
    r(x, -5 + y, 3, 4, color);
    r(x + 1, -4 + y, 1, 3, '#fff6e1');
    r(x - 1, y, 6, 1, '#fff6e1');
  } else if (style === 'runner') {
    r(x - 1, -3 + y, 4, 2, color);
    r(x + 3, -1 + y, 3, 2, color);
    r(x, -2 + y, 3, 1, team.dark);
    r(x - 1, y, 7, 1, '#fff6e1');
  } else if (style === 'boots') {
    r(x - 1, -6 + y, 5, 6, ink);
    r(x, -5 + y, 3, 4, color);
    r(x + 1, -4 + y, 1, 1, '#e5bd62');
    r(x + 1, -2 + y, 1, 1, '#e5bd62');
  } else if (style === 'sandals') {
    r(x - 1, -2 + y, 5, 2, appearance?.tone || '#f4cfac');
    r(x, -2 + y, 1, 2, color);
    r(x + 3, -2 + y, 1, 2, color);
    r(x - 1, y, 6, 1, color);
  } else if (style === 'neon') {
    r(x, -3 + y, 3, 1, ink);
    r(x - 1, -2 + y, 5, 2, '#364755');
    r(x - 1, y, 6, 1, color);
    r(x + 3, -2 + y, 1, 1, color);
  }
}
