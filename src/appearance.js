// Cosmetic randomness is independent of the match's physics random stream.
import { SPECIAL_HEADS } from './special-heads.js';
import { TEAMS, FEMALE_HEADS, HAIR_COLORS } from './teams.js';
import { EXTRA_HEAD_STYLES } from './head-styles.js';
export const HEAD_STYLES = [
  'cap',
  'fox',
  'band',
  'crop',
  'bald',
  ...Object.keys(EXTRA_HEAD_STYLES),
  ...Object.keys(SPECIAL_HEADS),
];
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
    headShape: 'square',
    head,
    body,
    tone,
    hair: pick(['#302b32', '#654537', '#a76a3e', '#d7b46a', '#843f38']),
  };
}

export function sanitizeAppearance(value = {}) {
  const p = value && typeof value === 'object' ? value : {};
  return {
    headShape: 'square',
    head: HEAD_STYLES.includes(p.head) ? p.head : 'crop',
    body: BODY_STYLES.includes(p.body) ? p.body : 'classic',
    tone: SKIN_TONES.includes(p.tone) ? p.tone : SKIN_TONES[0],
    hair: HAIR_COLORS.some(([color]) => color === p.hair) ? p.hair : HAIR_COLORS[0][0],
  };
}
export function appearanceKey(config) {
  return JSON.stringify([
    config.homeTeam,
    config.awayTeam,
    config.customTeamAppearance,
    config.randomTeamAppearance,
    config.appearanceSeed,
    config.teamPlayers,
  ]);
}
export function teamAppearance(config, team, slot) {
  const preset = TEAMS.find((t) => t.id === config[team ? 'awayTeam' : 'homeTeam']) || TEAMS[team];
  if (team === 0 && config.randomTeamAppearance) {
    let seed = (config.appearanceSeed || 1) + slot * 7919;
    for (const c of preset.id) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const p = randomAppearance(random);
    if (preset.women) p.head = FEMALE_HEADS[Math.floor(random() * FEMALE_HEADS.length)];
    if (preset.country === 'Нигерия') p.tone = SKIN_TONES[4 + Math.floor(random() * 2)];
    return p;
  }
  if (team === 0 && config.customTeamAppearance && config.teamPlayers?.[slot])
    return sanitizeAppearance(config.teamPlayers[slot]);
  return { ...preset.roster[slot % 3] };
}
