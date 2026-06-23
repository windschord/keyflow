import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);

    contextBridge.exposeInMainWorld('electronAPI', {
      file: {
        showOpenDialog: (): Promise<string | null> => ipcRenderer.invoke('file:show-open-dialog'),
        read: (path: string): Promise<string> => ipcRenderer.invoke('file:read', path),
        readBinary: (path: string): Promise<ArrayBuffer> => ipcRenderer.invoke('file:read-binary', path),
      },
    });
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.api = api;
  // @ts-expect-error (define in dts)
  window.electronAPI = {
    file: {
      showOpenDialog: (): Promise<string | null> => ipcRenderer.invoke('file:show-open-dialog'),
      read: (path: string): Promise<string> => ipcRenderer.invoke('file:read', path),
      readBinary: (path: string): Promise<ArrayBuffer> => ipcRenderer.invoke('file:read-binary', path),
    },
  };
}
