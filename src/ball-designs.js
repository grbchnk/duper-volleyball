// Cosmetic catalogue shared by settings validation and both rendering modes.
export const BALL_DESIGNS = {
  classic: { name: 'Волейбольные панели', colors: ['#fff6df', '#e5ae43'] },
  ocean: { name: 'Диагональные полосы', colors: ['#ecf9ff', '#2987be'] },
  neon: { name: 'Звезда', colors: ['#dcfa83', '#7445ac'] },
  mono: { name: 'Шахматный', colors: ['#ffffff', '#293f4c'] },
  plain: { name: 'Без рисунка', colors: ['#fff3d1', '#fff3d1'] },
  sunset: { name: 'Закат · три цвета', colors: ['#ffe3a0', '#e37665', '#a76996'] },
  sakura: { name: 'Сакура · лепестки', colors: ['#fff0ef', '#d980a7', '#8e5886'] },
  circuit: { name: 'Кибер · микросхема', colors: ['#253b50', '#82e6c5', '#e9be6b'] },
  watermelon: { name: 'Арбуз', colors: ['#e99196', '#344e49', '#86bb7a'] },
  orbit: { name: 'Орбита · кольца', colors: ['#323d69', '#e8c16c', '#a4cae3'] },
  beach: { name: 'Пляжный · сектора', colors: ['#fff0c4', '#62bfc2', '#ed9b76'] },
  tiger: { name: 'Тигр · полосы', colors: ['#edb35e', '#47394a', '#fff1c5'] },
  confetti: { name: 'Конфетти', colors: ['#fff0da', '#af79ba', '#64b7ab'] },
};

export function ballPattern(skin, x, y) {
  const r = Math.hypot(x, y),
    a = Math.atan2(y, x);
  switch (skin) {
    case 'sunset':
      return y < -3 ? 0 : y < 3 ? 1 : 2;
    case 'sakura':
      return r < 2 ? 2 : r < 5 + 2 * Math.cos(5 * a) ? 1 : 0;
    case 'circuit':
      return (x + 12) % 6 < 1 || (y + 12) % 6 < 1 ? 1 : (x + y + 24) % 11 < 2 ? 2 : 0;
    case 'watermelon':
      return r > 7 ? 2 : Math.abs(x * 3 + y * 5) % 17 < 2 && r < 6 ? 1 : 0;
    case 'orbit':
      return Math.abs(y + x * 0.45) < 2 ? 1 : r < 4 ? 2 : 0;
    case 'beach':
      return Math.floor(((a + Math.PI) * 3) / Math.PI) % 3;
    case 'tiger':
      return Math.sin(x * 0.9 + Math.sin(y * 0.45) * 1.8) > 0.35 ? 1 : y > 6 ? 2 : 0;
    case 'confetti':
      return (Math.floor((x + 12) / 3) * 7 + Math.floor((y + 12) / 3) * 11) % 5 < 2
        ? x > y
          ? 1
          : 2
        : 0;
    default:
      return 0;
  }
}
