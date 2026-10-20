import { clamp } from './physics.js';

export function releaseMoveFactor(player, config) {
  const remaining = clamp(
    (player.releaseSlow || 0) / Math.max(player.releaseSlowTotal || config.releaseWindow, 0.001),
    0,
    1,
  );
  return 1 - (1 - config.chargeMove) * remaining * remaining * (3 - 2 * remaining);
}

export function groundVelocity(current, target, maximum, dt) {
  const seconds = target === 0 || current * target < 0 ? 0.055 : 0.075;
  return current + clamp(target - current, (-maximum * dt) / seconds, (maximum * dt) / seconds);
}

// Simulation-owned pose state keeps the lag identical in live play and replays.
export function updateBodyMotion(p, dt, config) {
  const state = (p.bodyMotion ||= { follow: 0, headFollow: 0, torso: 0, head: 0, landing: 0 });
  const active = config.dynamic && !p.diving && p.recovery <= 0;
  const velocity = active ? clamp(p.vx / config.playerSpeed, -1, 1) : 0;
  state.follow += (velocity - state.follow) * (1 - Math.exp(-dt * 18));
  state.headFollow += (state.follow - state.headFollow) * (1 - Math.exp(-dt * 12));
  state.torso = active ? clamp(velocity * 0.7 - (velocity - state.follow) * 3, -2.5, 2.5) : 0;
  state.head = active ? clamp(velocity - (velocity - state.headFollow) * 4, -3.5, 3.5) : 0;
  // The same lag on the vertical axis: the head follows more slowly than the torso.
  // Store it with the player so rendering frequency and replays cannot change it.
  const launchSpeed = p.jumpProfile
    ? (2 * p.jumpProfile.height) / p.jumpProfile.rise
    : config.jumpSpeed * 2;
  const vertical = active ? clamp((p.vy || 0) / Math.max(1, launchSpeed), -1, 1) : 0;
  state.verticalFollow ??= 0;
  state.headVerticalFollow ??= 0;
  state.verticalFollow += (vertical - state.verticalFollow) * (1 - Math.exp(-dt * 18));
  state.headVerticalFollow +=
    (state.verticalFollow - state.headVerticalFollow) * (1 - Math.exp(-dt * 12));
  for (const [part, target, rate] of [
    ['torsoY', (vertical - state.verticalFollow) * 2.2, 26],
    ['headY', (vertical - state.headVerticalFollow) * 3.2, 20],
    ['feetY', (vertical - state.verticalFollow) * 1.2, 30],
  ]) {
    state[part] ??= 0;
    state[part] += ((active ? target : 0) - state[part]) * (1 - Math.exp(-dt * rate));
    if (!active) state[part] = 0;
  }
  state.landing = Math.max(0, state.landing - dt);
}

export function verticalBodyOffset(p) {
  const motion = p.bodyMotion;
  if (!motion || p.diving || p.recovery > 0) return { torso: 0, head: 0, feet: 0 };
  const offset = (value = 0) => (Math.abs(value) < 0.03 ? 0 : Math.round(value * 100) / 100);
  return {
    torso: offset(motion.torsoY),
    head: offset(motion.headY),
    // Keep the soles on the court during windup and after landing.
    feet: p.y > 0 ? Math.min(offset(motion.feetY), p.y * 20) : 0,
  };
}

export function bodyOffset(p) {
  const motion = p.bodyMotion;
  if (!motion || p.diving || p.recovery > 0) return { torso: 0, head: 0, drop: 0 };
  const age = 0.22 - motion.landing;
  const drop = motion.landing > 0 ? Math.sin(Math.PI * clamp(age / 0.22, 0, 1)) * 2 : 0;
  return {
    torso: Math.round(motion.torso),
    head: Math.round(motion.head),
    drop: Math.round(drop) + verticalBodyOffset(p).torso,
  };
}
