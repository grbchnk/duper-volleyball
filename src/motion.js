import { serveSettings } from './serve-settings.js';
import { heldServeBall } from './serve-support.js';
// Quick ease-out ascent, a short apex pause, then an accelerating fall.
// The ball retains its independent ballistic physics.
export function jumpProfile(config) {
  const natural = config.jumpSpeed / config.gravity;
  return {
    height: config.jumpSpeed ** 2 / (2 * config.gravity),
    windup: config.jumpWindup,
    rise: natural * config.jumpRise,
    hang: config.jumpHang,
    fall: natural * config.jumpFall,
  };
}
export function sampleJump(profile, time) {
  const { height, rise, hang, fall } = profile;
  if (time < profile.windup) return { y: 0, vy: 0 };
  time -= profile.windup;
  if (time < rise) {
    const u = Math.max(0, time / rise);
    return { y: height * (1 - (1 - u) ** 2), vy: (2 * height * (1 - u)) / rise };
  }
  if (time < rise + hang) return { y: height, vy: 0 };
  const u = Math.min(1, (time - rise - hang) / fall);
  return { y: height * (1 - u * u), vy: u === 1 ? 0 : (-2 * height * u) / fall };
}
export const jumpDuration = (profile) =>
  profile.windup + profile.rise + profile.hang + profile.fall;
export const SERVE_WINDUP = 43 / 120;
export function blockWindow(player, config) {
  if (!player.jumpProfile || !player.block || player.blockUsed) return false;
  const apex = player.jumpProfile.windup + player.jumpProfile.rise + player.jumpProfile.hang / 2;
  return Math.abs(player.jumpTime - apex) <= config.blockWindow / 2;
}
export function serveOrigin(player, kind, config, preview = false) {
  const settings = serveSettings(config, kind);
  const dir = player.team === 0 ? 1 : -1;
  const lift = preview ? (kind === 'drive' ? jumpProfile(config).height : 0) : player.y;
  return {
    x: player.x + dir * (0.5 + (preview && kind === 'drive' ? settings.Runup : 0)),
    y: lift + settings.ContactHeight,
    z: 4.5,
  };
}

export function serveMotion(player, action, config) {
  const settings = serveSettings(config, action.kind),
    profile = jumpProfile(config);
  const t = Math.max(0, Math.min(1, action.power)) ** settings.PowerCurve;
  const requested = settings.IdealMin + (settings.IdealMax - settings.IdealMin) * t;
  const jumpLead = profile.windup + profile.rise + profile.hang / 2;
  const ideal = action.kind === 'drive' ? Math.max(requested, jumpLead + 0.05) : requested;
  const height = serveOrigin(player, action.kind, config, true).y;
  const jumpAt = Math.max(0.05, ideal - jumpLead);
  const tossDelay = config.dynamic
    ? Math.min(0.14, ideal * 0.22, action.kind === 'drive' ? jumpAt + profile.windup - 0.02 : 0.14)
    : 0;
  const flight = ideal - tossDelay;
  return {
    ...action,
    settings,
    profile,
    startX: player.x,
    ideal,
    jumpAt,
    jumped: false,
    tossStart: settings.TossHeight,
    heldStart: heldServeBall(player).y,
    tossDelay,
    tossSpeed: (height - settings.TossHeight + (settings.TossGravity * flight ** 2) / 2) / flight,
  };
}
export function sampleServeMotion(player, action, time) {
  const dir = player.team === 0 ? 1 : -1,
    settings = action.settings;
  if (action.kind === 'drive') {
    player.x = action.startX + dir * settings.Runup * Math.min(time / action.jumpAt, 1);
    player.vx = time < action.jumpAt ? (dir * settings.Runup) / action.jumpAt : 0;
    player.runTime = time;
    if (time >= action.jumpAt) {
      player.jumpProfile = action.profile;
      player.jumpTime = time - action.jumpAt;
      Object.assign(player, sampleJump(action.profile, player.jumpTime));
      action.jumped = true;
    }
  }
  const delay = action.tossDelay || 0;
  const flight = Math.max(0, time - delay);
  const u = delay ? Math.min(1, time / delay) : 1;
  const heldHeight =
    (2 * u ** 3 - 3 * u ** 2 + 1) * action.heldStart +
    (-2 * u ** 3 + 3 * u ** 2) * action.tossStart +
    (u ** 3 - u ** 2) * delay * action.tossSpeed;
  return {
    x: player.x + dir * 0.5,
    y:
      time < delay
        ? heldHeight
        : action.tossStart + action.tossSpeed * flight - (settings.TossGravity * flight ** 2) / 2,
    z: player.z,
  };
}

// Damped wrists and a two-bone elbow. Only presentation uses these springs;
// contacts remain deterministic and never depend on the render frame rate.
export function springPoint(point, target, dt, stiffness = 440, damping = 29) {
  const steps = Math.max(1, Math.ceil(Math.min(dt, 0.1) * 120));
  const h = Math.min(dt, 0.1) / steps;
  for (let i = 0; i < steps; i++)
    for (const axis of ['x', 'y']) {
      const velocity = axis === 'x' ? 'vx' : 'vy';
      point[velocity] += ((target[axis] - point[axis]) * stiffness - point[velocity] * damping) * h;
      point[axis] += point[velocity] * h;
    }
  return point;
}
export function elbowBetween(shoulder, wrist, bend) {
  const dx = wrist.x - shoulder.x,
    dy = wrist.y - shoulder.y,
    length = Math.max(0.001, Math.hypot(dx, dy));
  const offset = Math.min(8, Math.max(2, 18 - length * 0.35)) * bend;
  return {
    x: (shoulder.x + wrist.x) / 2 - (dy / length) * offset,
    y: (shoulder.y + wrist.y) / 2 + (dx / length) * offset,
  };
}
