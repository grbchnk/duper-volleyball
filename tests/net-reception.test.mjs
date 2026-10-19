import test from 'node:test';
import assert from 'node:assert/strict';
import { netSeparates, localReceiveAim, receiveWrists } from '../src/receive-pose.js';
import { diveHands } from '../src/dive-pose.js';
import { Match } from '../src/engine.js';
import { DEFAULTS } from '../src/config.js';

test('reception hands never track a ball across the net on either side or facing direction', () => {
  for (const side of [-1, 1])
    for (const facing of [-1, 1])
      for (const kind of ['low', 'loft']) {
        const p = { x: side * 0.7, y: 0, team: side < 0 ? 0 : 1, facing };
        const neutral = localReceiveAim(p, { kind }, null, null, DEFAULTS);
        for (const x of [0, -side * 0.02, -side * 1.2])
          for (const y of [0.5, 2, 4.5]) {
            const aim = localReceiveAim(
              p,
              { kind },
              { x, y, vx: side * 7, vy: -2 },
              null,
              DEFAULTS,
            );
            assert.equal(netSeparates(p, { x }), true);
            assert.deepEqual(aim, neutral);
            assert.deepEqual(receiveWrists(kind, aim, 0.5), receiveWrists(kind, neutral, 0.5));
          }
        const own = localReceiveAim(
          p,
          { kind },
          { x: side * 0.3, y: kind === 'low' ? 1 : 2, vx: side * 3, vy: -1 },
          null,
          DEFAULTS,
        );
        assert.ok(own.weight > 0, 'hands follow again as soon as the ball reaches their side');
      }
});
test('a diving player keeps hands on their own side instead of chasing the ball through the net', () => {
  const m = new Match();
  m.reset('match');
  for (const side of [-1, 1]) {
    const p = m.players[side < 0 ? 2 : 5];
    Object.assign(p, {
      x: side * 0.65,
      y: 0,
      diving: true,
      diveAge: 0.12,
      diveVelocity: -side * 5,
      facing: -side,
    });
    const near = diveHands(p, { x: -side * 0.1, y: 0.7 }, DEFAULTS);
    const high = diveHands(p, { x: -side * 3, y: 5 }, DEFAULTS);
    assert.deepEqual(near, high, 'an opponent-side target cannot pull the hands around');
    assert.ok(near.x * side > 0);
    assert.ok(Number.isFinite(near.y));
  }
});
