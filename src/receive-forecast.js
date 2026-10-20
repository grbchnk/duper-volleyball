import { contactBounds } from './contact-rules.js';
import { integrateBall, collideNet, crossesUnderNet, clamp } from './physics.js';
import { sampleJump } from './motion.js';
import { COURT } from './config.js';

// First future entry into the receiving zone, using the live ball integrator.
// Express the meeting point relative to the player's future position, so running
// and jumping do not make the arms reach past the point of interception.
export function predictedLowContact(player, ball, config) {
  const b = { vx: 0, vy: 0, vz: 0, z: player.z ?? 4.5, ...ball };
  const at = (time) => ({
    ...player,
    ...(player.jumpProfile ? sampleJump(player.jumpProfile, player.jumpTime + time) : {}),
    x: clamp(
      player.x + (player.vx || 0) * time,
      player.team === 0 ? -COURT.playerBackLimit : 0.65,
      player.team === 0 ? -0.65 : COURT.playerBackLimit,
    ),
  });
  const margins = (point, p) => {
    const bounds = contactBounds(p, 'low', config);
    return [
      point.x - bounds.minX,
      bounds.maxX - point.x,
      point.y - bounds.minY,
      bounds.maxY - point.y,
    ];
  };
  let before = margins(b, at(0));
  if (before.every((value) => value >= 0)) return { ...ball, time: 0 };
  const dt = 1 / 60;
  for (let step = 1; step <= 120; step++) {
    const previous = { ...b },
      time = step * dt;
    integrateBall(b, dt, config);
    collideNet(b, previous, config.restitution, config);
    if (crossesUnderNet(b, previous, config)) break;
    const after = margins(b, at(time));
    let enter = 0,
      exit = 1;
    for (let i = 0; i < before.length; i++) {
      if (before[i] < 0 && after[i] < 0) {
        exit = -1;
        break;
      }
      if (before[i] < 0) enter = Math.max(enter, -before[i] / (after[i] - before[i]));
      else if (after[i] < 0) exit = Math.min(exit, before[i] / (before[i] - after[i]));
    }
    if (enter <= exit) {
      const time = (step - 1 + enter) * dt,
        future = at(time);
      return {
        x: previous.x + (b.x - previous.x) * enter - future.x + player.x,
        y: previous.y + (b.y - previous.y) * enter - future.y + player.y,
        time,
      };
    }
    if (b.y <= 0.105) break;
    before = after;
  }
  return null;
}
