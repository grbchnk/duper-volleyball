import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import {
  traceBall,
  predictAtHeight,
  integrateBall,
  collideNet,
  crossesUnderNet,
} from '../src/physics.js';
import { chooseCPUShot } from '../src/cpu.js';

test('live play and both trajectory predictors stop at the same under-net fault', () => {
  for (const side of [-1, 1]) {
    const ball = { x: side * 0.4, y: 0.65, z: 4.5, vx: -side * 9, vy: 0, vz: 0, spin: 0 };
    const trace = traceBall(ball, DEFAULTS, 3);
    assert.equal(trace.at(-1).netFault, true);
    assert.ok(trace.at(-1).y > 0.105);
    assert.equal(predictAtHeight(ball, 0.105, DEFAULTS, 3).netFault, true);
    const actual = { ...ball };
    let hitFault = false;
    for (let i = 0; i < 120 && !hitFault; i++) {
      const previous = { ...actual };
      integrateBall(actual, FIXED_DT, DEFAULTS);
      collideNet(actual, previous, DEFAULTS.restitution, DEFAULTS);
      hitFault = crossesUnderNet(actual, previous, DEFAULTS);
    }
    assert.ok(hitFault);
    assert.equal(actual.x, trace.at(-1).x);
    assert.equal(actual.y, trace.at(-1).y);
  }
});

test('CPU never values an under-net flight as a legal attacking landing', () => {
  for (const team of [0, 1])
    for (const style of ['balanced', 'blocker', 'trickster'])
      for (const height of [1.4, 1.9, 2.4, 3.3]) {
        const m = new Match({ cpuStyle: style, cpuSkill: 80 }, 41);
        m.phase = 'rally';
        m.mode = 'demo';
        m.lastTouch = team;
        m.touches[team] = 2;
        const p = m.players[team * 3];
        p.x = team ? 1.2 : -1.2;
        p.y = Math.max(0, height - 2.1);
        Object.assign(m.ball, { x: p.x, y: height, vx: 0, vy: -1, z: 4.5, vz: 0 });
        const shot = chooseCPUShot(m, p, ['low', 'loft', 'drive']);
        const flight = traceBall({ ...m.ball, ...shot.impulse }, m.config, 10);
        assert.notEqual(
          flight.at(-1).netFault,
          true,
          `${team}/${style}/${height}/${shot.impulse.intent}`,
        );
      }
});
