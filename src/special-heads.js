export const SPECIAL_HEADS = { bear: 'Медведь', pumpkin: 'Тыква', rabbit: 'Заяц', robot: 'Робот' };
// Complete heads replace the human face, in the existing integer sprite grid.
export function paintSpecialHead(r, head, hair, ink, blink = false) {
  if (!SPECIAL_HEADS[head]) return false;
  if (head === 'bear') {
    r(-10, -41, 6, 8, ink);
    r(5, -41, 6, 8, ink);
    r(-9, -40, 4, 5, hair);
    r(6, -40, 4, 5, hair);
    r(-9, -36, 19, 15, ink);
    r(-8, -35, 17, 13, hair);
    r(-7, -39, 2, 3, '#d5ac88');
    r(7, -39, 2, 3, '#d5ac88');
    r(-4, -27, 9, 5, '#edc99d');
    r(-1, -27, 3, 2, ink);
    r(0, -24, 1, 2, ink);
  } else if (head === 'pumpkin') {
    r(-1, -43, 3, 8, '#536f54');
    r(1, -42, 4, 2, '#87a26e');
    r(-7, -37, 15, 16, '#84563c');
    r(-10, -34, 21, 10, '#84563c');
    r(-6, -36, 13, 14, '#e5a060');
    r(-9, -33, 19, 8, '#e5a060');
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
    r(-8, -36, 17, 15, ink);
    r(-7, -35, 15, 13, '#f1e4d9');
    r(-1, -26, 3, 2, '#c68591');
    r(0, -24, 1, 2, ink);
    r(-6, -25, 3, 1, '#b4a4a2');
    r(4, -25, 3, 1, '#b4a4a2');
  } else {
    r(0, -44, 1, 8, ink);
    r(-1, -45, 3, 3, '#e5a4a0');
    r(-8, -37, 17, 16, ink);
    r(-7, -36, 15, 14, '#a3b9bc');
    r(-6, -35, 12, 2, '#dbe9df');
    r(-10, -32, 2, 7, ink);
    r(9, -32, 2, 7, ink);
    r(-5, -31, 11, 6, '#dbe9df');
    r(-3, -24, 7, 2, ink);
    r(-1, -24, 1, 2, '#dbe9df');
    r(2, -24, 1, 2, '#dbe9df');
  }
  r(-3, -29, 2, blink ? 1 : 3, ink);
  r(3, -29, 2, blink ? 1 : 3, ink);
  return true;
}
