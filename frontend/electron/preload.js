const { contextBridge } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('electronAPI', {
  getHostname: () => os.hostname(),
  platform: process.platform
});
