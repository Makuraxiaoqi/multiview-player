import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const shots = path.join(root, 'dev', 'shots');
const stateFile = path.join(process.env.APPDATA || '', 'Multiview 多窗播放器', 'state.json');
if (fs.existsSync(stateFile)) fs.rmSync(stateFile);

const errors = [];
const app = await electron.launch({ args: ['.'], cwd: root, env: { ...process.env, MV_TEST: '1' } });
const page = await app.firstWindow();
page.on('pageerror', (err) => errors.push(err.message));
await page.waitForTimeout(1200);

const openFolder = async (name) => {
  await page.locator('.file-item.folder').filter({ hasText: name }).first().dblclick();
  await page.waitForTimeout(500);
};

await page.locator('.quick-item', { hasText: 'F:' }).first().click();
await page.waitForTimeout(400);
for (const name of ['project', 'video', 'dev', 'media', 'images']) await openFolder(name);

await page.locator('.pane[data-index="0"]').click({ position: { x: 240, y: 180 } });
await page.locator('#folderSlideshow').click();
await page.waitForTimeout(1400);

const shuffleBtn = page.locator('.pane[data-index="0"] .pane-shuffle');
console.log('shuffle visible:', await shuffleBtn.isVisible());
console.log('initial active:', await shuffleBtn.evaluate((el) => el.classList.contains('is-active')), 'title:', await shuffleBtn.getAttribute('title'));

await shuffleBtn.click();
await page.waitForTimeout(500);
console.log('after click active:', await shuffleBtn.evaluate((el) => el.classList.contains('is-active')), 'title:', await shuffleBtn.getAttribute('title'));
console.log('pane time:', await page.locator('.pane[data-index="0"] .pane-time').textContent());
await page.screenshot({ path: path.join(shots, '14-shuffle-on.png') });

await page.locator('.pane[data-index="0"] [data-act="settings"]').click();
await page.waitForTimeout(300);
console.log('order segment:', await page.evaluate(() => [...document.querySelectorAll('[data-order]')].map((b) => ({ order: b.dataset.order, active: b.classList.contains('active') }))));
await page.screenshot({ path: path.join(shots, '15-order-setting.png') });

await page.locator('[data-order="sequence"]').click();
await page.waitForTimeout(700);
console.log('after sequence active:', await shuffleBtn.evaluate((el) => el.classList.contains('is-active')));
console.log('order segment:', await page.evaluate(() => [...document.querySelectorAll('[data-order]')].map((b) => ({ order: b.dataset.order, active: b.classList.contains('active') }))));

await page.locator('[data-order="random"]').click();
await page.waitForTimeout(800);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
console.log('saved shuffle:', saved.panes[0].slideshow.shuffle, 'layout:', saved.layout);
console.log('errors:', errors.length ? errors : 'none');
await app.close();
