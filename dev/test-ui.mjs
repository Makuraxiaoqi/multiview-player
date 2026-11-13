import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
fs.mkdirSync(path.join(root, 'dev', 'shots'), { recursive: true });

const errors = [];
const app = await electron.launch({
  args: ['.'],
  cwd: root,
  env: { ...process.env, MV_TEST: '1' }
});

const page = await app.firstWindow();
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[renderer:${msg.type()}]`, text);
});
page.on('pageerror', (err) => {
  errors.push(err.message);
  console.log('[pageerror]', err.stack || err.message);
});

await page.waitForTimeout(1500);
console.log('title:', await page.title());
console.log('panes:', await page.locator('.pane').count());
console.log('presets:', await page.locator('.preset-btn').count());
console.log('file items:', await page.locator('.file-item').count());
console.log('status:', await page.locator('#statusCounts').textContent());
await page.screenshot({ path: path.join(root, 'dev', 'shots', '01-initial.png') });

await app.close();
console.log('errors:', errors.length ? errors : 'none');
