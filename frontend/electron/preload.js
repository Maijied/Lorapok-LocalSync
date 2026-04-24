const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // You can expose ipcRenderer methods here if needed in the future
});
