import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Match } from '../src/engine.js';
import { DEFAULTS, sanitizeConfig } from '../src/config.js';
import { simulateShot } from '../src/shot-lab.js';
import { simulateServe } from '../src/serve-lab.js';
import { importSettings, exportSettings } from '../src/settings-file.js';
import { contactReason } from '../src/contact-rules.js';
import { shotSettings } from '../src/shot-settings.js';
import { captureScene, capture, restore } from '../src/replay.js';
import { nextReceiver } from '../src/receiver-selection.js';
import { challengeProfileKey, profileRecords } from '../src/records.js';
import { sanitizeProgress } from '../src/club.js';
import { startChallenge } from '../src/challenges.js';
import { Tutorial } from '../src/tutorial.js';

test('the supplied standard profile is the complete default, including a reset and JSON roundtrip', () => {
  const supplied = JSON.parse(
    readFileSync(new URL('../config/standard.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(DEFAULTS, supplied.config);
  assert.deepEqual(sanitizeConfig(), supplied.config);
  assert.deepEqual(importSettings(exportSettings(DEFAULTS)), supplied.config);
  assert.equal(
    importSettings('{"version":3,"config":{"backSpeedMax":7.2}}').backSpeedMax,
    undefined,
  );
  assert.equal(sanitizeConfig({ ballFire: false }).ballFire, false);
  assert.equal(sanitizeConfig({ livelyBackground: false }).livelyBackground, false);
  assert.equal(
    importSettings('{"version":2,"config":{"rightStickAim":true}}').rightStickAim,
    undefined,
  );
});

test('laboratory impulse equals the actual manual contact on both teams with each modifier and direction', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'loft', 'drive'])
      for (const power of [0.1, 0.7, 1])
        for (const angle of [null, 30, 150, -25])
          for (const modifier of [{}, { soft: true }, { fast: true }, { soft: true, fast: true }]) {
            const sample = simulateShot(DEFAULTS, {
              kind,
              power,
              angle,
              playerId: team * 3 + 1,
              ...modifier,
            });
            const match = sample.match;
            match.reset('versus');
            match.phase = 'rally';
            match.ball = { ...sample.ball };
            const control = match.controls[team];
            match.inputs = [{}, {}, {}];
            const vector =
              angle === null
                ? undefined
                : {
                    x: Math.cos((angle * Math.PI) / 180),
                    y: Math.sin((angle * Math.PI) / 180),
                  };
            match.inputs[team] = {
              [kind]: true,
              buttonVector: vector,
              l2: modifier.soft,
              r2: modifier.fast,
            };
            control.pending = {
              kind,
              age: DEFAULTS.armWindup,
              power,
              playerId: sample.player.id,
              aim: {},
              ttl: DEFAULTS.releaseWindow,
            };
            assert.equal(
              match.tryPending(match.ball, control),
              true,
              `${team}/${kind}/${power}/${angle}`,
            );
            for (const key of ['vx', 'vy', 'spin', 'attackGravity'])
              assert.equal(match.ball[key], sample.impulse[key], key);
          }
});

test('laboratory defaults stay inside custom contact zones and explicit heights remain inspectable', () => {
  for (const kind of ['low', 'loft', 'drive'])
    for (const height of [0, 1.2]) {
      const config = { ...DEFAULTS, [kind + 'ContactMin']: 0.4, [kind + 'ContactMax']: 0.6 };
      const sample = simulateShot(config, { kind, height, power: 0.5 });
      assert.equal(contactReason(sample.match, sample.player, kind, sample.ball), null);
      const outside = simulateShot(config, { kind, height, power: 0.5, contactHeight: 1 });
      assert.equal(outside.ball.y, height + 1);
      assert.match(contactReason(outside.match, outside.player, kind, outside.ball), /высоко/);
    }
});

test('contact diagnostics report the same rule used by gameplay', () => {
  const match = new Match();
  match.phase = 'rally';
  const p = match.players[0];
  const settings = shotSettings(match.config, 'low');
  Object.assign(match.ball, { x: p.x, y: (settings.ContactMin + settings.ContactMax) / 2 });
  assert.equal(contactReason(match, p, 'low'), null);
  match.ball.y = 4;
  assert.equal(match.canContact(p, 'low'), false);
  assert.match(contactReason(match, p, 'low'), /высоко/);
  match.ball.x = 3;
  assert.match(contactReason(match, p, 'low'), /стороне/);
});

test('serve laboratory carries the selected direction through the actual second press', () => {
  for (const playerId of [0, 3])
    for (const kind of ['low', 'back', 'loft', 'drive'])
      for (const angle of [30, 70, 150]) {
        const sample = simulateServe(DEFAULTS, { kind, playerId, power: 0.5, angle });
        assert.equal(sample.hit, true);
        assert.equal(Math.sign(sample.impulse.vx), Math.sign(Math.cos((angle * Math.PI) / 180)));
        const actual = (Math.atan2(sample.impulse.vy, Math.abs(sample.impulse.vx)) * 180) / Math.PI;
        assert.ok(Math.abs(actual - (angle > 90 ? 180 - angle : angle)) < 1e-8);
      }
});

test('playback contains scene state and shares immutable settings; retry restores simulation independently', () => {
  const match = new Match();
  match.reset('coop');
  match.phase = 'rally';
  const start = capture(match);
  for (let n = 0; n < 3; n++) {
    match.time += 0.06;
    match.replay.record(match);
  }
  assert.equal(match.replay.frames[0].config, match.replay.frames[1].config);
  assert.equal(Object.isFrozen(match.replay.frames[0].config), true);
  assert.equal(Object.hasOwn(captureScene(match), 'seed'), false);
  assert.equal(Object.hasOwn(captureScene(match), 'cpuOutForecast'), false);
  match.phase = 'point';
  match.replay.record(match);
  const view = match.replay.view(match, 0);
  assert.equal(view.coopPlayer(2), match.coopSelected);
  assert.equal(view.humanControllers().length, 2);
  match.controls[2].charge = { kind: 'loft', playerId: 2 };
  restore(match, start);
  assert.equal(match.controls[2].charge, null);
  assert.equal(match.phase, 'rally');
});

test('two receivers share a forecast only while the physical state and configuration match', () => {
  const match = new Match();
  match.reset('coop');
  match.phase = 'rally';
  Object.assign(match.ball, { x: -4, y: 4, vx: -2, vy: -2 });
  nextReceiver(match, 0);
  const first = match.receiverForecast;
  nextReceiver(match, 0, { currentId: 2 });
  assert.equal(match.receiverForecast, first);
  match.ball.vx = -3;
  nextReceiver(match, 0);
  assert.notEqual(match.receiverForecast, first);
});

test('challenge records separate physics profiles, preserve old records and detect mid-attempt changes', () => {
  const progress = sanitizeProgress({ records: { precision: 1800 } });
  const custom = { ...DEFAULTS, gravity: 12 };
  profileRecords(progress, DEFAULTS, true).precision = 2100;
  profileRecords(progress, custom, true).precision = 900;
  assert.equal(profileRecords(progress, DEFAULTS).precision, 2100);
  assert.equal(progress.records.precision, 1800);
  assert.equal(
    challengeProfileKey({ ...DEFAULTS, ballSkin: 'plain' }),
    challengeProfileKey(DEFAULTS),
  );
  assert.deepEqual(sanitizeProgress(progress), progress);
  const match = new Match({ ...DEFAULTS, duel: true });
  match.reset('challenge');
  startChallenge(match, 'precision');
  match.updateConfig({ ...match.config, ballFire: false });
  assert.equal(match.challenge.profileChanged, false);
  match.updateConfig({ ...match.config, gravity: 12 });
  match.updateConfig({ ...match.config, gravity: DEFAULTS.gravity });
  assert.equal(match.challenge.profileChanged, true);
});

test('tutorial uses the existing exercise and only advances after a real action', () => {
  const match = new Match();
  match.reset('practice');
  const tutorial = new Tutorial(match);
  tutorial.start();
  assert.equal(match.drill, 'footwork');
  assert.equal(match.tutorialNoBall, true);
  assert.equal(tutorial.phase, 'explain');
  assert.equal(tutorial.next(), false);
  tutorial.advance(2.99);
  assert.equal(tutorial.frozen, true);
  tutorial.advance(0.02);
  assert.equal(tutorial.phase, 'practice');
  for (let n = 0; n < 60; n++) {
    match.tick(1 / 120, { axis: 1 });
    tutorial.observe({ axis: 1 });
  }
  assert.equal(tutorial.ready, false);
  assert.equal(tutorial.completed, 1);
  for (let n = 0; n < 80 && !tutorial.ready; n++) {
    match.tick(1 / 120, { jump: true, jumpHeld: true });
    tutorial.observe({ jump: true });
  }
  assert.equal(tutorial.ready, true);
  assert.equal(tutorial.next(), true);
  assert.equal(tutorial.lesson.id, 'receive');
  assert.equal(match.tutorialNoBall, false);
  tutorial.leave();
  assert.equal(tutorial.active, false);
});
