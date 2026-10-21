export const SQUARE_HEAD_DESIGNS = {
  cat: { name: 'Квадрокот', color: '#d5ac88', light: '#f4dec3' },
  panda: { name: 'Панда', color: '#efeadd', light: '#b4bec0' },
  frog: { name: 'Лягушка', color: '#87b77a', light: '#c9dd91' },
  owl: { name: 'Сова', color: '#a67b60', light: '#e8c89a' },
  tiger: { name: 'Тигр', color: '#e8a35d', light: '#ffe0a5' },
  penguin: { name: 'Пингвин', color: '#536977', light: '#edf0df' },
  alien: { name: 'Пришелец', color: '#a3c5a0', light: '#d6e5b8' },
  skeleton: { name: 'Скелет', color: '#e7ddc1', light: '#fff6df' },
  lizard: { name: 'Ящер', color: '#6faeaa', light: '#a9d2b4' },
  yeti: { name: 'Йети', color: '#dcecf0', light: '#a3c9d5' },
};
export const SPECIAL_HEADS = {
  bear: 'Медведь',
  pumpkin: 'Тыква',
  rabbit: 'Заяц',
  robot: 'Робот',
  ...Object.fromEntries(Object.entries(SQUARE_HEAD_DESIGNS).map(([id, d]) => [id, d.name])),
};

function paintSquareCharacter(r, head, ink) {
  const { color, light } = SQUARE_HEAD_DESIGNS[head];
  // All ten silhouettes share the same 15×15 square as the human face.
  r(-7, -36, 15, 15, ink);
  r(-6, -35, 13, 13, color);
  r(-5, -35, 11, 1, light);
  if (head === 'cat') {
    r(-6, -35, 4, 4, ink);
    r(3, -35, 4, 4, ink);
    r(-5, -34, 2, 2, '#dba6bd');
    r(4, -34, 2, 2, '#dba6bd');
    r(-3, -26, 7, 4, light);
    r(0, -26, 1, 2, '#bf7e82');
    r(-6, -25, 3, 1, ink);
    r(4, -25, 3, 1, ink);
  } else if (head === 'panda') {
    r(-6, -35, 4, 3, ink);
    r(3, -35, 4, 3, ink);
    r(-5, -31, 5, 6, '#879393');
    r(1, -31, 5, 6, '#879393');
    r(-1, -25, 3, 2, ink);
    r(0, -23, 1, 1, ink);
  } else if (head === 'frog') {
    r(-6, -33, 5, 7, light);
    r(2, -33, 5, 7, light);
    r(-5, -24, 11, 1, ink);
    r(-6, -25, 1, 1, ink);
    r(6, -25, 1, 1, ink);
    r(-6, -27, 2, 1, '#d5ac88');
    r(5, -27, 2, 1, '#d5ac88');
  } else if (head === 'owl') {
    r(-5, -32, 6, 7, light);
    r(0, -32, 6, 7, light);
    r(0, -27, 1, 4, '#edbd62');
    r(-1, -27, 3, 2, '#edbd62');
    r(-6, -35, 3, 2, ink);
    r(4, -35, 3, 2, ink);
    r(-4, -23, 2, 1, light);
    r(3, -23, 2, 1, light);
  } else if (head === 'tiger') {
    r(-6, -34, 3, 2, ink);
    r(4, -34, 3, 2, ink);
    r(-1, -35, 3, 4, ink);
    r(-6, -28, 2, 1, ink);
    r(5, -28, 2, 1, ink);
    r(-6, -25, 2, 1, ink);
    r(5, -25, 2, 1, ink);
    r(-3, -25, 7, 3, light);
    r(-1, -26, 3, 2, ink);
    r(0, -24, 1, 2, ink);
  } else if (head === 'penguin') {
    r(-4, -33, 9, 11, light);
    r(-5, -31, 11, 7, light);
    r(-1, -26, 3, 3, '#e5bd62');
    r(-2, -25, 5, 1, '#e5bd62');
    r(-6, -35, 3, 2, '#364755');
    r(4, -35, 3, 2, '#364755');
  } else if (head === 'alien') {
    r(-5, -34, 11, 4, light);
    r(-5, -30, 5, 5, '#729a83');
    r(1, -30, 5, 5, '#729a83');
    r(-2, -23, 5, 1, ink);
    r(-1, -33, 3, 1, '#edf0c4');
  } else if (head === 'skeleton') {
    r(-5, -33, 11, 2, light);
    r(-5, -31, 5, 6, '#b4a88f');
    r(1, -31, 5, 6, '#b4a88f');
    r(0, -26, 1, 2, ink);
    r(-4, -24, 9, 2, ink);
    for (const x of [-3, -1, 1, 3]) r(x, -24, 1, 2, light);
  } else if (head === 'lizard') {
    for (const x of [-4, 0, 4]) r(x, -34, 2, 2, light);
    r(-6, -31, 2, 6, '#528d8c');
    r(5, -31, 2, 6, '#528d8c');
    r(-4, -24, 9, 1, ink);
    r(1, -23, 2, 1, '#e49aa4');
  } else if (head === 'yeti') {
    r(-5, -32, 11, 8, light);
    r(-6, -34, 2, 2, '#fff6e1');
    r(5, -34, 2, 2, '#fff6e1');
    r(-3, -24, 7, 2, ink);
    r(-2, -24, 1, 1, '#fff6e1');
    r(3, -24, 1, 1, '#fff6e1');
    r(-6, -23, 2, 1, light);
    r(5, -23, 2, 1, light);
  }
}
// Complete heads replace the human face, in the existing integer sprite grid.
export function paintSpecialHead(r, head, hair, ink, blink = false) {
  if (!SPECIAL_HEADS[head]) return false;
  if (Object.hasOwn(SQUARE_HEAD_DESIGNS, head)) {
    paintSquareCharacter(r, head, ink);
  } else if (head === 'bear') {
    r(-7, -40, 4, 4, ink);
    r(4, -40, 4, 4, ink);
    r(-6, -39, 2, 2, hair);
    r(5, -39, 2, 2, hair);
    r(-7, -36, 15, 15, ink);
    r(-6, -35, 13, 13, hair);
    r(-6, -39, 2, 2, '#d5ac88');
    r(5, -39, 2, 2, '#d5ac88');
    r(-4, -27, 9, 5, '#edc99d');
    r(-1, -27, 3, 2, ink);
    r(0, -24, 1, 2, ink);
  } else if (head === 'pumpkin') {
    r(-1, -43, 3, 8, '#536f54');
    r(1, -42, 4, 2, '#87a26e');
    r(-7, -36, 15, 15, ink);
    r(-6, -35, 13, 13, '#e5a060');
    r(-6, -34, 2, 10, '#cd824c');
    r(5, -34, 2, 10, '#cd824c');
    r(0, -35, 1, 8, '#efb56c');
    r(-4, -24, 9, 2, ink);
    r(-2, -25, 2, 2, ink);
    r(3, -25, 2, 2, ink);
  } else if (head === 'rabbit') {
    r(-7, -47, 5, 13, ink);
    r(3, -47, 5, 13, ink);
    r(-6, -46, 3, 11, '#f1e4d9');
    r(4, -46, 3, 11, '#f1e4d9');
    r(-5, -44, 1, 7, '#dba6bd');
    r(5, -44, 1, 7, '#dba6bd');
    r(-7, -36, 15, 15, ink);
    r(-6, -35, 13, 13, '#f1e4d9');
    r(-1, -26, 3, 2, '#c68591');
    r(0, -24, 1, 2, ink);
    r(-6, -25, 3, 1, '#b4a4a2');
    r(4, -25, 3, 1, '#b4a4a2');
  } else {
    r(0, -44, 1, 8, ink);
    r(-1, -45, 3, 3, '#e5a4a0');
    r(-7, -36, 15, 15, ink);
    r(-6, -35, 13, 13, '#a3b9bc');
    r(-5, -34, 11, 2, '#dbe9df');
    r(-7, -32, 2, 7, ink);
    r(6, -32, 2, 7, ink);
    r(-5, -31, 11, 6, '#dbe9df');
    r(-3, -24, 7, 2, ink);
    r(-1, -24, 1, 2, '#dbe9df');
    r(2, -24, 1, 2, '#dbe9df');
  }
  r(-3, -29, 2, blink ? 1 : 3, ink);
  r(3, -29, 2, blink ? 1 : 3, ink);
  return true;
}
