const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');

const IMAGE_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.svg', '.ico'
]);
const VIDEO_EXT = new Set([
  '.mp4', '.m4v', '.webm', '.ogv', '.ogg', '.mov', '.mkv'
]);
const MEDIA_EXT = new Set([...IMAGE_EXT, ...VIDEO_EXT]);

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (process.env.MV_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', String(process.env.MV_DEBUG_PORT));
}

let mainWindow = null;
let saveChain = Promise.resolve();

function statePath() {
  return path.join(app.getPath('userData'), 'state.json');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1060,
    minHeight: 660,
    backgroundColor: '#0a0c10',
    title: 'Multiview 多窗播放器',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function mediaKind(name) {
  const ext = path.extname(name).toLowerCase();
  if (IMAGE_EXT.has(ext)) return 'image';
  if (VIDEO_EXT.has(ext)) return 'video';
  return null;
}

function safeResolve(target) {
  if (typeof target !== 'string' || !target.trim()) throw new Error('无效路径');
  return path.resolve(target);
}

async function statSafe(target) {
  try {
    const st = await fs.stat(target);
    return { exists: true, isDir: st.isDirectory(), size: st.size, mtime: st.mtimeMs };
  } catch {
    return { exists: false, isDir: false, size: 0, mtime: 0 };
  }
}

async function listDir(target) {
  const dir = safeResolve(target);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'System Volume Information' || entry.name === '$RECYCLE.BIN') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push({ name: entry.name, path: full, isDir: true, kind: 'folder' });
    } else if (entry.isFile()) {
      const kind = mediaKind(entry.name);
      if (!kind) continue;
      const st = await statSafe(full);
      files.push({
        name: entry.name,
        path: full,
        isDir: false,
        kind,
        ext: path.extname(entry.name).toLowerCase(),
        size: st.size,
        mtime: st.mtime
      });
    }
  }

  dirs.sort((a, b) => collator.compare(a.name, b.name));
  files.sort((a, b) => collator.compare(a.name, b.name));

  const parent = path.dirname(dir);
  return {
    dir,
    name: path.basename(dir) || dir,
    parent: parent === dir ? null : parent,
    dirs,
    files,
    imageCount: files.filter((f) => f.kind === 'image').length,
    videoCount: files.filter((f) => f.kind === 'video').length
  };
}

async function collectImages(folder, recursive, limit = 4000) {
  const root = safeResolve(folder);
  const results = [];
  const stack = [{ dir: root, rel: '' }];

  while (stack.length && results.length < limit) {
    const { dir, rel } = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const subdirs = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('$')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) subdirs.push({ dir: full, rel: path.join(rel, entry.name) });
      } else if (entry.isFile() && IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) {
        results.push({ name: entry.name, path: full, rel: path.join(rel, entry.name) });
      }
    }
    subdirs.sort((a, b) => collator.compare(a.rel, b.rel));
    for (let i = subdirs.length - 1; i >= 0; i--) stack.push(subdirs[i]);
  }

  results.sort((a, b) => collator.compare(a.rel, b.rel));
  return { folder: root, images: results, truncated: results.length >= limit };
}

async function getDrives() {
  const drives = [];
  const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  await Promise.all(letters.map(async (letter) => {
    const root = `${letter}:\\`;
    try {
      await fs.access(root);
      drives.push({ name: `${letter}:`, path: root });
    } catch {
      /* not available */
    }
  }));
  drives.sort((a, b) => a.name.localeCompare(b.name));
  return drives;
}

async function getQuickPlaces() {
  const home = os.homedir();
  const candidates = [
    { name: '主目录', path: home, icon: 'home' },
    { name: '桌面', path: path.join(home, 'Desktop'), icon: 'desktop' },
    { name: '图片', path: path.join(home, 'Pictures'), icon: 'image' },
    { name: '视频', path: path.join(home, 'Videos'), icon: 'film' },
    { name: '下载', path: path.join(home, 'Downloads'), icon: 'download' }
  ];
  const places = [];
  for (const item of candidates) {
    const st = await statSafe(item.path);
    if (st.exists && st.isDir) places.push({ ...item, isDir: true });
  }
  return { home, places };
}

function registerIpc() {
  ipcMain.handle('fs:list-dir', (_event, target) => listDir(target));
  ipcMain.handle('fs:list-images', (_event, folder, recursive) => collectImages(folder, !!recursive));
  ipcMain.handle('fs:stat', (_event, target) => statSafe(target));
  ipcMain.handle('fs:drives', async () => {
    const [drives, quick] = await Promise.all([getDrives(), getQuickPlaces()]);
    return { drives, ...quick };
  });

  ipcMain.handle('dialog:folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择图片文件夹',
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择图片或视频',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '图片与视频', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico', 'mp4', 'm4v', 'webm', 'ogv', 'ogg', 'mov', 'mkv'] },
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico'] },
        { name: '视频', extensions: ['mp4', 'm4v', 'webm', 'ogv', 'ogg', 'mov', 'mkv'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('state:load', async () => {
    try {
      const raw = await fs.readFile(statePath(), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  ipcMain.handle('state:save', async (_event, state) => {
    const json = JSON.stringify(state, null, 2);
    saveChain = saveChain.then(async () => {
      const file = statePath();
      const temp = `${file}.tmp`;
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(temp, json, 'utf8');
      await fs.rename(temp, file);
    }).catch((error) => {
      console.error('保存设置失败', error);
    });
    return saveChain.then(() => true);
  });

  ipcMain.handle('shell:reveal', (_event, target) => {
    if (typeof target === 'string' && target) shell.showItemInFolder(target);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.makura.multiview');
    Menu.setApplicationMenu(null);
    registerIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
