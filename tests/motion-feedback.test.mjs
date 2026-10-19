import test from 'node:test';
import assert from 'node:assert/strict';
import { groundVelocity, updateBodyMotion, bodyOffset } from '../src/movement-feel.js';
import { contactTempo } from '../src/contact-tempo.js';
import { gameCanvasSize } from '../src/canvas-size.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { Match } from '../src/engine.js';
import { soundCue } from '../src/audio.js';
import { InputBuffer } from '../src/input.js';

test('short acceleration and braking reach requested speed without overshoot', () => {
  let velocity = groundVelocity(0, 7, 7, FIXED_DT);
  assert.ok(velocity > 0 && velocity < 7);
  for (let i = 0; i < 12; i++) velocity = groundVelocity(velocity, 7, 7, FIXED_DT);
  assert.equal(velocity, 7);
  for (let i = 0; i < 8; i++) velocity = groundVelocity(velocity, 0, 7, FIXED_DT);
  assert.equal(velocity, 0);
  assert.ok(groundVelocity(7, -7, 7, FIXED_DT) > 0, 'a turn brakes before reversing');
});

test('body and head lag behind feet, settle during running, and reset after stopping', () => {
  const p = { vx: DEFAULTS.playerSpeed, recovery: 0 };
  updateBodyMotion(p, FIXED_DT, DEFAULTS);
  assert.ok(p.bodyMotion.head < p.bodyMotion.torso);
  assert.ok(p.bodyMotion.torso < 0);
  for (let i = 0; i < 120; i++) updateBodyMotion(p, FIXED_DT, DEFAULTS);
  assert.ok(p.bodyMotion.torso > 0);
  p.vx = 0;
  updateBodyMotion(p, FIXED_DT, DEFAULTS);
  assert.ok(p.bodyMotion.head > 0);
  for (let i = 0; i < 160; i++) updateBodyMotion(p, FIXED_DT, DEFAULTS);
  assert.deepEqual(bodyOffset(p), { torso: 0, head: 0, drop: 0 });
});

test('live movement produces one skid on a committed turn and landing emits a short recovery pose', () => {
  const m = new Match();
  m.reset('test');
  Object.assign(m.ball, { x: 4, y: 30, vx: 0, vy: 0 });
  for (let i = 0; i < 18; i++) m.tick(FIXED_DT, { axis: 1 });
  m.events = [];
  for (let i = 0; i < 12; i++) m.tick(FIXED_DT, { axis: -1 });
  assert.equal(m.events.filter((e) => e.type === 'skid').length, 1);
  const p = m.active();
  m.jump(p);
  for (let i = 0; i < 250 && p.jumpProfile; i++) m.animatePlayers(FIXED_DT);
  assert.equal(m.events.filter((e) => e.type === 'land').length, 1);
  assert.equal(p.y, 0);
  m.animatePlayers(0.1);
  assert.ok(bodyOffset(p).drop > 0);
});

test('third-contact tempo ramps smoothly, expires without a hit, and leaves physical parameters intact', () => {
  const m = new Match({ ...DEFAULTS, thirdTouchSlowdown: 0.4 });
  m.phase = 'rally';
  m.lastTouch = 0;
  m.touches[0] = 2;
  const p = m.active();
  m.jump(p);
  p.jumpTime = p.jumpProfile.windup + 0.01;
  Object.assign(m.ball, { x: p.x, y: p.y + 2.1 });
  const ball = { ...m.ball },
    gravity = m.config.gravity;
  const first = contactTempo(m, FIXED_DT);
  assert.ok(first < 1 && first > 0.95);
  let lowest = first,
    last;
  for (let i = 0; i < 90; i++) {
    last = contactTempo(m, FIXED_DT);
    lowest = Math.min(lowest, last);
  }
  assert.ok(lowest >= 0.6 && lowest < 0.65);
  assert.equal(last, 1);
  assert.deepEqual(m.ball, ball);
  assert.equal(m.config.gravity, gravity);
  m.shotSerial++;
  m.touches[0] = 3;
  assert.equal(contactTempo(m, FIXED_DT), 1);
  m.config.thirdTouchSlowdown = 0;
  assert.equal(contactTempo(m, FIXED_DT), 1);
});

test('a third contact immediately clears active slowdown and the next tick runs at normal speed', () => {
  const m = new Match({ ...DEFAULTS, thirdTouchSlowdown: 0.4 });
  m.phase = 'rally';
  m.lastTouch = 0;
  m.touches[0] = 2;
  const p = m.active();
  m.jump(p);
  p.jumpTime = p.jumpProfile.windup + 0.01;
  Object.assign(m.ball, { x: p.x, y: p.y + 2.1 });
  for (let i = 0; i < 14; i++) contactTempo(m, FIXED_DT);
  assert.ok(m.contactTempoState.blend > 0.99);
  assert.equal(m.makeContact(p, 'drive', 0.6, { vx: 10, vy: 3, vz: 0, spin: 0 }), true);
  assert.equal(m.contactTempoState, null);
  assert.equal(contactTempo(m, FIXED_DT), 1);
  const before = m.time;
  m.tick(FIXED_DT);
  assert.ok(Math.abs(m.time - before - FIXED_DT) < 1e-10);

  m.contactTempoState = { serial: m.shotSerial - 1, blend: 1 };
  assert.equal(contactTempo(m, FIXED_DT), 1, 'a new contact cannot inherit the previous slowdown');
});

test('only a fast frontal head impact detaches a cosmetic head, medium impact keeps stars', () => {
  for (const fast of [false, true]) {
    const m = new Match();
    m.phase = 'rally';
    const target = m.active(0);
    m.headHitEligible = true;
    m.headFlyEligible = fast;
    m.incomingShot = 'drive';
    m.lastTouch = 1;
    const before = { ...m.ball, x: target.x, y: 2.6 };
    Object.assign(m.ball, { x: target.x, y: 1.9, vx: fast ? -18 : -7, vy: -10 });
    assert.equal(m.tryHeadHit(before), true);
    assert.equal(!!target.headFly, fast);
    assert.ok(target.stunned > 0);
    assert.equal(m.lastTouch, 0);
    for (let i = 0; i < 160; i++) m.animatePlayers(FIXED_DT);
    assert.equal(target.headFly, null);
    assert.equal(target.stunned, 0);
  }
});

test('a fast sideways head hit is swept correctly, while a nearby miss does not stun', () => {
  for (const offset of [0, 0.6]) {
    const m = new Match();
    m.phase = 'rally';
    const p = m.active(0);
    m.lastTouch = 1;
    m.headHitEligible = true;
    m.headFlyEligible = offset === 0;
    m.incomingShot = 'drive';
    const before = { ...m.ball, x: p.x + 0.7, y: p.y + 1.9 + offset };
    Object.assign(m.ball, { x: p.x - 0.7, y: before.y, vx: -25, vy: 0 });
    assert.equal(m.tryHeadHit(before), offset === 0);
    assert.equal(!!p.headFly, offset === 0);
  }
});

test('a full-power hit keeps the head detached and the body down until the next round', () => {
  const m = new Match();
  m.phase = 'rally';
  const target = m.active(0);
  m.headHitEligible = true;
  m.headFlyEligible = true;
  m.incomingShot = 'drive';
  m.lastTouch = 1;
  const before = { ...m.ball, x: target.x, y: 2.6 };
  Object.assign(m.ball, { x: target.x, y: 1.9, vx: -12, vy: -4 });
  assert.equal(m.tryHeadHit(before), true);
  assert.ok(target.headFly);
  for (let i = 0; i < 600; i++) m.animatePlayers(FIXED_DT);
  assert.equal(target.headFly, null, 'the detached head finishes its flight');
  assert.equal(target.headDetached, true, 'the head stays absent from the body');
  assert.ok(target.recovery > 0, 'the body remains down');
  assert.equal(target.pose, 'belly');

  m.startServe();
  assert.equal(target.headDetached, false);
  assert.equal(target.recovery, 0);
  assert.equal(target.pose, 'idle');
});

test('full-screen backing size follows screen density and preserves 16:9', () => {
  assert.deepEqual(gameCanvasSize(false, 2560, 1440, 2), { width: 960, height: 540 });
  assert.deepEqual(gameCanvasSize(true, 1920, 1080), { width: 1920, height: 1080 });
  assert.deepEqual(gameCanvasSize(true, 1920, 1080, 2), { width: 3840, height: 2160 });
  const wide = gameCanvasSize(true, 2560, 1080);
  assert.deepEqual(wide, { width: 1920, height: 1080 });
});

test('contact tones form a C-major answer and L3 never requests a retry', () => {
  for (const [comboStage, frequency] of [
    [1, 523.25],
    [2, 659.25],
    [3, 783.99],
  ]) {
    const cue = soundCue({
      type: 'hit',
      kind: ['low', 'loft', 'drive'][comboStage - 1],
      comboStage,
    });
    assert.ok(cue.some((note) => note.frequency === frequency));
    assert.ok(cue.every((note) => Number.isFinite(note.frequency) && note.volume <= 0.2));
  }
  const input = new InputBuffer();
  input.gamepad = {
    buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: i === 10, value: i === 10 ? 1 : 0 })),
    axes: [0, 0, 0, 0],
  };
  assert.equal(input.read('rally').retryHeld, false);
});
