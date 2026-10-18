import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { planReception } from '../src/cpu.js';
import { shotImpulse } from '../src/moves.js';
import { integrateBall } from '../src/physics.js';
import { soundCue } from '../src/audio.js';
import { capture, restore } from '../src/replay.js';

function coop() {
  const m = new Match();
  m.reset('coop');
  m.phase = 'rally';
  Object.assign(m.ball, { x: -4, y: 14, vx: 0, vy: 0 });
  return m;
}
test('two controllers move and charge two different teammates while the opponent remains CPU', () => {
  const m = coop(),
    before = m.players.map((p) => p.x);
  for (let i = 0; i < 12; i++) m.tick(FIXED_DT, { axis: 1, loft: true }, { axis: -1, drive: true });
  assert.ok(m.players[0].x > before[0]);
  assert.ok(m.players[2].x < before[2]);
  assert.equal(m.controls[0].charge.kind, 'loft');
  assert.equal(m.controls[2].charge.kind, 'drive');
  assert.equal(m.isHuman(1), false);
  assert.equal(m.humanSlot(m.players[2]), 2);
  m.tick(FIXED_DT, { loft: true }, {});
  assert.equal(m.controls[0].charge.kind, 'loft');
  assert.equal(m.controls[2].charge, null);
});
test('co-op switching never steals the other controller player, even on simultaneous presses', () => {
  const m = coop();
  for (let i = 0; i < 25; i++) {
    m.tick(FIXED_DT, { switch: true }, { switch: true });
    assert.notEqual(m.selected[0], m.coopSelected);
    m.tick(FIXED_DT);
  }
  const snapshot = capture(m);
  restore(m, snapshot);
  assert.equal(m.controls.length, 3);
  assert.notEqual(m.selected[0], m.coopSelected);
});
test('the back controller owns the initial co-op serve', () => {
  const m = new Match();
  m.reset('coop');
  m.tick(FIXED_DT, {}, { drive: true });
  assert.equal(m.phase, 'serve');
  assert.equal(m.controls[2].charge, null);
  m.tick(FIXED_DT, { low: true });
  assert.equal(m.controls[0].charge.playerId, 0);
});
test('second teammate contacts from its own controller and uses the direction at impact', () => {
  const m = coop(),
    p = m.players[2];
  m.tick(FIXED_DT, {}, { drive: true, axis: 1 });
  m.tick(FIXED_DT, {}, {});
  assert.ok(m.controls[2].pending);
  Object.assign(m.ball, { x: p.x, y: 2, vx: 0, vy: 0 });
  m.cooldown = 0;
  m.lastTouch = 1;
  m.lastPlayer = 3;
  m.tick(FIXED_DT, {}, { axis: -1 });
  assert.equal(m.lastPlayer, p.id);
  assert.ok(m.ball.vx < 0);
  assert.equal(Object.hasOwn(m, 'controlSlot'), false);
});
test('a CPU never attempts a fourth team contact after a third ball stays on its side', () => {
  const m = new Match();
  m.reset('demo');
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 4;
  m.touches[1] = 3;
  Object.assign(m.ball, { x: m.players[3].x, y: 1.5, vx: 0, vy: -1 });
  const contacts = m.contacts;
  assert.equal(planReception(m, 1), null);
  m.tryCPUContact(1);
  assert.equal(m.contacts, contacts);
  assert.equal(m.touches[1], 3);
  assert.notEqual(m.pointReason, 'ЧЕТВЁРТОЕ КАСАНИЕ');
});
test('the CPU commits its last approach rather than alternating target positions', () => {
  const m = new Match();
  m.reset('demo');
  m.phase = 'rally';
  m.lastTouch = 0;
  Object.assign(m.ball, { x: 4, y: 2.4, vx: -0.2, vy: -1 });
  const previous = {
    serial: m.shotSerial,
    playerId: 4,
    targetX: 3.8,
    contactAt: m.time + 0.3,
    reactionAt: 0,
    error: 0,
    allowDive: false,
  };
  for (let i = 0; i < 5; i++) {
    m.time += 0.03;
    m.ball.x += i % 2 ? 0.08 : -0.08;
    const plan = planReception(m, 1, previous);
    assert.equal(plan.playerId, 4);
    assert.equal(plan.targetX, 3.8);
  }
});
test('stronger forward attacks gain more downward curvature, without changing player gravity', () => {
  const p = { team: 0, x: -2, y: 1 },
    b = { x: -2, y: 4, z: 4.5, vx: 10, vy: 2, vz: 0, spin: 0 };
  const weak = shotImpulse(b, p, 'drive', 0.2, { manualControl: true }, [p], DEFAULTS);
  const strong = shotImpulse(b, p, 'drive', 1, { manualControl: true }, [p], DEFAULTS);
  assert.ok(strong.attackGravity > weak.attackGravity);
  assert.ok(strong.vy > 0, 'neutral forward attack starts a visible arc');
  const a = { ...b, attackGravity: weak.attackGravity },
    c = { ...b, attackGravity: strong.attackGravity };
  integrateBall(a, 0.2, DEFAULTS);
  integrateBall(c, 0.2, DEFAULTS);
  assert.ok(c.y < a.y && c.vy < a.vy);
  assert.equal(DEFAULTS.gravity, 10.1);
  const pass = shotImpulse(
    { ...b, ...strong },
    p,
    'loft',
    0.4,
    { manualControl: true },
    [p],
    DEFAULTS,
  );
  assert.equal(pass.attackGravity, 0, 'the next pass does not inherit the attack acceleration');
  const flat = shotImpulse(b, p, 'drive', 1, { manualControl: true }, [p], {
    ...DEFAULTS,
    attackDip: 0,
  });
  assert.equal(flat.attackGravity, 0, 'the new curvature can be disabled in live physics settings');
});
test('whistle, applause and windup cues have bounded volume and valid notes', () => {
  for (const type of [
    'whistle',
    'windup',
    'dive',
    'floor',
    'applause',
    'charge-preview',
    'stage-start',
  ]) {
    const cue = soundCue({ type });
    assert.ok(cue.length > 0, type);
    for (const n of cue) {
      assert.ok(Number.isFinite(n.frequency) && n.frequency > 0);
      assert.ok(n.volume > 0 && n.volume <= 0.2);
      assert.ok(n.duration > 0 && n.duration <= 1.4);
    }
  }
});
