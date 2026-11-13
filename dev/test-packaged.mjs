import { _electron as electron } from 'playwright-core';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const exe = path.join(root, 'dist', 'Multiview-win32-x64', 'Multiview.exe');

const errors = [];
const app = await electron.launch({ executablePath: exe, args: [], env: { ...process.env } });
const page = await app.firstWindow();
page.on('pageerror', (err) => errors.push(err.message));
await page.waitForTimeout(1800);
console.log('title:', await page.title());
console.log('status:', await page.locator('#statusCounts').textContent());
console.log('workspace badge:', await page.locator('#workspacePresetBtn .ws-count').textContent().catch(() => 'none'));
console.log('layout:', await page.evaluate(() => document.getElementById('grid').style.gridTemplateAreas));
await page.screenshot({ path: path.join(root, 'dev', 'shots', '13-packaged.png') });
console.log('errors:', errors.length ? errors : 'none');
await app.close();
