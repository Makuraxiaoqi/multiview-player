const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { pathToFileURL } = require('node:url');

contextBridge.exposeInMainWorld('api', {
  isElectron: true,
  platform: process.platform,
  listDir: (target) => ipcRenderer.invoke('fs:list-dir', target),
  listImages: (folder, recursive) => ipcRenderer.invoke('fs:list-images', folder, recursive),
  stat: (target) => ipcRenderer.invoke('fs:stat', target),
  drives: () => ipcRenderer.invoke('fs:drives'),
  chooseFolder: () => ipcRenderer.invoke('dialog:folder'),
  chooseFiles: () => ipcRenderer.invoke('dialog:files'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  reveal: (target) => ipcRenderer.invoke('shell:reveal', target),
  fileUrl: (target) => {
    if (!target) return '';
    try {
      return pathToFileURL(target).href;
    } catch {
      return '';
    }
  },
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  }
});
