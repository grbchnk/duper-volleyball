import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './legacy-contract.js';
import { FIXED_DT } from '../../src/config.js';
import { SHOTS, SERVES } from '../../src/moves.js';
import { InputBuffer } from '../../src/input.js';
import { jumpProfile, jumpDuration, sampleJump, springPoint } from '../../src/motion.js';
import { traceBall, integrateBall, collideNet } from '../../src/physics.js';
const ticks = (m, n, input = {}) => {
  for (let i = 0; i < n; i++) m.tick(FIXED_DT, input);
};
function reception() {
  const m = new Match({ ...DEFAULTS, trajectory: true });
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 4;
  m.players[0].x = -7;
  m.ball = { x: -7, y: 1.1, z: 4.5, vx: 0, vy: 0, vz: 0, spin: 0, angle: 0 };
  return m;
}

test('legacy rally charge keeps its rate and shot ranges; a full serve waits for release', () => {
  assert.equal(DEFAULTS.chargeSeconds, 0.82 / 2);
  assert.deepEqual(SHOTS.drive.speed, [7.4, 18]);
  assert.deepEqual(SERVES.drive.speed, [11.5, 18.5]);
  const m = new Match();
  ticks(m, 150, { low: true });
  assert.equal(m.charge.power, 1);
  assert.equal(m.phase, 'serve');
  ticks(m, 1);
  assert.equal(m.phase, 'serve-motion');
  ticks(m, 80, { low: true });
  assert.equal(m.stats.serves[0], 0);
});
test('preparing shows its pose immediately and movement works while held and pending', () => {
  for (const kind of ['low', 'loft', 'drive']) {
    const m = reception();
    m.ball.y = 8;
    const x = m.active().x;
    m.tick(FIXED_DT, { [kind]: true, axis: 1 });
    assert.equal(m.active().pose, 'ready-' + SHOTS[kind].pose);
    ticks(m, 10, { [kind]: true, axis: 1 });
    assert.ok(m.active().x > x + 0.25);
    const before = m.active().x;
    m.tick(FIXED_DT, { axis: 1 });
    assert.ok(m.pending);
    assert.ok(m.active().x > before);
    assert.equal(m.contacts, 0);
  }
});
test('arrow movement and WASD actions are independent; Shift modifies height without jumping', () => {
  const b = new InputBuffer();
  b.down('KeyS');
  b.down('ArrowRight');
  assert.equal(b.read().low, true);
  assert.equal(b.read().axis, 1);
  b.clear();
  b.down('KeyD');
  assert.equal(b.read().drive, true);
  assert.equal(b.read().axis, 0);
  b.down('ShiftLeft');
  b.down('ArrowUp');
  assert.equal(b.read().up, true);
  assert.equal(b.read().jump, false);
  b.clear();
  b.down('ArrowDown');
  assert.equal(b.read().crouch, true);
  b.down('ShiftLeft');
  assert.equal(b.read().dive, false);
  assert.equal(b.read().down, true);
});
test('jump slows toward the apex, briefly hangs, then accelerates down with limited air steering', () => {
  const profile = jumpProfile(DEFAULTS),
    a = sampleJump(profile, profile.windup + (profile.rise + profile.hang / 2) * 0.5),
    b = sampleJump(profile, profile.windup + (profile.rise + profile.hang / 2) * 0.8);
  assert.ok(a.vy > b.vy && b.vy > 0);
  assert.equal(
    sampleJump(profile, profile.windup + profile.rise + profile.hang / 2).y,
    profile.height,
  );
  assert.equal(
    Math.abs(sampleJump(profile, profile.windup + profile.rise + profile.hang / 2).vy),
    0,
  );
  assert.ok(
    Math.abs(
      sampleJump(
        profile,
        profile.windup + profile.rise + profile.hang / 2 + (profile.fall + profile.hang / 2) * 0.5,
      ).vy,
    ) >
      Math.abs(
        sampleJump(
          profile,
          profile.windup +
            profile.rise +
            profile.hang / 2 +
            (profile.fall + profile.hang / 2) * 0.1,
        ).vy,
      ),
  );
  assert.ok(jumpDuration(profile) < 0.75);
  const m = reception();
  m.ball.y = 20;
  const p = m.active(),
    x = p.x;
  m.tick(FIXED_DT, { jump: true });
  ticks(m, 45, { axis: 1 });
  assert.ok(p.x > x);
  ticks(m, 55);
  assert.equal(p.y, 0);
  assert.equal(p.jumpProfile, null);
});
test('preview is absent for unreachable balls and matches the actual contact impulse', () => {
  const m = reception();
  m.charge = { kind: 'low', power: 0.5, aim: { axis: 1 }, playerId: 0 };
  m.ball.x = 4;
  m.updatePreview();
  assert.equal(m.aimPreview, null);
  m.ball.x = -7;
  m.updatePreview();
  assert.ok(m.aimPreview);
  const expected = { ...m.aimPreview };
  m.pending = { ...m.charge, ttl: 0.32 };
  m.charge = null;
  assert.equal(m.tryPending(), true);
  for (const key of ['x', 'y', 'vx', 'vy', 'spin']) assert.equal(m.ball[key], expected[key]);
  assert.equal(m.active(0).contact, null);
  const hitter = m.players[0];
  assert.equal(hitter.contact.x, m.ball.x);
  assert.equal(hitter.contact.y, m.ball.y);
  m.config.trajectory = false;
  m.updatePreview();
  assert.equal(m.aimPreview, null);
});
test('serve previews use exactly the launch point after the curved jump, for all three types', () => {
  for (const kind of ['low', 'loft', 'drive']) {
    const m = new Match({ ...DEFAULTS, trajectory: true });
    m.charge = { kind, power: 0.5, aim: { axis: 1 }, playerId: 0 };
    m.updatePreview();
    const expected = { ...m.aimPreview };
    m.charge = null;
    m.beginServe({ kind, power: 0.5, aim: { axis: 1 } });
    ticks(m, Math.round(m.serveAction.ideal / FIXED_DT) - 1);
    m.tick(FIXED_DT, { [kind]: true });
    assert.equal(m.phase, 'rally');
    for (const key of ['x', 'y', 'vx', 'vy'])
      assert.ok(Math.abs(m.ball[key] - expected[key]) < 0.015, `${kind}: ${key}`);
  }
});
test('trajectory trace follows the match integrator including a net rebound', () => {
  const ball = { x: -2, y: 1.8, z: 4.5, vx: 14, vy: 2, vz: 0, spin: 0.5, angle: 0 };
  const path = traceBall(ball, DEFAULTS, 0.3),
    actual = { ...ball };
  for (const point of path.slice(1)) {
    const previous = { ...actual };
    integrateBall(actual, FIXED_DT, DEFAULTS);
    collideNet(actual, previous, DEFAULTS.restitution, DEFAULTS);
    assert.equal(point.x, actual.x);
    assert.equal(point.y, actual.y);
  }
  assert.ok(actual.vx < 0);
});
test('forearm contact is below the head and visual spring remains stable at a slow frame rate', () => {
  const m = reception();
  m.ball.y = 1.7;
  assert.equal(m.canContact(m.active(), 'low'), false);
  m.ball.y = 1.1;
  assert.equal(m.canContact(m.active(), 'low'), true);
  const wrist = { x: 0, y: 0, vx: 0, vy: 0 };
  for (let i = 0; i < 50; i++) springPoint(wrist, { x: 20, y: -30 }, 0.1);
  assert.ok(Math.abs(wrist.x - 20) < 0.001);
  assert.ok(Math.abs(wrist.y + 30) < 0.001);
});
