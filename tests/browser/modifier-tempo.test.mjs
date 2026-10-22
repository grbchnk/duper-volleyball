import { revealSettingsControl } from './settings-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openBrowserGame, openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'tempo is edited and saved per shot modifier, with no global experimental switch',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t);
    await openSettingsSection(page, 'Физика и помощь');
    assert.equal(await page.locator('#modifier-tempo').count(), 0);
    await openSettingsSection(page, 'Приёмы и подачи');
    await revealSettingsControl(page, '#shot-kind');
    await page.locator('#shot-kind').selectOption('loft');
    await revealSettingsControl(page, '#shot-soft');
    await page.locator('#shot-soft').check();
    await settleSettings(page);
    await revealSettingsControl(page, '#contact-number-Tempo');
    await page.locator('#contact-number-Tempo').fill('0.75');
    await settleSettings(page);
    assert.match(await page.locator('#shot-stats').innerText(), /темп 75%/);
    await revealSettingsControl(page, '#shot-soft');
    await page.locator('#shot-soft').uncheck();
    await settleSettings(page);
    assert.equal(await page.locator('#contact-number-Tempo').inputValue(), '1');
    await page.reload();
    await page.waitForSelector('#club-sidebar');
    assert.equal(
      await page.evaluate(async () => (await import('/src/main.js')).match.config.loftSoftTempo),
      0.75,
    );
  },
);
