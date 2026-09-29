import { COURT } from './config.js';
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Metres, seconds, +y up. Quadratic drag and a small topspin acceleration.
// Velocity Verlet for gravity, semi-implicit drag, fixed 120 Hz simulation.
export function integrateBall(ball, dt, config) {
  const speed = Math.hypot(ball.vx, ball.vy, ball.vz);
  const drag = Math.max(0, 1 - config.drag * speed * dt);
  ball.vx *= drag;
  ball.vz *= drag;
  ball.vy *= drag;
  const gravity = config.gravity + (ball.spin || 0) * Math.abs(ball.vx) * 0.07;
  ball.x += ball.vx * dt;
  ball.z += ball.vz * dt;
  ball.y += ball.vy * dt - 0.5 * gravity * dt * dt;
  ball.vy -= gravity * dt;
  ball.spin = (ball.spin || 0) * Math.exp(-dt * 0.6);
  ball.angle = (ball.angle || 0) + (ball.vx * 0.8 + (ball.spin || 0) * 4) * dt;
}

// Swept plane collision prevents a fast spike tunnelling through the net.
export function collideNet(ball, previous, restitution = 0.58) {
  const r = COURT.ballRadius;
  const sign = previous.x < 0 ? -1 : 1;
  const plane = sign * r;
  if ((previous.x - plane) * (ball.x - plane) > 0 || sign * ball.vx >= 0) return false;
  const t = clamp((plane - previous.x) / (ball.x - previous.x || 1e-9), 0, 1);
  const y = previous.y + (ball.y - previous.y) * t;
  const z = previous.z + (ball.z - previous.z) * t;
  if (y > COURT.netHeight + r || y < 0 || z < -r || z > COURT.width + r) return false;
  ball.x = plane;
  ball.vx = -ball.vx * restitution * 0.65;
  ball.vy *= 0.7;
  ball.spin *= 0.4;
  return true;
}

export function isInside(ball) {
  const r = COURT.ballRadius;
  return Math.abs(ball.x) <= COURT.halfLength + r && ball.z >= -r && ball.z <= COURT.width + r;
}

export function predictAtHeight(ball, height, config, maxTime = 4) {
  const b = { ...ball };
  const dt = 1 / 60;
  for (let t = dt; t <= maxTime; t += dt) {
    const prev = { ...b };
    integrateBall(b, dt, config);
    collideNet(b, prev, config.restitution);
    if (b.y <= height && b.vy < 0) return { x: b.x, z: b.z, y: b.y, time: t };
  }
  return { x: b.x, z: b.z, y: b.y, time: maxTime };
}

// Solve the launch velocity against the SAME integrator used in the match.
// This aims a contact impulse; afterwards the ball follows free flight.
export function launchTo(ball, target, seconds, config, spin = 0) {
  let vx = (target.x - ball.x) / seconds;
  let vz = (target.z - ball.z) / seconds;
  let vy = (target.y - ball.y) / seconds + config.gravity * seconds * 0.5;
  for (let i = 0; i < 5; i++) {
    const b = { ...ball, vx, vy, vz, spin };
    const steps = Math.ceil(seconds * 120);
    for (let n = 0; n < steps; n++) integrateBall(b, seconds / steps, config);
    vx += (target.x - b.x) / seconds;
    vy += (target.y - b.y) / seconds;
    vz += (target.z - b.z) / seconds;
  }
  Object.assign(ball, { vx, vy, vz, spin });
}
