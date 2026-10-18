import { clamp, predictAtHeight, driveOverNet, traceBall } from './physics.js';

export const hasShotDirection = (aim) => !!(aim.vector || aim.axis || aim.up || aim.down);

// Assist only a neutral request. Rotate the authored impulse; never create energy.
export function assistManualShot(ball, player, kind, result, aim, players, config) {
  if (hasShotDirection(aim)) return result;
  const speed = Math.hypot(result.vx, result.vy);
  if (speed < 0.1) return result;
  const original = Math.atan2(result.vy, result.vx);
  const rotate = (desired, amount) => {
    const delta = Math.atan2(Math.sin(desired - original), Math.cos(desired - original));
    const angle = original + delta * amount;
    return {
      ...result,
      vx: speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      flightLaunchVy: speed * Math.sin(angle),
      assisted: Math.abs(delta * amount) > 1e-6,
    };
  };
  if (kind === 'drive') {
    const amount = clamp(config.neutralAttackAssist ?? 0, 0, 1);
    if (!amount) return result;
    const forward = player.team === 0 ? 1 : -1;
    const guided = driveOverNet({ ...ball, ...result }, speed, forward, true, config);
    return guided ? rotate(Math.atan2(guided.vy, guided.vx), amount) : result;
  }
  const amount = clamp(config.neutralPassAssist ?? 0, 0, 1);
  if (!amount || !['low', 'loft', 'back'].includes(kind)) return result;
  const side = player.team === 0 ? -1 : 1;
  const height = kind === 'loft' ? 2.8 : 1.9;
  const receivers = players.filter(
    (p) =>
      p.team === player.team &&
      p.id !== player.id &&
      p.id !== aim.previousPlayerId &&
      !p.benched &&
      p.recovery <= 0 &&
      !p.diving &&
      !p.block &&
      p.x * side > 0.4,
  );
  if (!receivers.length) return result;
  let best = null;
  for (const direction of [-1, 1])
    for (let degrees = 30; degrees <= 86; degrees += 2) {
      const angle = Math.atan2(
        Math.sin((degrees * Math.PI) / 180),
        direction * Math.cos((degrees * Math.PI) / 180),
      );
      const shot = {
        ...result,
        vx: speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
        flightLaunchVy: speed * Math.sin(angle),
      };
      const at = predictAtHeight({ ...ball, ...shot }, height, config, 4 / config.ballSpeed);
      if (at.y > height || at.time < 0.3 || at.x * side < 0.4) continue;
      const path = traceBall({ ...ball, ...shot }, config, at.time);
      if (
        path.some(
          (point) => point.x * side <= 0 || point.netImpact?.serial !== ball.netImpact?.serial,
        )
      )
        continue;
      for (const target of receivers) {
        const miss = Math.abs(at.x - target.x);
        if (miss > 0.7 || Math.abs(target.x - player.x) < 0.8) continue;
        const preferred = target.role === (kind === 'loft' ? 'open' : 'setter');
        const score = miss + at.time * 0.08 - (preferred ? 1 : 0);
        if (!best || score < best.score) best = { angle, target, score };
      }
    }
  if (!best) return result;
  const corrected = rotate(best.angle, amount);
  const at = predictAtHeight({ ...ball, ...corrected }, height, config, 4 / config.ballSpeed);
  return {
    ...corrected,
    targetId: at.y <= height && Math.abs(at.x - best.target.x) <= 0.8 ? best.target.id : null,
  };
}
