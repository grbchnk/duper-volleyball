// Native Canvas scenery. Every object is drawn on the logical pixel grid;
// sky, architecture, foliage, props and people remain separate animation layers.
import { STREET_COURT } from './court-visual.js';
export const STREET_SEATS = [
  [275, 315],
  [321, 315],
  [449, 315],
  [507, 315],
  [558, 315],
  [601, 330],
  [644, 321],
  [689, 325],
  [733, 321],
  [774, 315],
  [355, 351],
  [399, 351],
  [80, 163],
  [924, 173],
];

export function pixelTools(c) {
  const rect = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const line = (ax, ay, bx, by, color, width = 1) => {
    ax = Math.round(ax);
    ay = Math.round(ay);
    bx = Math.round(bx);
    by = Math.round(by);
    const dx = Math.abs(bx - ax),
      sx = ax < bx ? 1 : -1;
    const dy = -Math.abs(by - ay),
      sy = ay < by ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      rect(ax - Math.floor(width / 2), ay - Math.floor(width / 2), width, width, color);
      if (ax === bx && ay === by) break;
      const e = 2 * error;
      if (e >= dy) {
        error += dy;
        ax += sx;
      }
      if (e <= dx) {
        error += dx;
        ay += sy;
      }
    }
  };
  const path = (points, color, width = 1, close = false) => {
    for (let i = 1; i < points.length; i++) line(...points[i - 1], ...points[i], color, width);
    if (close) line(...points.at(-1), ...points[0], color, width);
  };
  const disc = (x, y, radius, color) => {
    for (let row = -radius; row <= radius; row++) {
      const w = Math.floor(Math.sqrt(radius * radius - row * row));
      rect(x - w, y + row, w * 2 + 1, 1, color);
    }
  };
  return { rect, line, path, disc };
}
const noise = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const mix = (a, b, t) =>
  '#' +
  [0, 1, 2]
    .map((i) =>
      Math.round(
        parseInt(a.slice(1 + i * 2, 3 + i * 2), 16) * (1 - t) +
          parseInt(b.slice(1 + i * 2, 3 + i * 2), 16) * t,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

export function drawStreetSky(c, time = 0) {
  const { rect: r, disc } = pixelTools(c);
  r(0, 0, 960, 540, '#e9ae91');
  const stops = [
    [0, '#776f9d'],
    [75, '#9c7caa'],
    [141, '#dc8eaa'],
    [211, '#ff9e87'],
    [286, '#ffd496'],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [top, a] = stops[i],
      [bottom, b] = stops[i + 1];
    for (let y = top; y < bottom; y += 3) r(0, y, 960, 3, mix(a, b, (y - top) / (bottom - top)));
  }
  disc(770, 211, 36, '#ffe797');
  r(734, 222, 73, 3, '#f8c48b');
  r(744, 241, 53, 4, '#f4bd88');
  for (let i = 0; i < 23; i++) {
    const x = ((i * 137 + time * (0.35 + (i % 3) * 0.13)) % 1100) - 80;
    const y = 90 + noise(i + 12) * 100;
    const w = 14 + noise(i + 32) * 60;
    r(x, y, w, 2, i % 3 ? '#ffa48b' : '#ee999e');
    r(x + w * 0.28, y - 3, w * 0.5, 3, i % 3 ? '#ffb28b' : '#ee999e');
    if (i % 4 === 0) {
      r(x + w * 0.4, y - 6, w * 0.23, 3, '#ffad8c');
      r(x + w * 0.17, y + 2, w * 0.9, 2, '#fda092');
    }
  }
}

function tree(c, x, y, scale = 1) {
  const { rect: r, line } = pixelTools(c);
  line(x, y + 58 * scale, x + 5 * scale, y, '#5f706d', 5 * scale);
  for (let branch = 0; branch < 8; branch++) {
    const tx = x + (noise(branch + x) - 0.5) * 64 * scale;
    const ty = y + (noise(branch + x + 10) - 0.5) * 38 * scale;
    line(x + 3, y + 26 * scale, tx, ty, '#687764', 2);
    for (let leaf = 0; leaf < 17; leaf++) {
      const lx = tx + (noise(leaf * 3 + branch + x) - 0.5) * 22 * scale;
      const ly = ty + (noise(leaf * 5 + branch + x) - 0.5) * 24 * scale;
      r(
        lx,
        ly,
        (3 + noise(leaf + x) * 5) * scale,
        5 * scale,
        ['#727e6b', '#82906a', '#a39f70', '#687b71', '#9d9b6a'][leaf % 5],
      );
    }
  }
}

function fence(c, x, y, w, h, color = '#555d70') {
  const { rect: r, line } = pixelTools(c);
  for (let k = -h; k < w; k += 9) {
    const start = Math.max(0, -k),
      end = Math.min(h, w - k);
    if (end > start) line(x + k + start, y + start, x + k + end, y + end, color);
    const start2 = Math.max(0, k),
      end2 = Math.min(w, k + h);
    if (end2 > start2) line(x + start2, y + h - start2 + k, x + end2, y + h - end2 + k, color);
  }
  r(x, y, w, 2, '#444d61');
  for (let px = x; px <= x + w; px += 81) {
    r(px, y - 6, 4, h + 9, '#454b5d');
    r(px + 3, y - 4, 1, h + 5, '#9a8b87');
  }
}

export function drawStreetCity(c) {
  const { rect: r, line, path, disc } = pixelTools(c);
  // Distant city: three depth planes, rooftop water tanks and sunset-facing edges.
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 19; i++) {
      const x = 95 + i * 43 + layer * 13;
      const top = [245, 244, 263][layer] - noise(i * 7 + layer * 91) * [48, 65, 44][layer];
      const width = 16 + noise(i + layer * 8) * 35;
      r(x, top, width, 275 - top, ['#9b8da7', '#8c889c', '#777d91'][layer]);
      if (i % 3 === 0) r(x + 5, top - 8, width * 0.58, 9, ['#9b8da7', '#8c889c', '#777d91'][layer]);
      if (i % 4 === 0) r(x + width - 2, top + 5, 2, 275 - top, '#b59ca8');
      if (layer === 2) for (let j = 0; j < 4; j++) r(x + 5 + j * 7, top + 13, 3, 7, '#a8a0a7');
    }
  }
  r(142, 163, 70, 97, '#777c92');
  r(150, 141, 58, 24, '#858199');
  r(213, 165, 70, 96, '#7a7d92');
  r(284, 190, 41, 73, '#6e788b');
  for (const x of [244, 257, 270]) r(x, 178, 6, 14, '#ddbc9c');
  r(561, 153, 20, 103, '#8b859d');
  r(566, 145, 9, 10, '#8b859d');
  for (let i = 0; i < 16; i++) tree(c, 153 + i * 48, 246 + noise(i) * 20, 0.7);
  tree(c, 204, 222, 0.85);
  tree(c, 274, 234, 0.9);
  for (const [px, py] of [
    [354, 219],
    [380, 224],
  ]) {
    line(px, 269, px - 3, py, '#667868', 4);
    for (let leaf = 0; leaf < 7; leaf++) {
      const angle = (leaf * Math.PI) / 4 + 0.1;
      const x = px + Math.cos(angle) * 26,
        y = py + Math.sin(angle) * 17;
      path(
        [
          [px - 3, py],
          [px + (x - px) * 0.6, py + (y - py) * 0.3 - 8],
          [x, y],
        ],
        leaf % 2 ? '#858a6b' : '#728470',
        4,
      );
      path(
        [
          [px - 3, py - 1],
          [x, y - 2],
        ],
        '#9b9b73',
      );
    }
  }
}

export function drawStreetArchitecture(c) {
  const { rect: r, line, path, disc } = pixelTools(c);
  r(170, 275, 715, 49, '#738178');
  for (let i = 0; i < 340; i++) {
    const x = 177 + noise(i + 811) * 705,
      y = 273 + noise(i + 217) * 48;
    r(
      x,
      y,
      3 + noise(i) * 6,
      3 + noise(i + 31) * 5,
      ['#84916f', '#a0a176', '#607770', '#8d9670'][i % 4],
    );
  }
  // Backstreet car, separate wheels and windows.
  r(548, 284, 184, 24, '#a84e63');
  r(565, 280, 146, 6, '#db7c77');
  path(
    [
      [554, 284],
      [570, 274],
      [696, 274],
      [718, 286],
    ],
    '#c96d71',
    6,
  );
  r(576, 279, 54, 12, '#676c7b');
  r(637, 279, 51, 12, '#676c7b');
  r(553, 296, 176, 3, '#d8877c');
  r(641, 292, 6, 2, '#f0ab84');
  disc(578, 307, 8, '#454b59');
  disc(700, 307, 8, '#454b59');
  disc(578, 307, 4, '#8c8490');
  disc(700, 307, 4, '#8c8490');
  fence(c, 204, 253, 678, 78, '#575e70');
  // Utility poles, insulators and individually sagging wires.
  for (const [x, y, h] of [
    [339, 158, 112],
    [439, 144, 119],
    [665, 171, 110],
    [840, 116, 159],
  ]) {
    r(x - 2, y, 5, h, '#5d5c71');
    r(x - 7, y + 7, 18, 3, '#646174');
    r(x - 6, y - 4, 2, 10, '#615e72');
    r(x + 5, y - 2, 3, 11, '#615e72');
    if (x === 665) {
      r(x - 11, y + 15, 25, 4, '#646174');
      r(x + 9, y + 9, 3, 17, '#646174');
    }
  }
  const wire = (x1, y1, x2, y2, sag) => {
    let last = [x1, y1];
    for (let t = 0.05; t <= 1.01; t += 0.05) {
      const p = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * sag];
      line(...last, ...p, '#746b7c');
      last = p;
    }
  };
  wire(200, 154, 339, 165, 7);
  wire(339, 165, 439, 151, 6);
  wire(439, 151, 665, 183, 7);
  wire(665, 183, 840, 128, 7);
  wire(840, 128, 909, 148, 6);
  // Left masonry building, recessed windows and fire escape.
  r(0, 49, 95, 311, '#ad686c');
  r(0, 54, 91, 5, '#b87977');
  r(92, 57, 6, 182, '#c58279');
  r(0, 234, 171, 8, '#ca8a7d');
  for (const [x, y] of [
    [-15, 88],
    [43, 87],
  ]) {
    r(x, y, 35, 60, '#644f60');
    r(x + 3, y + 4, 28, 52, '#3d4558');
    r(x + 4, y + 6, 2, 48, '#7f7882');
    r(x + 17, y + 4, 2, 52, '#929099');
    r(x - 2, y - 3, 39, 4, '#875d6a');
    r(x - 1, y + 37, 37, 3, '#9d858a');
  }
  r(0, 180, 127, 7, '#41485b');
  r(0, 145, 128, 4, '#42495d');
  for (let x = 4; x < 128; x += 17) r(x, 146, 3, 36, '#444a5d');
  path(
    [
      [9, 188],
      [-25, 256],
    ],
    '#44495c',
    3,
  );
  path(
    [
      [36, 188],
      [1, 256],
    ],
    '#44495c',
    3,
  );
  for (let i = 0; i < 11; i++) line(7 - i * 3, 193 + i * 6, 34 - i * 3, 193 + i * 6, '#44495c', 2);
  path(
    [
      [108, 183],
      [104, 220],
      [87, 234],
    ],
    '#4b5162',
    4,
  );
  r(0, 260, 89, 119, '#4c5263');
  r(0, 265, 82, 111, '#777b88');
  for (let y = 270; y < 376; y += 10) r(0, y, 83, 2, '#686e80');
  r(103, 231, 73, 141, '#9b666d');
  r(107, 239, 65, 3, '#c48a7b');
  r(168, 240, 7, 119, '#786272');
  path(
    [
      [118, 289],
      [126, 304],
      [159, 292],
      [151, 269],
      [141, 288],
      [132, 270],
      [128, 292],
      [118, 289],
    ],
    '#d3a072',
    3,
  );
  // Patina is seeded and never consumes the physics random stream.
  for (let i = 0; i < 150; i++) {
    const x = noise(i + 51) * 170,
      y = 65 + noise(i + 311) * 297;
    if (x > 99 || y < 84 || y > 196)
      r(x, y, 2 + noise(i + 25) * 7, 2, i % 2 ? '#b57472' : '#bc7d76');
  }
  r(125, 47, 8, 192, '#4a4e62');
  r(134, 57, 4, 179, '#80747e');
  r(121, 71, 26, 8, '#4a4e62');
  r(142, 44, 6, 38, '#53536a');
  r(199, 76, 6, 186, '#4b5062');
  r(204, 86, 23, 5, '#57576d');
  r(221, 85, 13, 6, '#ffda91');
  r(222, 83, 13, 3, '#767078');
  wire(98, 83, 200, 87, 12);
  wire(98, 100, 200, 97, 9);
  // Right brick wall, drainpipe, balcony and hoop.
  r(895, 40, 65, 287, '#626276');
  r(906, 46, 54, 271, '#696a7d');
  for (let y = 66; y < 262; y += 23) {
    r(904, y, 56, 2, '#5e6075');
    for (let x = 910 + (y % 46 ? 0 : 16); x < 960; x += 33) r(x, y, 2, 22, '#5d6074');
  }
  r(889, 55, 8, 202, '#474c60');
  r(882, 95, 17, 5, '#474c60');
  path(
    [
      [884, 99],
      [884, 111],
      [891, 118],
    ],
    '#474c60',
    4,
  );
  r(881, 205, 79, 180, '#916a75');
  r(876, 198, 84, 11, '#ac777b');
  r(881, 199, 79, 3, '#d08c80');
  r(942, 216, 6, 173, '#514f66');
  r(902, 222, 57, 47, '#555468');
  r(906, 225, 49, 41, '#d7b8b5');
  path(
    [
      [920, 266],
      [920, 247],
      [936, 247],
      [936, 266],
    ],
    '#985f6d',
    2,
  );
  r(913, 265, 32, 3, '#b16d70');
  for (let i = 0; i < 5; i++) {
    line(916 + i * 6, 269, 923 + i * 3, 286, '#d0b5aa');
    line(916 + i * 6, 269, 930, 285, '#d0b5aa');
  }
  // Terraces and wall: every spectator has a concrete ledge beneath their feet.
  r(174, 316, 612, 64, '#777786');
  r(175, 317, 610, 3, '#ac9690');
  r(248, 337, 536, 6, '#626a7c');
  r(247, 339, 538, 3, '#b6998b');
  r(255, 343, 529, 37, '#747583');
  r(255, 345, 529, 2, '#8d8389');
  for (const [a, b] of [
    [247, 471],
    [538, 783],
  ]) {
    r(a, 334, b - a, 5, '#c09780');
    r(a, 338, b - a, 3, '#555c6c');
    for (let x = a + 9; x < b; x += 72) r(x, 342, 4, 11, '#525c6d');
  }
  r(175, 371, 609, 9, '#646d7b');
  r(783, 276, 95, 107, '#6a737f');
  r(784, 276, 95, 4, '#98908c');
  // Hand-drawn graffiti with pixel strokes, rather than platform-dependent fonts.
  path(
    [
      [187, 350],
      [195, 340],
      [206, 342],
      [212, 353],
      [202, 364],
      [193, 352],
      [204, 340],
      [219, 337],
      [226, 344],
      [220, 354],
      [232, 358],
      [228, 368],
      [214, 367],
    ],
    '#8b80a4',
    7,
  );
  path(
    [
      [16, 321],
      [12, 301],
      [21, 295],
      [31, 317],
      [40, 321],
      [37, 300],
      [47, 292],
      [50, 311],
      [61, 294],
      [70, 297],
      [63, 317],
      [51, 328],
      [66, 341],
    ],
    '#9493a3',
    7,
  );
  disc(827, 310, 27, '#8593a0');
  disc(827, 310, 22, '#6a737f');
  r(815, 298, 4, 8, '#8593a0');
  r(835, 298, 4, 8, '#8593a0');
  path(
    [
      [813, 318],
      [819, 325],
      [831, 326],
      [840, 319],
    ],
    '#8593a0',
    3,
  );
  path(
    [
      [900, 319],
      [888, 302],
      [899, 295],
      [912, 314],
      [921, 309],
      [915, 292],
      [930, 297],
      [932, 317],
      [946, 311],
    ],
    '#c18c8a',
    9,
  );
  path(
    [
      [892, 349],
      [904, 331],
      [919, 334],
      [925, 344],
      [917, 353],
      [902, 351],
      [915, 368],
      [933, 370],
    ],
    '#b18a96',
    7,
  );
  // Ground texture and perspective markings.
  r(0, 382, 960, 158, '#9a8986');
  r(0, 388, 960, 3, '#ae9388');
  r(60, 396, 840, 102, '#ac9489');
  for (let i = 0; i < 1300; i++) {
    const x = noise(i + 1000) * 960,
      y = 383 + noise(i + 3000) * 157;
    r(
      x,
      y,
      2 + noise(i + 5000) * 14,
      i % 4 === 0 ? 2 : 1,
      ['#a08d88', '#b09a8c', '#99878a', '#b39b8d'][i % 4],
    );
  }
  // Preserve the original perspective. Line calls intersect these end lines
  // with the fixed gameplay lane rather than flattening the painted court.
  const { backLeft, backRight, frontLeft, frontRight, backY, frontY } = STREET_COURT;
  path(
    [
      [backLeft, backY],
      [backRight, backY],
      [frontRight, frontY],
      [frontLeft, frontY],
      [backLeft, backY],
    ],
    '#f3dcc0',
    2,
  );
  line(342, 408, 314, 496, '#f3dcc0', 2);
  line(618, 408, 650, 496, '#f3dcc0', 2);
  line(479, 408, 494, 496, '#ead3bc', 2);
  // Small environmental props, all independently repaintable.
  for (const x of [17, 723]) {
    r(x, 358, 48, 22, '#4d5364');
    r(x + 3, 360, 42, 17, '#92909c');
    r(x + 6, 355, 18, 3, '#3c4355');
    r(x + 6, 361, 34, 2, '#535c6e');
    disc(x + 12, 369, 6, '#424b5d');
    disc(x + 35, 369, 6, '#424b5d');
    disc(x + 12, 369, 3, '#71798a');
    disc(x + 35, 369, 3, '#71798a');
    r(x + 23, 364, 5, 9, '#596276');
  }
  // Bicycle and board leaning against the wall.
  for (const x of [95, 115]) {
    disc(x, 365, 11, '#424c61');
    disc(x, 365, 8, '#9a8986');
    disc(x, 365, 2, '#65758a');
  }
  path(
    [
      [95, 365],
      [100, 346],
      [115, 365],
      [95, 365],
      [108, 349],
      [116, 348],
    ],
    '#a3a2aa',
    2,
  );
  path(
    [
      [101, 346],
      [99, 333],
      [105, 331],
    ],
    '#dfc5aa',
    2,
  );
  r(106, 345, 9, 2, '#414b5e');
  path(
    [
      [140, 334],
      [145, 328],
      [153, 328],
      [157, 334],
      [153, 370],
      [148, 375],
      [140, 372],
      [140, 334],
    ],
    '#d28c79',
    2,
  );
  path(
    [
      [142, 336],
      [146, 331],
      [152, 333],
      [153, 340],
      [150, 369],
      [145, 371],
    ],
    '#527b7d',
    3,
  );
  r(867, 354, 27, 30, '#535b6e');
  r(870, 357, 19, 25, '#878896');
  for (const x of [874, 881, 888]) r(x, 359, 2, 22, '#525c70');
  // Weeds over the wall and at the bases of the buildings.
  for (let i = 0; i < 150; i++) {
    const x = 99 + noise(i + 710) * 784,
      y = 375 + noise(i + 913) * 6;
    if (x > 240 && x < 782 && i % 3) continue;
    line(
      x,
      y,
      x + (noise(i + 912) - 0.5) * 8,
      y - 3 - noise(i + 211) * 12,
      ['#687d70', '#829073', '#9c9d73'][i % 3],
      2,
    );
  }
  // Foreground silhouettes frame the court without covering the play area.
}

export function drawStreetForeground(c) {
  const { rect: r, line, path } = pixelTools(c);
  fence(c, 0, 478, 67, 62, '#3f4a60');
  fence(c, 887, 482, 73, 58, '#3f4a60');
  r(0, 472, 70, 5, '#37465b');
  r(8, 468, 7, 72, '#3c4c62');
  r(56, 471, 8, 69, '#3c4c62');
  r(885, 479, 75, 5, '#37465b');
  r(884, 477, 8, 63, '#3c4c62');
  r(946, 472, 8, 68, '#3c4c62');
  r(108, 510, 91, 30, '#333f52');
  r(112, 505, 83, 10, '#4e4559');
  r(120, 502, 65, 4, '#735b69');
  r(117, 510, 70, 5, '#2b374a');
  r(193, 516, 9, 24, '#51495c');
  r(214, 519, 28, 21, '#414a5c');
  r(220, 516, 21, 5, '#52586a');
  r(266, 519, 139, 4, '#414b5d');
  r(266, 514, 8, 26, '#3c485c');
  r(398, 511, 8, 29, '#3c485c');
  fence(c, 273, 525, 125, 15, '#4f586b');
  r(773, 513, 110, 27, '#9a6f58');
  r(780, 509, 97, 5, '#c28a60');
  path(
    [
      [775, 512],
      [802, 502],
      [888, 508],
      [873, 520],
      [775, 512],
    ],
    '#bf8c65',
    4,
  );
  for (const x of [793, 822, 851]) line(x, 512, x + 22, 506, '#694d48', 4);
  for (const y of [522, 533]) r(778, y, 101, 3, '#624e4b');
  r(729, 524, 13, 16, '#57778b');
  r(733, 518, 6, 7, '#a5aaa5');
  r(731, 524, 3, 12, '#a1b0ad');
}

export function drawStreetLife(c, time, ball, live) {
  const { rect: r, line, disc, path } = pixelTools(c);
  const t = live ? time : 0;
  // Warm lamps, an occasional window flicker and a car indicator.
  r(222, 87, 10, 3, Math.sin(t * 0.73) > 0.97 ? '#e8b887' : '#ffe0a0');
  if (Math.sin(t * 0.8) > 0.15) r(269, 179, 4, 12, '#f1c69c');
  if (Math.sin(t * 1.6) > 0.7) r(721, 293, 6, 3, '#f8bc7a');
  for (let i = 0; i < 18; i++) {
    const x = 159 + i * 37,
      sway = Math.round(Math.sin(t * 1.4 + i) * 1.5);
    r(x + sway, 371 - (i % 4) * 2, 3, 5, ['#7e8c70', '#9b9d73', '#75856d'][i % 3]);
    if (i % 3 === 0) r(x + sway + 3, 371 - (i % 4) * 2, 2, 2, '#b5a579');
  }
  // The dog watches the ball, and wags faster during the crowd's celebrations.
  const look = live ? Math.max(-1, Math.min(1, Math.round((ball.x - 175) / 200))) : 0;
  r(164, 354, 20, 25, '#785944');
  r(168, 355, 12, 21, '#bb855b');
  r(166, 366, 6, 13, '#d7b080');
  r(176, 367, 5, 12, '#d7b080');
  r(164 + look, 347, 17, 15, '#b57c53');
  path(
    [
      [165 + look, 350],
      [165 + look, 343],
      [170 + look, 347],
    ],
    '#5d493e',
    3,
  );
  path(
    [
      [175 + look, 347],
      [181 + look, 342],
      [181 + look, 352],
    ],
    '#5d493e',
    3,
  );
  r(168 + look, 351, 2, 3, '#363c42');
  r(176 + look, 351, 2, 3, '#363c42');
  r(171 + look, 356, 5, 3, '#493d38');
  line(
    183,
    374,
    190 + Math.round(Math.sin(t * 4) * 3),
    368 + Math.round(Math.cos(t * 4) * 3),
    '#624b40',
    4,
  );
  // Slow drifting dust motes stay behind the court and never resemble a ball.
  if (live)
    for (let i = 0; i < 7; i++) {
      const x = 210 + ((i * 83 + t * 2) % 570),
        y = 270 + ((i * 29 + Math.sin(t + i) * 4) % 100);
      r(x, y, 1, 1, '#d8ba95');
    }
  // Tiny speaker LEDs pulse with the scene clock.
  disc(54, 363, 1, Math.sin(t * 3) > 0 ? '#d7ad81' : '#997b79');
}
