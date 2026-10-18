import { integrateBall, collideNet } from './physics.js';
import { jumpProfile } from './motion.js';

// A bounded adjustment of a jump explicitly requested by the player.
export function assistedJump(ball, player, config) {
  const base = jumpProfile(config),
    hang = base.hang;
  const b = { ...ball };
  let best = null;
  for (let n = 1; n <= 100; n++) {
    const old = { ...b },
      time = n / 120;
    integrateBall(b, 1 / 120, config);
    collideNet(b, old, config.restitution, config);
    const rise = time - base.windup - hang / 2;
    const height = b.y - 2.1;
    const targetX = b.x + (player.team === 0 ? -0.25 : 0.25);
    if (
      time < base.windup + base.rise ||
      time > base.windup + base.rise + hang ||
      height < base.height * 0.75 ||
      height > base.height * 1.25 ||
      Math.abs(b.x - player.x) > 1.0 ||
      targetX * (player.team === 0 ? -1 : 1) < 0.4
    )
      continue;
    const cost =
      Math.abs(height - base.height) +
      Math.abs(rise - base.rise) * 2 +
      Math.abs(targetX - player.x) * 0.3;
    if (!best || cost < best.cost)
      best = { cost, time, targetX: player.x, profile: { ...base, height, hang } };
  }
  return best;
}
