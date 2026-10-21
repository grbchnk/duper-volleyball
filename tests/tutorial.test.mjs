import test from 'node:test';
import assert from 'node:assert/strict';
import { BALL_DESIGNS, ballPattern } from '../src/ball-designs.js';
import { sanitizeConfig } from '../src/config.js';
import { LESSONS } from '../src/tutorial.js';
import { coachFor, controlIcon } from '../src/tutorial-visuals.js';
test('all lessons explain controls using real SVG controller icons', () => {
  for (const lesson of LESSONS)
    for (const goal of lesson.goals) {
      const c = coachFor(lesson, goal);
      assert.ok(c.controls.length);
      assert.ok(c.hint.length < 150);
      for (const id of c.controls) assert.match(controlIcon(id), /<svg/);
    }
});
test('every new ball survives config validation and has a distinct three-color pattern', () => {
  const signatures = new Set();
  for (const [id, design] of Object.entries(BALL_DESIGNS)) {
    assert.equal(sanitizeConfig({ ballSkin: id }).ballSkin, id);
    if (design.colors.length !== 3) continue;
    const pixels = [];
    for (let y = -8; y <= 8; y++)
      for (let x = -8; x <= 8; x++) {
        const index = ballPattern(id, x, y);
        assert.ok(index >= 0 && index < 3);
        pixels.push(index);
      }
    signatures.add(JSON.stringify(pixels));
  }
  assert.equal(signatures.size, 8);
});
