import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './legacy-contract.js';
import { FIXED_DT } from '../../src/config.js';
import { preparedHands } from '../../src/held-contact.js';
import { localReceiveAim } from '../../src/receive-pose.js';
import { InputBuffer } from '../../src/input.js';

test('all receptions track the side of the ball rather than its velocity or outgoing aim', () => {
  for (const kind of ['low', 'loft', 'back'])
    for (const facing of [-1, 1]) {
      const m = new Match();
      m.startDrill('receive');
      const p = m.active();
      p.x = -4;
      p.facing = facing;
      m.charge = { kind, playerId: p.id, power: 0.5, age: 0.3, aim: { axis: 1 } };
      const centre = (hands) => hands.reduce((sum, h) => sum + h.x, 0) / hands.length;
      Object.assign(m.ball, {
        x: -4.9,
        y: kind === 'low' ? 0.7 : kind === 'loft' ? 2 : 1,
        vx: 3,
        vy: 0,
      });
      const left = preparedHands(p, m);
      m.charge.aim = { vector: { x: -1, y: 0 } };
      assert.deepEqual(preparedHands(p, m), left, 'outgoing aim cannot move the hands');
      Object.assign(m.ball, { x: -3.1, vx: -3 });
      const right = preparedHands(p, m);
      assert.ok(centre(left) < p.x && centre(right) > p.x);
      for (const h of [...left, ...right]) {
        assert.ok(Math.abs(h.x - p.x) < 1.4);
        if (kind === 'low') assert.ok(h.y < 1);
        if (kind === 'loft') assert.ok(h.y > 1.6);
      }
    }
});

test('a ball behind is saved forward; reaching does not trigger an uncommanded hit', () => {
  const m = new Match({ ...DEFAULTS, assist: false });
  m.startDrill('receive');
  const p = m.active();
  p.x = -4;
  p.facing = 1;
  Object.assign(m.ball, { x: -4.9, y: 1, vx: 0, vy: 0 });
  assert.equal(m.tryHeldContact(), false);
  m.charge = {
    kind: 'back',
    playerId: p.id,
    age: 0.3,
    power: 0.6,
    aim: { vector: { x: 1, y: 0.6 } },
  };
  assert.equal(m.tryHeldContact(), true);
  assert.equal(p.armSwing.hand, 0);
  assert.ok(m.ball.vx > 0 && m.ball.vy > 0);
});

test('near-centre balls use the hand on their actual side and distant balls stay unreachable', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.active();
  p.x = -4;
  p.facing = 1;
  const action = { kind: 'back', playerId: p.id, age: 0.3, power: 0.5 };
  m.charge = action;
  for (const dx of [-0.1, 0.1]) {
    Object.assign(m.ball, { x: p.x + dx, y: 1, vx: 0, vy: 0 });
    assert.equal(localReceiveAim(p, action, m.ball).hand, dx < 0 ? 0 : 1);
  }
  Object.assign(m.ball, { x: -1.5, y: 3.5 });
  assert.equal(m.tryHeldContact(), false);
});

test('fast incoming ball can touch the tracking hand without the lead moving it out of reach', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.active();
  p.x = -4;
  p.facing = 1;
  m.charge = { kind: 'back', playerId: p.id, age: 0.3, power: 0.5, aim: { axis: -1 } };
  Object.assign(m.ball, { x: -3.1, y: 1, vx: -16, vy: -3 });
  assert.equal(m.tryHeldContact(), true);
});
