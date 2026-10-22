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
// Follow the same tabs, disclosure buttons and popovers as a settings user.
export async function revealSettingsControl(page, selector) {
  const target = page.locator(selector).first();
  const context = await target.evaluate((el) => {
    const popup = el.closest('[popover]');
    const group = el.closest('.flat-settings');
    return {
      popup: popup?.id,
      color: el.closest('[data-color-part]')?.dataset.colorPart,
      section: el.dataset.section,
      group: group?.querySelector('h3')?.textContent,
      groupParent: group?.parentElement.id,
      details: [
        ...(function* () {
          for (let p = el.parentElement; p; p = p.parentElement)
            if (p.tagName === 'DETAILS' && el.tagName !== 'SUMMARY') yield p;
        })(),
      ].map((el) => [...document.querySelectorAll('details')].indexOf(el)),
    };
  });
  const openPopup = page.locator('[popover]:popover-open');
  if ((await openPopup.count()) && (await openPopup.first().getAttribute('id')) !== context.popup)
    await page.keyboard.press('Escape');
  if (context.group && context.groupParent) {
    const button = page
      .locator('#' + context.groupParent + ' .settings-group-tabs')
      .getByRole('button', { name: context.group, exact: true });
    if (await button.count()) await button.click();
  }
  if (context.section)
    await page.locator('#contact-tabs [data-section="' + context.section + '"]').click();
  for (const index of context.details.reverse()) {
    const details = page.locator('details').nth(index);
    if ((await details.count()) && (await details.first().getAttribute('open')) === null)
      await details.first().locator('summary').first().click();
  }
  if (context.popup) {
    if (!(await page.locator('#' + context.popup).evaluate((el) => el.matches(':popover-open'))))
      await page
        .locator('[popovertarget="' + context.popup + '"]')
        .first()
        .click();
    if (context.color) await page.locator('#team-color-part').selectOption(context.color);
  }
}
