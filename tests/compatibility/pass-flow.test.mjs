import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './legacy-contract.js';
import { FIXED_DT, sanitizeConfig } from '../../src/config.js';
import { shotImpulse } from '../../src/moves.js';
import { traceBall } from '../../src/physics.js';

const neutral = { axis: 0, up: false, down: false };

test('pass assistance blends direction at constant power and zero is fully manual', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.players[0];
  Object.assign(m.ball, { x: p.x, y: 0.8 });
  for (const kind of ['low', 'loft']) {
    const shot = (passAssist, assist = true) =>
      shotImpulse(m.ball, p, kind, 0.4, neutral, m.players, { ...m.config, assist, passAssist });
    const free = shot(0),
      full = shot(1);
    assert.deepEqual(free, shot(1, false));
    assert.equal(free.assisted, false);
    assert.equal(free.targetId, null);
    for (const amount of [0.25, 0.5, 0.75]) {
      const actual = shot(amount);
      const angle = (s) => Math.atan2(s.vy, s.vx);
      const delta = Math.atan2(
        Math.sin(angle(full) - angle(free)),
        Math.cos(angle(full) - angle(free)),
      );
      assert.ok(Math.abs(angle(actual) - angle(free) - delta * amount) < 1e-9);
      assert.ok(Math.abs(Math.hypot(actual.vx, actual.vy) - Math.hypot(free.vx, free.vy)) < 1e-9);
      assert.equal(actual.flightLaunchVy, actual.vy);
    }
  }
  for (const serving of [false, true]) {
    const shot = (amount) =>
      shotImpulse(
        m.ball,
        p,
        'drive',
        0.4,
        neutral,
        m.players,
        { ...m.config, passAssist: amount },
        serving,
      );
    if (serving) assert.deepEqual(shot(0), shot(1));
    else {
      assert.deepEqual(shot(1), shot(0));
      assert.equal(shot(0).assisted, true);
    }
  }
});

test('pass assistance is bounded and survives settings export without breaking old saves', () => {
  assert.equal(sanitizeConfig({}).passAssist, 0.5);
  assert.equal(sanitizeConfig({ passAssist: -1 }).passAssist, 0);
  assert.equal(sanitizeConfig({ passAssist: 5 }).passAssist, 1);
  assert.equal(sanitizeConfig(JSON.parse(JSON.stringify({ passAssist: 0.35 }))).passAssist, 0.35);
  assert.equal(sanitizeConfig({ assist: false }).assist, false);
});

test('passers pause then walk to a stable free position, and manual control takes priority', () => {
  const m = new Match();
  const targets = [];
  for (let i = 0; i < 6; i++) {
    m.startDrill('receive');
    const p = m.players[0];
    p.x = -5;
    Object.assign(m.ball, { x: p.x, y: 0.8 });
    m.makeContact(p, 'low', 0.4, pass(m, p, 'low', 0.4));
    const target = p.homeX;
    targets.push(target);
    assert.ok(target >= -8.5 && target <= -0.5);
    assert.ok(p.returnDelay >= 0.1);
    assert.equal(p.x, -5);
    assert.ok(p.clearLane || p.returnHome);
    for (let n = 0; n < 750; n++) {
      const old = p.x;
      m.time += FIXED_DT;
      m.movePlayers(FIXED_DT, neutral);
      assert.equal(p.homeX, target);
      assert.ok(Math.abs(p.x - old) <= m.config.playerSpeed * FIXED_DT + 1e-9);
    }
    assert.equal(p.x, target);
    assert.equal(p.returnHome, false);
    p.x = -5;
    p.returnHome = true;
    m.selected[0] = p.id;
    m.movePlayers(FIXED_DT, { axis: 1 });
    assert.ok(p.x > -5);
    assert.equal(p.returnHome, false);
  }
  assert.ok(targets.every(Number.isFinite));
});

test('return waits for landing and recovery; becoming the pass recipient cancels it', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.players[0];
  p.x = -5;
  m.jump(p);
  Object.assign(m.ball, { x: p.x, y: 2.1 });
  m.makeContact(p, 'loft', 0.4, pass(m, p, 'loft', 0.4));
  assert.notEqual(
    m.active().id,
    p.id,
    'a completed pass hands control over while the passer is airborne',
  );
  m.movePlayers(FIXED_DT, neutral);
  assert.equal(p.x, -5);
  assert.ok(p.clearLane || p.returnHome);
  p.jumpProfile = null;
  p.recovery = 0.5;
  m.movePlayers(FIXED_DT, neutral);
  assert.equal(p.x, -5);
  p.recovery = 0;
  p.returnDelay = 0;
  m.movePlayers(FIXED_DT, neutral);
  assert.ok(p.x < -5);
  m.autoSelect(0, p.id);
  assert.equal(p.returnHome, false);
  const x = p.x;
  m.movePlayers(FIXED_DT, neutral);
  assert.equal(p.x, x);
  m.startServe();
  assert.equal(p.returnHome, false);
  assert.equal(p.homeX, -8);
});

function pass(m, p, kind, power) {
  return shotImpulse(m.ball, p, kind, power, neutral, m.players, m.config);
}

test('neutral passes select reachable teammates using the actual strength profile', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.players[2];
  Object.assign(m.ball, { x: p.x, y: 1, vx: 0, vy: 0 });
  for (const kind of ['low', 'loft', 'back'])
    for (const power of [0.15, 0.5, 1]) {
      const hit = pass(m, p, kind, power);
      const raw = shotImpulse(m.ball, p, kind, power, neutral, m.players, {
        ...m.config,
        assist: false,
      });
      assert.ok(Math.abs(Math.hypot(hit.vx, hit.vy) - Math.hypot(raw.vx, raw.vy)) < 1e-10);
      if (hit.targetId !== null) {
        assert.notEqual(hit.targetId, p.id);
        assert.equal(m.players[hit.targetId].team, p.team);
      }
    }
  const drive = pass(m, p, 'drive', 1);
  assert.equal(drive.assisted, true);
  assert.equal(drive.targetId, null);
  assert.ok(drive.vy > 0);
});

test('serve styles retain a high S, ordinary W and forward D at all powers', () => {
  const m = new Match();
  for (const power of [0.1, 0.5, 1]) {
    const shots = ['low', 'loft', 'drive'].map((kind) =>
      shotImpulse(m.ball, m.active(), kind, power, neutral, m.players, m.config, true),
    );
    const slopes = shots.map((s) => s.vy / s.vx);
    assert.ok(slopes[0] > slopes[1] && slopes[1] > slopes[2]);
    assert.ok(shots.every((s) => s.vx > 0 && !s.assisted && s.targetId === null));
  }
});

test('full charge uses the same pending window as release and cannot repeat while held', () => {
  for (const kind of ['low', 'loft', 'drive'])
    for (const window of [0, 0.06, 0.2]) {
      for (const auto of [false, true]) {
        const m = new Match({ ...DEFAULTS, releaseWindow: window });
        m.startDrill('receive');
        Object.assign(m.ball, { x: 4, y: 10, vx: 0, vy: 0 });
        m.charge = { kind, power: auto ? 0.99 : 1, age: 0.38, playerId: 0, aim: neutral };
        m.updateCharge(FIXED_DT, { ...neutral, [kind]: auto }, () => false);
        assert.equal(m.charge, null);
        assert.equal(m.pending?.ttl ?? 0, window);
        assert.equal(m.players[0].armSwing.hit, false);
        m.tick(FIXED_DT, { [kind]: auto });
        Object.assign(m.ball, { x: m.players[0].x, y: kind === 'low' ? 0.8 : 2.1, vx: 0, vy: 0 });
        m.tick(FIXED_DT, { [kind]: auto });
        assert.equal(m.contacts, window > 0 ? 1 : 0);
        for (let n = 0; n < 20; n++) m.tick(FIXED_DT, { [kind]: auto });
        assert.equal(m.charge, null);
        assert.equal(m.contacts, window > 0 ? 1 : 0);
      }
    }
});
