import test from 'node:test';
import assert from 'node:assert/strict';
import { openBrowserGame, openSettingsSection } from './settings-helpers.mjs';

test(
  'jump hold has no charge state or visible controls, while the ordinary apex pause remains',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t);
    await openSettingsSection(page, 'Физика и помощь');
    assert.equal(await page.locator('#physics-jumpHoldHang').count(), 0);
    assert.equal(await page.locator('#physics-jumpHoldThreshold').count(), 0);
    assert.equal(await page.locator('#variableJump').count(), 0);
    assert.equal(await page.locator('#physics-jumpHang').count(), 1);
    const result = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { FIXED_DT } = await import('/src/config.js');
      return [false, true].map((held) => {
        const m = new Match();
        m.reset('test');
        m.config.jumpHoldHang = 0.25;
        m.humanJump(m.players[0]);
        m.inputs = [{ jumpHeld: held }, {}, {}];
        const frames = [];
        for (let i = 0; i < 50; i++) {
          m.animatePlayers(FIXED_DT);
          frames.push(m.players[0].y);
        }
        return { frames, hold: m.players[0].jumpButtonHold };
      });
    });
    assert.deepEqual(result[0], result[1]);
    assert.equal(result[0].hold, null);
  },
);
