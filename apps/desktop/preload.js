const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('mrqDesktop', {
  platform: process.platform,
  arch: process.arch,
  isElectron: true,
});
