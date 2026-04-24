const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getHostname: () => ipcRenderer.invoke('get-hostname'),
  getHubIp: () => ipcRenderer.invoke('get-hub-ip'),
  platform: process.platform
});
