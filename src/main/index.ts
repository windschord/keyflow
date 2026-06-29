import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { AppSettings, isSettingsKey, SettingsService, validateSettingsValue } from './settings';
import { PathAllowlist } from './path-allowlist';

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

function isTrustedAppOrigin(pageUrl: string): boolean {
  const parsedUrl = new URL(pageUrl);
  if (parsedUrl.protocol === 'file:') return true;
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return parsedUrl.origin === new URL(process.env['ELECTRON_RENDERER_URL']).origin;
  }
  return false;
}

function isTrustedAppUrl(pageUrl: string): boolean {
  try {
    return isTrustedAppOrigin(pageUrl);
  } catch {
    return false;
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const pathAllowlist = new PathAllowlist();

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  ipcMain.handle('file:show-open-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'MusicXML', extensions: ['xml', 'mxl', 'musicxml'] }],
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    pathAllowlist.allowMusicXml(filePaths[0]);
    return filePaths[0];
  });

  ipcMain.handle('file:read', async (_, path: string) => {
    const content = await fs.promises.readFile(path, 'utf-8');
    return content;
  });

  ipcMain.handle('file:read-binary', async (_, path: string) => {
    const content = await fs.promises.readFile(path);
    // IPC経由でArrayBufferとして送るためにBufferをArrayBufferに変換
    return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
  });

  ipcMain.handle('file:write', async (_, path: string, content: string) => {
    const allowedPath = pathAllowlist.assertAllowedAnnotationPath(path);
    await fs.promises.writeFile(allowedPath, content, 'utf-8');
  });

  createWindow();

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'midi' && isTrustedAppUrl(webContents.getURL())) {
      callback(true);
    } else {
      callback(false);
    }
  });

  const settingsService = new SettingsService();
  ipcMain.handle('settings:get', (_, key: unknown) => {
    if (!isSettingsKey(key)) {
      throw new Error(`Invalid settings key: ${String(key)}`);
    }
    return settingsService.get(key);
  });
  ipcMain.handle('settings:set', (_, key: unknown, value: unknown) => {
    if (!isSettingsKey(key)) {
      throw new Error(`Invalid settings key: ${String(key)}`);
    }
    const validated = validateSettingsValue(key, value);
    settingsService.set(key, validated as AppSettings[typeof key]);
  });
  ipcMain.handle('settings:get-recent-files', () => settingsService.getRecentFiles());

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
