import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import HubManager from './hubManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hubManager = new HubManager(app);
let discoveredHub = null;

let mainWindow;
let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.on('closed', () => (splashWindow = null));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    title: "Lorapok LocalSync",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, use absolute path from app root
    const indexPath = path.join(app.getAppPath(), 'dist/index.html');
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load production index:', err);
    });
  }

  // Once ready-to-show, close splash and show main
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => (mainWindow = null));
}

// IPC Handlers
import { ipcMain } from 'electron';
import * as os from 'os';

ipcMain.handle('get-hostname', () => {
  return os.hostname();
});

ipcMain.handle('get-hub-ip', () => {
  return discoveredHub ? discoveredHub.ip : null;
});

app.whenReady().then(async () => {
  createSplashWindow();
  
  // Try to find an existing Hub on the network
  console.log('Searching for Hub...');
  discoveredHub = await hubManager.discoverHub();
  
  if (!discoveredHub) {
    console.log('No Hub found, starting internal Hub...');
    hubManager.startInternalHub();
    discoveredHub = { ip: '127.0.0.1', port: 4000 };
  } else {
    console.log(`Found existing Hub at ${discoveredHub.ip}`);
  }

  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  hubManager.stop();
  if (process.platform !== 'darwin') app.quit();
});
