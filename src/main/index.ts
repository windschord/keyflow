import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { MidiControllerService } from './midi-controller';
import { IpcChannels } from './ipc-channels';

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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on(IpcChannels.PING, () => console.log('pong'));

  const allowedPaths = new Set<string>();

  ipcMain.handle(IpcChannels.FILE_SHOW_OPEN_DIALOG, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'MusicXML', extensions: ['xml', 'mxl', 'musicxml'] }],
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    allowedPaths.add(filePaths[0]);
    return filePaths[0];
  });

  ipcMain.handle(IpcChannels.FILE_READ, async (_, path: string) => {
    if (!allowedPaths.has(path)) throw new Error('Unauthorized file read access');
    const content = await fs.promises.readFile(path, 'utf-8');
    return content;
  });

  ipcMain.handle(IpcChannels.FILE_READ_BINARY, async (_, path: string) => {
    if (!allowedPaths.has(path)) throw new Error('Unauthorized file read access');
    const content = await fs.promises.readFile(path);
    // IPC経由でArrayBufferとして送るためにBufferをArrayBufferに変換
    return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
  });

  const win = createWindow();

  const midiController = new MidiControllerService(win);
  midiController.initialize();
  ipcMain.handle(IpcChannels.MIDI_GET_DEVICES, () => midiController.listDevices());
  ipcMain.on(IpcChannels.MIDI_SELECT_DEVICE, (_, index: unknown) => {
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0) {
      midiController.selectDevice(index);
    }
  });

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow();
      midiController.setWindow(newWin);
    }
  });

  app.on('before-quit', () => {
    midiController.dispose();
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
