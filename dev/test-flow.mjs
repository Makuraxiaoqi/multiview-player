import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const shots = path.join(root, 'dev', 'shots');
fs.mkdirSync(shots, { recursive: true });

const stateFile = path.join(process.env.APPDATA || '', 'Multiview 多窗播放器', 'state.json');
if (fs.existsSync(stateFile)) fs.rmSync(stateFile);

const errors = [];
const app = await electron.launch({ args: ['.'], cwd: root, env: { ...process.env, MV_TEST: '1' } });
const page = await app.firstWindow();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[renderer:error]', msg.text());
});
page.on('pageerror', (err) => {
  errors.push(err.message);
  console.log('[pageerror]', err.stack || err.message);
});

const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(shots, `${name}.png`) });
  console.log('shot:', name);
};

const pauseAll = async () => {
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach((v) => v.pause());
  });
};

const clickPreset = async (id) => {
  await page.locator(`.preset-btn[data-preset="${id}"]`).click();
  await page.waitForTimeout(250);
};

const navUp = async () => {
  await page.locator('[data-nav="up"]').click();
  await page.waitForTimeout(450);
};

const openFolder = async (name) => {
  const row = page.locator('.file-item.folder').filter({ hasText: name }).first();
  await row.dblclick();
  await page.waitForTimeout(550);
};

const openFile = async (name) => {
  const row = page.locator('.file-item').filter({ hasText: name }).first();
  await row.dblclick();
  await page.waitForTimeout(900);
};

const activatePane = async (index) => {
  await page.locator(`.pane[data-index="${index}"]`).click({ position: { x: 260, y: 200 } });
  await page.waitForTimeout(150);
};

await page.waitForTimeout(1200);
await page.locator('.quick-item', { hasText: 'F:' }).first().click();
await page.waitForTimeout(500);
await openFolder('project');
await openFolder('video');
await openFolder('dev');
await openFolder('media');
await openFolder('images');
await shot('02-images-folder');

await openFile('frame-01.jpg');
await shot('03-one-image');

await activatePane(1);
await openFile('frame-02.jpg');

await activatePane(2);
await page.locator('#folderSlideshow').click();
await page.waitForTimeout(1200);

await navUp();
await openFolder('videos');
await activatePane(3);
await openFile('video-a.mp4');
await page.waitForTimeout(1000);

console.log('media state:', await page.evaluate(() => [...document.querySelectorAll('.pane')].map((p) => ({
  index: p.dataset.index,
  mode: p.dataset.mode,
  name: p.querySelector('.pane-name')?.textContent?.trim(),
  playing: p.classList.contains('is-playing')
}))));

await shot('04-quad-media');

// Master volume
await page.evaluate(() => {
  const el = document.getElementById('masterVolume');
  el.value = '35';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
console.log('master volume:', await page.locator('#masterVolLabel').textContent());

// Unified seek to 50%
await page.evaluate(() => {
  const el = document.getElementById('masterSeek');
  el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  el.value = '500';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(500);
console.log('video progress:', await page.evaluate(() => [...document.querySelectorAll('video')]
  .filter((v) => v.getAttribute('src'))
  .map((v) => ({ t: Number(v.currentTime.toFixed(2)), d: Number((v.duration || 0).toFixed(2)), paused: v.paused, volume: v.volume }))));

// Master slide speed fine tune
await page.evaluate(() => {
  const el = document.getElementById('slideSeconds');
  el.value = '1.2';
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.locator('#slidePlus').click();
console.log('slide speed:', await page.locator('#slideSeconds').inputValue());

// open pane settings for slideshow pane
await activatePane(2);
await page.locator('.pane[data-index="2"] [data-act="settings"]').click();
await page.waitForTimeout(300);
await shot('05-slideshow-settings');
await page.keyboard.press('Escape');

// six-up layout + load extra panes
await clickPreset('six');
await activatePane(4);
await page.locator('[data-nav="up"]').click();
await page.waitForTimeout(400);
await openFile('video-b.mp4');
await activatePane(5);
await openFile('video-c.mp4');
await page.waitForTimeout(900);
await shot('06-six-media');

// fullscreen active pane
await page.locator('.pane[data-index="5"]').dblclick({ position: { x: 300, y: 200 } });
await page.waitForTimeout(500);
await shot('07-fullscreen');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// nine layout (empty trailing panes)
await clickPreset('nine');
await shot('08-nine');

// help popover
await page.locator('#helpBtn').click();
await page.waitForTimeout(250);
await shot('09-help');
await page.keyboard.press('Escape');

await pauseAll();
console.log('errors:', errors.length ? errors : 'none');
console.log('status:', await page.locator('#statusCounts').textContent());
await app.close();
