import test from 'node:test';
import assert from 'node:assert/strict';
import { openBrowserGame, openSettingsSection } from './settings-helpers.mjs';

test(
  'scripted feints and CPU approach switches are removed from the live settings',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t);
    await openSettingsSection(page, 'Матч и управление');
    assert.equal(await page.locator('#dynamic-feint').count(), 0);
    assert.equal(await page.locator('#dynamic-approach').count(), 0);
    await openSettingsSection(page, 'Управление и обучение');
    assert.doesNotMatch(await page.locator('#guide-content').innerText(), /Навес с ложным прыжком/);
    assert.match(
      await page.locator('#guide-content').innerText(),
      /L2 \+ R2 использует мягкий профиль/,
    );
  },
);
