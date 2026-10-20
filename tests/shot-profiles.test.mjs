import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, sanitizeConfig, FIXED_DT } from '../src/config.js';
import { variantKey, VARIANT_FIELDS } from '../src/shot-settings.js';
import { manualImpulse, shotImpulse } from '../src/moves.js';
import { simulateShot } from '../src/shot-lab.js';
import { simulateBlock } from '../src/block-lab.js';
import { Match } from '../src/engine.js';
import { releaseMoveFactor } from '../src/movement-feel.js';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';
import { importSettings, exportSettings } from '../src/settings-file.js';

test('every exposed variant parameter changes its shot, without changing another variant or kind', () => {
  for (const kind of ['low', 'loft', 'drive'])
    for (const variant of ['normal', 'soft', 'fast']) {
      const aim = {
        manualControl: true,
        axis: kind === 'low' ? 1 : 0,
        soft: variant === 'soft',
        fast: variant === 'fast',
      };
      for (const suffix of Object.keys(VARIANT_FIELDS).filter(
        (key) => key !== 'Dip' || kind === 'drive',
      )) {
        const m = new Match();
        const p = m.players[0];
        const config = { ...DEFAULTS, passAssist: 0 };
        // Neutral lower receives derive their angle from the contact instead.
        aim.axis = kind === 'low' && suffix.includes('Angle') ? 1 : 0;
        if (suffix === 'AirAngle') p.y = 1;
        if (suffix === 'AimScale') aim.vector = { x: 0.8, y: 0.4 };
        else delete aim.vector;
        const power =
          suffix === 'SpeedMin' || suffix === 'SpinMin' ? 0 : suffix === 'PowerCurve' ? 0.4 : 1;
        const key = variantKey(kind, variant, suffix);
        const changed = { ...config, [key]: config[key] + (suffix.includes('Angle') ? -5 : 0.2) };
        const base = manualImpulse(m.ball, p, kind, power, aim, config);
        assert.notDeepEqual(
          manualImpulse(m.ball, p, kind, power, aim, changed),
          base,
          `${kind}/${variant}/${suffix}`,
        );
        const otherAim = { ...aim, soft: variant !== 'soft', fast: false };
        assert.deepEqual(
          manualImpulse(m.ball, p, kind, power, otherAim, changed),
          manualImpulse(m.ball, p, kind, power, otherAim, config),
        );
        const otherKind = kind === 'low' ? 'loft' : 'low';
        assert.deepEqual(
          manualImpulse(m.ball, p, otherKind, power, aim, changed),
          manualImpulse(m.ball, p, otherKind, power, aim, config),
        );
      }
    }
});

test('lower and overhead passes scale their angular correction at constant speed', () => {
  for (const options of [
    { kind: 'low', playerId: 0, angle: 60, power: 1 },
    { kind: 'loft', playerId: 0, angle: 80, power: 0.6 },
    { kind: 'loft', playerId: 1, angle: 80, power: 0.6 },
  ]) {
    const shots = [0, 0.5, 1].map(
      (amount) => simulateShot({ ...DEFAULTS, passAssist: amount }, options).impulse,
    );
    const angles = shots.map((s) => Math.atan2(s.vy, s.vx));
    assert.ok(Math.abs(angles[2] - angles[0]) > 0.001);
    assert.ok(Math.abs(angles[1] - (angles[0] + angles[2]) / 2) < 1e-10);
    for (const shot of shots)
      assert.ok(
        Math.abs(Math.hypot(shot.vx, shot.vy) - Math.hypot(shots[0].vx, shots[0].vy)) < 1e-10,
      );
  }
});

test('a cross-net request never becomes a teammate pass and high net sets are identified', () => {
  const crossing = simulateShot(
    { ...DEFAULTS, passAssist: 1 },
    { kind: 'loft', playerId: 1, angle: 45, power: 0.6 },
  );
  assert.match(crossing.impulse.assistIntent, /через сетку/);
  assert.equal(crossing.impulse.targetId, null);
  assert.ok(crossing.impulse.vx > 0);
  const lob = simulateShot(
    { ...DEFAULTS, passAssist: 1 },
    { kind: 'loft', playerId: 1, angle: 80, power: 0.6 },
  );
  assert.equal(lob.impulse.assistIntent, 'Навес у сетки');
});

test('retired experiments, jump hold and feints cannot be reenabled by old settings', () => {
  const config = sanitizeConfig({
    ...DEFAULTS,
    receiveMomentum: true,
    thirdTouchSlowdown: 0.45,
    jumpHoldHang: 0.25,
    variableJump: true,
  });
  assert.equal(config.receiveMomentum, false);
  assert.equal(config.thirdTouchSlowdown, 0);
  assert.equal(config.jumpHoldHang, 0);
  const jumps = [false, true].map((held) => {
    const m = new Match(config);
    m.phase = 'rally';
    m.lastTouch = 1;
    m.inputs = [{}, {}, {}];
    m.humanJump(m.players[0]);
    for (let i = 0; i < 30; i++) {
      m.inputs[0] = { jumpHeld: held };
      m.animatePlayers(FIXED_DT);
    }
    return { y: m.players[0].y, profile: m.players[0].jumpProfile };
  });
  assert.deepEqual(jumps[0], jumps[1]);
  const m = new Match(config),
    p = m.players[1];
  const aim = { manualControl: true, soft: true, fast: true, play: 'feint' };
  const shot = shotImpulse(m.ball, p, 'loft', 1, aim, m.players, config);
  assert.equal(shot.feint, undefined);
  assert.deepEqual(
    shot,
    shotImpulse(m.ball, p, 'loft', 1, { ...aim, fast: false, play: undefined }, m.players, config),
  );
});

test('run speed recovers smoothly over the release allowance and reaches normal at the end', () => {
  const p = { releaseSlow: 0.2, releaseSlowTotal: 0.2 };
  assert.ok(Math.abs(releaseMoveFactor(p, DEFAULTS) - DEFAULTS.chargeMove) < 1e-10);
  const values = [0.2, 0.15, 0.1, 0.05, 0].map((remaining) =>
    releaseMoveFactor({ ...p, releaseSlow: remaining }, DEFAULTS),
  );
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1]);
  assert.ok(Math.abs(values[2] - 0.6) < 1e-10);
  assert.equal(values.at(-1), 1);
});

test('the actual released pass restores running speed during its pending contact window', () => {
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 3;
  Object.assign(m.ball, { x: 5, y: 20, vx: 0, vy: 0 });
  for (let i = 0; i < 10; i++) m.tick(FIXED_DT, { low: true, axis: 1 });
  const p = m.players[0];
  m.tick(FIXED_DT, { axis: 1 });
  assert.ok(m.controls[0].pending);
  assert.ok(p.vx < m.config.playerSpeed * 0.4);
  let previous = p.vx;
  for (let i = 0; i < 24; i++) {
    m.tick(FIXED_DT, { axis: 1 });
    assert.ok(p.vx >= previous - 1e-9);
    previous = p.vx;
  }
  assert.ok(Math.abs(p.vx - m.config.playerSpeed) < 0.05);
});

test('v5 profiles migrate old attack dip, modifier tempo and speed customizations once', () => {
  const migrated = importSettings(
    JSON.stringify({
      version: 5,
      config: {
        lowSpeedMax: 20,
        attackDip: 5,
        neutralPassAssist: 0.4,
        modifierTempo: true,
        modifierSlowdown: 0.25,
        modifierSpeedup: 0.3,
        receiveMomentum: true,
        variableJump: true,
        thirdTouchSlowdown: 0.4,
      },
    }),
  );
  assert.equal(migrated.lowFastSpeedMax, 25.6);
  assert.equal(migrated.driveNormalDip, 5);
  assert.equal(migrated.driveFastDip, 5);
  assert.equal(migrated.loftSoftTempo, 0.75);
  assert.equal(migrated.loftFastTempo, 1.3);
  assert.equal(migrated.passAssist, 0.4);
  assert.equal(migrated.receiveMomentum, false);
  assert.equal(migrated.variableJump, false);
  assert.equal(migrated.thirdTouchSlowdown, 0);
  assert.deepEqual(importSettings(exportSettings(migrated)), migrated);
});

test('block preview uses the actual active window, reach and reflected impulse', () => {
  const center = simulateBlock(DEFAULTS);
  assert.equal(center.hit, true);
  assert.equal(simulateBlock(DEFAULTS, { time: 0 }).hit, false);
  assert.equal(simulateBlock(DEFAULTS, { dx: DEFAULTS.blockReach + 0.01 }).hit, false);
  assert.equal(simulateBlock(DEFAULTS, { dy: DEFAULTS.blockHeight + 0.01 }).hit, false);
  assert.equal(
    simulateBlock(DEFAULTS, { time: center.apex + DEFAULTS.blockWindow / 2 + 0.01 }).hit,
    false,
  );
  const faster = simulateBlock({ ...DEFAULTS, blockDeflect: 0.8 });
  assert.ok(Math.abs(faster.match.ball.vx) > Math.abs(center.match.ball.vx));
});

test('R2 has a distinct attack windup and L2 overhead prepares both hands', () => {
  const options = {
    spec: ARM_STYLES.whip,
    config: DEFAULTS,
    kind: 'drive',
    charge: { power: 1, age: 0.2, aim: {} },
  };
  const normal = expressivePose(options);
  const fast = expressivePose({ ...options, charge: { ...options.charge, aim: { fast: true } } });
  assert.notDeepEqual(normal.wrists, fast.wrists);
  assert.notDeepEqual(normal.elbows, fast.elbows);
  const gentle = expressivePose({
    ...options,
    kind: 'loft',
    charge: { ...options.charge, aim: { soft: true } },
  });
  assert.deepEqual(gentle.activeHands, [0, 1]);
  assert.ok(gentle.wrists[1].x - gentle.wrists[0].x > 8);
});
