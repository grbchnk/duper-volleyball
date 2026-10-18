import { clamp } from './physics.js';

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
  state.landing = Math.max(0, state.landing - dt);
}

export function bodyOffset(p) {
  const motion = p.bodyMotion;
  if (!motion || p.diving || p.recovery > 0) return { torso: 0, head: 0, drop: 0 };
  const age = 0.22 - motion.landing;
  const drop = motion.landing > 0 ? Math.sin(Math.PI * clamp(age / 0.22, 0, 1)) * 2 : 0;
  return { torso: Math.round(motion.torso), head: Math.round(motion.head), drop: Math.round(drop) };
}
