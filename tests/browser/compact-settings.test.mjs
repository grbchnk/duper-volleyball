import test from 'node:test';
import assert from 'node:assert/strict';
import { openBrowserGame, openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'compact settings keep lab controls fixed and open focused appearance pickers',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t, { width: 1440, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openSettingsSection(page, 'Приёмы и подачи');
    await page.locator('#contact-tabs button[data-section="direction"]').click();
    assert.equal(await page.locator('#contact-range-ElevationMin').isVisible(), true);
    await page.screenshot({ path: '.cache/settings-lab-desktop.png' });
    const before = await page.locator('#shot-endpoints').boundingBox();
    await page.locator('.shot-controls').evaluate((el) => (el.scrollTop = el.scrollHeight));
    assert.deepEqual(await page.locator('#shot-endpoints').boundingBox(), before);
    await page.locator('#shot-soft').check();
    await page.locator('#contact-tabs button[data-section="contact"]').click();
    assert.equal(await page.locator('#contact-range-ReceiveHoldTime').inputValue(), '120');
    await page.locator('#contact-wait-enabled').uncheck();
    assert.equal(await page.locator('#contact-range-ReceiveHoldTime').inputValue(), '0');
    await page.locator('#contact-wait-enabled').check();
    await page.locator('#contact-range-ReceiveHoldTime').fill('180');
    assert.equal(await page.locator('#contact-value-ReceiveHoldTime').textContent(), '180 мс');
    await page.locator('#shot-kind').selectOption('drive');
    assert.equal(await page.locator('#contact-range-ReceiveHoldTime').inputValue(), '120');
    await openSettingsSection(page, 'Моя команда');
    await page.locator('#team-head-trigger').click();
    await page.locator('[data-head="bear"]').click();
    await settleSettings(page);
    assert.equal(await page.locator('[data-head="bear"]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    await page.locator('#team-body-trigger').click();
    await page.locator('#team-body').selectOption('longsleeve');
    await settleSettings(page);
    assert.match(await page.locator('#team-body-trigger').textContent(), /Длинный рукав/);
    await page.keyboard.press('Escape');
    await page.locator('[popovertarget="team-colors-popup"]').first().click();
    await page.locator('#team-color-part').selectOption('shoe');
    assert.equal(await page.locator('#team-shoe-colors').isVisible(), true);
    assert.equal(await page.locator('#team-hair-colors').isVisible(), false);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: '.cache/settings-team-desktop.png' });
    await page.setViewportSize({ width: 390, height: 760 });
    await openSettingsSection(page, 'Приёмы и подачи');
    await page.screenshot({ path: '.cache/settings-lab-mobile.png' });
    for (const id of ['#shot-mode', '#shot-kind', '#shot-endpoints']) {
      const rect = await page.locator(id).boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= 390);
    }
    await page.setViewportSize({ width: 760, height: 390 });
    await page.locator('#contact-range-ReceiveHoldTime').scrollIntoViewIfNeeded();
    const landscape = await page.locator('#contact-range-ReceiveHoldTime').boundingBox();
    assert.ok(landscape.y >= 0 && landscape.y + landscape.height <= 390);
    await page.screenshot({ path: '.cache/settings-lab-landscape.png' });
    assert.equal(await page.locator('#random-arms').count(), 0);
    assert.deepEqual(errors, []);
  },
);
