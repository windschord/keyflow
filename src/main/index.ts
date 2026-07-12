import { app, shell, BrowserWindow, ipcMain, dialog, session, Menu } from 'electron';
import { join, dirname, resolve } from 'path';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { SettingsService } from './settings';
import { PathAllowlist } from './path-allowlist';
import { LibraryService } from './library';
import {
  createReadBinaryFileHandler,
  createReadFileHandler,
  createReadFileIfExistsHandler,
  createRegisterDroppedFileHandler,
  createShowOpenDialogHandler,
} from './file-handlers';
import {
  createLibraryGetAllHandler,
  createLibraryOpenHandler,
  createLibraryRemoveHandler,
  createLibraryUpsertHandler,
} from './library-handlers';
import { createWindowOptions, APP_TITLE } from './window-options';
import { applyDockIcon } from './dock-icon';
import { createApplicationMenuTemplate } from './menu';
import { isAllowedExternalUrl, isAllowedNavigationUrl } from './navigation-policy';
import { resolveLanguage, type Language } from './locale';
import { createSettingsSetHandler } from './settings-handlers';

function createWindow(): void {
  // TASK-088: 実起動E2E（Playwright for Electron）実行時のみ環境変数KEYFLOW_E2E=1が
  // 渡される。preloadへ'--keyflow-e2e'引数を渡すことでE2E専用計装
  // （__e2eStore__/__e2eMidiHooks__）の公開可否を伝搬する（本番ビルドでは引数なし
  // ＝計装非公開）。sandboxを有効化した状態のpreloadでもprocess.argvは参照可能。
  const isE2E = process.env['KEYFLOW_E2E'] === '1';

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    ...createWindowOptions({ platform: process.platform, iconPath: icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      ...(isE2E ? { additionalArguments: ['--keyflow-e2e'] } : {}),
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // TASK-087: shell.openExternal に渡すURLをhttp/httpsのみへ制限する
  // （file:や任意のカスタムスキームがOSへ渡ることを防ぐ）。
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });

  // TASK-087: メインウィンドウ自体のトップレベルナビゲーション（location.href書き換え等）を
  // 開発時のHMR URLと本番のindex.html自己遷移のみへ制限する多層防御。
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationUrl(url, process.env['ELECTRON_RENDERER_URL'])) {
      event.preventDefault();
    }
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/**
 * アプリケーションメニューを指定言語で構築し設定する（TASK-099、REQ-016-004/005）。
 * 起動時と言語切り替え時（settings:setハンドラ経由）の双方から呼び出す。
 */
function buildAndSetApplicationMenu(language: Language): void {
  const applicationMenu = Menu.buildFromTemplate(
    createApplicationMenuTemplate({
      platform: process.platform,
      appTitle: APP_TITLE,
      language,
      onOpenAbout: () => {
        const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
        targetWindow?.webContents.send('menu:open-about');
      },
    })
  );
  Menu.setApplicationMenu(applicationMenu);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const pathAllowlist = new PathAllowlist();
  // settings系IPCハンドラ（settings:get 等）と同一インスタンスを共有するため、
  // file:show-open-dialog ハンドラ登録より前に生成する（TASK-039）。
  const settingsService = new SettingsService();
  // 楽譜ライブラリ（US-017、TASK-101）。設定とは別のelectron-storeインスタンス（DEC-010）。
  const libraryService = new LibraryService();

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

  // TASK-086: 読み取り3ハンドラはすべて PathAllowlist.assertAllowedReadPath を経由し、
  // ユーザーが開いたMusicXML本体・その注釈サイドカー以外の読み取りを拒否する
  // （書き込み側 file:write の allowlist と同様の非対称解消）。
  ipcMain.handle('file:read', createReadFileHandler(pathAllowlist, fs.promises));

  // アノテーションのサイドカーファイル（*.annotation.json）のように「存在しないのが
  // 正常」なファイル用。ENOENTはエラーではなくnullを返す（file:readをそのまま使うと
  // 初回オープンのたびにメインプロセスへ未処理エラーがログされるため。2026-07-05）。
  ipcMain.handle('file:read-if-exists', createReadFileIfExistsHandler(pathAllowlist, fs.promises));

  ipcMain.handle('file:read-binary', createReadBinaryFileHandler(pathAllowlist, fs.promises));

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
  // TASK-099: ui.languageの変更を検知したらメニューを再構築する（REQ-016-004）。
  ipcMain.handle(
    'settings:set',
    createSettingsSetHandler(settingsService, (newLanguageSetting) => {
      buildAndSetApplicationMenu(resolveLanguage(newLanguageSetting, app.getLocale()));
    })
  );
  ipcMain.handle('settings:get-recent-files', () => settingsService.getRecentFiles());

  // 楽譜ライブラリ（US-017、TASK-101）。library:openはfile:register-dropped-fileと
  // 同様の拡張子検証に加え、存在確認・allowlist登録・recent追加をfsモジュール経由で行う。
  ipcMain.handle('library:get-all', createLibraryGetAllHandler(libraryService));
  ipcMain.handle('library:upsert', createLibraryUpsertHandler(libraryService));
  ipcMain.handle('library:remove', createLibraryRemoveHandler(libraryService));
  ipcMain.handle(
    'library:open',
    createLibraryOpenHandler(pathAllowlist, settingsService, fs.promises)
  );

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // TASK-084: 装飾的な処理（Dockアイコン・メニュー）はウィンドウ生成とIPCハンドラ登録より
  // 後に呼ぶ。ここで例外が発生してもメインウィンドウの表示を道連れにせず起動を継続する構成とする
  // （詳細はdocs/sdd/troubleshooting/2026-07-08-packaged-no-window/analysis.md）。
  if (is.dev) {
    // TASK-080: 開発モードのみDockアイコンを独自アイコンへ差し替える
    // （パッケージ版はicon.icnsが自動適用されるため不要）。
    applyDockIcon({ platform: process.platform, dock: app.dock, iconPath: icon });
  }

  // TASK-082: アプリケーションメニューを設定する。カスタムメニューはElectronの
  // 既定メニュー（コピー/ペースト等の標準ロールを含む）を丸ごと置き換えるため、
  // createApplicationMenuTemplate内で標準ロールを再現している。
  // TASK-099: 起動時は保存済み言語設定（またはOSロケール解決）でメニューを構築する（REQ-016-005）。
  buildAndSetApplicationMenu(resolveLanguage(settingsService.get('ui').language, app.getLocale()));
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
