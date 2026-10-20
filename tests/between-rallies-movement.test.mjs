import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { COURT, FIXED_DT } from '../src/config.js';
import { InputBuffer } from '../src/input.js';

test('both teams walk back before the next serve after receivers have moved', () => {
  for (const mode of ['single', 'versus', 'coop']) {
    for (const winner of [0, 1]) {
      const m = new Match();
      m.reset(mode);
      m.server = 1;
      m.startServe();
      for (let i = 0; i < 30; i++) m.tick(FIXED_DT, { axis: 1 }, { axis: -1 });
      m.phase = 'rally';
      for (const p of m.players) p.x = m.sign(p.team) * (2 + (p.id % 3) * 2);
      const homes = m.players.map((p) => p.homeX);
      m.point(winner, 'МЯЧ НА ПОЛУ');
      let walking = false;
      for (let i = 0; i < 1200 && m.phase === 'point'; i++) {
        const before = m.players.map((p) => p.x);
        m.tick(FIXED_DT, { axis: 1 }, { axis: -1 });
        for (const p of m.players) {
          assert.ok(Math.abs(p.x - before[p.id]) <= m.config.playerSpeed * FIXED_DT + 1e-8);
          if (p.x !== before[p.id]) walking = true;
        }
      }
      assert.equal(walking, true);
      assert.equal(m.phase, 'serve');
      assert.equal(m.server, winner);
      for (const p of m.players) {
        const target =
          p === m.serverPlayer() ? m.sign(winner) * (COURT.halfLength + 0.15) : homes[p.id];
        assert.equal(p.x, target);
        assert.equal(p.moveVx, 0);
      }
    }
  }
});

test('stick up only aims; the jump button jumps once and releasing it rearms the jump', () => {
  const pad = { connected: true, mapping: 'standard', axes: [0, -1], buttons: [] };
  const input = new InputBuffer(() => [pad]);
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  m.inputs = [{}, {}];
  // Keep the ball in play while checking several complete jump durations.
  const p = m.active(0);
  const step = () => {
    input.poll();
    m.inputs[0] = input.read();
    m.handleControl(FIXED_DT, m.inputs[0], 0);
    m.animatePlayers(FIXED_DT);
    m.controls[0].previousInput = m.inputs[0];
  };
  step();
  assert.equal(p.jumpProfile, null);
  assert.equal(m.inputs[0].buttonVector.y, 1);
  pad.buttons[0] = { pressed: true };
  step();
  assert.ok(p.jumpProfile);
  for (let i = 0; i < 600; i++) step();
  assert.equal(p.jumpProfile, null);
  pad.buttons[0].pressed = false;
  step();
  pad.buttons[0].pressed = true;
  step();
  assert.ok(p.jumpProfile);
});
