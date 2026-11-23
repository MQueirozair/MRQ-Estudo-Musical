const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mrq', {
  isDesktop: true,
  platform: process.platform,
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    remove: (key) => ipcRenderer.invoke('store:remove', key),
  },
  appInfo: () => ipcRenderer.invoke('app:info'),
  setTheme: (theme) => ipcRenderer.invoke('app:setTheme', theme),
  onDataImported: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('dados:importados', handler);
    return () => ipcRenderer.removeListener('dados:importados', handler);
  },
});
