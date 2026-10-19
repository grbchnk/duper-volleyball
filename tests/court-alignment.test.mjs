import test from 'node:test';
import assert from 'node:assert/strict';
import { COURT, DEFAULTS, FIXED_DT } from '../src/config.js';
import {
  COURT_VIEW,
  NET_BOTTOM,
  projectCourt,
  courtLineBounds,
  STREET_COURT,
  projectStreetNet,
} from '../src/court-visual.js';
import { collideNet, isInside, netBallRadius } from '../src/physics.js';
import { Match } from '../src/engine.js';
import { netVisual } from '../src/net-visual.js';

test('visible end lines and configurable ball edges agree with line calls on both sides', () => {
  for (const side of [-1, 1]) {
    for (const ballSize of [0.7, 1.2, 1.8]) {
      const config = { ...DEFAULTS, arenaTheme: 'miami', ballSize };
      const bounds = courtLineBounds(config);
      const edge = side < 0 ? bounds.left : bounds.right;
      const line = projectCourt(edge).x;
      const radius = netBallRadius(config);
      const touching = { x: edge + side * (radius - 0.001), z: COURT.width / 2 };
      assert.equal(isInside(touching, config), true);
      assert.ok(Math.abs(projectCourt(touching.x).x - line) < radius * COURT_VIEW.scaleX);
      assert.equal(isInside({ ...touching, x: edge + side * (radius + 0.001) }, config), false);
    }
  }
});

test('perspective boundaries intersect the fixed ground lane and do not move with ball height', () => {
  const config = { ...DEFAULTS, arenaTheme: 'miami' };
  const bounds = courtLineBounds(config);
  const t = (COURT_VIEW.floor - STREET_COURT.backY) / (STREET_COURT.frontY - STREET_COURT.backY);
  assert.ok(Math.abs(projectCourt(bounds.left).x - (102 + (33 - 102) * t)) < 1e-9);
  assert.ok(Math.abs(projectCourt(bounds.right).x - (859 + (929 - 859) * t)) < 1e-9);
  for (const y of [0.105, 1, 4, 12]) {
    assert.equal(isInside({ x: 10, y, z: 4.5 }, config), true);
    assert.equal(isInside({ x: 11.1, y, z: 4.5 }, config), false);
  }
  assert.deepEqual(courtLineBounds({ arenaTheme: 'park' }), {
    left: -COURT.halfLength,
    right: COURT.halfLength,
  });
});

test('actual rally scoring uses the perspective line rather than the former narrow boundary', () => {
  for (const side of [-1, 1])
    for (const outside of [false, true]) {
      const m = new Match({ arenaTheme: 'miami' });
      m.phase = 'rally';
      m.lastTouch = side > 0 ? 0 : 1;
      for (const p of m.players) p.benched = true;
      Object.assign(m.ball, {
        x: side * (outside ? 11.1 : 10),
        y: 0.1,
        z: 4.5,
        vx: 0,
        vy: -1,
        vz: 0,
        spin: 0,
      });
      m.tick(FIXED_DT);
      assert.equal(m.pointReason.includes('АУТ'), outside);
      assert.equal(m.pointWinner, outside ? 1 - m.lastTouch : m.lastTouch);
    }
});

test('swept mesh contacts rebound and drive a visible ripple; over-tape flights pass', () => {
  assert.equal(COURT.netHeight - NET_BOTTOM, 1);
  assert.equal(projectCourt(0, NET_BOTTOM).y - projectCourt(0, COURT.netHeight).y, 42);
  for (const side of [-1, 1]) {
    const previous = { x: side, y: 1.9, z: 4.5, vx: -side * 90, vy: -2, spin: 0 };
    const ball = { ...previous, x: -side };
    assert.equal(collideNet(ball, previous, DEFAULTS.restitution, DEFAULTS), true);
    assert.equal(Math.sign(ball.vx), side);
    const initial = netVisual(null, ball.netImpact, 0);
    const response = netVisual(initial, ball.netImpact, 0.06);
    assert.ok(Math.abs(response.wave) > 5);
    const high = { ...previous, y: COURT.netHeight + netBallRadius(DEFAULTS) + 0.1 };
    assert.equal(collideNet({ ...high, x: -side }, high, DEFAULTS.restitution, DEFAULTS), false);
    const under = { ...previous, y: 0.5 };
    assert.equal(collideNet({ ...under, x: -side }, under, DEFAULTS.restitution, DEFAULTS), false);
  }
});

test('perspective net follows court depth while matching the physical tape in the gameplay lane', () => {
  const lane = (COURT_VIEW.floor - STREET_COURT.backY) / (STREET_COURT.frontY - STREET_COURT.backY);
  const tape = projectStreetNet(lane, COURT.netHeight);
  assert.deepEqual(tape, projectCourt(0, COURT.netHeight));
  const far = projectStreetNet(0, COURT.netHeight);
  const near = projectStreetNet(1, COURT.netHeight);
  assert.ok(near.x > far.x && near.y > far.y);
  for (const depth of [0, lane, 1]) {
    const bottom = projectStreetNet(depth, NET_BOTTOM);
    const floor = projectStreetNet(depth, 0);
    assert.ok(floor.y - bottom.y > 59);
    assert.ok(Math.abs(bottom.y - projectStreetNet(depth, COURT.netHeight).y - 42) < 1e-9);
  }
});

test('a ball crossing beneath the mesh loses the rally instead of hitting an invisible wall', () => {
  for (const side of [-1, 1]) {
    const m = new Match();
    m.phase = 'rally';
    m.lastTouch = side < 0 ? 0 : 1;
    for (const p of m.players) p.benched = true;
    Object.assign(m.ball, {
      x: side * 0.02,
      y: 0.5,
      z: 4.5,
      vx: -side * 12,
      vy: 0,
      vz: 0,
      spin: 0,
    });
    m.tick(FIXED_DT);
    assert.equal(m.pointReason, 'МЯЧ ПОД СЕТКОЙ');
    assert.equal(m.pointWinner, 1 - m.lastTouch);
  }
});
