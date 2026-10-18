// Cosmetic randomness is independent of the match's physics random stream.
export const HEAD_STYLES = ['cap', 'fox', 'band', 'crop', 'bald'];
export const BODY_STYLES = ['classic', 'stripes', 'sleeveless', 'chevron', 'longsleeve'];
export const SKIN_TONES = ['#f4cfac', '#edba91', '#d79b70', '#b87950', '#925b3d', '#633f30'];
const TONE_WEIGHTS = [38, 32, 18, 7, 3, 2];

export function skinPalette(tone = SKIN_TONES[0]) {
  const rgb = tone
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16));
  const shade = (factor) =>
    '#' +
    rgb
      .map((v) =>
        Math.round(v * factor)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return { outline: shade(0.4), blush: shade(0.86), mouth: shade(0.56) };
}

export function randomAppearance(random = Math.random) {
  const pick = (items) => items[Math.floor(random() * items.length)];
  const head = pick(HEAD_STYLES);
  const body = pick(BODY_STYLES);
  let roll = random() * 100;
  const tone = SKIN_TONES.find((_, i) => (roll -= TONE_WEIGHTS[i]) < 0) || SKIN_TONES[0];
  return {
    head,
    body,
    tone,
    hair: pick(['#302b32', '#654537', '#a76a3e', '#d7b46a', '#843f38']),
  };
}
