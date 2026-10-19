import { openSettingsSection, settleSettings } from './settings-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

test(
  'teams: ten presets, individual appearance, pastel swatches, stable random uniforms and persistence',
  { timeout: 60000 },
  async (t) => {
    const server = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('../../', import.meta.url),
      env: { ...process.env, PORT: '0' },
      windowsHide: true,
    });
    t.after(() => server.kill());
    const base = await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.stdout.on('data', (d) => {
        const url = d.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
        if (url) resolve(url);
      });
    });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.locator('#team-quick').click();
    await settleSettings(page);
    assert.equal(await page.locator('.team-preset').count(), 10);
    await page.locator('.team-presets summary').click();
    await settleSettings(page);
    await mkdir('.cache/teams', { recursive: true });
    const gallery = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1200;
      c.height = 660;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fffdf5';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      for (const [i, card] of [...document.querySelectorAll('.team-preset')].entries()) {
        const x = (i % 4) * 300,
          y = Math.floor(i / 4) * 220;
        ctx.drawImage(card.querySelector('canvas'), x + 10, y + 10, 280, 156);
        ctx.fillStyle = '#43564a';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(card.querySelector('strong').textContent, x + 10, y + 190);
      }
      return c.toDataURL().split(',')[1];
    });
    await writeFile('.cache/teams/roster-gallery.png', Buffer.from(gallery, 'base64'));
    assert.equal(await page.locator('input[type="color"]').count(), 0);
    const stored = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('duper-volleyball.dynamic-v3.config')).config,
      );
    await page.locator('[data-team="sakura"]').click();
    await settleSettings(page);
    for (const [slot, head] of [
      ['0', 'ponytail'],
      ['1', 'bun'],
      ['2', 'doublebun'],
    ]) {
      await page.locator(`[data-player="${slot}"]`).click();
      await settleSettings(page);
      assert.equal(
        await page.locator('.head-choice[aria-pressed="true"]').getAttribute('data-head'),
        head,
      );
    }
    await page.locator('[data-team="nigeria"]').click();
    await settleSettings(page);
    assert.equal((await stored()).homeTeam, 'nigeria');
    assert.equal(
      await page.locator('.head-choice[aria-pressed="true"]').getAttribute('data-head'),
      'dreads',
    );
    await page.locator('[data-team="pumpkins"]').click();
    await settleSettings(page);
    await page.locator('#team-uniform-colors [data-color="#b0a2cb"]').click();
    await settleSettings(page);
    await page.locator('[data-player="0"]').click();
    await settleSettings(page);
    await page.locator('[data-head="bear"]').click();
    await settleSettings(page);
    await page.locator('#team-body').selectOption('longsleeve');
    await settleSettings(page);
    await page.locator('#team-hair-colors [data-color="#a76a3e"]').click();
    await settleSettings(page);
    let config = await stored();
    assert.equal(config.teamPlayers[0].head, 'bear');
    assert.equal(config.teamPlayers[1].head, 'pumpkin');
    assert.equal(config.homeColor, '#b0a2cb');
    const before = await page.locator('#team-roster-preview').evaluate((c) => c.toDataURL());
    await page.locator('#team-random-appearance').check();
    await settleSettings(page);
    assert.equal(await page.locator('.head-choice').first().isDisabled(), true);
    assert.equal((await stored()).homeColor, '#b0a2cb');
    await page.locator('#team-reroll').click();
    await settleSettings(page);
    assert.equal((await stored()).homeColor, '#b0a2cb');
    await page.locator('#team-random-appearance').uncheck();
    await settleSettings(page);
    assert.equal(
      await page.locator('.head-choice[aria-pressed="true"]').getAttribute('data-head'),
      'bear',
    );
    assert.equal(await page.locator('#team-roster-preview').evaluate((c) => c.toDataURL()), before);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('#team-quick').click();
    await settleSettings(page);
    assert.equal(
      await page.locator('.head-choice[aria-pressed="true"]').getAttribute('data-head'),
      'bear',
    );
    assert.equal((await stored()).homeColor, '#b0a2cb');
    await mkdir('.cache/teams', { recursive: true });
    await page.screenshot({ path: '.cache/teams/editor-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#team-body').scrollIntoViewIfNeeded();
    assert.ok(
      await page.locator('#team-dialog').evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    );
    const control = await page.locator('#team-body').boundingBox();
    assert.ok(control.y >= 0 && control.y + control.height < 844);
    assert.equal(
      await page.locator('.team-preview').evaluate((p) => getComputedStyle(p).position),
      'static',
    );
    await page.screenshot({ path: '.cache/teams/editor-mobile.png' });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openSettingsSection(page, 'Матч и управление');
    await page.locator('#away-team').selectOption('robots');
    await settleSettings(page);
    assert.equal((await stored()).awayTeam, 'robots');
    assert.equal((await stored()).awayColor, '#a6accb');
    assert.deepEqual(errors, []);
  },
);
