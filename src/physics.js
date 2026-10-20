import { COURT, FIXED_DT } from './config.js';
import { courtLineBounds } from './court-visual.js';
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Re-time the same spatial trajectory: readable launch, smooth acceleration,
// faster finish. This clock is shared by live flight, prediction and the solver.
function animationClock(age, config) {
  const ramp = config.cartoonRamp ?? 0.85;
  const start = config.cartoonStart ?? 0.55;
  const end = config.cartoonEnd ?? 1.35;
  const u = clamp(age / ramp, 0, 1);
  const integral = ramp * (u ** 3 - 0.5 * u ** 4);
  return start * age + (end - start) * (integral + Math.max(0, age - ramp));
}
export function flightTime(age, dt, config) {
  const amount = config.cartoonFlight || 0;
  if (!amount) return dt * (config.ballSpeed ?? 1);
  return (
    (config.ballSpeed ?? 1) *
    (dt * (1 - amount) + amount * (animationClock(age + dt, config) - animationClock(age, config)))
  );
}
export function resetFlight(ball, tempo = 1) {
  ball.flightTempo = tempo;
  ball.flightAge = 0;
  ball.flightLaunchVy = ball.vy;
  ball.flightPhysicalAge = 0;
}

// Metres, seconds, +y up. Quadratic drag and a small topspin acceleration.
// Velocity Verlet for gravity, semi-implicit drag, fixed 120 Hz simulation.
export function integrateBall(ball, dt, config) {
  // Re-time this flight, including its animation clock, without changing its impulse.
  dt *= config.dynamic || config.modifierTempo ? (ball.flightTempo ?? 1) : 1;
  const age = ball.flightAge || 0;
  ball.flightAge = age + dt;
  ball.flightLaunchVy ??= ball.vy;
  dt = flightTime(age, dt, config);
  // A smooth slowdown only around the apex of an upward launch, never on a spike.
  if (config.cartoonFlight > 0 && ball.flightLaunchVy > 1)
    dt *=
      1 -
      (config.cartoonFlight || 0) * (config.cartoonHang || 0) * Math.exp(-((ball.vy / 1.8) ** 2));
  ball.flightPhysicalAge = (ball.flightPhysicalAge || 0) + dt;
  const speed = Math.hypot(ball.vx, ball.vy, ball.vz);
  const drag = Math.max(0, 1 - config.drag * speed * dt);
  ball.vx *= drag;
  ball.vz *= drag;
  ball.vy *= drag;
  const gravity =
    config.gravity +
    clamp(ball.attackGravity || 0, 0, 24) +
    (ball.spin || 0) * Math.abs(ball.vx) * 0.07;
  ball.x += ball.vx * dt;
  ball.z += ball.vz * dt;
  ball.y += ball.vy * dt - 0.5 * gravity * dt * dt;
  ball.vy -= gravity * dt;
  ball.spin = (ball.spin || 0) * Math.exp(-dt * 0.6);
  ball.angle = (ball.angle || 0) + (ball.vx * 0.8 + (ball.spin || 0) * 4) * dt;
}

// Swept plane collision prevents a fast spike tunnelling through the net.
export const netBallRadius = (config) =>
  config ? 0.295 * (config.ballSize ?? 1.2) : COURT.ballRadius;
export function crossesUnderNet(ball, previous, config) {
  if (previous.x * ball.x > 0 || previous.x === ball.x) return false;
  const t = clamp(-previous.x / (ball.x - previous.x), 0, 1);
  const height = previous.y + (ball.y - previous.y) * t;
  return height + netBallRadius(config) < COURT.netHeight - COURT.netDepth;
}
export function collideNet(ball, previous, restitution = 0.58, config = null) {
  const r = netBallRadius(config);
  const sign = previous.x < 0 ? -1 : 1;
  const plane = sign * r;
  if ((previous.x - plane) * (ball.x - plane) > 0 || sign * ball.vx >= 0) return false;
  const t = clamp((plane - previous.x) / (ball.x - previous.x || 1e-9), 0, 1);
  const y = previous.y + (ball.y - previous.y) * t;
  const z = previous.z + (ball.z - previous.z) * t;
  if (
    y > COURT.netHeight + r ||
    y < COURT.netHeight - COURT.netDepth - r ||
    z < -r ||
    z > COURT.width + r
  )
    return false;
  const speed = Math.hypot(ball.vx, ball.vy);
  ball.attackGravity = (ball.attackGravity || 0) * 0.35;
  ball.netImpact = { serial: (ball.netImpact?.serial || 0) + 1, direction: -sign, speed, y };
  // A grazing contact with the tape keeps forward momentum, loses energy and
  // hops up. Lower hits rebound into the same court as before.
  if (y >= COURT.netHeight + r * 0.65 && Math.abs(ball.vx) > 1.2) {
    ball.x = plane;
    ball.y = Math.max(ball.y, COURT.netHeight + r + 0.015);
    ball.vx *= 0.82;
    ball.vy = Math.max(0.9, Math.min(3.2, Math.abs(ball.vy) * 0.45 + speed * 0.14));
    ball.spin *= 0.6;
    resetFlight(ball, ball.flightTempo ?? 1);
    return true;
  }
  ball.x = plane;
  ball.vx = -ball.vx * restitution * 0.85;
  ball.vy *= 0.7;
  ball.spin *= 0.4;
  resetFlight(ball, ball.flightTempo ?? 1);
  return true;
}

// A dead ball keeps its momentum, losing energy on each floor contact.
export function bounceFloor(ball, config) {
  if (ball.y > COURT.ballRadius) return;
  ball.y = COURT.ballRadius;
  if (ball.vy >= 0) return;
  ball.vy = -ball.vy * config.restitution;
  if (ball.vy < 0.35) ball.vy = 0;
  ball.vx *= 0.8;
  ball.vz *= 0.8;
  if (Math.hypot(ball.vx, ball.vz) < 0.03) ball.vx = ball.vz = 0;
  ball.spin *= 0.7;
  ball.attackGravity = 0;
  resetFlight(ball, ball.flightTempo ?? 1);
}

export function isInside(ball, config = null) {
  const r = netBallRadius(config);
  const { left, right } = courtLineBounds(config);
  return ball.x >= left - r && ball.x <= right + r && ball.z >= -r && ball.z <= COURT.width + r;
}

// Same step, drag, spin and net collision as Match.tick; excludes future player contacts.
export function traceBall(ball, config, seconds = 4) {
  const b = { ...ball },
    points = [{ ...b }];
  for (let i = 0; i < Math.ceil(seconds / FIXED_DT); i++) {
    const previous = { ...b };
    integrateBall(b, FIXED_DT, config);
    collideNet(b, previous, config.restitution, config);
    if (crossesUnderNet(b, previous, config)) {
      points.push({ ...b, netFault: true });
      break;
    }
    if (b.y <= COURT.ballRadius) {
      b.y = COURT.ballRadius;
      points.push({ ...b });
      break;
    }
    points.push({ ...b });
  }
  return points;
}

export function predictAtHeight(ball, height, config, maxTime = 4) {
  const b = { ...ball };
  const dt = 1 / 60;
  for (let t = dt; t <= maxTime; t += dt) {
    const prev = { ...b };
    integrateBall(b, dt, config);
    collideNet(b, prev, config.restitution, config);
    if (crossesUnderNet(b, prev, config))
      return { x: b.x, z: b.z, y: b.y, time: t, netFault: true };
    if (b.y <= height && b.vy < 0) return { x: b.x, z: b.z, y: b.y, time: t };
  }
  return { x: b.x, z: b.z, y: b.y, time: maxTime };
}

// Solve the launch velocity against the SAME integrator used in the match.
// This aims a contact impulse; afterwards the ball follows free flight.
export function launchTo(ball, target, seconds, config, spin = 0) {
  const physicalSeconds = flightTime(0, seconds, config);
  let vx = (target.x - ball.x) / physicalSeconds;
  let vz = (target.z - ball.z) / physicalSeconds;
  let vy = (target.y - ball.y) / physicalSeconds + config.gravity * physicalSeconds * 0.5;
  const simulate = (vertical) => {
    const b = { ...ball, vx, vy: vertical, vz, spin };
    resetFlight(b);
    const steps = Math.ceil(seconds * 120);
    for (let n = 0; n < steps; n++) integrateBall(b, seconds / steps, config);
    return b;
  };
  const stylised = config.cartoonFlight > 0;
  for (let i = 0; i < (stylised ? 12 : 5); i++) {
    const b = simulate(vy);
    if (Math.hypot(target.x - b.x, target.y - b.y, target.z - b.z) < 0.001) break;
    const derivative = stylised ? (simulate(vy + 0.02).y - b.y) / 0.02 : physicalSeconds;
    vx += (target.x - b.x) / b.flightPhysicalAge;
    vy += clamp((target.y - b.y) / Math.max(0.15, derivative), -5, 5);
    vz += (target.z - b.z) / b.flightPhysicalAge;
  }
  Object.assign(ball, { vx, vy, vz, spin });
  resetFlight(ball);
}

// A landing solution alone can intersect the net. Validate the complete flight
// with the same fixed-step collisions as the match before choosing a serve.
export function launchOverNet(ball, target, seconds, config) {
  const side = Math.sign(ball.x);
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = { ...ball };
    const duration = seconds + (attempt * 0.12) / config.ballSpeed;
    launchTo(candidate, target, duration, config);
    const path = traceBall(candidate, config, duration + 3 / config.ballSpeed);
    const landing = path.at(-1);
    const crossing = path.findIndex((p) => p.x * side <= 0);
    if (
      crossing <= 0 ||
      landing.netFault ||
      landing.y > COURT.ballRadius + 0.001 ||
      landing.x * side >= -1 ||
      Math.abs(landing.x) > COURT.halfLength - 0.3
    )
      continue;
    const before = path[crossing - 1],
      after = path[crossing];
    const fraction = -before.x / (after.x - before.x);
    const clearance = before.y + (after.y - before.y) * fraction;
    if (clearance < COURT.netHeight + netBallRadius(config) + 0.25) continue;
    Object.assign(ball, candidate);
    return true;
  }
  return false;
}

// Find the lowest launch angle that clears the near face of the net at the
// requested speed. Use the match integrator, so spin, drag and flight timing agree.
export function driveOverNet(ball, speed, forward, down, config) {
  const plane = -forward * netBallRadius(config);
  if ((plane - ball.x) * forward <= 0) return null;
  const height = COURT.netHeight + netBallRadius(config) + (down ? 0.18 : 0.28);
  const crossingHeight = (angle) => {
    const rad = (angle * Math.PI) / 180;
    const b = {
      ...ball,
      vx: forward * speed * Math.cos(rad),
      vy: speed * Math.sin(rad),
      vz: 0,
      spin: ball.spin ?? 0.5,
    };
    resetFlight(b);
    for (let n = 0; n < 720; n++) {
      const x = b.x,
        y = b.y;
      integrateBall(b, FIXED_DT, config);
      if ((b.x - plane) * forward >= 0) return y + ((b.y - y) * (plane - x)) / (b.x - x);
      if (b.y < COURT.ballRadius) break;
    }
    return -Infinity;
  };
  let lower = -85;
  for (const upper of [...Array.from({ length: 34 }, (_, i) => -80 + i * 5), 89, 89.9]) {
    if (crossingHeight(upper) >= height) {
      let high = upper;
      for (let n = 0; n < 10; n++) {
        const mid = (lower + high) / 2;
        if (crossingHeight(mid) >= height) high = mid;
        else lower = mid;
      }
      const rad = (high * Math.PI) / 180;
      return { vx: forward * speed * Math.cos(rad), vy: speed * Math.sin(rad) };
    }
    lower = upper;
  }
  return null;
}

// Intended net crossing, deliberately before applying a net collision.
export function reachesNet(ball, config) {
  const side = Math.sign(ball.x);
  if (!side || ball.vx * side >= 0) return !side;
  const b = { ...ball };
  resetFlight(b);
  for (let n = 0; n < 960; n++) {
    integrateBall(b, FIXED_DT, config);
    if (b.x * side <= COURT.ballRadius) return true;
    if (b.y <= COURT.ballRadius) return false;
  }
  return false;
}
