import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { shotImpulse } from '../src/moves.js';

const lean = (r) => (Math.atan2(Math.abs(r.vx), r.vy) * 180) / Math.PI;
const speed = (r) => Math.hypot(r.vx, r.vy);
function setup() {
  const m = new Match();
  return {
    m,
    hit: (kind, dx = 0, vx = 0, vy = -10, aim = {}, team = 0, assist = 0.5) => {
      const p = m.players[team * 3],
        side = team ? -1 : 1;
      const b = { ...m.ball, x: p.x + side * dx, y: kind === 'low' ? 0.5 : 1.9, vx: side * vx, vy };
      return shotImpulse(b, p, kind, 0.6, { manualControl: true, ...aim }, m.players, {
        ...m.config,
        passAssist: assist,
      });
    },
  };
}

test('central neutral receives remain upright while stretched contacts expose a substantially flatter flight', () => {
  const { hit } = setup();
  for (const kind of ['low', 'loft']) {
    assert.ok(lean(hit(kind)) < 0.01);
    const moderate = hit(kind, -0.3, 0, -10),
      stretched = hit(kind, -0.8, 0, -25);
    assert.ok(lean(moderate) < 10);
    assert.ok(lean(stretched) > 25);
    assert.ok(stretched.vy > 0, 'even a difficult neutral reception still attempts a lift');
  }
});

test('incoming motion has a stronger effect at a stretched platform and forceful downward hits expose its tilt', () => {
  const { hit } = setup();
  for (const kind of ['low', 'loft']) {
    const central = hit(kind, 0, -16, -10),
      glancing = hit(kind, -0.8, -16, -10);
    assert.ok(lean(central) < 16);
    assert.ok(lean(glancing) > 35);
    assert.ok(lean(glancing) > lean(hit(kind, -0.8, 0, -10)) + 8);
    assert.ok(lean(hit(kind, -0.6, 0, -25)) > lean(hit(kind, -0.6, 0, -3)) + 2);
  }
});

test('full assist and L2 cannot erase bad positioning, while L2 still damps lateral carry', () => {
  const { hit } = setup();
  for (const kind of ['low', 'loft']) {
    const raw = hit(kind, -1, -20, -12, {}, 0, 0),
      helped = hit(kind, -1, -20, -12, {}, 0, 1);
    assert.ok(lean(helped) > 35);
    assert.ok(
      lean(raw) - lean(helped) < 3,
      'a stretched contact cannot be rescued by the full 6-degree correction',
    );
    assert.ok(lean(hit(kind, -0.9, -16, -10, { soft: true })) > 20);
    assert.ok(
      Math.abs(hit(kind, 0, 12, -8, { soft: true }).vx) < Math.abs(hit(kind, 0, 12, -8).vx),
    );
  }
});

test('response stays smooth, symmetric, deterministic, and never adds incoming energy', () => {
  const { hit } = setup();
  for (const kind of ['low', 'loft']) {
    const reference = speed(hit(kind));
    let previous;
    for (let n = -200; n <= 200; n++) {
      const dx = n / 200,
        r = hit(kind, dx, -16, -12),
        mirrored = hit(kind, dx, -16, -12, {}, 1);
      assert.ok(Math.abs(r.vx + mirrored.vx) < 1e-8);
      assert.ok(Math.abs(r.vy - mirrored.vy) < 1e-8);
      assert.ok(Math.abs(speed(r) - reference) < 1e-8);
      if (previous) assert.ok(Math.hypot(r.vx - previous.vx, r.vy - previous.vy) < 0.2);
      previous = r;
    }
    assert.deepEqual(
      hit(kind, -0.8, -16, -10),
      hit(kind, -0.8, -16, -10, { neutralErrorSeed: 999 }),
    );
    assert.equal(hit(kind, 0, 0, -10, { vector: { x: 0.5, y: 0.8 } }).neutralReception, undefined);
    assert.equal(hit(kind, 0, 0, -10, { tutorialAutoPass: true }).neutralReception, undefined);
  }
});
