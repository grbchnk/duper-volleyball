import { clamp, predictAtHeight } from './physics.js';

// Choose a reachable receiver by rotating a fixed-length impulse. Never add power.
export function smartPass(
  ball,
  player,
  kind,
  result,
  players,
  config,
  settings,
  amount,
  manual = false,
) {
  const speed = Math.hypot(result.vx, result.vy);
  if (speed < 0.01) return result;
  const forward = player.team === 0 ? 1 : -1;
  const facing = player.facing || forward;
  const behind = (ball.x - player.x) * facing < -0.12;
  const receivers = players.filter(
    (p) =>
      !p.benched &&
      p.team === player.team &&
      p.id !== player.id &&
      p.recovery <= 0 &&
      !p.diving &&
      !p.block &&
      p.x * forward < -0.2,
  );
  const height = kind === 'loft' ? 1.9 : 1.1;
  let best = null;
  const original = Math.atan2(result.vy, result.vx);
  const assess = (direction, degrees) => {
    if (manual && direction !== Math.sign(result.vx)) return;
    const angle = (degrees * Math.PI) / 180;
    const impulse = {
      ...result,
      vx: direction * speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      flightLaunchVy: speed * Math.sin(angle),
    };
    const at = predictAtHeight({ ...ball, ...impulse }, height, config, 5 / config.ballSpeed);
    if (at.y > height || at.time < 0.2 || at.x * forward >= -0.25) return;
    for (const p of receivers) {
      if ((p.x - ball.x) * direction < 0.25) continue;
      const miss = Math.abs(at.x - p.x);
      if (miss > Math.min(0.65, settings.AssistRadius)) continue;
      const rear = (p.x - player.x) * facing < 0;
      const desired = Math.atan2(impulse.vy, impulse.vx);
      const turn = Math.abs(Math.atan2(Math.sin(desired - original), Math.cos(desired - original)));
      if (manual && turn > (config.dynamic ? (settings.AssistAngle * Math.PI) / 180 : Math.PI / 2))
        continue;
      const score =
        (manual ? turn * 6 : 0) +
        miss * 3 +
        at.time * 0.09 +
        Math.abs(degrees - 65) * 0.002 -
        (behind && rear ? 0.22 : 0) -
        (kind === 'loft' && p.role === 'open' ? 0.1 : 0);
      if (!best || score < best.score) best = { score, direction, degrees, player: p };
    }
  };
  for (const direction of [-1, 1]) {
    for (let angle = Math.max(8, settings.ElevationMin); angle <= settings.ElevationMax; angle += 4)
      assess(direction, angle);
    assess(direction, settings.ElevationMax);
  }
  if (!best) return result;
  const initial = best;
  for (let delta = -4; delta <= 4; delta += 0.5)
    assess(
      initial.direction,
      clamp(initial.degrees + delta, settings.ElevationMin, settings.ElevationMax),
    );
  const desired = Math.atan2(
    Math.sin((best.degrees * Math.PI) / 180),
    best.direction * Math.cos((best.degrees * Math.PI) / 180),
  );
  const delta = Math.atan2(Math.sin(desired - original), Math.cos(desired - original));
  const angle = original + delta * amount;
  const corrected = {
    ...result,
    vx: speed * Math.cos(angle),
    vy: speed * Math.sin(angle),
    flightLaunchVy: speed * Math.sin(angle),
  };
  const at = predictAtHeight({ ...ball, ...corrected }, height, config, 5 / config.ballSpeed);
  return {
    ...corrected,
    assisted: Math.abs(delta * amount) > 1e-7,
    targetId: at.y <= height && Math.abs(at.x - best.player.x) <= 0.7 ? best.player.id : null,
  };
}
