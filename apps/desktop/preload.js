const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mrqDesktop', {
  platform: process.platform,
  arch: process.arch,
  isElectron: true,
  showEngineLog: () => ipcRenderer.invoke('mrq:show-engine-log'),
});
