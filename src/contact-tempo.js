import { clamp } from './physics.js';

// Scale the shared simulation clock, preserving gravity, trajectories and relative contacts.
export function contactTempo(match, dt) {
  const amount = match.config.dynamic ? match.config.thirdTouchSlowdown || 0 : 0;
  if (!amount || match.phase !== 'rally') {
    match.contactTempoState = null;
    return 1;
  }
  let state = match.contactTempoState;
  if (!state || state.serial !== match.shotSerial) {
    state = match.contactTempoState = {
      serial: match.shotSerial,
      blend: 0,
      age: 0,
      playerId: null,
      used: false,
    };
  }
  const candidate = match.players.find(
    (p) =>
      !p.benched &&
      match.humanSlot(p) !== null &&
      match.lastTouch === p.team &&
      match.touches[p.team] === 2 &&
      p.jumpProfile &&
      p.jumpTime >= p.jumpProfile.windup &&
      !p.block &&
      p.recovery <= 0 &&
      Math.abs(match.ball.x - p.x) < 1.3 &&
      match.ball.y - p.y > 0.8 &&
      match.ball.y - p.y < 3.1,
  );
  if (candidate && !state.used) {
    state.playerId = candidate.id;
    state.used = true;
  }
  const engaged = candidate?.id === state.playerId && state.age < 0.4;
  if (state.playerId !== null) state.age += dt;
  state.blend += clamp((engaged ? 1 : 0) - state.blend, -dt / 0.09, dt / 0.09);
  return 1 - amount * state.blend;
}
