import { pixelTools } from './street-scene.js';

export const ZONES = {
  beach: {
    name: 'Пляж · закат',
    subtitle: 'Океан, ар-деко, пальмы и спасательная вышка',
    court: '#eac291',
    edge: '#dcb287',
    floor: '#dfb786',
  },
  gym: {
    name: 'Школьный спортзал',
    subtitle: 'Солнечный паркет, шведские стенки и трибуны',
    court: '#dfa875',
    edge: '#bd805e',
    floor: '#c99169',
  },
  farm: {
    name: 'Деревня',
    subtitle: 'Амбар, пшеничное поле, трактор и подсолнухи',
    court: '#b99b77',
    edge: '#ab8b6d',
    floor: '#b89b7b',
  },
  alpine: {
    name: 'Альпийский кубок',
    subtitle: 'Снежные вершины, шале и канатная дорога',
    court: '#c98d86',
    edge: '#b67d84',
    floor: '#e3e9ed',
  },
  sky: {
    name: 'Небесная арена',
    subtitle: 'Парящие храмы, водопады и розовые облака',
    court: '#b87787',
    edge: '#855f86',
    floor: '#ac9bbc',
  },
  championship: {
    name: 'Чемпионский стадион',
    subtitle: 'Большой кубок, прожекторы и полные трибуны',
    court: '#d29086',
    edge: '#b8767b',
    floor: '#4e9299',
  },
};
export const isZone = (theme) => Object.hasOwn(ZONES, theme);
const noise = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function tools(c) {
  const t = pixelTools(c);
  const poly = (points, color) => {
    const min = Math.ceil(Math.min(...points.map((p) => p[1]))),
      max = Math.floor(Math.max(...points.map((p) => p[1])));
    for (let y = min; y <= max; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
          xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2)
        t.rect(Math.ceil(xs[i]), y, Math.floor(xs[i + 1]) - Math.ceil(xs[i]) + 1, 1, color);
    }
  };
  return { ...t, poly };
}
function sky(c, top, bottom, h = 355) {
  const { rect: r } = tools(c);
  for (let y = 0; y < h; y += 3) {
    const color =
      '#' +
      [1, 3, 5]
        .map((i) =>
          Math.round(
            parseInt(top.slice(i, i + 2), 16) * (1 - y / h) +
              (parseInt(bottom.slice(i, i + 2), 16) * y) / h,
          )
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    r(0, y, 960, 3, color);
  }
}
function cloud(c, x, y, w, color = '#ffe1bb') {
  const { rect: r } = tools(c);
  // Clustered stepped lobes, a warm rim and broken undersides, rather than one repeated stair.
  const seed = Math.floor(w * 7);
  for (let j = 0; j < 9; j++) {
    const xx = x + (j * w) / 11;
    const ww = w * (0.18 + noise(j + seed) * 0.2);
    const h = (8 + Math.sin((j / 8) * Math.PI) * 13) * Math.min(1.8, w / 75);
    r(xx, y - h, ww, h, color);
    r(xx + 3, y - h - 3, ww - 7, 3, color);
    r(xx + 4, y - h, Math.max(2, ww - 8), 2, '#fff0cc24');
  }
  r(x + w * 0.08, y, w * 0.85, 3, color);
  r(x + w * 0.2, y + 3, w * 0.6, 2, color);
  r(x + w * 0.18, y - 1, w * 0.6, 3, '#9f74991c');
}
function text(c, str, x, y, size, color, align = 'center') {
  c.fillStyle = color;
  c.font = `bold ${size}px monospace`;
  c.textAlign = align;
  c.fillText(str, Math.round(x), Math.round(y));
}
function windows(c, x, y, cols, rows, dx = 21, dy = 27) {
  const { rect: r } = tools(c);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      r(x + col * dx - 2, y + row * dy - 2, 13, 18, '#b18d92');
      r(x + col * dx, y + row * dy, 9, 14, '#628a9b');
      r(x + col * dx + 1, y + row * dy, 3, 13, '#abc5bd');
      r(x + col * dx - 3, y + row * dy + 15, 15, 3, '#ffe0ad');
    }
}
function palm(c, x, y, s = 1) {
  const { line, poly } = tools(c);
  const top = [x + 12 * s, y - 150 * s];
  line(x, y, top[0] - 7 * s, top[1] + 25 * s, '#665650', 11 * s);
  line(top[0] - 7 * s, top[1] + 25 * s, ...top, '#665650', 9 * s);
  line(x - 3 * s, y, top[0] - 10 * s, top[1] + 25 * s, '#a47b59', 3 * s);
  for (let n = 0; n < 15; n++) {
    const ty = y - n * 9 * s;
    line(x + (y - ty) / 13 - 4 * s, ty, x + (y - ty) / 13 + 4 * s, ty - 2 * s, '#514f4d', 2 * s);
  }
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i * Math.PI) / 5,
      dx = Math.cos(a) * 73 * s,
      dy = Math.sin(a) * 36 * s;
    const tip = [top[0] + dx, top[1] + dy + 20 * s];
    poly(
      [
        top,
        [top[0] + dx * 0.6, top[1] + dy - 9 * s],
        tip,
        [top[0] + dx * 0.7, top[1] + dy + 12 * s],
      ],
      i % 2 ? '#4b7560' : '#3c665b',
    );
    for (let k = 2; k < 9; k++) {
      const t = k / 10;
      line(
        top[0] + dx * t,
        top[1] + dy * t,
        top[0] + dx * t - 7 * s,
        top[1] + dy * t + 15 * s,
        '#65865e',
        3 * s,
      );
    }
  }
}
function pine(c, x, y, s = 1, snow = false) {
  const { rect: r, poly } = tools(c);
  r(x - 3 * s, y - 75 * s, 6 * s, 75 * s, '#67656b');
  for (let i = 0; i < 4; i++) {
    const yy = y - 118 * s + i * 23 * s,
      w = 13 * s + i * 8 * s;
    poly(
      [
        [x, yy],
        [x - w, yy + 39 * s],
        [x + w, yy + 39 * s],
      ],
      i % 2 ? '#4e6c76' : '#3c5e6d',
    );
    if (snow)
      poly(
        [
          [x, yy],
          [x - w * 0.7, yy + 29 * s],
          [x + 3 * s, yy + 22 * s],
          [x + w * 0.8, yy + 32 * s],
        ],
        '#dce5ed',
      );
  }
}
function fence(c, x, y, w, color = '#69594c', snow = false) {
  const { rect: r } = tools(c);
  for (const yy of [y + 9, y + 25]) {
    r(x, yy, w, 5, color);
    r(x, yy, w, 1, '#ab8e6b');
  }
  for (let xx = x; xx < x + w; xx += 39) {
    r(xx, y, 7, 49, color);
    r(xx + 1, y, 2, 47, '#92745a');
    if (snow) r(xx - 2, y - 3, 11, 5, '#f6ecea');
  }
}
function sunflower(c, x, y, s = 1) {
  const { line, disc, poly } = tools(c);
  line(x, y, x + 2 * s, y - 32 * s, '#6b8152', 3 * s);
  poly(
    [
      [x, y - 12 * s],
      [x - 11 * s, y - 21 * s],
      [x - 10 * s, y - 13 * s],
      [x, y - 8 * s],
    ],
    '#7e9159',
  );
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    disc(
      x + Math.cos(a) * 8 * s,
      y - 36 * s + Math.sin(a) * 8 * s,
      4 * s,
      k % 2 ? '#e1b84e' : '#f0cb63',
    );
  }
  disc(x, y - 36 * s, 6 * s, '#69553e');
  disc(x - 1 * s, y - 37 * s, 3 * s, '#8c6b3b');
}
function bench(c, x, y, w = 190) {
  const { rect: r } = tools(c);
  r(x, y, w, 7, '#8f6e53');
  r(x, y + 8, w, 3, '#5e5b54');
  for (const dx of [8, w - 13]) {
    r(x + dx, y + 9, 5, 18, '#535d60');
  }
  for (let xx = x + 14; xx < x + w; xx += 25) r(xx, y, 1, 7, '#bd9870');
}
function banner(c, x, y, w, h, color, icon = 'crown') {
  const { rect: r, line, poly, disc } = tools(c);
  r(x - 3, y - 5, w + 6, 4, '#6d6373');
  r(x, y, w, h, color);
  poly(
    [
      [x, y + h - 1],
      [x + w / 2, y + h - 13],
      [x + w, y + h - 1],
    ],
    '#e5c38d',
  );
  r(x + 3, y + 4, 2, h - 12, '#d6b895');
  r(x + w - 5, y + 4, 2, h - 12, '#d6b895');
  const cx = x + w / 2,
    cy = y + h * 0.43;
  if (icon === 'ball') {
    disc(cx, cy, Math.min(w * 0.3, 21), '#e8d0a8');
    for (let i = 0; i < 3; i++) line(cx - 16, cy - 10 + i * 10, cx + 12, cy + 8 + i * 5, color, 3);
  } else {
    poly(
      [
        [cx - 19, cy - 9],
        [cx - 10, cy + 2],
        [cx, cy - 15],
        [cx + 10, cy + 2],
        [cx + 19, cy - 9],
        [cx + 15, cy + 15],
        [cx - 15, cy + 15],
      ],
      '#eecb8a',
    );
    r(cx - 15, cy + 18, 30, 4, '#eecb8a');
  }
}
function trophy(c, x, y, s = 1) {
  const { rect: r, line, poly } = tools(c);
  r(x - 28 * s, y - 32 * s, 56 * s, 9 * s, '#ffe3a0');
  poly(
    [
      [x - 25 * s, y - 23 * s],
      [x + 25 * s, y - 23 * s],
      [x + 19 * s, y + 7 * s],
      [x + 8 * s, y + 20 * s],
      [x - 8 * s, y + 20 * s],
      [x - 19 * s, y + 7 * s],
    ],
    '#eab868',
  );
  r(x - 17 * s, y - 22 * s, 7 * s, 29 * s, '#ffdb8d');
  r(x - 4 * s, y + 17 * s, 8 * s, 15 * s, '#d69a56');
  r(x - 18 * s, y + 31 * s, 36 * s, 7 * s, '#f4ca7c');
  for (const sign of [-1, 1]) {
    line(x + sign * 27 * s, y - 22 * s, x + sign * 39 * s, y - 22 * s, '#efbe70', 6 * s);
    line(x + sign * 39 * s, y - 22 * s, x + sign * 35 * s, y + 2 * s, '#efbe70', 5 * s);
    line(x + sign * 35 * s, y + 2 * s, x + sign * 20 * s, y + 8 * s, '#efbe70', 5 * s);
  }
}

export function zoneSeats(theme) {
  if (theme === 'farm') return [260, 330, 401, 536, 607, 677].map((x) => [x, 363]);
  if (theme === 'beach')
    return [280, 325, 370, 425, 475, 535, 585, 635, 685, 735].map((x) => [x, 361]);
  if (theme === 'gym')
    return Array.from({ length: 21 }, (_, i) => [80 + i * 40, i % 2 ? 355 : 366]);
  if (theme === 'alpine')
    return [
      [40, 250],
      [85, 250],
      [120, 250],
      [850, 268],
      [895, 268],
      [930, 268],
      ...[200, 245, 290, 335, 380, 580, 625, 670, 715, 760].map((x) => [x, 361]),
    ];
  if (theme === 'sky') return [45, 85, 125, 165, 795, 835, 875, 915].map((x) => [x, 355]);
  return [65, 110, 155, 200, 245, 290, 335, 625, 670, 715, 760, 805, 850, 895].map((x) => [x, 353]);
}
export function drawZoneSky(c, theme, time = 0) {
  // Cover the complete frame so transparent layers cannot retain a previous zone.
  pixelTools(c).rect(0, 0, 960, 540, ZONES[theme].floor);
  if (theme === 'gym' || theme === 'championship') {
    pixelTools(c).rect(0, 0, 960, 540, theme === 'gym' ? '#c2aa9e' : '#283950');
    return;
  }
  const colors =
    theme === 'beach'
      ? ['#ad7fb0', '#ffc18f']
      : theme === 'farm'
        ? ['#86afd0', '#f3d7ac']
        : theme === 'alpine'
          ? ['#8aaedf', '#f5d3bb']
          : ['#8d7bb6', '#ffc5a2'];
  sky(c, ...colors);
  const { disc, rect: r } = tools(c);
  if (theme !== 'farm') {
    const x = theme === 'beach' ? 667 : theme === 'alpine' ? 765 : 737,
      y = theme === 'beach' ? 246 : theme === 'alpine' ? 165 : 190;
    disc(x, y, theme === 'sky' ? 62 : theme === 'beach' ? 45 : 27, '#ffe3a0');
  }
  for (let i = 0; i < 12; i++)
    cloud(
      c,
      ((i * 133 + time * (0.3 + (i % 3) * 0.1)) % 1130) - 100,
      115 + ((i * 47) % 130),
      40 + noise(i + 9) * 85,
      theme === 'sky' ? '#f7bda9' : '#ffdfb6',
    );
  if (theme === 'beach') {
    r(0, 271, 960, 91, '#578f95');
    r(0, 272, 960, 3, '#a5c5ac');
    for (let i = 0; i < 130; i++) {
      const x = noise(i + 10) * 960,
        y = 278 + noise(i + 21) * 69;
      r(x, y, 4 + noise(i + 50) * 20, 1, i % 3 ? '#83b4aa' : '#efd099');
    }
    for (let i = 0; i < 22; i++)
      r(617 + noise(i + 33) * 106, 279 + i * 3, 5 + noise(i + 88) * 32, 2, '#f6d59a');
  }
}

function beachDistance(c) {
  const { rect: r, poly, line } = tools(c);
  for (let i = 0; i < 5; i++) {
    const x = 30 + i * 53,
      y = 148 + (i % 3) * 15;
    r(x, y, 50, 175, ['#f0c5a6', '#dcafa4', '#efd9b0'][i % 3]);
    r(x + 7, y - 10, 36, 10, '#ead5ac');
    windows(c, x + 9, y + 16, 2, 5, 23, 28);
  }
  for (const [x, y, s] of [
    [90, 332, 0.65],
    [200, 325, 0.8],
    [380, 329, 0.65],
    [530, 334, 0.75],
  ])
    palm(c, x, y, s);
  for (const [x, y] of [
    [546, 287],
    [737, 292],
    [825, 285],
  ]) {
    line(x, y - 19, x, y + 3, '#f1ddb7');
    poly(
      [
        [x - 1, y - 17],
        [x - 16, y],
        [x - 1, y],
      ],
      '#ffedcb',
    );
    poly(
      [
        [x + 2, y - 14],
        [x + 11, y],
        [x + 2, y],
      ],
      '#e4c9ba',
    );
    r(x - 17, y + 2, 31, 3, '#dfc4ac');
  }
}
function beachArchitecture(c) {
  const { rect: r, line, poly, disc } = tools(c);
  for (const [x, w, h, col] of [
    [-18, 103, 234, '#f1d0ab'],
    [88, 102, 257, '#e8b9b0'],
    [193, 97, 215, '#f3d4b0'],
  ]) {
    const y = 350 - h;
    r(x, y, w, h, col);
    r(x + 6, y - 8, w - 12, 7, '#f5dfb7');
    r(x + 12, y - 14, w - 24, 6, col);
    windows(c, x + 15, y + 23, 3, Math.floor((h - 40) / 35), 25, 35);
    r(x, y + 15, w, 4, '#8db7ac');
    r(x, y + 21, w, 2, '#fce0b4');
    for (let k = 0; k < 5; k++) {
      r(x + 5 + k * 19, 315, 10, 19, k % 2 ? '#dd9c9e' : '#78a59a');
    }
    r(x + 2, 335, w - 4, 4, '#77777e');
  }
  r(139, 86, 27, 214, '#85b1a5');
  for (let i = 0; i < 6; i++) {
    r(146, 111 + i * 23, 12, 13, '#698d91');
    r(150, 114 + i * 23, 5, 3, '#bfd5b4');
  }
  r(150, 67, 4, 19, '#6d998f');
  for (const [x, y, s] of [
    [18, 369, 1.8],
    [304, 346, 1.2],
    [407, 347, 0.85],
    [936, 371, 1.85],
  ])
    palm(c, x, y, s);
  r(0, 359, 960, 39, '#ae9a99');
  r(0, 359, 960, 4, '#e4c5ad');
  r(0, 387, 960, 3, '#d6b4a1');
  for (let x = 0; x < 960; x += 37) r(x, 368, 1, 17, '#8d858a');
  // Cadillac, whitewall tyres, grille and two-tone paint.
  r(53, 339, 144, 14, '#c57873');
  r(61, 335, 129, 7, '#ed9b82');
  poly(
    [
      [86, 335],
      [96, 323],
      [148, 323],
      [164, 335],
    ],
    '#e7b294',
  );
  r(99, 325, 23, 9, '#80a7a5');
  r(126, 325, 22, 9, '#80a7a5');
  r(57, 350, 140, 3, '#e1c1ac');
  for (const x of [79, 169]) {
    disc(x, 353, 11, '#5b606a');
    disc(x, 353, 7, '#eddac0');
    disc(x, 353, 3, '#838388');
  }
  r(187, 339, 12, 5, '#ffe1a4');
  r(53, 344, 7, 5, '#a95f66');
  // Lifeguard cabin with striped railings, steps and surfboards.
  for (const x of [805, 863]) {
    line(x, 326, x - 12, 375, '#887c73', 5);
    line(x, 326, x + 23, 375, '#887c73', 5);
  }
  r(786, 318, 108, 8, '#80b1a8');
  r(797, 275, 84, 44, '#7aafa7');
  r(806, 283, 30, 25, '#b78aa7');
  r(840, 283, 30, 25, '#8b779d');
  r(786, 270, 108, 5, '#e5cfad');
  r(781, 266, 118, 4, '#9dc7ad');
  r(790, 310, 99, 3, '#efd9b0');
  for (let x = 790; x < 890; x += 17) r(x, 303, 3, 20, '#edcfac');
  line(796, 325, 745, 374, '#e4c3a1', 4);
  for (let i = 0; i < 8; i++) r(792 - i * 6, 330 + i * 6, 17, 3, '#a78b8c');
  line(866, 266, 866, 244, '#786f7e', 2);
  poly(
    [
      [868, 245],
      [888, 247],
      [884, 259],
      [868, 258],
    ],
    '#78ad9f',
  );
  for (let i = 0; i < 4; i++) {
    const x = 899 + i * 12;
    poly(
      [
        [x, 374],
        [x - 2, 337],
        [x + 2, 325],
        [x + 7, 333],
        [x + 8, 374],
      ],
      ['#db9b90', '#eee0b6', '#73aaa9', '#b69abb'][i],
    );
  }
  for (let i = 0; i < 4; i++) {
    const x = 360 + i * 111,
      y = 337 + (i % 2) * 4;
    line(x, y - 18, x, y + 18, '#a48c7b', 2);
    poly(
      [
        [x - 25, y - 14],
        [x, y - 28],
        [x + 25, y - 14],
      ],
      i % 2 ? '#e6b2a2' : '#e5d3b2',
    );
    poly(
      [
        [x - 8, y - 14],
        [x, y - 28],
        [x + 8, y - 14],
      ],
      '#8db6aa',
    );
  }
  r(0, 398, 960, 142, '#e6bd8b');
  for (let i = 0; i < 1700; i++) {
    const x = noise(i + 600) * 960,
      y = 398 + noise(i + 890) * 142;
    r(x, y, 1 + (i % 3), 1, ['#d8af82', '#edc995', '#eac38e'][i % 3]);
  }
}
function gymArchitecture(c) {
  const { rect: r, line, poly } = tools(c);
  r(0, 70, 960, 300, '#c4ada1');
  r(0, 234, 960, 115, '#b4866e');
  r(0, 229, 960, 5, '#d1a48a');
  for (let x = 0; x < 960; x += 108) {
    r(x, 81, 10, 260, '#af9992');
    r(x + 11, 82, 3, 145, '#ddc6ad');
  }
  for (const x of [25, 70, 115, 160]) {
    r(x, 94, 35, 182, '#afc4c4');
    r(x + 3, 98, 29, 173, '#d2dfca');
    for (let i = 0; i < 9; i++)
      r(x + noise(x + i) * 24, 164 + i * 9, 12, 17, i % 2 ? '#8faa8a' : '#a9bb93');
    for (const y of [132, 181, 230]) r(x, y, 35, 5, '#d9bc9b');
    r(x + 15, 95, 4, 182, '#d9bc9b');
  }
  poly(
    [
      [0, 105],
      [0, 290],
      [550, 540],
      [856, 540],
    ],
    '#e9c699',
  );
  for (let i = 0; i < 5; i++)
    poly(
      [
        [i * 38, 121 + i * 9],
        [i * 38 + 6, 124 + i * 9],
        [690 + i * 39, 540],
        [675 + i * 39, 540],
      ],
      '#bba58d',
    );
  for (let x = 245; x < 720; x += 83) {
    r(x, 246, 5, 90, '#8f6552');
    r(x + 65, 246, 5, 90, '#8f6552');
    for (let y = 250; y < 336; y += 12) {
      r(x, y, 69, 3, '#d0a17a');
      r(x, y + 3, 69, 1, '#9a7057');
    }
  }
  banner(c, 342, 145, 62, 91, '#ae7166');
  banner(c, 558, 145, 62, 91, '#687f9e', 'ball');
  r(440, 195, 83, 54, '#596a7a');
  r(443, 198, 77, 48, '#d0c6b8');
  r(466, 214, 35, 27, '#637382');
  r(469, 217, 29, 21, '#d0c6b8');
  r(475, 239, 31, 3, '#b56d62');
  for (let i = 0; i < 6; i++) line(477 + i * 5, 242, 482 + i * 3, 262, '#e8dac6', 1);
  line(478, 250, 505, 250, '#e8dac6', 1);
  line(481, 256, 502, 256, '#e8dac6', 1);
  r(727, 149, 153, 79, '#786f79');
  r(732, 154, 143, 69, '#3c5362');
  r(738, 160, 131, 57, '#354957');
  text(c, 'HOME   GUEST', 804, 173, 10, '#b1bbb5');
  r(14, 292, 38, 90, '#586f83');
  r(17, 295, 32, 84, '#708b9a');
  r(39, 339, 3, 5, '#e9d5b3');
  r(894, 289, 47, 93, '#556d83');
  r(898, 294, 38, 83, '#738c9e');
  r(907, 277, 20, 8, '#aec8b0');
  for (let row = 0; row < 3; row++) {
    r(45, 337 + row * 16, 870, 11, '#a37d60');
    r(45, 337 + row * 16, 870, 2, '#d0a780');
    r(50, 349 + row * 16, 860, 3, '#746a62');
  }
  for (let x = 53; x < 925; x += 43) {
    r(x, 326, 3, 59, '#6f7b7c');
    r(x, 326, 42, 2, '#95a1a0');
  }
  for (const x of [32, 281, 679, 922]) {
    line(x, 73, x, 113, '#6f727e', 2);
    r(x - 12, 110, 26, 15, '#777982');
    r(x - 15, 125, 32, 5, '#f0dbad');
  }
  for (let x = 0; x < 960; x += 125) {
    r(x, 74, 8, 17, '#797c84');
    r(x, 86, 125, 5, '#929092');
  }
  for (const [x, y] of [
    [74, 277],
    [920, 250],
  ]) {
    r(x, y, 19, 25, '#8e7f7c');
    r(x + 2, y + 2, 15, 21, '#d4c9b5');
    r(x + 4, y + 5, 8, 3, '#a0afad');
    r(x + 5, y + 12, 10, 2, '#af8c86');
  }
  for (const x of [176, 364, 596, 806]) {
    r(x, 370, 4, 9, '#8ea9a7');
    r(x + 1, 367, 2, 3, '#d8d6c2');
  }
  r(922, 350, 35, 30, '#6c7885');
  for (const y of [353, 365]) {
    r(925, y + 8, 30, 2, '#9eaca7');
    for (let i = 0; i < 4; i++) {
      const x = 929 + i * 7;
      const { disc } = tools(c);
      disc(x, y + 4, 4, '#d9bc80');
      r(x - 2, y + 2, 2, 5, '#7e9b9d');
    }
  }
  r(924, 381, 5, 3, '#4d6276');
  r(950, 381, 5, 3, '#4d6276');
  r(0, 391, 960, 149, '#c9956e');
  for (let y = 395; y < 540; y += 8) {
    r(0, y, 960, 1, '#b68768');
    for (let x = (y % 3) * 27; x < 960; x += 87) r(x, y, 1, 8, '#ad7f62');
  }
  for (let i = 0; i < 250; i++) {
    const x = noise(i + 65) * 960,
      y = 392 + noise(i + 564) * 148;
    r(x, y, 14 + noise(i + 8) * 30, 1, '#d6a579');
  }
}
function leafyTree(c, x, y, s = 1) {
  const { rect: r, line, poly } = tools(c);
  line(x, y, x - 5 * s, y - 100 * s, '#6c6952', 8 * s);
  line(x + 2 * s, y, x - 3 * s, y - 87 * s, '#aaa078', 2 * s);
  for (let i = 0; i < 7; i++)
    line(x, y - 35 * s, x + (i - 3) * 12 * s, y - (77 + noise(i + x) * 31) * s, '#6c6952', 3 * s);
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 27; i++) {
      const a = noise(i + x) * Math.PI * 2,
        rr = Math.sqrt(noise(i + y)) * 44 * s;
      const xx = x + Math.cos(a) * rr,
        yy = y - 98 * s + Math.sin(a) * rr * 0.83 - layer * 4 * s;
      const w = (9 + noise(i + x + 5) * 12) * s,
        h = (9 + noise(i + y + 6) * 12) * s;
      poly(
        [
          [xx - w / 2, yy - h / 2],
          [xx - w / 4, yy - h / 2 - 3 * s],
          [xx + w / 3, yy - h / 2],
          [xx + w / 2, yy - h / 5],
          [xx + w / 2 + 2 * s, yy + h / 3],
          [xx + w / 4, yy + h / 2],
          [xx - w / 2, yy + h / 3],
        ],
        ['#526e57', '#6d865a', '#8d9b60'][layer],
      );
      for (let j = 0; j < 8; j++)
        r(
          xx - w / 3 + noise(i * 8 + j) * w * 0.7,
          yy - h / 3 + noise(i * 9 + j + 5) * h * 0.7,
          3 * s,
          2 * s,
          layer === 2 ? '#b0b273' : '#8d9d64',
        );
    }
  }
}
function farmDistance(c) {
  const { rect: r, poly, disc, line } = tools(c);
  for (let layer = 0; layer < 3; layer++) {
    const pts = [
      [0, 310],
      [0, 230 + layer * 17],
    ];
    for (let x = 0; x <= 1000; x += 40)
      pts.push([x, 230 + layer * 17 + Math.sin(x / 140 + layer) * 18]);
    pts.push([960, 335]);
    poly(pts, ['#a5b9a1', '#8ea899', '#75978a'][layer]);
  }
  for (let i = 0; i < 13; i++) {
    const x = 225 + i * 61,
      y = 226 + (i % 3) * 9;
    r(x, y, 39, 34, '#d2c7a7');
    poly(
      [
        [x - 6, y],
        [x + 18, y - 21],
        [x + 46, y],
      ],
      i % 2 ? '#a7786a' : '#b3826e',
    );
    r(x + 3, y - 1, 36, 2, '#ddc4a3');
    r(x + 31, y - 27, 5, 17, '#a19280');
    for (let k = 0; k < 3; k++)
      line(x + 4 + k * 10, y - 6, x + 13 + k * 10, y - 17 + k * 4, '#bc8b76', 1);
    r(x + 7, y + 12, 7, 10, '#6d8990');
    r(x + 6, y + 11, 9, 2, '#e9d2b0');
    r(x + 5, y + 12, 2, 12, '#8c9d8d');
    r(x + 14, y + 12, 2, 12, '#8c9d8d');
    r(x + 8, y + 17, 5, 1, '#b9c7b4');
    r(x + 27, y + 17, 8, 17, '#9f8875');
  }
  r(686, 194, 19, 61, '#d8c8a8');
  r(682, 188, 27, 9, '#9c9483');
  disc(695, 180, 10, '#747e80');
  line(695, 158, 695, 170, '#646e73', 2);
  line(691, 163, 699, 163, '#646e73', 2);
  r(692, 202, 5, 13, '#7c8581');
  for (const [x, y, size] of [
    [197, 280, 0.85],
    [305, 274, 0.45],
    [452, 276, 0.38],
    [614, 277, 0.4],
    [774, 275, 0.5],
    [938, 277, 0.6],
  ])
    leafyTree(c, x, y, size);
  leafyTree(c, 190, 276, 1.65);
  leafyTree(c, 267, 283, 0.95);
  r(0, 280, 960, 62, '#d0ac60');
  for (let i = 0; i < 1600; i++) {
    const x = noise(i + 65) * 960,
      y = 281 + noise(i + 188) * 57;
    line(x, y, x, y - 4 - noise(i + 56) * 11, i % 3 ? '#ddbd6c' : '#bda054', 1);
  }
  for (const [x, y, s] of [
    [235, 288, 1],
    [340, 275, 0.9],
  ]) {
    disc(x, y, 25 * s, '#b38c49');
    disc(x - 3, y - 2, 22 * s, '#e2bd6a');
    for (let i = 0; i < 7; i++) line(x - 19 + i * 5, y - 17, x - 19 + i * 5, y + 17, '#c59e50');
    disc(x - 5, y - 1, 8, '#ba934e');
  }
}
function farmArchitecture(c) {
  const { rect: r, line, poly, disc } = tools(c);
  r(0, 194, 157, 199, '#a65f4f');
  poly(
    [
      [0, 93],
      [184, 219],
      [164, 227],
      [0, 119],
    ],
    '#704e49',
  );
  poly(
    [
      [0, 115],
      [156, 218],
      [0, 218],
    ],
    '#b36e54',
  );
  for (let x = 3; x < 157; x += 11) {
    r(x, 204, 2, 185, '#825447');
    r(x + 3, 214, 1, 172, '#c88760');
  }
  for (let x = 2; x < 151; x += 8) {
    const top = 119 + x * 0.66;
    line(x, top, x, 218, '#bd7c5b', 2);
    line(x + 3, top + 3, x + 3, 218, '#8e5949', 1);
  }
  r(27, 164, 27, 32, '#6d584c');
  r(31, 168, 19, 24, '#3f4944');
  r(24, 195, 34, 4, '#d39e6e');
  r(39, 166, 3, 28, '#9e7654');
  for (let i = 0; i < 85; i++) {
    const x = 3 + noise(i + 520) * 151,
      y = 220 + noise(i + 800) * 166;
    if (x > 10 && x < 108 && y > 237) continue;
    r(x, y, 2, 1, i % 2 ? '#c2825d' : '#8e594b');
  }
  r(14, 244, 92, 145, '#5a5246');
  r(9, 237, 105, 9, '#c38b61');
  r(12, 245, 6, 144, '#8d654d');
  for (let i = 0; i < 5; i++) {
    r(19 + (i % 2) * 39, 321 - Math.floor(i / 2) * 23, 35, 24, '#c8a153');
    for (let x = 0; x < 35; x += 5)
      r(20 + (i % 2) * 39 + x, 324 - Math.floor(i / 2) * 23, 1, 18, '#ddbd69');
  }
  r(121, 337, 16, 48, '#aaa99b');
  r(123, 333, 12, 6, '#d1cbbb');
  r(123, 347, 4, 29, '#d8d3bc');
  line(113, 315, 113, 377, '#786a53', 3);
  for (const x of [107, 112, 117]) line(x, 307, x, 323, '#7c8277', 2);
  fence(c, 177, 331, 783);
  bench(c, 235, 365, 209);
  bench(c, 510, 365, 210);
  for (let i = 0; i < 13; i++) sunflower(c, 566 + i * 28, 331 + (i % 3) * 5, 0.65);
  // Tractor, engine grille, wheel treads, glass cab and wooden trailer.
  r(786, 329, 131, 32, '#557c66');
  r(822, 292, 54, 49, '#6d9675');
  r(816, 286, 68, 8, '#4e715e');
  r(829, 301, 34, 28, '#9bb6a3');
  r(841, 300, 4, 30, '#46685c');
  r(892, 313, 40, 42, '#547a63');
  for (let x = 897; x < 931; x += 5) r(x, 319, 2, 24, '#344f4d');
  r(902, 309, 4, 8, '#b4b19a');
  r(884, 295, 4, 29, '#4b5550');
  for (const [x, y, size] of [
    [817, 358, 28],
    [912, 360, 21],
  ]) {
    disc(x, y, size, '#4c5352');
    disc(x, y, size - 6, '#626c60');
    disc(x, y, size - 12, '#9f665b');
    disc(x, y, 5, '#5a5d55');
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      line(
        x + Math.cos(a) * (size - 3),
        y + Math.sin(a) * (size - 3),
        x + Math.cos(a) * (size + 1),
        y + Math.sin(a) * (size + 1),
        '#444e4d',
        3,
      );
    }
  }
  r(737, 335, 53, 29, '#9b7953');
  for (let y = 337; y < 363; y += 8) r(739, y, 49, 2, '#c39763');
  disc(748, 370, 10, '#555c53');
  r(0, 395, 960, 145, '#b89b7b');
  for (let i = 0; i < 1900; i++) {
    const x = noise(i + 450) * 960,
      y = 395 + noise(i + 210) * 145;
    r(x, y, 1 + (i % 3), 1, i % 2 ? '#c1a680' : '#a98f70');
  }
}
function alpineDistance(c) {
  const { poly, rect: r, line } = tools(c);
  // Independent ridgelines and fractured faces, with atmospheric separation.
  for (let layer = 0; layer < 4; layer++) {
    const peaks = [
      [-90, 248],
      [94, 204],
      [184, 136],
      [290, 230],
      [402, 119],
      [524, 225],
      [626, 163],
      [752, 240],
      [900, 107],
      [1040, 235],
    ].map(([x, y], i) => [x + layer * (i % 2 ? -14 : 11), y + layer * 26]);
    const ridge = [];
    for (let i = 0; i < peaks.length - 1; i++) {
      const a = peaks[i],
        b = peaks[i + 1];
      for (let k = 0; k < 9; k++) {
        const t = k / 9;
        ridge.push([
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t + (k ? (noise(i * 19 + k + layer * 93) - 0.5) * 12 : 0),
        ]);
      }
    }
    poly([...ridge, [1030, 358], [-90, 358]], ['#9db7d3', '#849fbe', '#6888a8', '#567a96'][layer]);
    for (const i of [2, 4, 6, 8]) {
      const [x, y] = peaks[i],
        base = Math.min(353, y + 160);
      poly(
        [
          [x, y],
          [x + 22, y + 45],
          [x + 94, base],
          [x + 11, base],
          [x - 18, y + 72],
        ],
        ['#829dbf', '#6f8cad', '#587b9e', '#486d89'][layer],
      );
      const snow = [
        [x, y],
        [x - 17, y + 29],
        [x - 39, y + 53],
        [x - 60, y + 77],
        [x - 38, y + 66],
        [x - 22, y + 52],
        [x - 19, y + 62],
        [x - 9, y + 43],
        [x + 1, y + 60],
        [x + 11, y + 48],
        [x + 27, y + 71],
        [x + 25, y + 54],
        [x + 45, y + 69],
        [x + 28, y + 40],
      ];
      poly(snow, ['#f4e9df', '#dce3e4', '#c4d5df', '#a9c2d1'][layer]);
      for (let j = 0; j < 10; j++) {
        const yy = y + 34 + j * 8,
          xx = x + j * 4;
        poly(
          [
            [xx, yy],
            [xx + 4, yy + 5],
            [xx + 19, yy + 20],
            [xx + 11, yy + 18],
          ],
          ['#c6d6e2', '#b8cad9', '#94aec5', '#819fb5'][layer],
        );
        line(x - 8 - j * 4, yy + 8, x - 15 - j * 6, yy + 20, '#c3d4dd70', 1);
      }
      // Broken gullies and wind-packed snowfields give each face a different relief.
      for (let j = 0; j < 100; j++) {
        const depth = 17 + noise(j + i * 71 + layer * 5) * Math.max(1, base - y - 22);
        const side = noise(j + 981) < 0.58 ? -1 : 1;
        const xx = x + side * depth * (0.12 + noise(j + 123) * 0.51);
        const yy = y + depth,
          len = 3 + noise(j + 62) * 10;
        poly(
          [
            [xx, yy],
            [xx + side * 3, yy + 2],
            [xx + side * len * 0.8, yy + len],
            [xx + side * 2, yy + len * 0.7],
          ],
          side < 0
            ? ['#e0e6e7', '#c9d9e1', '#abc4d5', '#92b3c8'][layer]
            : ['#b5c8da', '#9cb6cc', '#7f9fb9', '#6e92ae'][layer],
        );
      }
      // Short strata follow the direction of each face, rather than random dots.
      for (let j = 0; j < 90; j++) {
        const depth = 45 + noise(j + i * 39) * Math.max(1, base - y - 48);
        const xx = x + (noise(j + layer * 17 + 90) - 0.35) * depth * 1.1;
        r(xx, y + depth, 2 + noise(j + 42) * 6, 1, j % 3 ? '#c2d2da22' : '#304e7025');
      }
    }
  }
  r(170, 308, 616, 24, '#a6c5d0');
  for (let i = 0; i < 90; i++)
    r(
      190 + noise(i) * 560,
      309 + noise(i + 70) * 19,
      12 + noise(i + 8) * 28,
      1,
      i % 2 ? '#d9e1df' : '#8eacbb',
    );
  for (let i = 0; i < 70; i++)
    pine(c, noise(i + 40) * 960, 337 + (i % 3) * 9, 0.19 + noise(i + 51) * 0.36, true);
}
function lodge(c, x, y, w, h) {
  const { rect: r, poly, line } = tools(c);
  r(x, y, w, h, '#9c7465');
  for (let yy = y + 6; yy < y + h; yy += 9) {
    r(x, yy, w, 2, '#765e59');
    r(x + 2, yy + 2, w - 4, 1, '#b38b70');
  }
  poly(
    [
      [x - 12, y],
      [x + w / 2, y - 45],
      [x + w + 13, y],
    ],
    '#746271',
  );
  poly(
    [
      [x - 16, y - 3],
      [x + w / 2, y - 51],
      [x + w + 18, y - 3],
      [x + w + 4, y + 3],
      [x + w / 2, y - 39],
      [x - 8, y + 3],
    ],
    '#eee7e4',
  );
  for (let xx = x + 13; xx < x + w - 15; xx += 33) {
    r(xx, y + 18, 22, 29, '#5f6776');
    r(xx + 3, y + 21, 16, 23, '#e7bd8c');
    r(xx + 10, y + 20, 2, 25, '#9f7d69');
  }
  r(x - 7, y + 60, w + 14, 7, '#c7a486');
  for (let xx = x; xx < x + w; xx += 14) {
    r(xx, y + 43, 4, 28, '#826452');
  }
  line(x - 8, y + 43, x + w + 7, y + 43, '#d1af8c', 4);
}
function alpineArchitecture(c) {
  const { rect: r, line, poly, disc } = tools(c);
  r(0, 338, 960, 202, '#dde4e8');
  for (let i = 0; i < 70; i++)
    poly(
      [
        [noise(i + 6) * 960, 350 + noise(i) * 40],
        [noise(i + 6) * 960 + 33, 347 + noise(i) * 40],
        [noise(i + 6) * 960 + 70, 355 + noise(i) * 40],
      ],
      i % 2 ? '#c2d1e0' : '#f2ebe6',
    );
  lodge(c, -28, 182, 187, 150);
  lodge(c, 822, 214, 165, 128);
  for (const [x, y, s] of [
    [172, 347, 0.8],
    [257, 345, 0.56],
    [716, 347, 0.64],
    [799, 348, 0.9],
  ])
    pine(c, x, y, s, true);
  r(138, 369, 685, 24, '#b0c5d6');
  r(138, 365, 685, 5, '#f7eee4');
  for (let x = 145; x < 823; x += 54) {
    r(x, 373, 2, 19, '#9aacbd');
    r(x + 11, 378, 14, 4, '#889fb5');
  }
  text(c, 'ALPINE CUP', 480, 385, 12, '#58728b');
  for (const [x, col] of [
    [329, '#d598aa'],
    [375, '#7c9ab7'],
    [720, '#d598aa'],
    [766, '#7c9ab7'],
  ]) {
    line(x, 294, x, 367, '#7b8898', 2);
    poly(
      [
        [x + 2, 295],
        [x + 20, 299],
        [x + 18, 345],
        [x + 2, 339],
      ],
      col,
    );
    poly(
      [
        [x + 6, 324],
        [x + 12, 310],
        [x + 18, 324],
        [x + 12, 320],
      ],
      '#eee7de',
    );
  }
  // Cable and supports leave the airborne play area readable.
  line(76, 108, 470, 191, '#5a6b80', 2);
  line(470, 191, 850, 245, '#5a6b80', 2);
  r(464, 185, 8, 126, '#778598');
  r(453, 182, 29, 6, '#5c7189');
  r(458, 308, 19, 5, '#adbccd');
  for (let i = 0; i < 4; i++) {
    const x = 45 + i * 16;
    poly(
      [
        [x, 381],
        [x - 4, 344],
        [x, 325],
        [x + 7, 331],
        [x + 9, 381],
      ],
      ['#d799a7', '#84a7b9', '#c9b78c', '#bb9eba'][i],
    );
  }
  disc(915, 365, 17, '#f1ece5');
  disc(915, 341, 12, '#f1ece5');
  r(905, 326, 22, 7, '#536378');
  r(909, 315, 14, 14, '#536378');
  r(906, 348, 19, 4, '#7e99af');
  r(910, 337, 2, 2, '#566575');
  r(919, 337, 2, 2, '#566575');
  poly(
    [
      [916, 342],
      [931, 345],
      [916, 346],
    ],
    '#cf9474',
  );
  for (const y of [358, 365, 372]) r(915, y, 2, 2, '#657181');
  r(0, 398, 960, 142, '#dde5ed');
  for (let i = 0; i < 280; i++)
    r(
      noise(i + 11) * 960,
      398 + noise(i + 31) * 142,
      8 + noise(i) * 18,
      1,
      i % 2 ? '#c6d6e8' : '#f1eee8',
    );
}
function island(c, x, y, w, h) {
  const { poly, line, rect: r } = tools(c);
  const outline = [
    [x, y],
    [x + w, y],
    [x + w - 5, y + 16],
    [x + w - 19, y + 23],
    [x + w - 14, y + 37],
    [x + w * 0.79, y + h * 0.58],
    [x + w * 0.76, y + h * 0.82],
    [x + w * 0.65, y + h],
    [x + w * 0.55, y + h * 0.88],
    [x + w * 0.43, y + h + 12],
    [x + w * 0.33, y + h * 0.72],
    [x + w * 0.24, y + h * 0.78],
    [x + w * 0.15, y + h * 0.45],
    [x + 12, y + 31],
    [x + 15, y + 18],
    [x + 3, y + 14],
  ];
  poly(outline, '#766b89');
  // Sedimentary terraces narrow with depth, alternating lit and recessed faces.
  for (let j = 0; j < Math.floor(h / 8); j++) {
    const d = j * 8,
      fraction = d / (h + 10),
      left = x + fraction * w * 0.4,
      right = x + w - fraction * w * 0.34;
    const jag = 3 + noise(j + x) * 8;
    poly(
      [
        [left, y + d],
        [right, y + d],
        [right - jag, y + d + 8],
        [left + 4, y + d + 8],
      ],
      ['#a18b9d', '#8e7d94', '#7d718c', '#968395'][j % 4],
    );
    r(left + 4, y + d, right - left - 7, 1, '#d0aaa650');
    for (let k = 0; k < 8; k++) {
      const xx = left + noise(k + j * 11 + x) * (right - left - 10);
      line(xx, y + d + 2, xx - 2, y + d + 7, '#504f722e', 1);
    }
  }
  for (let i = 0; i < 9; i++) {
    const xx = x + w * (0.12 + i * 0.087),
      depth = h * (0.35 + noise(i + x) * 0.55);
    poly(
      [
        [xx, y + 6],
        [xx + w * 0.04, y + 7],
        [xx + 8, y + depth],
        [xx - 3, y + depth - 7],
      ],
      i % 2 ? '#585b7a55' : '#d7b1a750',
    );
  }
  // Uneven moss shelves and trailing plants on the sunlit lip.
  for (let i = 0; i < Math.floor(w / 5); i++) {
    const xx = x + i * 5,
      yy = y - 5 - noise(i + x) * 6;
    r(xx, yy, 6, 7, ['#648675', '#78947b', '#a6ad84'][i % 3]);
    r(xx + 1, yy, 4, 2, '#c4bb8b');
    if (i % 4 === 0)
      for (let d = 4; d < 12 + noise(i) * 25; d += 4)
        r(xx + Math.sin(d) * 2, y + d, 3, 4, '#728b78');
  }
}
function temple(c, x, y, w = 95) {
  const { rect: r, poly } = tools(c);
  r(x - 5, y + 49, w + 10, 8, '#b3a4b0');
  r(x - 9, y + 56, w + 18, 4, '#dbc3b9');
  for (let xx = x + 5; xx < x + w; xx += 20) {
    r(xx, y, 8, 51, '#d5beb7');
    r(xx + 2, y, 2, 49, '#f0d3ba');
    r(xx - 2, y + 4, 12, 5, '#e3c9b7');
    r(xx - 2, y + 46, 12, 5, '#b49eab');
  }
  r(x - 5, y - 5, w + 10, 9, '#d8bdb5');
  poly(
    [
      [x - 11, y - 6],
      [x + w / 2, y - 29],
      [x + w + 11, y - 6],
    ],
    '#e6c3b6',
  );
  poly(
    [
      [x + 4, y - 10],
      [x + w / 2, y - 23],
      [x + w - 4, y - 10],
    ],
    '#b19caa',
  );
}
function skyDistance(c) {
  const { rect: r, poly } = tools(c);
  for (let j = 0; j < 3; j++) {
    const points = [[0, 330]];
    for (let x = 0; x <= 960; x += 26)
      points.push([x, 269 - j * 9 - Math.abs(Math.sin(x / 103 + j)) * 43]);
    points.push([960, 350]);
    poly(points, ['#c893b4', '#aa8bad', '#8c88a5'][j]);
  }
  r(0, 307, 960, 54, '#d5a4b0');
  for (let i = 0; i < 95; i++)
    r(
      590 + noise(i + 3) * 300,
      311 + noise(i + 8) * 42,
      5 + noise(i) * 24,
      1,
      i % 2 ? '#edbfae' : '#e1b1ae',
    );
  island(c, 548, 247, 88, 63);
  temple(c, 568, 207, 42);
  island(c, 809, 191, 96, 74);
  temple(c, 819, 151, 67);
  island(c, 329, 245, 72, 49);
  temple(c, 344, 209, 39);
}
function skyArchitecture(c) {
  const { rect: r, poly, line, disc } = tools(c);
  for (let i = 0; i < 32; i++)
    cloud(
      c,
      220 + noise(i + 500) * 540,
      341 + noise(i + 345) * 67,
      35 + noise(i + 900) * 90,
      i % 3 ? '#e6becb' : '#f2cdcf',
    );
  island(c, 70, 270, 245, 119);
  temple(c, 113, 217, 88);
  island(c, 700, 269, 229, 115);
  temple(c, 797, 218, 91);
  // Weathered guardian holding a stone volleyball, assembled in the sprite grid.
  const stone = '#c1b0aa',
    lit = '#ddc5b5',
    shade = '#998f9e';
  poly(
    [
      [181, 268],
      [187, 227],
      [199, 208],
      [230, 202],
      [246, 218],
      [257, 263],
    ],
    stone,
  );
  poly(
    [
      [195, 206],
      [185, 178],
      [190, 153],
      [209, 141],
      [229, 154],
      [232, 180],
      [221, 206],
    ],
    stone,
  );
  r(194, 146, 26, 13, shade);
  r(202, 159, 24, 23, lit);
  r(213, 168, 3, 3, '#7e7d8b');
  r(222, 171, 6, 5, shade);
  poly(
    [
      [226, 210],
      [247, 202],
      [268, 178],
      [281, 181],
      [270, 216],
      [246, 233],
    ],
    stone,
  );
  line(272, 188, 285, 169, lit, 10);
  disc(285, 151, 22, shade);
  disc(282, 148, 19, stone);
  for (const d of [-10, 0, 10]) line(268, 141 + d, 297, 152 + d, shade, 2);
  poly(
    [
      [194, 213],
      [178, 226],
      [165, 252],
      [176, 262],
      [197, 236],
    ],
    shade,
  );
  r(190, 258, 14, 29, shade);
  r(220, 257, 14, 30, stone);
  r(182, 284, 61, 8, shade);
  for (const [x, y] of [
    [202, 195],
    [210, 220],
    [219, 242],
    [192, 260],
  ]) {
    line(x, y, x + 9, y + 11, '#778775', 3);
    r(x + 3, y + 3, 6, 4, '#8b9a7d');
  }
  // Side ruins and viewing galleries.
  for (const x of [0, 889]) {
    r(x, 209, 65, 149, '#a695a7');
    r(x + 6, 214, 50, 7, '#d3bbb2');
    for (let y = 227; y < 349; y += 16) r(x + 3, y, 59, 1, '#c3acaf');
    for (const xx of [x + 9, x + 43]) {
      r(xx, 228, 10, 117, '#c4b0b0');
      r(xx + 2, 229, 2, 114, '#dfc4b7');
    }
    r(x + 20, 251, 23, 85, '#77768d');
    r(x + 17, 243, 29, 12, '#8e8395');
  }
  for (const [x, col] of [
    [47, '#9e7899'],
    [113, '#54778f'],
    [798, '#54778f'],
    [868, '#b77d96'],
  ])
    banner(c, x, 290, 32, 80, col);
  bench(c, 22, 360, 180);
  bench(c, 762, 360, 178);
  // Platforms and mist underneath the playing terrace.
  r(0, 391, 960, 149, '#afa1b8');
  for (let i = 0; i < 25; i++)
    cloud(
      c,
      noise(i + 90) * 1020 - 60,
      410 + noise(i + 60) * 128,
      85 + noise(i) * 90,
      i % 2 ? '#e0bfd1' : '#edc5ce',
    );
  r(24, 493, 912, 12, '#8e7f99');
  for (let x = 28; x < 940; x += 42) {
    r(x, 499, 33, 17, '#a092a8');
    r(x + 3, 500, 27, 3, '#c8adb9');
  }
}
function crowdRows(c) {
  const { rect: r } = tools(c);
  for (let row = 0; row < 9; row++)
    for (let i = 0; i < 100; i++) {
      const x = 5 + i * 9.6 + (row % 2) * 4,
        y = 194 + row * 16 + Math.abs(x - 480) * 0.026;
      const n = row * 100 + i;
      if (x > 333 && x < 627 && y < 282) continue;
      r(x, y, 6, 7, ['#648ca0', '#ab7f95', '#b79983', '#688f89', '#9b91aa'][n % 5]);
      r(x + 1, y - 5, 4, 5, ['#d1aa8b', '#b08e76', '#d5b69a', '#927968'][n % 4]);
      r(x + 1, y - 6, 4, 2, '#4b5366');
      if (n % 9 === 0) r(x - 1, y - 2, 1, 6, '#bd9c88');
    }
}
function championshipArchitecture(c) {
  const { rect: r, poly, line, disc } = tools(c);
  r(0, 69, 960, 283, '#2e4059');
  for (let x = -150; x < 1050; x += 145) {
    poly(
      [
        [x, 72],
        [x + 45, 72],
        [x + 310, 359],
        [x + 162, 359],
      ],
      '#3b4c66',
    );
    line(x, 74, x + 198, 351, '#48536b', 2);
  }
  for (let row = 0; row < 3; row++) {
    r(0, 215 + row * 49, 960, 37, '#334b65');
    r(0, 248 + row * 49, 960, 9, '#957385');
    r(0, 249 + row * 49, 960, 2, '#d2a08b');
  }
  crowdRows(c);
  for (const [x, col, kind] of [
    [59, '#b47e9e', 'crown'],
    [166, '#5b87a4', 'ball'],
    [243, '#78aaa4', 'ball'],
    [689, '#bd819e', 'crown'],
    [784, '#567ea3', 'ball'],
    [864, '#6b9e9e', 'ball'],
  ])
    banner(c, x, 111, 49, 127, col, kind);
  r(329, 127, 302, 146, '#172d43');
  r(333, 131, 294, 138, '#847d91');
  r(338, 136, 284, 127, '#547fa1');
  for (let i = 0; i < 72; i++)
    r(342 + noise(i + 88) * 272, 140 + noise(i + 20) * 116, 2, 2, '#668daa');
  trophy(c, 480, 188, 1.08);
  for (let side of [-1, 1])
    for (let i = 0; i < 8; i++) {
      const a = (i - 3.5) * 0.18,
        x = 480 + side * (65 - Math.abs(i - 3.5) * 4),
        y = 170 + i * 9;
      poly(
        [
          [x, y],
          [x + side * 12, y - 7],
          [x + side * 11, y + 2],
          [x, y + 5],
        ],
        '#e2be7d',
      );
    }
  r(419, 297, 122, 67, '#715b72');
  r(425, 301, 110, 63, '#bf8c86');
  r(434, 309, 92, 55, '#e9bd91');
  r(449, 314, 63, 50, '#f6d7a8');
  for (let i = 0; i < 4; i++) {
    const x = 446 + i * 21;
    disc(x, 338, 4, '#5b5970');
    r(x - 5, 342, 10, 17, '#5b5970');
    r(x - 4, 359, 3, 10, '#5b5970');
    r(x + 2, 359, 3, 10, '#5b5970');
  }
  for (let i = 0; i < 5; i++) r(429 - i * 5, 365 + i * 5, 102 + i * 10, 4, '#a48e97');
  r(0, 365, 960, 32, '#416b91');
  for (let x = 0; x < 960; x += 230) {
    poly(
      [
        [x, 397],
        [x + 38, 365],
        [x + 55, 365],
        [x + 17, 397],
      ],
      '#68aab2',
    );
    poly(
      [
        [x + 23, 397],
        [x + 61, 365],
        [x + 76, 365],
        [x + 38, 397],
      ],
      '#bd8fa9',
    );
  }
  text(c, 'WORLD CHAMPIONSHIP', 190, 386, 13, '#c4d7d4');
  text(c, 'DUPER VOLLEYBALL', 746, 386, 14, '#e7c3ae');
  for (const x of [16, 921]) {
    r(x, 334, 21, 13, '#354557');
    r(x + 4, 330, 19, 10, '#283b50');
    r(x - 2, 339, 5, 5, '#1c3347');
    line(x + 9, 347, x - 3, 376, '#4b5a69', 3);
    line(x + 9, 347, x + 23, 376, '#4b5a69', 3);
    line(x + 9, 347, x + 9, 378, '#4b5a69', 2);
  }
  for (let x = 39; x < 960; x += 69) {
    line(x, 88, x + 66, 98, '#70707c', 2);
    for (let i = 0; i < 4; i++) {
      r(x + i * 12, 93 + i * 2, 7, 6, '#b8a594');
      r(x + i * 12 + 1, 94 + i * 2, 5, 4, '#f8d6a2');
    }
  }
  r(0, 398, 960, 142, '#4e9299');
  for (let i = 0; i < 100; i++)
    r(noise(i + 11) * 960, 400 + noise(i + 13) * 140, 20 + noise(i + 34) * 50, 1, '#57989e');
}
function court(c, theme) {
  const { rect: r, poly, line } = tools(c),
    p = ZONES[theme];
  poly(
    [
      [91, 402],
      [870, 402],
      [944, 501],
      [18, 501],
    ],
    p.edge,
  );
  poly(
    [
      [102, 408],
      [859, 408],
      [929, 496],
      [33, 496],
    ],
    p.court,
  );
  for (let i = 0; i < 130; i++) {
    const y = 410 + noise(i + 300) * 83,
      t = (y - 408) / 88,
      left = 102 - 69 * t,
      right = 859 + 70 * t,
      x = left + noise(i + 802) * (right - left);
    r(
      x,
      y,
      2 + noise(i + 512) * 16,
      1,
      theme === 'alpine'
        ? '#d69c92'
        : theme === 'gym'
          ? '#e8b383'
          : theme === 'sky'
            ? '#c68c96'
            : p.edge,
    );
  }
  if (theme === 'gym') {
    for (let y = 411; y < 496; y += 7) {
      const t = (y - 408) / 88;
      line(102 - 69 * t, y, 859 + 70 * t, y, '#c18d6c', 1);
    }
    for (let i = 0; i < 19; i++) line(106 + i * 40, 408, 40 + i * 48, 496, '#c18d6c', 1);
    poly(
      [
        [120, 410],
        [179, 410],
        [391, 494],
        [288, 494],
      ],
      '#f4ce98',
    );
    poly(
      [
        [230, 410],
        [266, 410],
        [529, 494],
        [467, 494],
      ],
      '#edbf8e',
    );
  }
  if (theme === 'sky') {
    for (let i = 0; i < 13; i++) {
      const x = 205 + i * 44;
      line(x, 475, x + 32, 475, '#d29b9f', 2);
      line(x + 6, 481, x + 24, 481, '#c58b9a', 1);
    }
  }
  const color = theme === 'farm' ? '#eee0bf' : '#fff0d3';
  for (const a of [
    [102, 408, 859, 408],
    [33, 496, 929, 496],
    [102, 408, 33, 496],
    [859, 408, 929, 496],
  ])
    line(...a, color, 2);
  for (const backX of [353, 480, 606]) {
    const t = (backX - 102) / (859 - 102);
    line(backX, 408, 33 + t * (929 - 33), 496, color, 1);
  }
  // Subtle surface sheen stays behind actors and the physical lane.
  if (theme === 'gym' || theme === 'sky')
    for (let i = 0; i < 15; i++) line(150 + i * 47, 485, 170 + i * 47, 485, '#f0c3a0', 1);
}
export function drawZoneDistance(c, theme) {
  if (theme === 'beach') beachDistance(c);
  else if (theme === 'farm') farmDistance(c);
  else if (theme === 'alpine') alpineDistance(c);
  else if (theme === 'sky') skyDistance(c);
}
export function drawZoneArchitecture(c, theme) {
  if (theme === 'beach') beachArchitecture(c);
  else if (theme === 'gym') gymArchitecture(c);
  else if (theme === 'farm') farmArchitecture(c);
  else if (theme === 'alpine') alpineArchitecture(c);
  else if (theme === 'sky') skyArchitecture(c);
  else championshipArchitecture(c);
  scenicDetail(c, theme);
  court(c, theme);
  courtLighting(c, theme);
}
export function drawZoneForeground(c, theme) {
  const { rect: r, line, poly, disc } = tools(c);
  if (theme === 'beach') {
    for (const [x, s] of [
      [-24, 1],
      [963, -1],
    ])
      for (let i = 0; i < 8; i++)
        poly(
          [
            [x, 540],
            [x + s * (20 + i * 9), 480 + i * 4],
            [x + s * (13 + i * 10), 525],
            [x + s * (50 + i * 7), 540],
          ],
          i % 2 ? '#4a7161' : '#355c57',
        );
    poly(
      [
        [772, 518],
        [866, 518],
        [916, 540],
        [792, 540],
      ],
      '#eed8bb',
    );
    for (let i = 0; i < 5; i++)
      poly(
        [
          [782 + i * 18, 520],
          [790 + i * 18, 520],
          [816 + i * 18, 540],
          [807 + i * 18, 540],
        ],
        '#cb8f91',
      );
    r(858, 500, 36, 32, '#c69269');
    r(868, 500, 8, 32, '#678f95');
    line(866, 502, 866, 490, '#4d6973', 4);
    line(866, 490, 883, 490, '#4d6973', 4);
    line(883, 490, 883, 502, '#4d6973', 4);
    for (const x of [733, 750]) {
      r(x, 527, 14, 5, '#c8886d');
      line(x + 3, 526, x + 7, 521, '#e7b291', 3);
    }
  } else if (theme === 'farm') {
    fence(c, 0, 512, 125);
    fence(c, 739, 513, 221);
    for (let i = 0; i < 200; i++) {
      const x = noise(i + 9) * 960;
      if (x > 140 && x < 740 && i % 3) continue;
      line(
        x,
        540,
        x + (noise(i + 35) - 0.5) * 12,
        519 - noise(i + 25) * 13,
        ['#7a8856', '#899757', '#a1a364'][i % 3],
        2,
      );
    }
    for (const [x, y, s] of [
      [20, 533, 1],
      [72, 545, 0.7],
      [818, 537, 1.1],
      [900, 530, 1.05],
      [947, 545, 0.8],
    ])
      sunflower(c, x, y, s); // goose stays outside the painted court.
    disc(111, 520, 13, '#e9e6d0');
    r(119, 496, 6, 24, '#e9e6d0');
    disc(123, 496, 5, '#f3edd9');
    r(127, 496, 10, 3, '#c88a52');
    r(124, 494, 1, 1, '#59605b');
    line(106, 531, 103, 537, '#ce9b57', 2);
    line(117, 531, 118, 537, '#ce9b57', 2);
  } else if (theme === 'alpine') {
    fence(c, 0, 516, 252, '#6e6266', true);
    fence(c, 700, 515, 260, '#6e6266', true);
    for (let i = 0; i < 18; i++)
      cloud(c, noise(i + 33) * 990 - 40, 539 + noise(i) * 9, 45 + noise(i + 7) * 40, '#eeeae7');
  } else if (theme === 'sky') {
    for (const [x, w, h] of [
      [0, 75, 31],
      [118, 59, 17],
      [754, 75, 19],
      [878, 82, 34],
    ]) {
      poly(
        [
          [x, 540],
          [x + 7, 540 - h],
          [x + w - 7, 536 - h],
          [x + w, 540],
        ],
        '#8d839b',
      );
      r(x + 10, 540 - h, Math.max(12, w - 22), 4, '#c4aab4');
    }
    for (let i = 0; i < 22; i++) r(noise(i + 10) * 960, 524 + noise(i + 8) * 16, 3, 3, '#b8a8b7');
  } else if (theme === 'championship') {
    for (let i = 0; i < 32; i++) {
      const x = i * 33 - 10,
        y = 532 + (i % 3) * 6;
      disc(x, y, 9, '#283b51');
      r(x - 11, y + 7, 23, 17, '#283b51');
      if (i % 4 === 0) {
        line(x - 10, y + 6, x - 18, y - 9, '#283b51', 5);
        line(x + 10, y + 6, x + 19, y - 12, '#283b51', 5);
      }
    }
  } else {
    for (let x = 5; x < 960; x += 54) {
      r(x, 530, 33, 2, '#dfb68a');
      r(x + 8, 538, 17, 1, '#eac496');
    }
    r(905, 508, 35, 32, '#758b96');
    for (let i = 0; i < 4; i++) {
      disc(911 + i * 7, 515, 4, '#dcc48e');
      r(910 + i * 7, 513, 2, 5, '#688899');
    }
  }
  scenicForeground(c, theme);
}
export function drawZoneLife(c, theme, time = 0, live = true, score = [0, 0]) {
  const { rect: r, line, poly, disc } = tools(c),
    t = live ? time : 0;
  ambientDetail(c, theme, t);
  if (theme === 'beach') {
    for (let i = 0; i < 17; i++) {
      const y = 284 + i * 4;
      const x = (i * 97 + t * 8) % 920;
      r(x, y, 14 + (i % 4) * 7, 1, '#b3cec0');
    }
    for (let i = 0; i < 4; i++) {
      const x = 410 + i * 67 + Math.sin(t * 0.4 + i) * 9,
        y = 214 + (i % 2) * 12;
      line(x - 4, y, x, y + 2, '#6b8184');
      line(x, y + 2, x + 4, y, '#6b8184');
    }
  }
  if (theme === 'alpine') {
    for (let i = 0; i < 3; i++) {
      const x = 106 + ((i * 210 + t * 11) % 650),
        y = x < 470 ? 108 + ((x - 76) * 83) / 394 : 191 + ((x - 470) * 54) / 380;
      line(x, y, x, y + 17, '#566d84', 2);
      r(x - 12, y + 15, 25, 22, '#955d75');
      r(x - 10, y + 17, 21, 12, '#c69baa');
      r(x - 8, y + 19, 7, 8, '#7c9eb6');
      r(x + 2, y + 19, 7, 8, '#7c9eb6');
      r(x - 11, y + 37, 23, 3, '#5c6a83');
    }
  }
  if (theme === 'sky') {
    for (const [x, y, h, w] of [
      [289, 270, 107, 16],
      [703, 270, 106, 17],
      [875, 215, 70, 10],
    ]) {
      r(x, y, w, h, '#adc6ce');
      r(x + 2, y, w - 4, h, '#d3d4df');
      for (let i = 0; i < 12; i++) {
        const yy = y + ((i * 17 + t * 29) % h);
        r(x + 3 + (i % 3) * 3, yy, 2, 8, '#eff0e4');
      }
      cloud(c, x - w, y + h, w * 3, '#e0c5d3');
    }
    const x = 420 + Math.sin(t * 0.07) * 20,
      y = 196 + Math.sin(t * 0.5) * 3;
    disc(x, y, 10, '#cc9c9b');
    for (let k = 0; k < 4; k++) r(x - 8 + k * 5, y - 8, 2, 15, '#e0b392');
    line(x - 5, y + 8, x - 3, y + 18, '#897b85');
    line(x + 5, y + 8, x + 3, y + 18, '#897b85');
    r(x - 4, y + 17, 9, 6, '#a57c78');
  }
  if (theme === 'farm') {
    for (let i = 0; i < 3; i++) {
      const x = 702 + Math.sin(t * 0.6 + i) * 4 + i * 3,
        y = 208 - i * 7 - ((t * 2) % 7);
      r(x, y, 5 + i * 2, 2, '#d0c8af');
    }
    const x = 501 + Math.sin(t * 0.25) * 22,
      y = 176 + Math.sin(t * 0.7) * 3;
    line(x - 5, y, x, y + 3, '#768783');
    line(x, y + 3, x + 5, y, '#768783');
  }
  if (theme === 'gym') {
    for (const x of [32, 281, 679, 922])
      r(x - 13, 126, 28, 3, Math.sin(t * 0.45 + x * 0.01) > 0.2 ? '#ffebbd' : '#eddbb3');
    r(744, 181, 120, 31, '#354957');
    text(
      c,
      String(score[0]).padStart(2, '0') + ' - ' + String(score[1]).padStart(2, '0'),
      804,
      205,
      24,
      '#df9690',
    );
  }
  if (theme === 'championship') {
    for (let i = 0; i < 10; i++) {
      const x = 30 + i * 100;
      const col = Math.sin(t * 1.6 + i) > 0.5 ? '#ffe2aa' : '#e9c69d';
      r(x, 110 + (i % 2) * 10, 10, 5, col);
    }
    for (const x of [27, 914]) {
      r(x, 299, 23, 10, '#94868b');
      for (let i = 0; i < 4; i++) r(x + 2 + i * 5, 301, 3, 5, '#ffdeb0');
    }
  }
}
export function drawZoneBackdrop(c, theme, time = 0) {
  drawZoneSky(c, theme, time);
  drawZoneDistance(c, theme);
  drawZoneArchitecture(c, theme);
  drawZoneLife(c, theme, time, true);
  drawZoneForeground(c, theme);
}

// Cached material and lighting pass: details follow the objects, not a screen-wide noise filter.
function scenicDetail(c, theme) {
  const { rect: r, line, poly, disc } = tools(c);
  if (theme === 'beach') {
    // Art-deco balconies, mouldings, deep shopfronts and striped café awnings.
    for (const [x, w, top] of [
      [0, 85, 116],
      [88, 102, 93],
      [193, 97, 135],
    ]) {
      r(x + w - 7, top, 7, 202, '#825c8c30');
      for (let yy = top + 54; yy < 302; yy += 35) {
        r(x + 11, yy, w - 18, 3, '#f8dfbc');
        r(x + 12, yy + 3, w - 18, 4, '#966e8d50');
        for (let xx = x + 14; xx < x + w - 9; xx += 7) r(xx, yy - 9, 1, 9, '#a2a798');
      }
      r(x + 9, 310, w - 16, 25, '#536e76');
      for (let xx = x + 12; xx < x + w - 12; xx += 17) {
        r(xx, 313, 2, 22, '#edc4a4');
        r(xx + 3, 315, 10, 2, '#a4bdb0');
      }
      poly(
        [
          [x + 4, 306],
          [x + w - 3, 306],
          [x + w + 1, 317],
          [x, 317],
        ],
        '#e8b3a3',
      );
      for (let xx = x + 2; xx < x + w; xx += 12) {
        r(xx, 310, 6, 7, '#81aca3');
        r(xx, 317, 6, 3, '#668e91');
      }
    }
    text(c, 'O C E A N', 151, 105, 7, '#f5dfbb');
    // Boardwalk planters and warm café lights; keep the road and people readable.
    for (const x of [226, 263, 313, 751, 786]) {
      r(x - 8, 345, 18, 11, '#bd8d79');
      r(x - 10, 343, 22, 3, '#e1b294');
      for (let i = 0; i < 9; i++)
        line(
          x,
          343,
          x - 12 + i * 3,
          329 + noise(i + x) * 11,
          ['#668a68', '#8eaa79', '#416e65'][i % 3],
          2,
        );
    }
    line(215, 319, 459, 325, '#746f79', 1);
    for (let i = 0; i < 13; i++) {
      const x = 217 + i * 19,
        y = 320 + i * 0.45;
      r(x, y, 2, 4, '#ffe1a6');
      r(x - 2, y - 1, 6, 7, '#ffe1a620');
    }
    r(844, 291, 22, 17, '#e7bbbd');
    r(853, 293, 4, 13, '#fff0cc');
    r(849, 297, 12, 4, '#fff0cc');
    for (let i = 0; i < 24; i++) {
      const x = 802 + noise(i + 10) * 73,
        y = 279 + noise(i + 3) * 37;
      r(x, y, 8, 1, '#e9d1aa25');
    }
    // Broad palm shadows outside the actual playing rectangle.
    for (let i = 0; i < 12; i++) line(80, 539, 120 + i * 15, 509 + Math.sin(i) * 5, '#8a7e9545', 5);
  } else if (theme === 'gym') {
    // Wall panel joints, ventilation, ceiling trusses, bolts and equipment.
    for (let y = 91; y < 229; y += 26) r(204, y, 756, 1, '#fff2cf15');
    for (const x of [222, 647, 904]) {
      r(x, 105, 28, 13, '#a39791');
      for (let yy = 108; yy < 117; yy += 3) r(x + 3, yy, 22, 1, '#746f76');
    }
    for (let i = 0; i < 7; i++) {
      const x = 201 + i * 119;
      line(x, 75, x + 58, 91, '#8b8587', 3);
      line(x + 58, 91, x + 116, 75, '#a19b98', 2);
      disc(x + 58, 91, 2, '#cbbba8');
    }
    r(200, 235, 757, 3, '#795b5130');
    for (let i = 0; i < 180; i++) {
      const x = 215 + noise(i + 11) * 738,
        y = 241 + noise(i + 52) * 85;
      r(x, y, 5 + noise(i) * 18, 1, '#d6a47b25');
    }
    // Noticeboard, school pennants and clock.
    r(221, 155, 51, 59, '#8f7767');
    r(224, 158, 45, 53, '#a5977c');
    for (let i = 0; i < 6; i++) {
      const x = 227 + (i % 2) * 20,
        y = 163 + Math.floor(i / 2) * 15;
      r(x, y, 15, 12, i % 2 ? '#d4c7af' : '#b2c3b2');
      r(x + 2, y + 4, 10, 1, '#83958f');
      r(x + 2, y + 7, 7, 1, '#83958f');
    }
    disc(672, 166, 17, '#667382');
    disc(672, 166, 14, '#e1d7bb');
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      r(671 + Math.sin(a) * 11, 165 + Math.cos(a) * 11, 2, 2, '#73818a');
    }
    line(672, 166, 672, 156, '#626c79', 2);
    line(672, 166, 679, 170, '#626c79', 2);
    for (const x of [12, 902]) {
      r(x, 383, 32, 7, '#6e7684');
      r(x + 4, 380, 23, 4, '#8f8790');
      line(x + 7, 382, x + 13, 378, '#c9b6a4', 2);
    }
  } else if (theme === 'farm') {
    // Barn door bracing, hinges, hanging lantern, flower beds and grass at the fence.
    line(946, 195, 946, 326, '#6c675a', 6);
    line(931, 207, 960, 207, '#7a705c', 4);
    for (const yy of [211, 220]) {
      const pts = Array.from({ length: 21 }, (_, j) => [
        716 + j * 12,
        yy - 37 + j * 1.8 + Math.sin((j / 20) * Math.PI) * 13,
      ]);
      for (let j = 1; j < pts.length; j++) line(...pts[j - 1], ...pts[j], '#72766c', 1);
    }
    line(18, 250, 100, 383, '#886a4d', 5);
    line(100, 250, 18, 383, '#886a4d', 5);
    r(18, 248, 80, 3, '#c29763');
    for (const y of [259, 369]) {
      r(9, y, 18, 3, '#494e48');
      r(96, y, 15, 3, '#494e48');
    }
    r(141, 249, 3, 15, '#635748');
    r(133, 261, 18, 4, '#635748');
    r(136, 265, 12, 15, '#e1bb73');
    r(135, 279, 14, 3, '#695b4a');
    for (let i = 0; i < 300; i++) {
      const x = 165 + noise(i + 421) * 790,
        y = 382 + noise(i + 701) * 12;
      if (x > 235 && x < 722) continue;
      line(
        x,
        y,
        x + noise(i + 4) * 7 - 3,
        y - 3 - noise(i) * 12,
        ['#657c52', '#8e9c61', '#b1b46b'][i % 3],
        1,
      );
      if (i % 19 === 0) {
        disc(x, y - 6, 2, '#e8d9a0');
        r(x, y - 7, 1, 1, '#ae874e');
      }
    }
    // Worn tyres, fender highlights, crates and a small kitchen garden.
    r(790, 329, 37, 4, '#a4b183');
    r(884, 333, 46, 3, '#829b73');
    r(921, 325, 7, 7, '#e7ce87');
    for (let j = 0; j < 3; j++) {
      r(176 + j * 19, 370 - j * 5, 18, 19, '#9d7e57');
      for (let k = 0; k < 3; k++) r(177 + j * 19, 374 - j * 5 + k * 5, 16, 1, '#c3a06c');
    }
    for (let i = 0; i < 20; i++) {
      const x = 159 + i * 7;
      disc(x, 334 + (i % 3), 4, '#6e8558');
      r(x, 333 + (i % 3), 2, 2, '#d5a16a');
    }
  } else if (theme === 'alpine') {
    // Snow pillows, icicles and warm chalet lights make the cold/warm contrast explicit.
    for (const [x, y, w] of [
      [0, 273, 164],
      [805, 291, 155],
    ]) {
      r(x, y, w, 4, '#f7eee1');
      for (let i = 0; i < 22; i++) {
        const xx = x + i * 7;
        line(xx, y + 3, xx, y + 5 + noise(i + x) * 9, '#c9dce6', 1);
      }
      for (let i = 0; i < 8; i++) {
        const xx = x + i * 21;
        r(xx, y - 39, 2, 4, '#ffe5ab');
        r(xx - 3, y - 42, 8, 10, '#ffd39518');
      }
    }
    // Irregular layered snow banks and fir shadows behind the spectators.
    for (let i = 0; i < 70; i++) {
      const x = noise(i + 81) * 960,
        y = 380 + noise(i + 11) * 16;
      r(x, y, 5 + noise(i) * 21, 2, i % 3 ? '#c0d2e2' : '#fff1dc');
    }
    for (const x of [168, 785]) {
      r(x, 327, 5, 55, '#827777');
      r(x - 16, 330, 38, 13, '#c28f8c');
      r(x - 15, 328, 38, 3, '#f3eee4');
      text(c, 'SKI', x + 4, 339, 7, '#f4e4c9');
    }
    for (let i = 0; i < 9; i++) {
      r(39 + i * 8, 395 + i * 0.5, 4, 2, '#9eafc5');
      r(44 + i * 8, 399 + i * 0.5, 4, 2, '#b0bfd2');
    }
  } else if (theme === 'sky') {
    // Cypress groves and vines give the temples the lush silhouette of the reference.
    for (const [x, y, s] of [
      [78, 268, 1],
      [102, 267, 0.65],
      [250, 270, 0.8],
      [769, 268, 0.9],
      [910, 266, 1.1],
      [552, 245, 0.6],
      [892, 189, 0.65],
    ]) {
      line(x, y, x, y - 53 * s, '#636c68', 3);
      poly(
        [
          [x - 7 * s, y - 6],
          [x - 8 * s, y - 25 * s],
          [x - 3 * s, y - 54 * s],
          [x, y - 68 * s],
          [x + 5 * s, y - 44 * s],
          [x + 8 * s, y - 13],
        ],
        '#57796e',
      );
      for (let i = 0; i < 22; i++)
        r(x - 5 * s + noise(i + x) * 9 * s, y - 10 - noise(i + y) * 44 * s, 2, 4, '#9caa7b');
    }
    for (const [x, y, w] of [
      [70, 270, 245],
      [700, 269, 229],
    ]) {
      for (let i = 0; i < 110; i++) {
        const xx = x + noise(i + x) * w,
          yy = y + noise(i + y) * 23;
        r(xx, yy, 2 + noise(i) * 5, 2, ['#6d886e', '#9aa781', '#b5b090'][i % 3]);
      }
      for (let i = 0; i < 16; i++) {
        const xx = x + noise(i + x + 3) * w,
          h = 10 + noise(i + y) * 40;
        for (let j = 0; j < h; j += 5)
          r(xx + Math.sin(j) * 3, y + j, 4, 4, j % 3 ? '#748771' : '#a0a980');
      }
    }
    // Masonry chips, cracks and relief on the ancient guardian.
    for (let i = 0; i < 55; i++) {
      const x = 193 + noise(i + 74) * 34,
        y = 211 + noise(i + 52) * 45;
      r(x, y, 2, 2, i % 2 ? '#e0c8b4' : '#a18f99');
    }
    line(206, 151, 203, 165, '#9d8d96');
    line(203, 165, 207, 171, '#9d8d96');
    line(195, 224, 203, 231, '#988b95');
    line(203, 231, 201, 243, '#988b95');
    // Braziers on stone plinths.
    for (const x of [18, 940]) {
      r(x - 5, 205, 10, 15, '#ab8f94');
      r(x - 12, 198, 24, 8, '#b89590');
      r(x - 13, 196, 26, 3, '#efc69e');
    }
  } else if (theme === 'championship') {
    // Tier lips with warm concealed lights, exits and concrete aisle stairs.
    for (const y of [244, 284, 325]) {
      for (const [left, width] of [
        [0, 325],
        [635, 325],
      ]) {
        r(left, y, width, 4, '#9f7b87');
        r(left, y + 4, width, 2, '#ecc18f');
      }
      for (let x = 10; x < 960; x += 62) {
        if (x > 310 && x < 635) continue;
        r(x, y - 4, 18, 3, '#f8d294');
        r(x - 3, y - 6, 24, 8, '#f7c47a15');
      }
    }
    for (const x of [156, 783]) {
      for (let j = 0; j < 14; j++) {
        const y = 239 + j * 8;
        r(x - j * 0.3, y, 13 + j * 0.6, 3, '#7a8091');
        r(x - j * 0.3, y + 3, 13 + j * 0.6, 3, '#40546d');
      }
      r(x - 5, 222, 26, 10, '#8cbaa8');
      text(c, 'EXIT', x + 8, 230, 6, '#f4e3bd');
    }
    // Lighting gantry has individually cased lamps with warm pools of light.
    for (let i = 0; i < 26; i++) {
      const x = 14 + i * 37,
        y = 88 + Math.sin((i / 25) * Math.PI) * 24;
      r(x - 4, y - 4, 13, 13, '#455268');
      r(x - 2, y - 2, 9, 9, '#d6aa82');
      r(x, y, 5, 5, '#ffe5b0');
      r(x - 6, y - 6, 17, 17, '#ffcb8115');
    }
  }
}

function courtLighting(c, theme) {
  const { poly, rect: r, line } = tools(c);
  // Restrict the wash to the surface; lines and players retain contrast.
  if (theme === 'gym') {
    for (let i = 0; i < 4; i++) {
      const x = 76 + i * 119;
      poly(
        [
          [x, 408],
          [x + 57, 408],
          [x + 271, 494],
          [x + 193, 494],
        ],
        '#ffe5af35',
      );
      for (let j = 0; j < 6; j++) r(x + 164 + j * 10, 479 + j * 2, 15, 1, '#ffe7bb45');
    }
  } else if (theme === 'beach') {
    // Palm fronds cast long, broken shadows across the foreground sand.
    poly(
      [
        [7, 503],
        [39, 503],
        [178, 540],
        [136, 540],
      ],
      '#8b77933d',
    );
    for (let i = 0; i < 14; i++)
      line(120, 531, 165 + i * 13, 508 + Math.abs(i - 7) * 3, '#88749332', 3);
  } else if (theme === 'sky') {
    for (let j = 0; j < 24; j++) r(565 - j * 5, 410 + j * 3, 90 + j * 10, 1, '#ffe2ad20');
    poly(
      [
        [103, 408],
        [238, 408],
        [314, 496],
        [34, 496],
      ],
      '#6c689b20',
    );
  } else if (theme === 'alpine') {
    poly(
      [
        [102, 408],
        [240, 408],
        [182, 496],
        [33, 496],
      ],
      '#657aa323',
    );
  } else if (theme === 'championship') {
    poly(
      [
        [390, 408],
        [563, 408],
        [623, 496],
        [330, 496],
      ],
      '#ffe3bb18',
    );
  }
}

function ambientDetail(c, theme, t) {
  const { rect: r, line, poly, disc } = tools(c);
  if (theme === 'alpine') {
    // A few slow flakes, confined above the court so they never resemble the ball.
    for (let i = 0; i < 35; i++) {
      const x = (noise(i + 312) * 960 + Math.sin(t * 0.3 + i) * 10 + 960) % 960;
      const y = 93 + ((noise(i + 41) * 290 + t * (2 + (i % 3))) % 290);
      r(x, y, i % 4 ? 1 : 2, 2, '#f4f0e4a0');
    }
    for (const [x, y] of [
      [57, 169],
      [923, 200],
    ])
      for (let i = 0; i < 4; i++) {
        r(x + Math.sin(t + i) * 3 + i * 3, y - i * 9 - ((t * 3) % 9), 6 + i * 3, 3, '#e0d3ce70');
      }
  } else if (theme === 'gym') {
    for (let i = 0; i < 18; i++) {
      const x = 40 + noise(i + 52) * 250 + Math.sin(t * 0.3 + i) * 4;
      const y = 160 + ((noise(i + 88) * 140 + t * 1.5) % 140);
      r(x, y, 1, 1, '#fff0c280');
    }
  } else if (theme === 'farm') {
    for (let i = 0; i < 4; i++) {
      const x = 563 + i * 45 + Math.sin(t * 0.8 + i) * 8,
        y = 321 + Math.cos(t * 0.9 + i) * 6;
      const wing = Math.sin(t * 7 + i) > 0 ? 3 : 1;
      r(x - wing, y, wing, 2, '#edcd92');
      r(x + 1, y - 1, wing, 2, '#f0be89');
    }
  } else if (theme === 'sky') {
    for (const x of [18, 940]) {
      const h = 15 + Math.sin(t * 7 + x) * 3;
      poly(
        [
          [x - 8, 197],
          [x - 11, 190],
          [x - 5, 183],
          [x - 2, 197 - h],
          [x + 2, 184],
          [x + 7, 180],
          [x + 9, 194],
          [x + 4, 198],
        ],
        '#efb17d',
      );
      poly(
        [
          [x - 4, 197],
          [x - 1, 185],
          [x + 4, 197],
        ],
        '#ffe5a3',
      );
    }
    for (let i = 0; i < 16; i++) {
      const x = 320 + noise(i + 12) * 345,
        y = 340 + noise(i + 8) * 40;
      r(x + Math.sin(t + i) * 4, y, 2, 1, '#fff0c380');
    }
  } else if (theme === 'championship') {
    // Camera flashes are isolated in the stands, with long gaps between bursts.
    for (let i = 0; i < 9; i++) {
      if ((t + i * 1.73) % 9 > 0.09) continue;
      const x = 30 + noise(i + 44) * 890,
        y = 235 + noise(i + 3) * 80;
      line(x - 3, y, x + 3, y, '#e9f3ec', 1);
      line(x, y - 3, x, y + 3, '#e9f3ec', 1);
    }
  }
}

function scenicForeground(c, theme) {
  const { rect: r, line, poly, disc } = tools(c);
  if (theme === 'farm') {
    for (let i = 0; i < 360; i++) {
      const x = noise(i + 52) * 960;
      const edge = x < 95 || x > 780;
      const y = edge ? 524 + noise(i + 12) * 16 : 538 + noise(i + 12) * 10;
      const h = 5 + noise(i + 5) * (edge ? 30 : 13);
      line(
        x,
        y,
        x + Math.sin(i) * 6,
        y - h,
        ['#486b50', '#6b854f', '#a1aa62', '#b9b86e'][i % 4],
        2,
      );
      if (i % 11 === 0) {
        disc(x, y - h, 3, '#e9e0b1');
        r(x - 1, y - h - 1, 2, 2, '#ccaa58');
      }
    }
    for (const [x, y, s] of [
      [17, 540, 1.45],
      [62, 557, 1.2],
      [851, 554, 1.5],
      [927, 544, 1.3],
    ])
      sunflower(c, x, y, s);
  } else if (theme === 'beach') {
    for (const [x, sign] of [
      [0, 1],
      [960, -1],
    ]) {
      for (let i = 0; i < 8; i++) {
        const tipX = x + sign * (21 + i * 10),
          tipY = 483 + (i % 3) * 12;
        line(x, 540, tipX, tipY, '#315c59', 3);
        for (let j = 1; j < 8; j++) {
          const t = j / 8,
            xx = x + (tipX - x) * t,
            yy = 540 + (tipY - 540) * t;
          line(xx, yy, xx + sign * (13 * (1 - t) + 3), yy - 9, '#487966', 2);
          line(xx, yy, xx - sign * 8, yy - 7, '#5f896c', 2);
        }
      }
    }
    for (let i = 0; i < 9; i++) {
      const x = 610 + i * 13,
        y = 517 + (i % 3) * 3;
      r(x, y, 3, 2, '#f4dab1');
      r(x + 1, y - 1, 1, 1, '#fff0d0');
    }
  } else if (theme === 'sky') {
    for (const x of [9, 903]) {
      for (let i = 0; i < 50; i++) {
        const xx = x + noise(i + x) * 45,
          yy = 521 + noise(i + 30) * 19;
        r(xx, yy, 2 + noise(i) * 5, 2, ['#647c70', '#88977a', '#b2aa89'][i % 3]);
      }
      line(x + 4, 514, x + 26, 537, '#665f7a', 1);
      line(x + 26, 537, x + 39, 532, '#665f7a', 1);
    }
  } else if (theme === 'alpine') {
    for (const x of [17, 925]) {
      line(x, 540, x - 5, 507, '#707c88', 2);
      for (let i = 0; i < 5; i++) {
        line(x - 3, 516 + i * 5, x - 11, 513 + i * 5, '#526f75', 2);
        line(x - 3, 518 + i * 5, x + 7, 515 + i * 5, '#587b7e', 2);
        r(x - 10, 512 + i * 5, 8, 2, '#f6eee4');
      }
    }
  }
}
