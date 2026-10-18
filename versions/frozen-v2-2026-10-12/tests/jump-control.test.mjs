import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT, DEFAULTS, sanitizeConfig } from '../src/config.js';
import { jumpProfile } from '../src/motion.js';

function jumpHeight(variableJump, heldTicks) {
  const m = new Match({ ...DEFAULTS, variableJump });
  m.startDrill('receive');
  Object.assign(m.ball, { x: 4, y: 20, vx: 0, vy: 0 });
  const p = m.active();
  let peak = 0;
  for (let n = 0; n < 110; n++) {
    m.tick(FIXED_DT, { jump: n < heldTicks });
    peak = Math.max(peak, p.y);
  }
  assert.equal(p.jumpProfile, null);
  assert.equal(p.y, 0);
  m.tick(FIXED_DT, { jump: true });
  assert.ok(p.jumpProfile, 'a fresh press jumps again after landing');
  return peak;
}

test('optional hold duration increases jump height, while the default jump ignores duration', () => {
  const short = jumpHeight(true, 1),
    medium = jumpHeight(true, 22),
    full = jumpHeight(true, 70);
  assert.ok(short > 0 && short < medium && medium < full, `${short}, ${medium}, ${full}`);
  assert.ok(Math.abs(jumpHeight(false, 1) - jumpHeight(false, 70)) < 0.002);
  assert.equal(sanitizeConfig({}).variableJump, false);
  assert.equal(
    sanitizeConfig(JSON.parse(JSON.stringify({ variableJump: true }))).variableJump,
    true,
  );
});

test('second and third contacts share ordinary jump motion with height-only assistance', () => {
  const profiles = [];
  for (const touches of [0, 1, 2]) {
    const m = new Match();
    m.startDrill('receive');
    m.lastTouch = touches ? 0 : 1;
    m.lastPlayer = 1;
    m.touches[0] = touches;
    const p = m.active(),
      x = p.x;
    Object.assign(m.ball, { x, y: 3.7, vx: 0, vy: 1 });
    m.tick(FIXED_DT, { jump: true });
    assert.equal('attackPlan' in m, false);
    assert.ok(p.jumpProfile);
    assert.equal(p.armSwing, null);
    assert.notEqual(p.pose, 'ready-spike');
    assert.equal(p.jumpProfile.rise, jumpProfile(m.config).rise);
    assert.equal(p.jumpProfile.hang, m.config.jumpHang);
    profiles.push({ ...p.jumpProfile });
    for (let n = 0; n < 90; n++) {
      m.tick();
      assert.equal(p.x, x);
      assert.equal(p.armSwing, null);
    }
    m.tick(FIXED_DT, { jump: true });
    assert.ok(p.jumpProfile);
  }
  assert.deepEqual(profiles[0], profiles[1]);
  assert.deepEqual(profiles[1], profiles[2]);
});
