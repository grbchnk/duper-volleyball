import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { aimOf } from '../src/controllers.js';
import { shotImpulse } from '../src/moves.js';

test('double triggers use L2 and never request a scripted feint, in versus and co-op', () => {
  for (const mode of ['versus', 'coop'])
    for (const team of mode === 'coop' ? [0] : [0, 1]) {
      const m = new Match({ ...DEFAULTS, feintMode: 'queued' });
      m.reset(mode);
      m.phase = 'rally';
      m.lastTouch = 1 - team;
      m.lastPlayer = (1 - team) * 3;
      const p = m.players[team * 3 + 1];
      Object.assign(m.ball, { x: p.x, y: 2.1, vx: 0, vy: 0 });
      const aim = aimOf({ l2: true, r2: true });
      assert.equal(aim.play, undefined);
      const impulse = shotImpulse(m.ball, p, 'loft', 0.6, aim, m.players, m.config);
      assert.equal(impulse.feint, undefined);
      assert.equal(impulse.decoyId, undefined);
      assert.equal(m.makeContact(p, 'loft', 0.6, impulse), true);
      for (let i = 0; i < 10; i++) m.tick(FIXED_DT);
      assert.ok(
        m.players.filter((q) => q.team === team && q.id !== p.id).every((q) => !q.jumpProfile),
      );
      assert.ok(!m.teamRuns[team]?.feint);
      assert.ok(!m.controls.some((c) => c.pending?.comboQueued));
    }
});
