import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const shots = path.join(root, 'dev', 'shots');
fs.mkdirSync(shots, { recursive: true });

const stateFile = path.join(process.env.APPDATA || '', 'Multiview 多窗播放器', 'state.json');
if (fs.existsSync(stateFile)) fs.rmSync(stateFile);

const errors = [];
const launch = async () => {
  const app = await electron.launch({ args: ['.'], cwd: root, env: { ...process.env, MV_TEST: '1' } });
  const page = await app.firstWindow();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[renderer:error]', msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
    console.log('[pageerror]', err.stack || err.message);
  });
  await page.waitForTimeout(1200);
  return { app, page };
};

const shot = async (page, name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(shots, `${name}.png`) });
  console.log('shot:', name);
};

const openFolder = async (page, name) => {
  const row = page.locator('.file-item.folder').filter({ hasText: name }).first();
  await row.dblclick();
  await page.waitForTimeout(500);
};

const openFile = async (page, name) => {
  const row = page.locator('.file-item').filter({ hasText: name }).first();
  await row.dblclick();
  await page.waitForTimeout(900);
};

const activatePane = async (page, index) => {
  await page.locator(`.pane[data-index="${index}"]`).click({ position: { x: 240, y: 180 } });
  await page.waitForTimeout(150);
};

const navUp = async (page) => {
  await page.locator('[data-nav="up"]').click();
  await page.waitForTimeout(450);
};

const navTo = async (page, ...names) => {
  await page.locator('.quick-item', { hasText: 'F:' }).first().click();
  await page.waitForTimeout(450);
  for (const name of names) await openFolder(page, name);
};

const paneStates = (page) => page.evaluate(() => [...document.querySelectorAll('.pane')].map((p) => ({
  index: p.dataset.index,
  mode: p.dataset.mode,
  name: p.querySelector('.pane-name')?.textContent?.trim(),
  time: p.querySelector('.pane-time')?.textContent?.trim(),
  playing: p.classList.contains('is-playing')
})));

const { app, page } = await launch();

await navTo(page, 'project', 'video', 'dev', 'media');
const rows = await page.evaluate(() => [...document.querySelectorAll('.file-item')].map((el) => {
  const rect = el.getBoundingClientRect();
  return { text: el.textContent.trim().slice(0, 24), cls: el.className, w: Math.round(rect.width), h: Math.round(rect.height) };
}));
console.log('browser rows:', rows);
if (rows.some((row) => row.w > 900 || row.h > 200)) {
  console.log('!! file row sizing is broken');
}

// Pane 0: image
await openFolder(page, 'images');
await openFile(page, 'frame-01.jpg');

// Pane 2: slideshow of the same folder
await activatePane(page, 2);
await page.locator('#folderSlideshow').click();
await page.waitForTimeout(1300);

// Pane 1: video
await navUp(page);
await openFolder(page, 'videos');
await activatePane(page, 1);
await openFile(page, 'video-a.mp4');
await page.waitForTimeout(900);

console.log('initial panes:', await paneStates(page));
console.log('videos:', await page.evaluate(() => [...document.querySelectorAll('video')]
  .filter((v) => v.getAttribute('src'))
  .map((v) => ({ d: Number((v.duration || 0).toFixed(2)), paused: v.paused, volume: Number(v.volume.toFixed(2)) }))));

// Master volume + speed
await page.evaluate(() => {
  const el = document.getElementById('masterVolume');
  el.value = '35';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.evaluate(() => {
  const el = document.getElementById('slideSeconds');
  el.value = '1.2';
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
console.log('master volume:', await page.locator('#masterVolLabel').textContent(), 'speed:', await page.locator('#slideSeconds').inputValue());

// Save workspace preset
await page.locator('#workspacePresetBtn').click();
await page.waitForTimeout(300);
await page.locator('[data-role="wsName"]').fill('测试工作区');
await page.locator('[data-action="ws-save"]').click();
await page.waitForTimeout(400);
console.log('badge:', await page.locator('#workspacePresetBtn .ws-count').textContent());
console.log('preset items:', await page.locator('.ws-item').count());
await shot(page, '10-workspace-saved');

// Switch layout and clear visible panes
await page.keyboard.press('Escape');
await page.locator('.preset-btn[data-preset="six"]').click();
await page.waitForTimeout(400);
for (const index of [0, 1, 2]) {
  await page.locator(`.pane[data-index="${index}"] [data-act="close"]`).click();
  await page.waitForTimeout(200);
}
console.log('cleared panes:', await paneStates(page));

// Load preset back
await page.locator('#workspacePresetBtn').click();
await page.waitForTimeout(300);
await page.locator('.ws-item [data-action="ws-load"]').first().click();
await page.waitForTimeout(2600);
console.log('layout after load:', await page.evaluate(() => document.getElementById('grid').style.gridTemplateAreas));
console.log('panes after load:', await paneStates(page));
console.log('videos after load:', await page.evaluate(() => [...document.querySelectorAll('video')]
  .filter((v) => v.getAttribute('src'))
  .map((v) => ({ t: Number(v.currentTime.toFixed(2)), d: Number((v.duration || 0).toFixed(2)), paused: v.paused, volume: Number(v.volume.toFixed(2)) }))));
console.log('master after load:', await page.locator('#masterVolLabel').textContent(), await page.locator('#slideSeconds').inputValue());
await shot(page, '11-workspace-loaded');

// Relaunch: preset must persist
await app.close();
const second = await launch();
await second.page.waitForTimeout(800);
console.log('badge after relaunch:', await second.page.locator('#workspacePresetBtn .ws-count').textContent());
await second.page.locator('#workspacePresetBtn').click();
await second.page.waitForTimeout(300);
await shot(second.page, '12-workspace-relaunch');
const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
console.log('saved presets:', saved.workspacePresets?.map((p) => ({ name: p.name, layout: p.layout, panes: p.panes.length })));

console.log('errors:', errors.length ? errors : 'none');
await second.app.close();
