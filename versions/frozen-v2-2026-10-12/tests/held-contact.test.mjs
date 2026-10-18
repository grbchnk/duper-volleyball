import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { preparedHands, ballTouchesHands } from '../src/held-contact.js';
import { FIXED_DT } from '../src/config.js';
function setup(kind, power = 0.5) {
  const m = new Match();
  m.startDrill('receive');
  m.ball.x = 5;
  m.ball.y = 10;
  const p = m.active();
  p.facing = 1;
  m.charge = { playerId: p.id, kind, power, age: 0.2, aim: { axis: 0, up: false, down: false } };
  m.previousInput[kind] = true;
  return m;
}
for (const kind of ['low', 'back', 'loft', 'drive'])
  test(`${kind}: holding catches the palms at current power, consumes press and cannot repeat`, () => {
    for (const power of [0.2, 0.8, 1]) {
      const m = setup(kind, power),
        p = m.active(),
        hand = preparedHands(p, m).at(-1);
      Object.assign(m.ball, hand, { vx: 0, vy: 0 });
      m.tick(FIXED_DT, { [kind]: true });
      assert.equal(m.contacts, 1);
      assert.equal(m.charge, null);
      assert.equal(m.chargeLock, true);
      const hit = m.events.filter((e) => e.type === 'hit').at(-1);
      assert.ok(
        Math.abs(hit.power - Math.min(1, power + FIXED_DT / m.config.chargeSeconds)) < 1e-9,
      );
      for (let i = 0; i < 20; i++) m.tick(FIXED_DT, { [kind]: true });
      assert.equal(m.charge, null);
      assert.equal(m.contacts, 1);
      m.tick();
      assert.equal(m.chargeLock, false);
      assert.equal(m.contacts, 1);
    }
  });
test('held contact requires prepared hands, eligibility and a rally; it never launches a serve', () => {
  const m = setup('low');
  Object.assign(m.ball, { x: m.active().x, y: 1.2 });
  assert.equal(m.tryHeldContact(), false);
  Object.assign(m.ball, preparedHands(m.active(), m)[0]);
  m.charge.age = 0;
  assert.equal(m.tryHeldContact(), false);
  m.charge.age = 0.2;
  m.cooldown = 0.1;
  assert.equal(m.tryHeldContact(), false);
  m.cooldown = 0;
  m.lastPlayer = m.active().id;
  m.lastTouch = 0;
  assert.equal(m.tryHeldContact(), false);
  m.lastPlayer = 3;
  m.lastTouch = 1;
  m.phase = 'serve';
  assert.equal(m.tryHeldContact(), false);
});
test('palm collision catches a fast crossing but rejects a near miss', () => {
  assert.equal(ballTouchesHands({ x: 2, y: 1 }, { x: -2, y: 1 }, [{ x: 0, y: 1 }], 0.2), true);
  assert.equal(ballTouchesHands({ x: 2, y: 1.3 }, { x: -2, y: 1.3 }, [{ x: 0, y: 1 }], 0.2), false);
});
