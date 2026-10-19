import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { aimOf } from '../src/controllers.js';
import { shotImpulse, manualImpulse } from '../src/moves.js';
import { integrateBall } from '../src/physics.js';
import { queueFeintAttack, isFeintDecoy } from '../src/feint-play.js';
import { captureScene } from '../src/replay.js';
import { exportSettings, importSettings } from '../src/settings-file.js';

function feintScenario(mode = 'manual', team = 0, coop = false, rotated = false, kind = 'loft') {
  const m = new Match({ ...DEFAULTS, feintMode: mode, approachAssist: false, assist: false });
  m.reset(coop ? 'coop' : 'versus');
  m.phase = 'rally';
  m.lastTouch = 1 - team;
  m.lastPlayer = (1 - team) * 3;
  const side = m.sign(team);
  let passerId = team * 3 + 1;
  if (coop) {
    passerId = 0;
    m.coopRotationCount = rotated ? 1 : 0;
    m.selected[0] = m.coopPrimary = rotated ? 2 : 0;
    m.coopSelected = rotated ? 0 : 2;
  } else m.selected[team] = passerId;
  for (const [i, x] of (coop ? [3.7, 6, 0.8] : [6, 3.7, 0.8]).entries())
    m.players[team * 3 + i].x = side * x;
  const passer = m.players[passerId];
  Object.assign(m.ball, { x: passer.x, y: kind === 'loft' ? 2.1 : 0.9, vx: 0, vy: 0 });
  const aim = aimOf({ l2: true, r2: true });
  aim.controlledIds = m.players.filter((p) => m.humanSlot(p) !== null).map((p) => p.id);
  const impulse = shotImpulse(m.ball, passer, kind, 0.9, aim, m.players, m.config);
  assert.equal(impulse.feint, true);
  return { m, passer, impulse, side };
}

test('two triggers request a physical near-net lob with three distinct roles and a bounded speed', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'loft']) {
      const { m, passer, impulse, side } = feintScenario('manual', team, false, false, kind);
      assert.equal(new Set([passer.id, impulse.targetId, impulse.decoyId]).size, 3);
      assert.ok(impulse.targetX * side > 0 && Math.abs(impulse.targetX) < 3);
      assert.ok(Math.hypot(impulse.vx, impulse.vy) <= m.config[kind + 'SpeedMax']);
      const b = { ...m.ball, ...impulse };
      const count = Math.ceil(impulse.arrival / FIXED_DT);
      for (let i = 0; i < count; i++) {
        integrateBall(b, impulse.arrival / count, m.config);
        assert.ok(b.x * side > 0, 'the lob remains on our side');
        assert.ok(b.y > 0.12);
      }
      assert.ok(Math.abs(b.x - impulse.targetX) < 0.02);
      assert.ok(Math.abs(b.y - 3.2) < 0.03);
    }
});

for (const [team, coop, rotated] of [
  [0, false, false],
  [1, false, false],
  [0, true, false],
  [0, true, true],
]) {
  const label = `${team}/${coop}/${rotated}`;
  test(label + ': manual mode only jumps the unowned decoy and never creates an attack', () => {
    const { m, passer, impulse } = feintScenario('manual', team, coop, rotated);
    const decoy = m.players[impulse.decoyId];
    const originalX = decoy.x;
    assert.equal(m.humanSlot(decoy), null);
    m.makeContact(passer, 'loft', 0.9, impulse);
    const run = m.teamRuns[team];
    let airborne = false;
    for (let i = 0; i < 180 && m.phase === 'rally'; i++) {
      m.tick(FIXED_DT);
      airborne ||= decoy.y > 0;
      if (isFeintDecoy(m, decoy)) {
        assert.equal(m.canContact(decoy, 'drive'), false);
        assert.equal(m.humanSlot(decoy), null, 'automatic reception never takes the decoy');
        assert.ok(Math.abs(decoy.x - originalX) < 0.01, 'the fake stays in its own lane');
      }
      assert.equal(m.contacts, 1);
    }
    assert.equal(run.decoyJumped, true);
    assert.equal(airborne, true);
    assert.equal(run.attackJumped, undefined);
  });

  test(
    label + ': queued mode jumps after the decoy and executes the exact chosen attack once',
    () => {
      const { m, passer, impulse, side } = feintScenario('queued', team, coop, rotated);
      m.makeContact(passer, 'loft', 0.9, impulse);
      const run = m.teamRuns[team];
      const attacker = m.players[run.playerId];
      const slot = m.humanSlot(attacker);
      const vector = { x: -side, y: 0.25 };
      let queued = null,
        decoyJumpAt = null,
        attackJumpAt = null;
      for (let i = 0; i < 230 && m.phase === 'rally' && m.contacts === 1; i++) {
        const input = i < 18 ? { drive: true, buttonVector: vector } : {};
        m.tick(FIXED_DT, slot === 0 ? input : {}, slot !== 0 ? input : {});
        const action = m.controls[slot].pending;
        if (action?.comboQueued) queued ??= structuredClone(action);
        if (run.decoyJumped) decoyJumpAt ??= m.time;
        if (run.attackJumped) attackJumpAt ??= m.time;
      }
      assert.ok(queued);
      assert.ok(decoyJumpAt < attackJumpAt, 'the fake jump leads the real one');
      assert.equal(m.contacts, 2);
      assert.equal(m.lastPlayer, attacker.id);
      assert.equal(m.lastContact.power, queued.power);
      assert.ok(attacker.y > 0.4);
      const expected = manualImpulse(m.ball, attacker, 'drive', queued.power, queued.aim, m.config);
      assert.ok(Math.abs(m.ball.vx - expected.vx) < 1e-8);
      assert.ok(Math.abs(m.ball.vy - expected.vy) < 1e-8);
      assert.deepEqual(queued.aim.vector, vector);
      assert.equal(m.controls[slot].pending, null);
      const scene = captureScene(m);
      assert.ok(scene.teamRuns, 'replay keeps the play state');
      if (coop) {
        assert.ok(m.coopOwns(0, m.coopPlayer(0)));
        assert.ok(m.coopOwns(2, m.coopPlayer(2)));
      }
    },
  );
}

test('released lower and upper lobs launch the command through the actual reception pipeline', () => {
  for (const kind of ['low', 'loft']) {
    const { m, passer } = feintScenario('manual', 0, false, false, kind);
    const control = m.controls[0];
    control.pending = {
      kind,
      playerId: passer.id,
      age: 0.3,
      power: 0.9,
      aim: aimOf({ l2: true, r2: true }),
      ttl: 0.2,
    };
    m.inputs = [{}, {}, {}];
    assert.equal(m.tryPending(m.ball, control), true);
    assert.equal(m.teamRuns[0].feint, true);
    assert.equal(control.pending, null);
  }
});

test('a manual choice of the decoy cancels its automatic jump immediately', () => {
  const { m, passer, impulse } = feintScenario();
  m.makeContact(passer, 'loft', 0.9, impulse);
  const run = m.teamRuns[0];
  m.handleControl(FIXED_DT, { select: (impulse.decoyId % 3) + 1 }, 0);
  for (let i = 0; i < 100; i++) m.tick(FIXED_DT);
  assert.equal(run.decoyCancelled, true);
  assert.equal(run.decoyJumped, false);
});

test('a later contact cancels a queued shot, while manual selection takes control immediately', () => {
  for (const interruption of ['contact', 'select']) {
    const { m, passer, impulse } = feintScenario('queued');
    m.makeContact(passer, 'loft', 0.9, impulse);
    for (let i = 0; i < 18; i++) m.tick(FIXED_DT, { drive: true });
    m.tick(FIXED_DT);
    assert.equal(m.controls[0].pending.comboQueued, true);
    if (interruption === 'contact') {
      m.shotSerial++;
      assert.equal(m.tryPending(m.ball, m.controls[0]), false);
    } else m.handleControl(FIXED_DT, { select: 2 }, 0);
    assert.equal(m.controls[0].pending, null);
    if (interruption === 'select') assert.equal(m.selected[0], 1);
  }
});

test('a different contact button cancels the queued approach and prepares the requested shot', () => {
  const { m, passer, impulse } = feintScenario('queued');
  m.makeContact(passer, 'loft', 0.9, impulse);
  for (let i = 0; i < 18; i++) m.tick(FIXED_DT, { drive: true });
  m.tick(FIXED_DT);
  assert.equal(m.controls[0].pending.comboQueued, true);
  m.tick(FIXED_DT, { loft: true });
  assert.equal(m.teamRuns[0].attackCancelled, true);
  assert.equal(m.controls[0].pending, null);
  assert.equal(m.controls[0].charge.kind, 'loft');
});

test('ordinary low passes never enable an automatic approach or extend the shot window', () => {
  const { m, passer } = feintScenario('queued');
  m.makeContact(passer, 'low', 0.5, { vx: 1, vy: 2, vz: 0 });
  const action = { kind: 'drive', playerId: m.selected[0], aim: {}, power: 0.5, ttl: 0.2 };
  queueFeintAttack(m, m.controls[0], action);
  assert.equal(action.comboQueued, undefined);
  assert.equal(action.ttl, 0.2);
});

test('one trigger, a serve, or an unavailable teammate never starts the command', () => {
  const { m, passer } = feintScenario();
  for (const input of [{ l2: true }, { r2: true }, {}]) {
    const result = shotImpulse(m.ball, passer, 'loft', 0.9, aimOf(input), m.players, m.config);
    assert.equal(result.feint, undefined);
  }
  assert.equal(
    shotImpulse(
      m.ball,
      passer,
      'loft',
      0.9,
      aimOf({ l2: true, r2: true }),
      m.players,
      m.config,
      true,
    ).feint,
    undefined,
  );
  for (const property of ['recovery', 'diving', 'benched']) {
    m.players[0][property] = property === 'recovery' ? 1 : true;
    const result = shotImpulse(
      m.ball,
      passer,
      'loft',
      0.9,
      aimOf({ l2: true, r2: true }),
      m.players,
      m.config,
    );
    assert.equal(result.feint, undefined);
    m.players[0][property] = property === 'recovery' ? 0 : false;
  }
});

test('insufficient power or a late queue falls back instead of inventing flight or teleporting', () => {
  const { m, passer, impulse } = feintScenario('queued');
  const weak = shotImpulse(
    m.ball,
    passer,
    'loft',
    0,
    aimOf({ l2: true, r2: true }),
    m.players,
    m.config,
  );
  assert.equal(weak.feint, undefined);
  m.makeContact(passer, 'loft', 0.9, impulse);
  m.time = m.teamRuns[0].at - 0.03;
  const action = { kind: 'drive', playerId: impulse.targetId, power: 0.6, aim: {}, ttl: 0.2 };
  queueFeintAttack(m, m.controls[0], action);
  assert.equal(action.comboQueued, undefined);
  assert.equal(action.ttl, 0.2);
});

test('both variants persist and old settings default to manual attacks', () => {
  assert.equal(sanitizeConfig({}).feintMode, 'manual');
  assert.equal(sanitizeConfig({ feintMode: 'bad' }).feintMode, 'manual');
  for (const feintMode of ['manual', 'queued'])
    assert.equal(importSettings(exportSettings({ ...DEFAULTS, feintMode })).feintMode, feintMode);
});
