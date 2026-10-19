import { pixelTools } from './street-scene.js';

// Wardrobes belong to the venue, independently of the teams on court.
export const CROWD_WARDROBES = {
  beach: {
    shirts: ['#e6ab91', '#69a8a2', '#efcf8e', '#c68ba8'],
    pants: '#668e9c',
    sleeves: false,
    trousers: false,
  },
  gym: {
    shirts: ['#648dae', '#cb7a85', '#6fa69b', '#dab66e'],
    pants: '#596b86',
    sleeves: true,
    trousers: true,
  },
  farm: {
    shirts: ['#b87e6c', '#829880', '#c4a184', '#8e8ea5'],
    pants: '#657b89',
    sleeves: true,
    trousers: true,
  },
  alpine: {
    shirts: ['#c77c8f', '#628baf', '#d4aa69', '#74a6a6', '#a18bb9'],
    pants: '#465b79',
    sleeves: true,
    trousers: true,
  },
  sky: {
    shirts: ['#e4c8ad', '#a291bf', '#6f9fa7', '#be829c'],
    pants: '#837490',
    sleeves: true,
    trousers: true,
  },
  championship: {
    shirts: ['#568fb0', '#d58496', '#71b1ad', '#e0bd76'],
    pants: '#435d7c',
    sleeves: false,
    trousers: true,
  },
};

export function drawZoneSpectator(
  c,
  theme,
  i,
  x,
  y,
  { time = 0, look = 0, happy = false, disappointed = false, live = true } = {},
) {
  const outfit = CROWD_WARDROBES[theme];
  const { rect: r, line, disc } = pixelTools(c);
  const ink = '#414655',
    skin = ['#edbc92', '#b67d58', '#d99b73', '#f1c9a2', '#825c49'][i % 5];
  const shirt = outfit.shirts[i % outfit.shirts.length];
  const child = i % 7 === 3;
  // Children, broader adults, long hair and seated poses break the repeated silhouette.
  c.save();
  c.translate(Math.round(x), Math.round(y + (child ? 5 : 0)));
  c.scale(child ? 0.82 : 1, child ? 0.82 : 1);
  const w = i % 5 === 0 ? 10 : 8;
  r(-w - 1, -15, w * 2 + 2, 21, ink);
  r(-w, -14, w * 2, 20, shirt);
  r(-w, -12, 3, 15, '#ffffff18');
  r(w - 3, -10, 3, 15, '#25344a28');
  r(-6, -17, 12, 5, shirt);
  r(-3, -17, 6, 4, skin);
  r(-8, 4, 16, 5, outfit.pants);
  for (const dx of [-7, 3]) {
    r(dx, 8, 5, 13, outfit.trousers ? outfit.pants : skin);
    r(dx, 19, 5, 3, theme === 'alpine' ? '#39485e' : '#e8ddd0');
    r(dx - 1, 22, 8, 4, theme === 'alpine' ? '#3f4658' : '#dcd9cd');
    r(dx - 1, 25, 8, 1, ink);
  }
  const hair = ['#54433e', '#75543f', '#b68850', '#393e49', '#b6aca1'][i % 5];
  if (i % 3 === 1) {
    r(-8 + look, -27, 17, 18, hair);
    r(6 + look, -18, 5, 11, hair);
  }
  r(-7 + look, -28, 15, 14, ink);
  r(-6 + look, -27, 13, 12, skin);
  r(-6 + look, -16, 13, 2, '#9a654b40');
  r(-7 + look, -29, 15, 5, hair);
  if (i % 3 === 0) r(-7 + look, -26, 3, 7, hair);
  if (i % 3 === 1) disc(6 + look, -28, 4, hair);
  const blink = live && Math.floor(time * 6 + i * 13) % 97 === 0;
  r(-3 + look, -22, 2, blink ? 1 : 2, ink);
  r(3 + look, -22, 2, blink ? 1 : 2, ink);
  r(look, -17, 3, happy ? 2 : 1, '#935f53');
  let hands = skin;
  if (theme === 'alpine') {
    // Padded coat, zipped high collar, knitted cap, scarf, gloves and snow boots.
    r(-w, -13, w * 2, 3, '#dcd5cb');
    r(-1, -10, 2, 15, '#e0d7cb');
    for (const yy of [-6, 0]) r(-w + 1, yy, w * 2 - 2, 1, '#394a652b');
    r(-7 + look, -31, 15, 6, shirt);
    r(-8 + look, -26, 17, 3, '#e4d7cd');
    disc(look, -34, 3, '#e5d6c5');
    r(-5, -15, 13, 4, '#e9c799');
    r(4, -11, 4, 11, '#e9c799');
    for (let xx = -5; xx < 7; xx += 3) r(xx + look, -30, 1, 4, '#fff1d840');
    hands = '#435471';
    if (i % 4 === 1) {
      r(-6 + look, -24, 13, 4, '#526780');
      r(-4 + look, -23, 8, 1, '#a8d7db');
    }
  } else if (theme === 'farm') {
    if (i % 2 === 0) {
      r(-8 + look, -30, 16, 5, '#ba985f');
      r(-12 + look, -26, 25, 3, '#e1bd79');
    }
    if (i % 3 === 0) {
      r(-6, -13, 3, 18, outfit.pants);
      r(4, -13, 3, 18, outfit.pants);
      r(-6, -4, 13, 9, outfit.pants);
      r(-3, -2, 6, 4, '#8a9da3');
    } else
      for (let yy = -10; yy < 4; yy += 5) {
        r(-w, yy, w * 2, 1, '#efe0bd55');
        r(-3, -12, 1, 16, '#efe0bd55');
      }
  } else if (theme === 'beach') {
    if (i % 2 === 0) {
      r(-7 + look, -23, 14, 4, ink);
      r(-5 + look, -22, 4, 1, '#8dbac1');
    }
    if (i % 4 === 1) {
      r(-7 + look, -32, 15, 7, '#eed4a2');
      r(-12 + look, -26, 25, 3, '#f5dfb4');
    }
    r(-w + 1, -11, 3, 6, skin);
    r(w - 4, -11, 3, 6, skin);
  } else if (theme === 'sky') {
    r(-w, -12, 3, 20, '#e6c37d');
    r(-w, 5, w * 2, 3, '#e6c37d');
    r(-8 + look, -26, 17, 2, '#b3b477');
    for (const dx of [-8, 5]) r(dx + look, -29, 4, 3, '#8d9f72');
    disc(0, -7, 2, '#e8c57b');
  } else if (theme === 'championship') {
    r(-w, -13, w * 2, 3, '#f0dcb4');
    r(-w + 2, -10, 3, 12, '#f0dcb4');
    r(-3, -5, 6, 7, '#f2e7d3');
    r(-1, -4, 2, 5, shirt);
    if (i % 3 === 0) {
      r(-8 + look, -30, 16, 5, shirt);
      r(look, -26, 13, 2, '#e7d4b5');
    }
  } else {
    r(-w, -12, 3, 8, '#e8d7bf');
    r(w - 3, -12, 3, 8, '#e8d7bf');
    if (i % 4 === 0) {
      r(-7 + look, -23, 6, 4, '#546679');
      r(2 + look, -23, 6, 4, '#546679');
    }
  }
  const wave = Math.sin(time * 2.2 + i * 1.7);
  const raise = happy || (live && i % 8 === 2 && wave > 0.82);
  for (const side of [-1, 1]) {
    const endX = side * (raise ? 14 : disappointed ? 6 : w - 1);
    const endY = raise ? -29 + wave * 2 : disappointed ? -20 : 4;
    const elbowX = side * (w + 3),
      elbowY = raise ? -18 : disappointed ? -12 : 1;
    line(side * w, -10, elbowX, elbowY, outfit.sleeves ? shirt : skin, 5);
    line(elbowX, elbowY, endX, endY, outfit.sleeves ? shirt : skin, 4);
    r(endX - 2, endY - 1, 4, 4, hands);
  }
  if (!raise && !disappointed && i % 6 === 0) {
    r(6, -1, 5, 7, theme === 'alpine' ? '#e0ba80' : '#dcdac6');
    r(6, -2, 6, 2, '#f7e6c8');
  }
  if (theme === 'championship' && raise) {
    line(14, -27, 14, -43, '#ddd2bf', 1);
    r(15, -43, 17, 10, shirt);
    r(17, -40, 10, 2, '#f4dcb4');
  }
  c.restore();
}
