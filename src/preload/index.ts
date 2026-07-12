import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// TASK-088: main側がKEYFLOW_E2E=1のときのみ webPreferences.additionalArguments に
// '--keyflow-e2e' を追加する（src/main/index.ts参照）。sandboxを有効化した状態の
// preloadでも process.argv は参照可能なため、この引数の有無でE2E実行時のみを判定する。
const isE2E = process.argv.includes('--keyflow-e2e');

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
  } catch (error) {
    console.error('[preload] Failed to expose electron:', error);
  }

  try {
    contextBridge.exposeInMainWorld('electronAPI', {
      file: {
        showOpenDialog: (): Promise<string | null> => ipcRenderer.invoke('file:show-open-dialog'),
        read: (path: string): Promise<string> => ipcRenderer.invoke('file:read', path),
        readIfExists: (path: string): Promise<string | null> =>
          ipcRenderer.invoke('file:read-if-exists', path),
        readBinary: (path: string): Promise<ArrayBuffer> =>
          ipcRenderer.invoke('file:read-binary', path),
        write: (path: string, content: string): Promise<void> =>
          ipcRenderer.invoke('file:write', path, content),
        // TASK-053: contextIsolation下ではドロップされたFile.pathが使えないため、
        // webUtils.getPathForFile経由で絶対パスを取得する。
        getDroppedFilePath: (file: File): string => webUtils.getPathForFile(file),
        registerDroppedFile: (path: string): Promise<boolean> =>
          ipcRenderer.invoke('file:register-dropped-file', path),
      },
      settings: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: (key: string): Promise<any> => ipcRenderer.invoke('settings:get', key),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set: (key: string, value: any): Promise<void> =>
          ipcRenderer.invoke('settings:set', key, value),
        getRecentFiles: (): Promise<Array<{ path: string; openedAt: string }>> =>
          ipcRenderer.invoke('settings:get-recent-files'),
      },
      // TASK-101: 楽譜ライブラリ（US-017）関連のAPI。
      library: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getAll: (): Promise<any> => ipcRenderer.invoke('library:get-all'),
        upsert: (input: { path: string; title: string; composer: string }): Promise<void> =>
          ipcRenderer.invoke('library:upsert', input),
        remove: (path: string): Promise<void> => ipcRenderer.invoke('library:remove', path),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        open: (path: string): Promise<any> => ipcRenderer.invoke('library:open', path),
      },
      // TASK-082: アプリケーションメニューの「About」項目クリック（Main→Renderer）を購読するAPI。
      // renderer→mainへの送信機能は持たない受信専用の購読APIである。
      menu: {
        onOpenAbout: (callback: () => void): (() => void) => {
          const handler = (): void => callback();
          ipcRenderer.on('menu:open-about', handler);
          return () => ipcRenderer.removeListener('menu:open-about', handler);
        },
      },
      // TASK-088: 実起動E2E専用計装（__e2eStore__/__e2eMidiHooks__）の公開可否を
      // rendererが判定するためのフラグ。
      isE2E,
    });
  } catch (error) {
    console.error('[preload] Failed to expose electronAPI:', error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.electronAPI = {
    file: {
      showOpenDialog: (): Promise<string | null> => ipcRenderer.invoke('file:show-open-dialog'),
      read: (path: string): Promise<string> => ipcRenderer.invoke('file:read', path),
      readIfExists: (path: string): Promise<string | null> =>
        ipcRenderer.invoke('file:read-if-exists', path),
      readBinary: (path: string): Promise<ArrayBuffer> =>
        ipcRenderer.invoke('file:read-binary', path),
      write: (path: string, content: string): Promise<void> =>
        ipcRenderer.invoke('file:write', path, content),
      getDroppedFilePath: (file: File): string => webUtils.getPathForFile(file),
      registerDroppedFile: (path: string): Promise<boolean> =>
        ipcRenderer.invoke('file:register-dropped-file', path),
    },
    settings: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get: (key: string): Promise<any> => ipcRenderer.invoke('settings:get', key),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: (key: string, value: any): Promise<void> =>
        ipcRenderer.invoke('settings:set', key, value),
      getRecentFiles: (): Promise<Array<{ path: string; openedAt: string }>> =>
        ipcRenderer.invoke('settings:get-recent-files'),
    },
    // TASK-101: 楽譜ライブラリ（US-017）関連のAPI。
    library: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getAll: (): Promise<any> => ipcRenderer.invoke('library:get-all'),
      upsert: (input: { path: string; title: string; composer: string }): Promise<void> =>
        ipcRenderer.invoke('library:upsert', input),
      remove: (path: string): Promise<void> => ipcRenderer.invoke('library:remove', path),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      open: (path: string): Promise<any> => ipcRenderer.invoke('library:open', path),
    },
    // renderer→mainへの送信機能は持たない受信専用の購読API（TASK-082）。
    menu: {
      onOpenAbout: (callback: () => void): (() => void) => {
        const handler = (): void => callback();
        ipcRenderer.on('menu:open-about', handler);
        return () => ipcRenderer.removeListener('menu:open-about', handler);
      },
    },
    // TASK-088: 実起動E2E専用計装（__e2eStore__/__e2eMidiHooks__）の公開可否を
    // rendererが判定するためのフラグ。
    isE2E,
  };
}
