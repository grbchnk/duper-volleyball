import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { openBrowserGame, settleSettings } from './settings-helpers.mjs';

test(
  'individual accessories: previews, categories, independent slots, persistence, and mobile layout',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.locator('#team-quick').click();
    await settleSettings(page);
    const stored = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('duper-volleyball.dynamic-v3.config')).config,
      );
    assert.equal(await page.locator('#team-print-gallery .accessory-choice').count(), 16);
    assert.equal(await page.locator('#team-shoe-gallery .accessory-choice').count(), 7);
    assert.equal(await page.locator('[id*="eyewear"]').count(), 0);
    for (const head of ['straw', 'ushanka', 'bucket', 'pompom', 'durag'])
      assert.equal(
        await page.locator(`[data-head="${head}"]`).getAttribute('data-category'),
        'headwear',
      );
    for (const head of [
      'cat',
      'panda',
      'frog',
      'owl',
      'tiger',
      'penguin',
      'alien',
      'skeleton',
      'lizard',
      'yeti',
    ])
      assert.equal(
        await page.locator(`[data-head="${head}"]`).getAttribute('data-category'),
        'characters',
      );
    await page.locator('[data-player="0"]').click();
    const before = await page.locator('#team-roster-preview').evaluate((c) => c.toDataURL());
    await page.locator('#team-print-gallery [data-jersey-print="number3"]').click();
    await page.locator('#team-shoe-gallery [data-shoes="high"]').click();
    await page.locator('#team-shoe-colors [data-color="#ee967d"]').click();
    await page.locator('[data-head="panda"]').click();
    await settleSettings(page);
    const config = await stored();
    assert.equal(config.teamPlayers[0].jerseyPrint, 'number3');
    assert.equal(config.teamPlayers[0].shoes, 'high');
    assert.equal(config.teamPlayers[0].shoeColor, '#ee967d');
    assert.notEqual(
      await page.locator('#team-roster-preview').evaluate((c) => c.toDataURL()),
      before,
    );
    await page.locator('[data-player="1"]').click();
    await page.locator('#team-print-gallery [data-jersey-print="heart"]').click();
    await page.locator('#team-print-colors [data-color="#364755"]').click();
    await page.locator('#team-shoe-gallery [data-shoes="neon"]').click();
    await page.locator('#team-shoe-colors [data-color="#80bda8"]').click();
    const edited = await stored();
    assert.deepEqual(edited.teamPlayers[0], config.teamPlayers[0]);
    await page.reload();
    await page.locator('#team-quick').click();
    await settleSettings(page);
    assert.deepEqual((await stored()).teamPlayers, edited.teamPlayers);
    await page.locator('[data-player="0"]').click();
    assert.equal(
      await page
        .locator('#team-print-gallery [aria-pressed="true"]')
        .getAttribute('data-jersey-print'),
      'number3',
    );
    assert.equal(
      await page.locator('#team-shoe-gallery [aria-pressed="true"]').getAttribute('data-shoes'),
      'high',
    );

    await settleSettings(page);
    await mkdir('.cache/customization-qa', { recursive: true });
    // Render a sheet from actual gallery canvases, not separate mock artwork.
    const sheet = await page.evaluate(async () => {
      const { SQUARE_HEAD_DESIGNS } = await import('/src/special-heads.js');
      const canvas = document.createElement('canvas');
      canvas.width = 1120;
      canvas.height = 1040;
      const c = canvas.getContext('2d');
      c.fillStyle = '#fff9eb';
      c.fillRect(0, 0, 1120, 1040);
      c.imageSmoothingEnabled = false;
      function section(title, selectors, y, columns, cellHeight = 125) {
        c.fillStyle = '#43564a';
        c.font = 'bold 20px sans-serif';
        c.textAlign = 'left';
        c.fillText(title, 24, y);
        selectors.forEach((selector, i) => {
          const card = document.querySelector(selector),
            x = (((i % columns) + 0.5) * 1120) / columns,
            top = y + 12 + Math.floor(i / columns) * cellHeight;
          c.drawImage(card.querySelector('canvas'), x - 48, top, 96, 96);
          c.fillStyle = '#43564a';
          c.font = '13px sans-serif';
          c.textAlign = 'center';
          c.fillText(card.querySelector('span').textContent, x, top + 110);
        });
      }
      section(
        'Квадратные головы · 10 новых и исправленная тыква',
        [...Object.keys(SQUARE_HEAD_DESIGNS), 'pumpkin'].map((id) => `[data-head="${id}"]`),
        30,
        6,
      );

      section(
        'Отдельные рисунки и номера на форме',
        [...document.querySelectorAll('#team-print-gallery button')].map(
          (b) => `#team-print-gallery [data-jersey-print="${b.dataset.jerseyPrint}"]`,
        ),
        470,
        8,
      );
      section(
        'Обувь',
        [...document.querySelectorAll('#team-shoe-gallery button')].map(
          (b) => `#team-shoe-gallery [data-shoes="${b.dataset.shoes}"]`,
        ),
        770,
        7,
      );
      return canvas.toDataURL().split(',')[1];
    });
    await writeFile('.cache/customization-qa/catalogue.png', Buffer.from(sheet, 'base64'));
    for (const name of ['print', 'shoe'])
      await page
        .locator(`#team-${name}-gallery`)
        .screenshot({ path: `.cache/customization-qa/${name}-gallery.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#team-shoe-gallery').scrollIntoViewIfNeeded();
    assert.ok(
      await page.locator('#team-dialog').evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    );
    await page.screenshot({ path: '.cache/customization-qa/mobile.png' });
    assert.deepEqual(errors, []);
  },
);
