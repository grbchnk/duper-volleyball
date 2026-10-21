import { clamp, predictAtHeight, driveOverNet, traceBall } from './physics.js';
import { COURT } from './config.js';
import { reflectedReception, applyReceptionError } from './neutral-reception.js';

export const hasShotDirection = (aim) =>
  !!(Math.hypot(aim.vector?.x || 0, aim.vector?.y || 0) || aim.axis || aim.up || aim.down);
const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Rotate a fixed-length impulse towards the nearest plausible intent. Never add energy.
export function assistManualShot(ball, player, kind, result, aim, players, config) {
  // Both human passes use the same intent selection and angular assistance.
  if (aim.cpuControl) return result;
  if (Math.hypot(result.vx, result.vy) < 0.1) return result;

  const directed = hasShotDirection(aim);
  if (!directed && ['low', 'loft', 'back'].includes(kind) && !aim.tutorialAutoPass) {
    const reflected = reflectedReception(ball, player, kind, result);
    const corrected = assistManualShot(
      ball,
      player,
      kind,
      reflected,
      {
        ...aim,
        vector: { x: reflected.vx, y: reflected.vy },
        // Reuse the bounded directional correction, not the training target picker.
      },
      players,
      config,
    );
    return {
      ...applyReceptionError(ball, kind, corrected, aim, config),
      requestedDirection: { vx: reflected.vx, vy: reflected.vy },
      correctedDirection: { vx: corrected.vx, vy: corrected.vy },
      assistIntent: 'Приём по встречному направлению',
    };
  }
  let amount = clamp(
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
  // With no directional request the target is the intent, not a halfway turn
  // towards it (which used to send backward passes away from both players).
  if (!directed && kind !== 'drive') amount = 1;
  const original = Math.atan2(result.vy, result.vx);
  const forward = player.team === 0 ? 1 : -1;
  const rotate = (desired, details) => {
    const limit = kind === 'drive' || !directed ? Math.PI : (12 * Math.PI) / 180;
    const delta = clamp(turn(desired, original), -limit, limit) * amount;
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
  const count = clamp(aim.touchesBefore ?? 0, 0, 2);
  if (kind === 'drive' || (count >= 2 && !directed)) {
    if (kind !== 'drive') {
      let best = null;
      for (let degrees = kind === 'low' ? 38 : 5; degrees <= 85; degrees += 2) {
        const angle = (degrees * Math.PI) / 180;
        const vx = forward * speed * Math.cos(angle),
          vy = speed * Math.sin(angle);
        const path = traceBall(
          { ...ball, ...result, vx, vy, flightLaunchVy: vy, flightTempo: 1 },
          config,
          6 / config.ballSpeed,
        );
        const end = path.at(-1);
        if (
          path.some((p) => p.netImpact !== ball.netImpact) ||
          end.y > COURT.ballRadius + 0.001 ||
          end.x * forward < 0.6 ||
          end.x * forward > 8.7
        )
          continue;
        const desired = Math.atan2(vy, vx);
        const score = Math.abs(end.x * forward - 4.5) + Math.abs(turn(desired, original)) * 0.3;
        if (!best || score < best.score) best = { desired, score };
      }
      if (best)
        return rotate(best.desired, { assistIntent: 'Перевод через сетку', targetId: null });
    }
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
        assistIntent:
          (kind === 'drive' ? 'Атака' : 'Перевод') + ' через сетку · не хватает скорости',
        assistDegrees: 0,
      };
    let desired = Math.atan2(guided.vy, guided.vx);
    if (kind === 'low') {
      const elevation = clamp(
        Math.atan2(guided.vy, Math.abs(guided.vx)),
        (38 * Math.PI) / 180,
        (88 * Math.PI) / 180,
      );
      desired = Math.atan2(Math.sin(elevation), forward * Math.cos(elevation));
    }
    return rotate(desired, {
      assistIntent: kind === 'drive' ? 'Атака через сетку' : 'Перевод через сетку',
      targetId: null,
    });
  }
  if (!['low', 'loft', 'back'].includes(kind)) return result;
  const elevation = (Math.atan2(result.vy, Math.abs(result.vx)) * 180) / Math.PI;
  const requestedElevation = aim.vector
    ? (Math.atan2(aim.vector.y, Math.abs(aim.vector.x)) * 180) / Math.PI
    : aim.down
      ? 0
      : elevation;
  const upward = aim.up || (directed && requestedElevation >= 65);
  const towardsNet = result.vx * forward > 0.1;
  const crossing = directed && towardsNet && !upward && (requestedElevation < 50 || count >= 2);
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
      !p.benched &&
      !(p.recovery > 0) &&
      !p.diving &&
      !p.block &&
      (!directed || (p.x - ball.x) * result.vx > 0),
  );
  const setting = count === 1 || (directed && towardsNet && upward);
  const targets = receivers.map((p) => ({
    x: p.x,
    y: setting ? 2.8 : 1.9,
    player: p,
    id: p.id,
    label: `Пас игроку ${(p.id % 3) + 1}`,
  }));
  if (setting)
    targets.push(
      ...receivers.map((p) => ({
        x: p.x,
        y: 1.9,
        player: p,
        id: p.id,
        label: `Пас игроку ${(p.id % 3) + 1}`,
      })),
    );
  if (setting)
    for (const p of receivers)
      if (Math.abs(p.x + forward * 0.9) <= 1 + config.playerSpeed * 0.55)
        targets.unshift({ x: -forward * 0.9, y: 3.2, id: p.id, player: p, label: 'Навес у сетки' });
  let best = null;
  const budget = directed ? 12 : 180;
  const incomingSpeed = Math.hypot(ball.vx || 0, ball.vy || 0);
  for (let degrees = -budget; degrees <= budget; degrees += 1) {
    const angle = original + (degrees * Math.PI) / 180;
    const vx = speed * Math.cos(angle),
      vy = speed * Math.sin(angle);
    if (vy <= 0 || (directed && vx * result.vx < -1e-8)) continue;
    if (kind === 'low' && (Math.atan2(vy, Math.abs(vx)) * 180) / Math.PI < 38) continue;
    const shot = { ...ball, ...result, vx, vy, flightLaunchVy: vy, flightTempo: 1 };
    const forecasts = new Map();
    for (const target of targets) {
      if (
        upward &&
        towardsNet &&
        target.label !== 'Навес у сетки' &&
        Math.abs(target.x) > Math.abs(ball.x)
      )
        continue;
      if (!forecasts.has(target.y))
        forecasts.set(target.y, predictAtHeight(shot, target.y, config, 4 / config.ballSpeed));
      const at = forecasts.get(target.y);
      if (at.y > target.y || at.y < target.y - 0.25 || at.time < 0.15 || at.x * forward >= -0.25)
        continue;
      if (directed && (target.x - ball.x) * result.vx < -0.05) continue;
      const miss = Math.abs(at.x - target.x);
      // A neutral pass may meet a teammate a few steps away, including behind
      // the passer. Power stays unchanged; the receiver runs to the intercept.
      const reach = directed
        ? 0.8
        : Math.min(2.2, 0.6 + config.playerSpeed * Math.max(0, at.time - 0.3));
      if (miss > reach) continue;
      const travel = Math.abs(at.x - target.player.x);
      if (travel > config.playerSpeed * Math.max(0, at.time - 0.15) + 0.8) continue;
      const movement = Math.abs(
        at.x - (target.player.x + (target.player.vx || 0) * Math.min(at.time, 0.3)),
      );
      const continuedDrift =
        Math.max(0, (at.x - ball.x) * (ball.vx || 0)) / Math.max(1, incomingSpeed);
      const score =
        miss * 2 +
        Math.abs(degrees) * (directed ? 0.012 : 0.001) +
        movement * (0.12 + Math.min(incomingSpeed, 20) * 0.005) +
        continuedDrift * 0.03 +
        (setting && target.y < 2 ? 0.6 : 0) +
        at.time * 0.03 -
        (!directed && count === 0 && target.player.role === 'setter' ? 0.8 : 0) -
        (target.label === 'Навес у сетки' ? 1 : 0);
      if (!best || score < best.score) best = { angle, target, score, intercept: at.x, reach };
    }
  }
  if (!best)
    return { ...result, assistIntent: 'Свободный пас · нет доступной цели', assistDegrees: 0 };
  const corrected = rotate(best.angle, {
    assistIntent: best.target.label,
    assistTarget: { x: best.intercept, y: best.target.y },
    targetId: null,
  });
  const at = predictAtHeight(
    { ...ball, ...corrected, flightTempo: 1 },
    best.target.y,
    config,
    4 / config.ballSpeed,
  );
  if (at.y <= best.target.y && Math.abs(at.x - best.target.x) <= best.reach) {
    corrected.targetId = best.target.id;
    if (!directed) {
      corrected.targetX = at.x;
      corrected.arrival = at.time / (result.flightTempo ?? 1);
      corrected.reception = true;
    }
  }
  return corrected;
}
