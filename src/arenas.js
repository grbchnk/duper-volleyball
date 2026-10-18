import {
  drawStreetSky,
  drawStreetCity,
  drawStreetArchitecture,
  drawStreetForeground,
} from './street-scene.js';
// Court coordinates are identical in every location.
export const ARENAS = {
  miami: {
    name: 'Город · закат',
    subtitle: 'Тёплый асфальт, граффити и вечерний матч',
    court: '#e7bdad',
    edge: '#cb9da4',
    floor: '#8b9da2',
  },
  street: {
    name: 'Уличная площадка',
    subtitle: 'Кирпич, граффити и тёплые окна',
    court: '#a0b9b5',
    edge: '#809f9d',
    floor: '#8d9c98',
  },
  paris: {
    name: 'Париж',
    subtitle: 'Площадь у Сены и огни бульвара',
    court: '#d9c3a9',
    edge: '#bca18e',
    floor: '#a4b2a2',
  },
  stadium: {
    name: 'Внутри стадиона',
    subtitle: 'Тихий свет трибун и паркет',
    court: '#d9b98a',
    edge: '#ad8d70',
    floor: '#638d91',
  },
};
export function spectatorPlace(index) {
  const y = 338 + (index % 2) * 8;
  return { x: 65 + index * 47, y, groundY: y + 26 };
}
export function drawArenaBackdrop(c, theme = 'miami', time = 0) {
  if (theme === 'miami') {
    drawStreetSky(c, time);
    drawStreetCity(c);
    drawStreetArchitecture(c);
    drawStreetForeground(c);
    return;
  }
  const arena = ARENAS[theme] || ARENAS.miami;
  const r = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const line = (points, color, width = 3) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };
  const windows = (x, y, w, h, color) => {
    for (let dx = 9; dx < w - 5; dx += 17)
      for (let dy = 12; dy < h - 10; dy += 23) r(x + dx, y + dy, 6, 11, color);
  };
  const palm = (x, y, scale = 1) => {
    line(
      [
        [x, y],
        [x - 7 * scale, y - 48 * scale],
        [x + 2 * scale, y - 103 * scale],
      ],
      '#6d7376',
      8 * scale,
    );
    for (const [dx, dy] of [
      [-49, 7],
      [-37, -21],
      [-11, -33],
      [25, -29],
      [49, -4],
      [36, 22],
    ]) {
      line(
        [
          [x + 2 * scale, y - 103 * scale],
          [x + dx * scale * 0.55, y - 103 * scale + dy * scale * 0.4],
          [x + dx * scale, y - 103 * scale + dy * scale],
        ],
        '#416e75',
        8 * scale,
      );
      line(
        [
          [x + 2 * scale, y - 103 * scale],
          [x + dx * scale * 0.65, y - 100 * scale + dy * scale * 0.4],
        ],
        '#628c86',
        3 * scale,
      );
    }
  };
  if (theme === 'stadium') {
    r(0, 0, 960, 540, '#304956');
    r(0, 83, 960, 158, '#4b6875');
    for (let x = 20; x < 960; x += 110) {
      line(
        [
          [x, 69],
          [x + 55, 135],
          [x + 110, 69],
        ],
        '#9cabb0',
        4,
      );
      r(x + 35, 143, 42, 6, '#f5e3b2');
      r(x + 39, 149, 34, 6, '#b4cdbe');
    }
    for (let row = 0; row < 4; row++) {
      r(0, 216 + row * 37, 960, 35, ['#557885', '#63858d', '#74969a', '#85a6a5'][row]);
      for (let x = 12; x < 960; x += 27) {
        r(x, 220 + row * 37, 17, 14, row % 2 ? '#b2c6bd' : '#8baab3');
        r(x + 2, 234 + row * 37, 13, 5, '#d0c4a8');
      }
    }
    r(347, 158, 266, 46, '#294451');
    c.fillStyle = '#f6dfaf';
    c.font = 'bold 15px monospace';
    c.textAlign = 'center';
    c.fillText('D U P E R   D O M E', 480, 187);
    r(0, 361, 960, 179, arena.floor);
  } else if (theme === 'street') {
    r(0, 0, 960, 540, '#bfd6d3');
    r(0, 120, 960, 210, '#d7d8c5');
    for (let i = 0; i < 10; i++) {
      const x = i * 104 - 20,
        y = 139 + ((i * 37) % 65),
        h = 180;
      r(x, y, 99, h, ['#a99798', '#b9a48e', '#8d9da0'][i % 3]);
      r(x - 3, y - 8, 105, 10, '#7c8286');
      windows(x, y, 99, h, '#e8d8ae');
      for (let by = y + 8; by < y + h; by += 14)
        for (let bx = x + (by % 28 ? 0 : 7); bx < x + 99; bx += 20) r(bx, by, 15, 1, '#d0b6a0');
    }
    r(0, 278, 960, 84, '#b6afa0');
    r(0, 278, 960, 5, '#dfccb0');
    c.font = 'bold 36px monospace';
    c.textAlign = 'left';
    c.fillStyle = '#758f9d';
    c.fillText('PLAY', 119, 327);
    c.fillStyle = '#ebc69c';
    c.fillText('ONE MORE', 550, 329);
    for (let x = 0; x < 960; x += 34)
      line(
        [
          [x, 354],
          [x + 58, 297],
        ],
        '#829e9c',
        1,
      );
    line(
      [
        [0, 296],
        [960, 296],
      ],
      '#6f8b8a',
      3,
    );
    line(
      [
        [0, 354],
        [960, 354],
      ],
      '#6f8b8a',
      3,
    );
    for (const x of [57, 904]) {
      r(x, 189, 5, 168, '#607c7f');
      r(x - 14, 185, 33, 6, '#f5dfac');
      r(x - 9, 191, 23, 5, '#c6c6a0');
    }
    r(0, 362, 960, 178, arena.floor);
  } else if (theme === 'paris') {
    r(0, 0, 960, 540, '#cbd5df');
    r(0, 110, 960, 100, '#e8d6c9');
    r(0, 210, 960, 150, '#c6c5b7');
    // Eiffel silhouette, tucked into the skyline rather than the play area.
    const x = 239;
    line(
      [
        [x, 119],
        [x - 11, 184],
        [x - 26, 238],
        [x - 58, 294],
      ],
      '#86969a',
      7,
    );
    line(
      [
        [x, 119],
        [x + 11, 184],
        [x + 26, 238],
        [x + 58, 294],
      ],
      '#86969a',
      7,
    );
    for (const [y, w] of [
      [185, 17],
      [222, 28],
      [245, 42],
      [270, 52],
    ]) {
      r(x - w, y, w * 2, 5, '#86969a');
      line(
        [
          [x - w, y],
          [x + w * 0.7, y - 22],
        ],
        '#94a2a2',
        2,
      );
      line(
        [
          [x + w, y],
          [x - w * 0.7, y - 22],
        ],
        '#94a2a2',
        2,
      );
    }
    r(x - 2, 104, 4, 24, '#86969a');
    for (const [bx, by, w, h] of [
      [0, 230, 117, 121],
      [349, 205, 111, 146],
      [472, 229, 118, 122],
      [614, 193, 123, 158],
      [769, 218, 143, 133],
    ]) {
      r(bx, by, w, h, '#d8cbb7');
      r(bx - 6, by - 15, w + 12, 17, '#7c8b94');
      r(bx - 3, by - 18, w + 6, 5, '#99a3a6');
      windows(bx, by, w, h, '#f8dfb4');
      for (let dy = 34; dy < h; dy += 23) {
        r(bx, by + dy, w, 2, '#b0a99c');
        for (let xx = bx + 7; xx < bx + w; xx += 17) r(xx, by + dy - 5, 10, 2, '#838e90');
      }
    }
    for (const bx of [61, 332, 765, 922]) {
      r(bx, 289, 4, 78, '#5c777a');
      r(bx - 7, 276, 18, 17, '#f2d69f');
      r(bx - 10, 274, 24, 4, '#5c777a');
      r(bx - 2, 267, 7, 7, '#5c777a');
    }
    r(0, 365, 960, 175, arena.floor);
  } else {
    // Sunset bands, art-deco facades, a turquoise bay and hand-drawn palms.
    const bands = ['#8e9ebd', '#aaa9c6', '#c4b4c9', '#ddbdc7', '#edc8bd', '#f4d5b7'];
    bands.forEach((col, i) => r(0, i * 44, 960, 45, col));
    for (const [radius, color] of [
      [82, '#ffe9bb12'],
      [71, '#ffe9bb18'],
      [61, '#ffe9bb25'],
    ]) {
      c.fillStyle = color;
      c.beginPath();
      c.arc(727, 173, radius, 0, Math.PI * 2);
      c.fill();
    }
    for (let ray = 0; ray < 12; ray++) {
      const angle = (ray * Math.PI) / 6;
      for (let distance = 63; distance < 83; distance += 4)
        r(
          Math.round((727 + Math.cos(angle) * distance) / 2) * 2,
          Math.round((173 + Math.sin(angle) * distance) / 2) * 2,
          2,
          2,
          '#ffe8b85c',
        );
    }
    c.fillStyle = '#ffe5ba';
    c.beginPath();
    c.arc(727, 173, 51, 0, Math.PI * 2);
    c.fill();
    r(0, 264, 960, 101, '#8cb8b8');
    for (let i = 0; i < 22; i++)
      r((i * 137) % 960, 271 + ((i * 17) % 79), 22 + (i % 4) * 11, 2, '#b8d2c8');
    for (const [x, y, w, h, col] of [
      [43, 198, 77, 98, '#c5b8c8'],
      [133, 218, 90, 78, '#efd1ba'],
      [271, 229, 84, 67, '#b2b9c8'],
      [580, 230, 79, 66, '#d8c3bb'],
      [821, 202, 96, 94, '#d7b6c5'],
    ]) {
      r(x, y, w, h, col);
      r(x + 8, y - 11, w - 16, 12, col);
      r(x + 17, y - 17, w - 34, 7, col);
      windows(x, y, w, h, '#f7e5bd');
      r(x, y + 21, w, 3, '#a3abae');
    }
    palm(36, 364, 1.3);
    palm(902, 368, 1.35);
    palm(154, 355, 0.82);
    palm(805, 355, 0.85);
    r(0, 363, 960, 177, arena.floor);
    r(390, 288, 52, 6, '#e2cfb5');
    line(
      [
        [416, 265],
        [416, 288],
        [436, 285],
      ],
      '#f3dec8',
      2,
    );
  }
  if (theme === 'miami') {
    // The audience sits on the boardwalk, with the bay behind it.
    r(0, 319, 960, 54, '#d9bda8');
    r(0, 319, 960, 4, '#f0d9bc');
    for (let y = 327; y < 373; y += 11) r(0, y, 960, 1, '#c2a58f');
    for (let i = 0; i < 18; i++) {
      const { x, y, groundY } = spectatorPlace(i);
      r(x - 13, groundY - 1, 28, 2, '#b49a86');
      r(x - 10, y + 15, 3, 11, '#6b8a86');
      r(x + 9, y + 15, 3, 11, '#6b8a86');
      r(x - 13, y + 12, 28, 4, '#eed3b3');
      r(x - 12, y - 1, 26, 4, '#81a39a');
    }
  }
  // The same physical playing surface on every backdrop.
  r(0, 373, 960, 5, '#e7dfc7');
  r(52, 389, 856, 117, arena.edge);
  r(60, 396, 840, 102, arena.court);
  r(60, 401, 840, 4, '#f1d9b9');
  for (let x = 65; x < 900; x += 46) r(x, 406, 1, 86, theme === 'stadium' ? '#c5a077' : arena.edge);
  r(78, 422, 804, 2, '#fff4d8');
  r(78, 480, 804, 2, '#fff4d8');
  r(0, 506, 960, 34, arena.floor);
  c.fillStyle = theme === 'stadium' ? '#f4dfb5' : '#f7edda';
  c.font = 'bold 11px monospace';
  c.textAlign = 'center';
  c.fillText(arena.name.toUpperCase() + '  /  D U P E R   V O L L E Y B A L L', 480, 526);
}
