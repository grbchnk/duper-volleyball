import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './legacy-contract.js';
import { FIXED_DT, COURT, sanitizeConfig } from '../../src/config.js';
import { shotImpulse } from '../../src/moves.js';
import { integrateBall, collideNet, netBallRadius } from '../../src/physics.js';
import { InputBuffer } from '../../src/input.js';
import { diveHands } from '../../src/dive-pose.js';

test('full attack assistance clears the net low on both teams, even from low weak contacts', () => {
  for (const team of [0, 1])
    for (const distance of [0.65, 3, 8])
      for (const height of [0.8, 2, 4])
        for (const power of [0, 0.5, 1]) {
          const m = new Match();
          const forward = team ? -1 : 1;
          const ball = { ...m.ball, x: -forward * distance, y: height };
          const hit = shotImpulse(
            ball,
            m.players[team * 3],
            'drive',
            power,
            { axis: -forward, down: true },
            [],
            DEFAULTS,
          );
          Object.assign(ball, hit);
          let crossed = false;
          for (let n = 0; n < 960 && ball.y > COURT.ballRadius; n++) {
            const previous = { ...ball };
            integrateBall(ball, FIXED_DT, DEFAULTS);
            assert.equal(collideNet(ball, previous, DEFAULTS.restitution, DEFAULTS), false);
            const plane = -forward * netBallRadius(DEFAULTS);
            if ((previous.x - plane) * forward < 0 && (ball.x - plane) * forward >= 0) {
              const y =
                previous.y + ((ball.y - previous.y) * (plane - previous.x)) / (ball.x - previous.x);
              assert.ok(y >= COURT.netHeight + netBallRadius(DEFAULTS));
              assert.ok(y < COURT.netHeight + netBallRadius(DEFAULTS) + 0.22);
              crossed = true;
              break;
            }
          }
          assert.ok(crossed, `${team}/${distance}/${height}/${power}`);
        }
});

test('half attack assistance is half the angular correction and is independent of pass assistance', () => {
  const m = new Match();
  const ball = { ...m.ball, x: -3, y: 3.5 };
  const shoot = (driveAssist, passAssist = 1) =>
    shotImpulse(ball, m.active(), 'drive', 0.8, { vector: { x: -1, y: -0.3 } }, [], {
      ...DEFAULTS,
      driveAssist,
      passAssist,
    });
  const raw = shoot(0),
    full = shoot(1),
    half = shoot(0.5);
  const angle = (s) => Math.atan2(s.vy, s.vx);
  const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  assert.ok(Math.abs(turn(angle(half), angle(raw)) - turn(angle(full), angle(raw)) / 2) < 1e-10);
  assert.deepEqual(half, shoot(0.5, 0));
  assert.equal(sanitizeConfig({ driveAssist: 0.5 }).driveAssist, 0.5);
});

test('dive reaches a falling ball in both directions, makes one reception and recovers', () => {
  for (const direction of [-1, 1]) {
    const m = new Match();
    m.reset('test');
    m.phase = 'rally';
    m.cooldown = 0;
    const p = m.players[0];
    m.selected[0] = p.id;
    p.x = -5;
    m.lastPlayer = 3;
    m.lastTouch = 1;
    Object.assign(m.ball, { x: p.x + direction * 3, y: 1.4, vx: 0, vy: -1 });
    assert.equal(m.dive(p, direction), true);
    for (let n = 0; n < 100 && !m.contacts; n++) m.tick();
    assert.equal(m.contacts, 1);
    assert.equal(p.diveArmed, false);
    for (let n = 0; n < 180; n++) m.tick();
    assert.equal(p.diving, false);
    assert.equal(p.recovery, 0);
  }
});

test('dive contact uses the same bounded hand target and cannot collect a remote ball', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.active();
  m.dive(p, 1);
  p.diveAge = 0.22;
  p.y = 0.2;
  Object.assign(m.ball, { x: p.x + 1.8, y: 0.5 });
  const hands = diveHands(p, m.ball, m.config);
  assert.ok(Math.hypot(m.ball.x - hands.x, m.ball.y - hands.y) < 0.355);
  assert.equal(m.canContact(p, 'low'), true);
  m.ball.x += 3;
  assert.equal(m.canContact(p, 'low'), false);
});

test('a human occupying another slot stays put while teammates take distinct free slots', () => {
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  for (const team of [0, 1]) {
    const p = m.players[team * 3 + 2];
    m.selected[team] = p.id;
    p.x = m.players[team * 3 + 1].x;
    const x = p.x;
    for (let n = 0; n < 240; n++) m.movePlayers(FIXED_DT, {});
    assert.equal(p.x, x);
    const teammates = m.players.filter((q) => q.team === team);
    assert.equal(new Set(teammates.map((q) => q.homeX)).size, 3);
    for (const other of teammates.filter((q) => q.id !== p.id)) {
      assert.ok(Math.abs(other.x - p.x) >= 1.15);
      assert.ok(Math.abs(other.x - other.homeX) < 0.01);
    }
  }
});
