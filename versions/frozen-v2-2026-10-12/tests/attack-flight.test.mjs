import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { integrateBall, launchTo, traceBall, resetFlight } from '../src/physics.js';
import { shotImpulse } from '../src/moves.js';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';

function secondSet(config = {}, power = 0.3, seed = 42) {
  const m = new Match({ ...DEFAULTS, ...config }, seed);
  m.reset('practice');
  m.startDrill('combination');
  const setter = m.players[1];
  Object.assign(m.ball, { x: setter.x, y: 2.1, vx: 0, vy: 0 });
  m.makeContact(
    setter,
    'loft',
    power,
    shotImpulse(m.ball, setter, 'loft', power, { axis: 1 }, m.players, m.config),
  );
  return m;
}

test('a second set never creates automatic approach, jump or shot, on either human team', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    m.lastTouch = team;
    m.lastPlayer = team * 3;
    m.touches[team] = 1;
    const setter = m.players[team * 3 + 1];
    Object.assign(m.ball, { x: setter.x, y: 2.1, vx: 0, vy: 0 });
    m.makeContact(setter, 'loft', 0.5, { vx: team ? -2 : 2, vy: 7, vz: 0, spin: 0 });
    const p = m.active(team),
      x = p.x;
    assert.equal('attackPlan' in m, false);
    Object.assign(m.ball, { x: team ? 6 : -6, y: 15, vx: 0, vy: 0 });
    for (let n = 0; n < 90; n++) m.tick();
    assert.equal(p.x, x);
    assert.equal(p.jumpProfile, null);
    assert.equal(p.armSwing, null);
    assert.equal(m.contacts, 1);
  }
});
test('after a second set manual movement, jump and every contact still work normally', () => {
  for (const kind of ['low', 'loft', 'drive'])
    for (const reachable of [true, false]) {
      const m = secondSet();
      m.selected[0] = 2; // Test the attacker; the passer cannot make consecutive contacts.
      const p = m.active();
      Object.assign(m.ball, { x: 4, y: 15, vx: 0, vy: 0 });
      const x = p.x;
      m.tick(FIXED_DT, { axis: -0.5 });
      assert.ok(p.x < x);
      m.tick(FIXED_DT, { jump: true });
      assert.ok(p.jumpProfile);
      for (let i = 0; i < 26; i++) m.tick();
      Object.assign(m.ball, {
        x: p.x + (reachable ? 0.3 : 3),
        y: p.y + (kind === 'low' ? 0.8 : 2.1),
        vx: 0,
        vy: 0,
      });
      m.updateCharge(FIXED_DT, { [kind]: true, axis: 1 }, (key) => key === kind);
      m.charge.power = 0.6;
      const expected = shotImpulse(m.ball, p, kind, 0.6, { axis: 1 }, m.players, m.config);
      m.updateCharge(FIXED_DT, { axis: 1 }, () => false);
      assert.equal(p.armSwing.hit, reachable);
      assert.equal(m.contacts, reachable ? 2 : 1);
      if (reachable) {
        assert.equal(m.ball.vx, expected.vx);
        assert.equal(m.ball.vy, expected.vy);
      }
    }
});
test('a jump held before a second set never becomes a new jump', () => {
  const m = secondSet(),
    p = m.active();
  m.previousInput.jump = true;
  Object.assign(m.ball, { x: 4, y: 15, vx: 0, vy: 0 });
  for (let i = 0; i < 90; i++) m.tick(FIXED_DT, { jump: true });
  assert.equal(p.y, 0);
  assert.equal(p.jumpProfile, null);
});
test('long preparations finish at a stable pose and D retains its directional windup', () => {
  for (const kind of ['loft', 'drive'])
    for (const power of [0.2, 1]) {
      const args = { spec: ARM_STYLES.whip, config: DEFAULTS, kind, charge: { power, age: 0.5 } };
      const pose = expressivePose(args);
      assert.deepEqual(expressivePose({ ...args, charge: { power, age: 1.5 } }), pose);
      if (kind === 'loft') assert.deepEqual(expressivePose({ ...args, actionDirection: -1 }), pose);
      else {
        assert.equal(pose.wrists[0].x, 12);
        assert.ok(Math.abs(pose.wrists[1].x - (-8 - 2 * 1.3 * power)) < 1e-9);
        assert.equal(pose.elbows[1].y, (-20 + pose.wrists[1].y) / 2 + 5);
      }
      assert.ok(Math.abs(pose.elbows[1].x - pose.elbows[0].x) < 24);
      if (kind === 'loft') {
        assert.equal(pose.wrists[0].y, pose.wrists[1].y);
        assert.ok(pose.wrists[1].x - pose.wrists[0].x < 8);
      }
    }
});

test('cartoon flight accelerates smoothly while zero effect retains the normal trajectory', () => {
  const config = { ...DEFAULTS, gravity: 0, drag: 0, cartoonFlight: 1, cartoonHang: 0 };
  const b = { x: -5, y: 3, z: 4.5, vx: 10, vy: -1, vz: 0, spin: 0 };
  let old = b.x,
    last = 0;
  for (let n = 0; n < 180; n++) {
    integrateBall(b, FIXED_DT, config);
    const speed = (b.x - old) / FIXED_DT;
    assert.ok(speed >= last - 1e-7);
    assert.ok(speed <= 13.5 + 1e-7);
    last = speed;
    old = b.x;
  }
  const a = { x: -5, y: 3, z: 4.5, vx: 10, vy: 8, vz: 0, spin: 0 };
  const normal = { ...a };
  for (let n = 0; n < 60; n++) {
    integrateBall(a, FIXED_DT, {
      ...DEFAULTS,
      cartoonFlight: 0,
      cartoonHang: 0.85,
      cartoonStart: 0.2,
    });
    integrateBall(normal, FIXED_DT, DEFAULTS);
  }
  assert.deepEqual(a, normal);
});

test('apex hold slows a rising pass smoothly but never holds a downward spike', () => {
  const atApex = {
    x: -3,
    y: 5,
    z: 4.5,
    vx: 3,
    vy: 0,
    vz: 0,
    spin: 0,
    flightAge: 0.6,
    flightLaunchVy: 8,
  };
  const held = { ...atApex },
    free = { ...atApex };
  integrateBall(held, FIXED_DT, { ...DEFAULTS, cartoonFlight: 1, cartoonHang: 0.85 });
  integrateBall(free, FIXED_DT, { ...DEFAULTS, cartoonFlight: 1, cartoonHang: 0 });
  assert.ok(held.x - atApex.x < (free.x - atApex.x) * 0.2);
  const spike = { ...atApex, vy: -1, flightLaunchVy: -1 },
    baseline = { ...spike };
  integrateBall(spike, FIXED_DT, { ...DEFAULTS, cartoonFlight: 1, cartoonHang: 0.85 });
  integrateBall(baseline, FIXED_DT, { ...DEFAULTS, cartoonFlight: 1, cartoonHang: 0 });
  assert.deepEqual(spike, baseline);
});

test('flight solver and trajectory preview use the same clock at slow and fast settings', () => {
  for (const ballSpeed of [0.6, 1, 1.4])
    for (const cartoonHang of [0, 0.4, 0.85]) {
      const config = { ...DEFAULTS, cartoonFlight: 1, ballSpeed, cartoonHang };
      const b = { x: -5, y: 2.1, z: 4.5, vx: 0, vy: 0, vz: 0, spin: 0 };
      const target = { x: -1, y: 3.4, z: 4.5 };
      launchTo(b, target, 1.4, config);
      const preview = traceBall(b, config, 1.4);
      for (let n = 0; n < 168; n++) integrateBall(b, FIXED_DT, config);
      assert.ok(
        Math.hypot(b.x - target.x, b.y - target.y) < 0.04,
        JSON.stringify({ ballSpeed, cartoonHang, b }),
      );
      assert.ok(Math.abs(preview.at(-1).x - b.x) < 1e-8);
      resetFlight(b);
      assert.equal(b.flightAge, 0);
      assert.equal(b.flightLaunchVy, b.vy);
    }
});

test('flight settings are bounded and survive old and new JSON imports', () => {
  const old = sanitizeConfig({ gravity: 10 });
  assert.equal(old.cartoonFlight, 0);
  assert.equal(old.ballSpeed, 1);
  const config = sanitizeConfig({
    cartoonFlight: 3,
    ballSpeed: -2,
    cartoonHang: 9,
    cartoonRamp: 0,
  });
  assert.equal(config.cartoonFlight, 1);
  assert.equal(config.ballSpeed, 0.6);
  assert.equal(config.cartoonHang, 0.85);
  assert.equal(config.cartoonRamp, 0.2);
  assert.deepEqual(sanitizeConfig(JSON.parse(JSON.stringify(config))), config);
});

test('a blocker can stop a fresh spike during the hitter debounce, with no ball teleport', () => {
  const m = new Match();
  m.phase = 'rally';
  m.lastTouch = 0;
  m.lastPlayer = 2;
  m.incomingShot = 'drive';
  m.cooldown = 0.12;
  const p = m.players[5];
  m.jump(p, true);
  p.jumpTime = p.jumpProfile.windup + p.jumpProfile.rise + p.jumpProfile.hang / 2;
  p.y = p.jumpProfile.height;
  Object.assign(m.ball, { x: p.x - 0.22, y: p.y + 2.05, vx: 15, vy: -2 });
  const location = { x: m.ball.x, y: m.ball.y };
  assert.equal(m.tryBlocks(), true);
  assert.deepEqual({ x: m.ball.x, y: m.ball.y }, location);
  assert.equal(m.stats.blocks[1], 1);
  assert.equal(m.tryBlocks(), false);
});
