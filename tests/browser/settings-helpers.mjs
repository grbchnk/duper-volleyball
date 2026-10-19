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
