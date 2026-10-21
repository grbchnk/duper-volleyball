import { clamp } from './physics.js';

export const receptionErrorSeed = (visualSeed, serial, playerId) =>
  (visualSeed || 2026) ^ Math.imul(serial + 1, 73856093) ^ Math.imul(playerId + 1, 19349663);

// Stateless noise: previewing a shot never consumes the match RNG. The engine
// supplies one seed per incoming ball, shared by the preview and real contact.
export function receptionNoise(seed = 2026) {
  let n = seed | 0;
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
  return (((n ^ (n >>> 15)) >>> 0) / 0xffffffff) * 2 - 1;
}

export function reflectedReception(ball, player, kind, result) {
  const speed = Math.hypot(result.vx, result.vy);
  if (Math.hypot(ball.vx || 0, ball.vy || 0) < 0.1) return { ...result };
  const x = -(ball.vx || 0),
    y = -(ball.vy || 0);
  const direction = Math.sign(x) || (player.team === 0 ? 1 : -1);
  let elevation = Math.atan2(y, Math.abs(x));
  if (kind === 'low' || kind === 'back')
    elevation = clamp(elevation, (38 * Math.PI) / 180, (88 * Math.PI) / 180);
  const vx = direction * speed * Math.cos(elevation),
    vy = speed * Math.sin(elevation);
  return { ...result, vx, vy, flightLaunchVy: vy };
}

export function applyReceptionError(ball, kind, result, aim, config) {
  const incomingSpeed = Math.hypot(ball.vx || 0, ball.vy || 0);
  const error = clamp(config.neutralPassError ?? 0.15, 0, 1);
  const speedWeight = clamp(config.neutralPassSpeedError ?? 0.75, 0, 1);
  const limit = Math.min(60, 30 * error * (1 + speedWeight * Math.min(incomingSpeed / 20, 2)));
  const speed = Math.hypot(result.vx, result.vy);
  const original = Math.atan2(result.vy, result.vx);
  let angle = original + (receptionNoise(aim.neutralErrorSeed) * limit * Math.PI) / 180;
  if (kind === 'low' || kind === 'back') {
    const direction = Math.sign(Math.cos(angle)) || 1;
    const elevation = clamp(
      Math.atan2(Math.sin(angle), Math.abs(Math.cos(angle))),
      (38 * Math.PI) / 180,
      (88 * Math.PI) / 180,
    );
    angle = Math.atan2(Math.sin(elevation), direction * Math.cos(elevation));
  }
  const vx = speed * Math.cos(angle),
    vy = speed * Math.sin(angle);
  return {
    ...result,
    vx,
    vy,
    flightLaunchVy: vy,
    neutralReception: true,
    neutralErrorDegrees:
      (Math.atan2(Math.sin(angle - original), Math.cos(angle - original)) * 180) / Math.PI,
    neutralErrorLimit: limit,
    // Error can move the flight off the assisted target. Do not promise a run
    // to the old intercept; ordinary receiver selection still evaluates it.
    targetId: null,
    targetX: undefined,
    arrival: undefined,
    reception: false,
  };
}
