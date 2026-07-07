import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron';
import { join, dirname, resolve } from 'path';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { SettingsService } from './settings';
import { PathAllowlist } from './path-allowlist';
import { createRegisterDroppedFileHandler, createShowOpenDialogHandler } from './file-handlers';
import { createWindowOptions } from './window-options';

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    ...createWindowOptions({ platform: process.platform, iconPath: icon }),
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const pathAllowlist = new PathAllowlist();
  // settings系IPCハンドラ（settings:get 等）と同一インスタンスを共有するため、
  // file:show-open-dialog ハンドラ登録より前に生成する（TASK-039）。
  const settingsService = new SettingsService();

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  ipcMain.handle(
    'file:show-open-dialog',
    createShowOpenDialogHandler(dialog, pathAllowlist, settingsService)
  );

  // TASK-053: ドラッグ＆ドロップで開かれたファイルも file:write（アノテーション保存）の
  // allowlist に載せ、ファイル履歴（addRecentFile）に反映するための登録専用IPC。
  // 拡張子検証は createRegisterDroppedFileHandler 内で行う。
  ipcMain.handle(
    'file:register-dropped-file',
    createRegisterDroppedFileHandler(pathAllowlist, settingsService)
  );

  ipcMain.handle('file:read', async (_, path: string) => {
    const content = await fs.promises.readFile(path, 'utf-8');
    return content;
  });

  // アノテーションのサイドカーファイル（*.annotation.json）のように「存在しないのが
  // 正常」なファイル用。ENOENTはエラーではなくnullを返す（file:readをそのまま使うと
  // 初回オープンのたびにメインプロセスへ未処理エラーがログされるため。2026-07-05）。
  ipcMain.handle('file:read-if-exists', async (_, path: string) => {
    try {
      return await fs.promises.readFile(path, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  });

  ipcMain.handle('file:read-binary', async (_, path: string) => {
    const content = await fs.promises.readFile(path);
    // IPC経由でArrayBufferとして送るためにBufferをArrayBufferに変換
    return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
  });

  ipcMain.handle('file:write', async (_, path: string, content: string) => {
    const allowedPath = pathAllowlist.assertAllowedAnnotationPath(path);

    // Security: Verify that parent directory chain is not escaped via symlinks
    const parentDir = dirname(allowedPath);
    try {
      const realParentPath = await fs.promises.realpath(parentDir);
      const expectedParentPath = resolve(parentDir);
      if (realParentPath !== expectedParentPath) {
        throw new Error(
          `Refused to write: parent directory contains symlink that escapes allowed directory: ${path}`
        );
      }
    } catch (err) {
      // If parent directory doesn't exist yet, fail explicitly
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Parent directory does not exist: ${parentDir}`);
      }
      throw err;
    }

    // Security: Use atomic write pattern to prevent TOCTOU race
    // Write to temp file with 'wx' flag (exclusive create, fails if exists)
    // then rename into place after verifying target is not a symlink
    const tempSuffix = `.tmp-${randomBytes(8).toString('hex')}`;
    const tempPath = allowedPath + tempSuffix;
    let tempFileCreated = false;

    try {
      // Open temp file exclusively (wx = exclusive create, no symlink following)
      // Set tempFileCreated immediately after file is created, before writing content
      const fileHandle = await fs.promises.open(tempPath, 'wx');
      tempFileCreated = true;

      try {
        // Write content to the file handle
        await fileHandle.writeFile(content, { encoding: 'utf-8' });
      } finally {
        // Ensure file handle is closed even if write fails
        await fileHandle.close();
      }

      // Before renaming, verify target path is not a symlink
      try {
        const stats = await fs.promises.lstat(allowedPath);
        if (stats.isSymbolicLink()) {
          throw new Error(`Refused to write through symlink: ${path}`);
        }
        // Target exists and is not a symlink - safe to overwrite via rename
      } catch (err) {
        // ENOENT is expected for new files; other errors should propagate
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
        // Target does not exist - safe to rename
      }

      // Atomic rename into place
      await fs.promises.rename(tempPath, allowedPath);
      tempFileCreated = false; // Successfully renamed, no cleanup needed
    } finally {
      // Clean up temp file if it still exists (error case)
      if (tempFileCreated) {
        try {
          await fs.promises.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  createWindow();

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'midi' || permission === 'midiSysex') {
      callback(true);
    } else {
      callback(false);
    }
  });

  ipcMain.handle('settings:get', (_, key) => settingsService.get(key));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle('settings:set', (_, key, value) => settingsService.set(key, value as any));
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
