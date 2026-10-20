import { FIXED_DT } from './config.js';

export const serveButton = (kind) =>
  ({ low: 'S / □', back: 'Z + S / L2 + □', loft: 'W / △', drive: 'D / ○' })[kind];

export function serveCue(match) {
  const action = match.serveAction;
  if (
    !match.config.dynamic ||
    match.phase !== 'serve-motion' ||
    !action ||
    !match.isHuman(match.server)
  )
    return null;
  const timing = action.contactTiming || {
    start: action.ideal,
    end: action.ideal + action.settings.PerfectWindow,
  };
  // Stop showing green just before the edge, allowing the next input frame to reach the hand.
  const reserve = Math.min(2 * FIXED_DT, (timing.end - timing.start) * 0.2);
  const ready =
    !action.attempted &&
    action.contactQuality >= 1 - 1e-9 &&
    match.phaseTime >= timing.start &&
    match.phaseTime <= timing.end - reserve;
  const stage = action.attempted
    ? 'missed'
    : ready
      ? 'ready'
      : match.phaseTime < timing.start
        ? 'waiting'
        : 'late';
  const titles = {
    waiting: 'Следи за кругом у мяча',
    ready: 'НАЖМИ ЕЩЁ РАЗ!',
    missed: 'МИМО',
    late: 'МОМЕНТ УПУЩЕН',
  };
  const hints = {
    waiting: 'Коротко нажми второй раз, когда зелёный круг сойдётся к мячу.',
    ready: 'Нажми кнопку подачи сейчас. Удар происходит сразу по нажатию.',
    missed: 'В следующей подаче нажми, когда круг сойдётся к мячу.',
    late: 'В следующей подаче ориентируйся на схождение круга к мячу.',
  };
  const progress = Math.max(0, Math.min(1, match.phaseTime / timing.start));
  // A gentle initial drift grows into a sharp, continuous acceleration at contact.
  const collapse = 0.1 * progress + 0.9 * progress ** 10;
  const smooth = (value) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  // Anticipation builds weight, then the final contraction releases it into a fine ring.
  const anticipation = smooth(progress / 0.88);
  const release = smooth((progress - 0.88) / 0.12);
  const blend = progress ** 4;
  const yellow = [255, 223, 124],
    gold = [235, 221, 144];
  return {
    stage,
    ready,
    progress,
    targetRadius: 10 * (match.config.ballSize || 1.2) * 1.18 + 2.5,
    radius: 10 * (match.config.ballSize || 1.2) * 1.18 + 2.5 + 14 * (1 - collapse),
    width: 0.85 + 0.75 * anticipation - 0.5 * release,
    color: ready
      ? 'rgb(131, 230, 165)'
      : `rgb(${yellow.map((channel, i) => Math.round(channel + (gold[i] - channel) * blend)).join(', ')})`,
    title: titles[stage],
    hint: hints[stage],
    button: serveButton(action.kind),
  };
}
