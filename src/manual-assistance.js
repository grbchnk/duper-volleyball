import { clamp, predictAtHeight, driveOverNet, traceBall } from './physics.js';

export const hasShotDirection = (aim) => !!(aim.vector || aim.axis || aim.up || aim.down);
const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Rotate a fixed-length impulse towards the nearest plausible intent. Never add energy.
export function assistManualShot(ball, player, kind, result, aim, players, config) {
  // Lower reception is authored by the contact or by the player's explicit aim.
  // Neither may be redirected towards the net or a teammate automatically.
  if (kind === 'low' && config.dynamic && !aim.cpuControl) return result;
  const directed = hasShotDirection(aim);
  const amount = clamp(
    kind === 'drive'
      ? directed
        ? 0
        : (config.neutralAttackAssist ?? 0)
      : (config.passAssist ?? 0),
    0,
    1,
  );
  const speed = Math.hypot(result.vx, result.vy);
  if (!amount || speed < 0.1) return result;
  const original = Math.atan2(result.vy, result.vx);
  const forward = player.team === 0 ? 1 : -1;
  const rotate = (desired, details) => {
    const delta = turn(desired, original) * amount;
    const angle = original + delta;
    return {
      ...result,
      vx: speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      flightLaunchVy: speed * Math.sin(angle),
      assisted: Math.abs(delta) > 1e-6,
      assistDegrees: (delta * 180) / Math.PI,
      assistAmount: amount,
      ...details,
    };
  };
  if (kind === 'drive') {
    const guided = driveOverNet(
      { ...ball, ...result, flightTempo: 1 },
      speed,
      forward,
      true,
      config,
    );
    return guided
      ? rotate(Math.atan2(guided.vy, guided.vx), { assistIntent: 'Атака через сетку' })
      : result;
  }
  if (!['low', 'loft', 'back'].includes(kind)) return result;
  const rawPath = traceBall({ ...ball, ...result, flightTempo: 1 }, config, 4 / config.ballSpeed);
  const elevation = (Math.atan2(result.vy, Math.abs(result.vx)) * 180) / Math.PI;
  const towardsNet = result.vx * forward > 0.1;
  const crossing =
    towardsNet && (rawPath.some((p) => p.x * forward > 0.2) || (directed && elevation < 50));
  if (crossing) {
    const guided = driveOverNet(
      { ...ball, ...result, flightTempo: 1 },
      speed,
      forward,
      true,
      config,
    );
    if (!guided)
      return {
        ...result,
        assistIntent: 'Перевод через сетку · не хватает скорости',
        assistDegrees: 0,
      };
    const desired = Math.atan2(guided.vy, guided.vx);
    const delta = clamp(turn(desired, original), (-12 * Math.PI) / 180, (12 * Math.PI) / 180);
    return rotate(original + delta, { assistIntent: 'Перевод через сетку', targetId: null });
  }
  const receivers = players.filter(
    (p) =>
      p.team === player.team &&
      p.id !== player.id &&
      p.id !== aim.previousPlayerId &&
      !p.benched &&
      p.recovery <= 0 &&
      !p.diving &&
      !p.block &&
      (!directed || (p.x - ball.x) * result.vx > 0),
  );
  const targets = receivers.map((p) => ({
    x: p.x,
    y: kind === 'loft' ? 2.8 : 1.9,
    id: p.id,
    label: `Пас игроку ${(p.id % 3) + 1}`,
  }));
  const upward = aim.up || (aim.vector?.y ?? 0) > 0.65;
  if (towardsNet && upward)
    targets.unshift({ x: -forward * 0.9, y: 3.2, id: null, label: 'Навес у сетки' });
  let best = null;
  const budget = directed ? 12 : 35;
  for (let degrees = -budget; degrees <= budget; degrees += 1) {
    const angle = original + (degrees * Math.PI) / 180;
    const vx = speed * Math.cos(angle),
      vy = speed * Math.sin(angle);
    if (vy <= 0 || vx * result.vx < 0) continue;
    const shot = { ...ball, ...result, vx, vy, flightLaunchVy: vy, flightTempo: 1 };
    for (const target of targets) {
      if (
        upward &&
        towardsNet &&
        target.label !== 'Навес у сетки' &&
        Math.abs(target.x) > Math.abs(ball.x)
      )
        continue;
      const at = predictAtHeight(shot, target.y, config, 4 / config.ballSpeed);
      if (at.y > target.y || at.time < 0.15 || at.x * forward >= -0.25) continue;
      const miss = Math.abs(at.x - target.x);
      if (miss > 0.8) continue;
      const score =
        miss * 2 +
        Math.abs(degrees) * 0.025 +
        at.time * 0.03 -
        (target.label === 'Навес у сетки' ? 0.5 : 0);
      if (!best || score < best.score) best = { angle, target, score };
    }
  }
  if (!best)
    return { ...result, assistIntent: 'Свободный пас · нет близкой цели', assistDegrees: 0 };
  const corrected = rotate(best.angle, {
    assistIntent: best.target.label,
    assistTarget: { x: best.target.x, y: best.target.y },
    targetId: null,
  });
  const at = predictAtHeight(
    { ...ball, ...corrected, flightTempo: 1 },
    best.target.y,
    config,
    4 / config.ballSpeed,
  );
  if (at.y <= best.target.y && Math.abs(at.x - best.target.x) <= 0.8)
    corrected.targetId = best.target.id;
  return corrected;
}
