import { FIXED_DT } from './config.js';
import { contactBounds, contactReason } from './contact-rules.js';
import { clamp, integrateBall } from './physics.js';
import { sampleJump } from './motion.js';
import { shotImpulse } from './moves.js';
import { contactWaitTime } from './contact-wait.js';

export function isZoneReceive(match, action, player) {
  return !!(
    match.config.dynamic &&
    action &&
    player &&
    !player.diving &&
    (action.kind === 'loft' || contactWaitTime(match.config, action.kind, action.aim) > 0)
  );
}

export function zoneReceiveTarget(player, kind, ball, config) {
  const bounds = contactBounds(player, kind, config);
  return { x: clamp(ball.x, bounds.minX, bounds.maxX), y: clamp(ball.y, bounds.minY, bounds.maxY) };
}

// Clip the full ball segment against the configured zone, including very thin zones.
export function receiveZoneInterval(player, kind, previous, ball, config) {
  const bounds = contactBounds(player, kind, config);
  let enter = 0,
    exit = 1;
  for (const [axis, min, max] of [
    ['x', bounds.minX, bounds.maxX],
    ['y', bounds.minY, bounds.maxY],
  ]) {
    if (min > max) return null;
    const start = previous[axis],
      delta = ball[axis] - start;
    if (Math.abs(delta) < 1e-12) {
      if (start < min || start > max) return null;
      continue;
    }
    const first = (min - start) / delta,
      last = (max - start) / delta;
    enter = Math.max(enter, Math.min(first, last));
    exit = Math.min(exit, Math.max(first, last));
    if (enter > exit) return null;
  }
  return { enter, exit };
}

function cancel(match, control) {
  control.charge = control.pending = null;
  control.chargeLock = true;
  match.label('Мимо: мяч вышел из зоны приёма', 1.2);
  return false;
}

function outsideNextStep(match, p, kind, dt) {
  const ball = { ...match.ball };
  integrateBall(ball, dt, match.config);
  const player = p.jumpProfile
    ? { ...p, ...sampleJump(p.jumpProfile, p.jumpTime + dt), jumpTime: p.jumpTime + dt }
    : p;
  return contactReason(match, player, kind, ball) !== null;
}

export function tryZoneReceive(match, previous, control, released = false, dt = FIXED_DT) {
  const a = released ? control.pending : control.charge;
  const p = match.players[a.playerId];
  match.refreshAim(a, match.inputs?.[control.slot] || {});
  a.receiveReadyAt ??= match.time + match.config.armWindup - (a.age || 0);
  const registered = a.receiveZone || a.receiveHold;
  if (registered && (registered.playerId !== p.id || registered.serial !== match.shotSerial))
    return cancel(match, control);
  const interval = receiveZoneInterval(p, a.kind, previous, match.ball, match.config);
  if (!interval) return registered ? cancel(match, control) : false;
  const pointAt = (t) => ({
    x: previous.x + (match.ball.x - previous.x) * t,
    y: previous.y + (match.ball.y - previous.y) * t,
  });
  const middle = { ...match.ball, ...pointAt((interval.enter + interval.exit) / 2) };
  if (contactReason(match, p, a.kind, middle) !== null)
    return registered ? cancel(match, control) : false;
  a.receiveZone ??= {
    playerId: p.id,
    serial: match.shotSerial,
    at: match.time - dt + interval.enter * dt,
  };
  const inside = match.canContact(p, a.kind);
  const start = match.time - dt;
  const exitAt = inside ? Infinity : start + interval.exit * dt;
  if (a.receiveReadyAt > match.time + 1e-9 || a.receiveReadyAt > exitAt + 1e-9)
    return inside ? false : cancel(match, control);
  a.receiveHold ??= {
    at: a.receiveZone.at,
    playerId: p.id,
    serial: match.shotSerial,
  };
  const delay = contactWaitTime(match.config, a.kind, a.aim);
  const deadline = a.receiveHold.at + delay;
  if (!released && match.time + 1e-9 < deadline && inside && !outsideNextStep(match, p, a.kind, dt))
    return false;
  // When the whole zone was crossed in one step, resolve at the legal point
  // within that segment rather than letting the ball tunnel through it.
  if (!inside) {
    const desiredAt = released ? a.receiveHold.at : Math.min(deadline, exitAt);
    const fraction = clamp((desiredAt - start) / dt, interval.enter, interval.exit);
    const safe = clamp(
      fraction,
      interval.enter + (interval.exit - interval.enter) * 1e-7,
      interval.exit - (interval.exit - interval.enter) * 1e-7,
    );
    Object.assign(match.ball, zoneReceiveTarget(p, a.kind, pointAt(safe), match.config));
  }
  if (!match.canContact(p, a.kind)) return cancel(match, control);
  control.charge = control.pending = null;
  control.chargeLock = true;
  // A held reception starts recovery now; an already released shot keeps its elapsed recovery.
  if (!released) p.releaseSlow = match.config.releaseWindow;
  p.releaseSlowTotal ||= match.config.releaseWindow;
  return match.makeContact(
    p,
    a.kind,
    a.power,
    shotImpulse(match.ball, p, a.kind, a.power, a.aim, match.players, match.config),
  );
}
