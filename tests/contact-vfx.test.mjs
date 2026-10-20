import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, COURT } from '../src/config.js';
import { shotImpulse } from '../src/moves.js';
import { contactAccent } from '../src/contact-vfx.js';

function receive({ opponent = true, speed = 20, fire = true } = {}) {
  const m = new Match({ ...DEFAULTS, ballFire: fire });
  m.reset('versus');
  m.phase = 'rally';
  m.incomingShot = 'drive';
  const p = m.active();
  m.lastTouch = opponent ? 1 : 0;
  m.lastPlayer = m.players.find(
    (other) => other.id !== p.id && other.team === (opponent ? 1 - p.team : p.team),
  ).id;
  m.touches = [0, 0];
  Object.assign(m.ball, { x: p.x, y: 1, vx: -speed, vy: -3 });
  const impulse = shotImpulse(
    m.ball,
    p,
    'low',
    0.6,
    { manualControl: true, axis: 1 },
    m.players,
    m.config,
  );
  assert.equal(m.makeContact(p, 'low', 0.6, impulse), true);
  return { m, p, impulse, event: m.events.findLast((e) => e.type === 'hit') };
}

test('rescue uses the incoming opponent flight; embers do not change the outgoing impulse', () => {
  const { m, p, impulse, event } = receive();
  assert.equal(event.incomingVelocity.x, -20);
  assert.ok(event.incomingBurning);
  assert.equal(contactAccent(event, m.config).kind, 'rescue');
  assert.equal(p.handEmbers.until - p.handEmbers.at, 5);
  assert.equal(m.ball.vx, impulse.vx);
  assert.equal(m.ball.vy, impulse.vy);
  for (const options of [{ opponent: false }, { speed: 3 }, { fire: false }]) {
    const other = receive(options);
    assert.equal(other.p.handEmbers, undefined);
    if (options.opponent === false || options.speed === 3)
      assert.equal(contactAccent(other.event, other.m.config), null);
  }
});

test('R2 slash follows the actual modifier; L2 overrides R2 and illegal contacts have no accent', () => {
  const m = new Match();
  const p = m.active();
  for (const soft of [false, true]) {
    const impulse = shotImpulse(
      m.ball,
      p,
      'drive',
      1,
      { manualControl: true, fast: true, soft, axis: 1 },
      m.players,
      m.config,
    );
    const event = {
      type: 'hit',
      kind: 'drive',
      power: 1,
      modifier: impulse.contactModifier,
      outgoingVelocity: { x: impulse.vx, y: impulse.vy },
    };
    assert.equal(contactAccent(event, m.config)?.kind ?? null, soft ? null : 'slash');
    assert.equal(contactAccent({ ...event, legal: false }, m.config), null);
  }
});

test('winning ground location is emitted for floor points, never an airborne fault or permitted bounce', () => {
  for (const floorBounce of [false, true]) {
    const m = new Match({ ...DEFAULTS, floorBounce });
    m.reset('versus');
    m.phase = 'rally';
    Object.assign(m.ball, { x: 6, y: COURT.ballRadius, vx: 0, vy: -8 });
    m.lastTouch = 0;
    m.tick(1 / 120, {});
    const event = m.events.findLast((e) => e.type === 'point');
    if (floorBounce) assert.equal(event, undefined);
    else assert.equal(event.groundX, 6);
  }
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  Object.assign(m.ball, { x: 3, y: 4, floorTouched: false });
  m.point(1, 'ЧЕТВЁРТОЕ КАСАНИЕ');
  assert.equal(m.events.findLast((e) => e.type === 'point').groundX, null);
});
