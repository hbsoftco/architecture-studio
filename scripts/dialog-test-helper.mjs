export async function createDiagram(page, id, name) {
  await page.locator('#new-document').click();
  await page.locator('dialog.catalog-dialog[open]').waitFor();
  await page.locator(`[data-catalog-id="${id}"]`).click();
  await page.locator('#catalog-name').fill(name);
  await page.locator('.catalog-dialog .studio-dialog-submit').click();
  await page.locator('.doc-tab.active').filter({ hasText: name }).waitFor({ timeout: 30000 });
}

export async function submitDialogInput(page, value) {
  const dialog = page.locator('dialog.studio-dialog[open]');
  await dialog.waitFor();
  const element = await dialog.elementHandle();
  await dialog.locator('input:not([type="search"]), textarea').first().fill(value);
  await dialog.locator('.studio-dialog-submit').click();
  await page.waitForFunction(node => !node.isConnected, element);
}

export async function chooseDialogOption(page, value) {
  const dialog = page.locator('dialog.studio-dialog[open]');
  await dialog.waitFor();
  const element = await dialog.elementHandle();
  await dialog.locator('select').selectOption(value);
  await dialog.locator('.studio-dialog-submit').click();
  await page.waitForFunction(node => !node.isConnected, element);
}
