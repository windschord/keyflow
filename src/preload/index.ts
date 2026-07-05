import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

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
  };
}
