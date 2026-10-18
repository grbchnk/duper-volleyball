import { clamp, launchTo, traceBall } from './physics.js';
import { COURT } from './config.js';

export const ATTACKS = Object.freeze({
  power: 'Силовой в глубину',
  steep: 'Крутой вниз',
  tip: 'Скидка',
  roll: 'Накат через блок',
  free: 'Высокий перевод',
  manual: 'Ручной угол',
});
export const PLAYS = Object.freeze({
  high: 'Высокая с задержкой',
  quick: 'Быстрая атака',
  back: 'Пас за голову',
  pipe: 'Ложная → из глубины',
  dump: 'Скидка со второго',
});
export const STYLES = Object.freeze({
  balanced: 'Универсал',
  blocker: 'Ранний блок',
  deep: 'Глубокая защита',
  trickster: 'Обманщик',
  patient: 'Терпеливый',
});

export function contactQuality(ball, player) {
  const horizontal = Math.abs(ball.x - player.x);
  const height = ball.y - player.y;
  return clamp(1 - Math.max(0, horizontal - 0.35) * 0.35 - Math.abs(height - 2.12) * 0.12, 0.55, 1);
}

// A chosen shot defines intent; the integrator owns all flight after contact.
export function tacticalAttack(ball, player, style, power, config, aim = {}) {
  const forward = player.team ? -1 : 1;
  const q = contactQuality(ball, player);
  const depth = { power: 8.3, steep: 1.35, tip: 1.25, roll: 3.9, free: 7 }[style];
  if (depth === undefined) return null;
  const launch = { ...ball };
  const distance = Math.abs(forward * depth - ball.x);
  const speed = (10 + power * 10) * config.hitPower * (0.9 + q * 0.1);
  const seconds =
    style === 'free'
      ? Math.max(1.65, distance / 7)
      : style === 'roll'
        ? Math.max(0.85, distance / 9)
        : style === 'tip'
          ? Math.max(0.65, distance / 7)
          : Math.max(0.3, distance / speed);
  const spin = style === 'roll' ? 1.65 : style === 'steep' ? 1.1 : style === 'power' ? 0.65 : 0;
  launchTo(
    launch,
    { x: forward * depth, y: COURT.ballRadius, z: ball.z },
    seconds / config.ballSpeed,
    config,
    spin,
  );
  // A tip from below the net is a soft arc, never an impossible downward laser.
  if (style === 'tip' || style === 'roll' || style === 'free') {
    for (let n = 0; n < 12; n++) {
      const path = traceBall(launch, config, 4 / config.ballSpeed);
      if (path.some((p) => p.x * forward > 0.3)) break;
      launchTo(
        launch,
        { x: forward * depth, y: COURT.ballRadius, z: ball.z },
        (seconds + (n + 1) * 0.07) / config.ballSpeed,
        config,
        spin,
      );
    }
  }
  let angle = Math.atan2(launch.vy, Math.abs(launch.vx));
  const desired = aim.vector ? Math.atan2(aim.vector.y, Math.abs(aim.vector.x)) : null;
  if (desired !== null) angle += clamp(desired - angle, -0.24, 0.24) * 0.6;
  const offset = (ball.x - player.x) * forward;
  angle += clamp(offset - 0.3, -0.8, 0.8) * 0.045;
  const requestedSpeed = Math.hypot(launch.vx, launch.vy);
  const cap = style === 'tip' ? 8.5 : style === 'roll' ? 12 : style === 'free' ? 16 : speed;
  const magnitude = Math.min(requestedSpeed, cap) * (0.84 + power * 0.16);
  if (style === 'tip' || style === 'roll' || style === 'free') {
    // Assess the actual capped impulse, not the stronger solver candidate.
    // Lift only soft arcs that cannot pass the tape; energy remains fixed.
    for (let n = 0; n < 14; n++) {
      const candidate = {
        ...ball,
        vx: forward * magnitude * Math.cos(angle),
        vy: magnitude * Math.sin(angle),
        spin,
      };
      const path = traceBall(candidate, config, 5 / config.ballSpeed);
      if (path.some((p) => p.x * forward > 0.35)) break;
      angle = Math.min(1.35, angle + 0.06);
    }
  }
  return {
    vx: forward * magnitude * Math.cos(angle),
    vy: magnitude * Math.sin(angle),
    vz: 0,
    spin,
    assisted: false,
    targetId: null,
    intent: style,
    quality: q,
    feedback:
      style === 'steep' && ball.y < 3.25
        ? 'Низкий контакт: крутой удар рискует попасть в сетку'
        : q < 0.8
          ? 'Контакт с краю — подойдите ближе под мяч'
          : ATTACKS[style],
    flightAge: 0,
    flightPhysicalAge: 0,
    flightLaunchVy: magnitude * Math.sin(angle),
  };
}

export function tacticalPass(ball, player, power, aim, players, config) {
  if (aim.play === 'dump')
    return { ...tacticalAttack(ball, player, 'tip', power, config), intent: 'dump' };
  const forward = player.team ? -1 : 1;
  const candidates = players.filter(
    (p) =>
      !p.benched && p.team === player.team && p.id !== player.id && p.recovery <= 0 && !p.diving,
  );
  if (!candidates.length) return null;
  const play = aim.play || 'high';
  const wanted =
    play === 'pipe' ? 4.6 : play === 'back' ? Math.min(7.5, Math.abs(player.x) + 2.3) : 1.5;
  candidates.sort((a, b) => Math.abs(Math.abs(a.x) - wanted) - Math.abs(Math.abs(b.x) - wanted));
  const receiver = candidates[0];
  const clean = contactQuality(ball, player) > 0.82 && Math.abs(ball.x) < 5.5;
  const effective = play === 'quick' && !clean ? 'high' : play;
  const duration =
    effective === 'quick' ? 0.68 : effective === 'pipe' ? 1.22 : effective === 'back' ? 1.05 : 1.5;
  const targetX = -forward * wanted;
  // Do not require a teammate to teleport into the requested lane.
  const travel = Math.abs(targetX - receiver.x) / config.playerSpeed;
  const seconds = Math.max(duration, travel + 0.5);
  const target = { x: targetX, y: effective === 'quick' ? 2.95 : 3.25, z: ball.z };
  const launch = { ...ball };
  launchTo(launch, target, seconds / config.ballSpeed, config, 0);
  const speed = Math.hypot(launch.vx, launch.vy);
  if (speed > 15 * config.hitPower) return null;
  return {
    vx: launch.vx,
    vy: launch.vy,
    vz: 0,
    spin: 0,
    assisted: true,
    targetId: receiver.id,
    intent: effective,
    targetX,
    arrival: seconds / config.ballSpeed,
    decoyId: play === 'pipe' ? candidates.find((p) => p.id !== receiver.id)?.id : null,
    feedback: effective !== play ? 'Неточный приём — высокая страховочная передача' : PLAYS[play],
    flightLaunchVy: launch.vy,
    flightAge: 0,
    flightPhysicalAge: 0,
  };
}

export function blockImpulse(ball, player, perfect, config) {
  const forward = player.team ? -1 : 1;
  const edge = clamp((ball.y - (player.y + 2.05)) / 0.4, -1, 1);
  if (edge > 0.5)
    return {
      vx: ball.vx * 0.68,
      vy: 3.4 + edge * 2,
      spin: -0.2,
      label: 'Край блока — страхуйте отскок!',
    };
  return {
    vx: forward * Math.max(2.5, Math.abs(ball.vx) * config.blockDeflect),
    vy: perfect ? -2.4 : 3.2 + edge,
    spin: 0,
    label: perfect ? 'Закрытый блок!' : 'Мягкий блок — мяч в игре',
  };
}

export function defenseScore(path, opponents, config) {
  let best = Infinity;
  for (let i = 5; i < path.length; i += 12) {
    const b = path[i],
      time = i / 120;
    for (const p of opponents) {
      if ((b.x < 0 ? 0 : 1) !== p.team || b.y > 3.2 || b.y < 0.2) continue;
      const reach = config.playerSpeed * Math.max(0, time - 0.22) + 0.85;
      best = Math.min(best, Math.abs(b.x - p.x) - reach);
    }
  }
  return clamp(Number.isFinite(best) ? best : 3, -3, 3);
}
