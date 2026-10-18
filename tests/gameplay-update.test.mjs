import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, COURT, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { shotImpulse } from '../src/moves.js';
import { simulateShot } from '../src/shot-lab.js';
import { predictAtHeight, traceBall } from '../src/physics.js';
import { beginRally, observeContact } from '../src/skill-feedback.js';
import { netMesh } from '../src/net-visual.js';
import { constrainWorldHand, constrainRenderedJoint } from '../src/net-reach.js';
import { exportSettings, importSettings } from '../src/settings-file.js';

const speed = (b) => Math.hypot(b.vx, b.vy);
test('neutral attack assistance rotates at fixed speed, respects explicit aim, and cannot invent power', () => {
  for (const playerId of [1, 2, 4, 5]) {
    const options = { kind: 'drive', power: 0.5, playerId, height: 0.7 };
    const c = { ...DEFAULTS, neutralAttackAssist: 1 };
    const guided = simulateShot(c, options);
    const raw = simulateShot({ ...c, neutralAttackAssist: 0 }, options);
    assert.ok(guided.impulse.assisted);
    assert.ok(Math.abs(speed(guided.impulse) - speed(raw.impulse)) < 1e-10);
    const aimed = simulateShot(c, { ...options, angle: -30 });
    assert.deepEqual(
      aimed.impulse,
      simulateShot({ ...c, neutralAttackAssist: 0 }, { ...options, angle: -30 }).impulse,
    );
    const weak = simulateShot({ ...c, driveSpeedMin: 0.1, driveSpeedMax: 0.1 }, options);
    assert.equal(weak.impulse.assisted, false);
  }
});
test('neutral passes on either team find reachable partners without changing power or overriding direction', () => {
  for (const playerId of [1, 2, 4, 5]) {
    const c = { ...DEFAULTS, neutralPassAssist: 1 };
    const sample = simulateShot(c, { kind: 'low', power: 0.4, playerId });
    const base = simulateShot(
      { ...c, neutralPassAssist: 0 },
      { kind: 'low', power: 0.4, playerId },
    );
    assert.ok(sample.impulse.assisted);
    assert.ok(Math.abs(speed(sample.impulse) - speed(base.impulse)) < 1e-10);
    const target = sample.match.players[sample.impulse.targetId];
    assert.equal(target.team, sample.player.team);
    assert.notEqual(target.id, playerId);
    const at = predictAtHeight({ ...sample.ball, ...sample.impulse }, 1.9, c, 4 / c.ballSpeed);
    assert.ok(Math.abs(at.x - target.x) < 0.8);
    const manual = simulateShot(c, { kind: 'low', power: 0.4, playerId, angle: 180 });
    const unassisted = simulateShot(
      { ...c, neutralPassAssist: 0 },
      { kind: 'low', power: 0.4, playerId, angle: 180 },
    );
    assert.deepEqual(manual.impulse, unassisted.impulse);
    const unavailable = sample.match.players.map((p) => ({ ...p, benched: p.id !== playerId }));
    const result = shotImpulse(sample.ball, sample.player, 'low', 0.4, sample.aim, unavailable, c);
    assert.equal(result.assisted, false);
  }
});

test('experimental reception transfers only approaching speed, caps it, and L2 damps the addition', () => {
  const run = (incomingSpeed, soft = false, receiveMomentum = true) =>
    simulateShot(
      { ...DEFAULTS, receiveMomentum, neutralPassAssist: 0 },
      { kind: 'low', power: 0.5, playerId: 1, incomingSpeed, soft },
    ).impulse;
  assert.equal(run(30, false, false).inheritedSpeed, 0);
  assert.ok(run(20).inheritedSpeed > run(10).inheritedSpeed);
  assert.equal(run(1000).inheritedSpeed, 5);
  assert.ok(run(20, true).inheritedSpeed < run(20).inheritedSpeed * 0.2);
  assert.ok(Math.abs(speed(run(20)) - speed(run(0)) - run(20).inheritedSpeed) < 1e-10);
  assert.equal(run(-20).inheritedSpeed, 0, 'a receding ball creates no energy');
  const config = sanitizeConfig({ receiveMomentum: true, receiveTransfer: 20, receiveDamping: -3 });
  assert.equal(config.receiveTransfer, 0.6);
  assert.equal(config.receiveDamping, 0);
  assert.deepEqual(importSettings(exportSettings(config)), config);
});

test('TEST is a seeded ball machine with one receiver and no opponents serving', () => {
  const m = new Match(DEFAULTS, 771),
    other = new Match(DEFAULTS, 771);
  m.reset('test');
  other.reset('test');
  assert.deepEqual(m.ball, other.ball);
  const player = m.active(0),
    origins = [],
    powers = [];
  player.x = -4.1;
  player.y = 0.7;
  for (let i = 0; i < 20; i++) {
    m.feedTestBall();
    assert.deepEqual(
      m.players.filter((p) => !p.benched).map((p) => p.id),
      [player.id],
    );
    assert.equal(m.serveAction, null);
    assert.equal(m.lastPlayer, null);
    assert.equal(player.x, -4.1);
    assert.equal(player.y, 0.7);
    const path = traceBall(m.ball, m.config, 10),
      end = path.at(-1);
    assert.ok(end.x < 0 && end.x >= -COURT.halfLength);
    assert.ok(Math.abs(end.x - m.testTarget) < 0.15);
    origins.push(m.ball.x);
    powers.push(speed(m.ball));
  }
  assert.ok(Math.max(...origins) > 0 && Math.min(...origins) < 0);
  assert.ok(Math.max(...powers) - Math.min(...powers) > 3);
  m.tick(FIXED_DT, { switch: true, select: 2 });
  assert.equal(m.active(0).id, player.id);
  assert.deepEqual(m.stats.serves, [0, 0]);
});

test('a clean receive-set-spike earns a visual combination without changing the ball', () => {
  const m = new Match();
  m.phase = 'rally';
  const contact = (id, count, kind) => {
    const p = m.players[id];
    m.touches[p.team] = count;
    Object.assign(m.ball, { x: p.x, y: p.y + 2.1, vx: p.team ? -8 : 8, vy: 5 });
    const before = { ...m.ball };
    const result = observeContact(m, p, kind, 0.6);
    assert.deepEqual(m.ball, before);
    return result;
  };
  for (const team of [0, 1]) {
    beginRally(m);
    assert.equal(contact(team * 3, 1, 'low').comboStage, 1);
    assert.equal(contact(team * 3 + 1, 2, 'loft').comboStage, 2);
    assert.equal(contact(team * 3 + 2, 3, 'drive').comboStage, 3);
    assert.equal(m.visualCombo.team, team);
    assert.equal(m.skillStats.combinations[team], 1);
  }
  beginRally(m);
  contact(0, 1, 'low');
  contact(1, 2, 'low');
  assert.equal(contact(2, 3, 'drive').comboStage, 0);
  assert.equal(m.visualCombo, null);
  beginRally(m);
  contact(0, 1, 'low');
  contact(3, 1, 'low');
  assert.equal(m.combinations[0], null);
});

test('out marker stays at the first landing and clears for the next serve', () => {
  const m = new Match();
  m.phase = 'rally';
  Object.assign(m.ball, { x: COURT.halfLength + 1, y: COURT.ballRadius, vx: 5, vy: -2 });
  m.point(0, 'АУТ');
  const marker = { ...m.outMarker };
  for (let i = 0; i < 15; i++) m.stepDeadBall(FIXED_DT);
  assert.deepEqual(m.outMarker, marker);
  m.startServe();
  assert.equal(m.outMarker, null);
  m.phase = 'rally';
  Object.assign(m.ball, { x: COURT.halfLength + 1, y: 0.2, vx: 1, vy: -3 });
  m.point(0, 'АУТ');
  assert.equal(m.outMarker, null);
  for (let i = 0; i < 10; i++) m.stepDeadBall(FIXED_DT);
  assert.ok(m.outMarker?.x > COURT.halfLength);
});

test('net mesh stays on the pixel grid while bending and low hands cannot cross either side', () => {
  const still = netMesh(0, 350.3),
    bent = netMesh(3.5, 350.3);
  assert.notDeepEqual(still, bent);
  assert.ok(bent.every((rect) => rect.every((value) => value % 2 === 0)));
  for (const team of [0, 1]) {
    const side = team ? 1 : -1;
    assert.ok(constrainWorldHand({ x: -side, y: 1 }, { team }, { y: 1 }, true).x * side > 0);
    const transform = {
      transformPoint: (p) => p,
      inverse() {
        return this;
      },
    };
    const wrist = { x: -side * 20, y: 40, vx: 100, vy: 100 };
    constrainRenderedJoint(wrist, transform, () => ({ x: 0, y: 0 }), team, { y: 1 }, true);
    assert.equal(wrist.x, side * 5);
    assert.equal(wrist.vx, 0);
  }
});
