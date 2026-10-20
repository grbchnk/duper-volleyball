export async function openSettingsSection(page, label) {
  if (!(await page.locator('dialog[open]').count())) await page.locator('#settings-button').click();
  const dialog = page.locator('dialog[open]');
  if (await dialog.locator('.settings-section-select').isVisible()) {
    await dialog.locator('.settings-section-select').selectOption({ label });
  } else await dialog.locator('.settings-nav').getByText(label, { exact: true }).click();
}

export async function settleSettings(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

export async function openBrowserGame(t, viewport = { width: 1440, height: 1000 }) {
  const { spawn } = await import('node:child_process');
  const { chromium } = await import('playwright');
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, PORT: '0' },
    windowsHide: true,
  });
  t.after(() => server.kill());
  const base = await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.stdout.on('data', (data) => {
      const url = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) resolve(url);
    });
  });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport });
  await page.goto(base);
  await page.waitForSelector('#club-sidebar');
  return { browser, page, base };
}
