import { traceBall } from './physics.js';
import { shotSettings } from './shot-settings.js';
import { sampleJump } from './motion.js';
import { isFeintDecoy } from './feint-play.js';

// Compare actual interception windows, including approach effort and contact
// height. A smaller cost means more time/reach in reserve and a cleaner contact.
export function receptionOpportunities(match, team, players, forecast = null) {
  const { config, ball } = match;
  const path = forecast || traceBall(ball, config, 3 / config.ballSpeed);
  const profiles = ['low', 'loft'].map((kind) => ({ kind, ...shotSettings(config, kind) }));
  const options = [];
  for (const p of players) {
    if (
      p.team !== team ||
      p.benched ||
      p.recovery > 0 ||
      p.diving ||
      p.block > 0 ||
      isFeintDecoy(match, p)
    )
      continue;
    for (const shot of profiles) {
      let best = null;
      for (let i = 0; i < path.length; i++) {
        const b = path[i];
        if ((b.x < 0 ? 0 : 1) !== team || b.vy >= 0 || b.y <= 0.12) continue;
        const time = i / 120;
        const height = p.jumpProfile
          ? sampleJump(p.jumpProfile, p.jumpTime + time).y
          : Math.max(0, p.y + p.vy * time - (config.gravity * time * time) / 2);
        const offset = height <= 0 ? (p.crouchAmount || 0) * 0.4 : 0;
        const contactHeight = b.y - height + offset;
        if (contactHeight < shot.ContactMin || contactHeight > shot.ContactMax) continue;
        const distance = Math.abs(b.x - p.x);
        const speed = p.jumpProfile ? config.airMoveSpeed : config.playerSpeed;
        const availableTravel = speed * time;
        if (distance > shot.Reach + availableTravel) continue;
        // Reserve some reach for a comfortable contact, rather than treating
        // a last-instant fully stretched interception as equally desirable.
        const travel = Math.max(0, distance - shot.Reach * 0.65);
        const effort = travel / (availableTravel + shot.Reach * 0.35);
        const midpoint = (shot.ContactMin + shot.ContactMax) / 2;
        const edge =
          Math.abs(contactHeight - midpoint) / Math.max(0.01, midpoint - shot.ContactMin);
        const cost = effort * 2 + edge * 0.15;
        if (!best || cost < best.cost)
          best = { id: p.id, kind: shot.kind, time, distance, effort, edge, cost };
      }
      if (best) options.push(best);
    }
  }
  return options;
}

// Serve reception favours a controlled underhand pass, but a difficult sprint
// must not outrank a comfortable overhead reception. Rally policy stays separate.
export function serveReceiver(match, team, players, currentId = null, forecast = null) {
  if (
    !match.config.dynamic ||
    match.phase !== 'rally' ||
    match.incomingShot !== 'serve' ||
    match.lastTouch !== 1 - team ||
    match.ball.vx * match.sign(team) <= 0
  )
    return null;
  const options = receptionOpportunities(match, team, players, forecast);
  const score = (option) => option.cost + (option.kind === 'loft' ? 0.35 : 0);
  options.sort((a, b) => score(a) - score(b) || a.time - b.time);
  const best = options[0];
  if (!best) return null;
  const current = options.find((option) => option.id === currentId);
  // Keep the established receiver unless another offers a clear improvement.
  return current && score(current) <= score(best) + 0.15 ? current.id : best.id;
}
