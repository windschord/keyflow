import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

interface ElectronAppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: { maxSpanSemitones: number; leftHandScaleFactor: number };
  ui: { theme: 'light' | 'dark'; zoom: number; pianoHeight: number; language: string };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}

const settingsApi = {
  get: <K extends keyof ElectronAppSettings>(key: K): Promise<ElectronAppSettings[K]> =>
    ipcRenderer.invoke('settings:get', key) as Promise<ElectronAppSettings[K]>,
  set: <K extends keyof ElectronAppSettings>(
    key: K,
    value: ElectronAppSettings[K]
  ): Promise<void> => ipcRenderer.invoke('settings:set', key, value) as Promise<void>,
  getRecentFiles: (): Promise<Array<{ path: string; openedAt: string }>> =>
    ipcRenderer.invoke('settings:get-recent-files') as Promise<
      Array<{ path: string; openedAt: string }>
    >,
};

// Custom APIs for renderer
const api = {};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('[preload] Failed to expose electron/api:', error);
  }

  try {
    contextBridge.exposeInMainWorld('electronAPI', {
      file: {
        showOpenDialog: (): Promise<string | null> => ipcRenderer.invoke('file:show-open-dialog'),
        read: (path: string): Promise<string> => ipcRenderer.invoke('file:read', path),
        readBinary: (path: string): Promise<ArrayBuffer> =>
          ipcRenderer.invoke('file:read-binary', path),
        write: (path: string, content: string): Promise<void> =>
          ipcRenderer.invoke('file:write', path, content),
      },
      settings: {
        ...settingsApi,
      },
    });
  } catch (error) {
    console.error('[preload] Failed to expose electronAPI:', error);
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
      readBinary: (path: string): Promise<ArrayBuffer> =>
        ipcRenderer.invoke('file:read-binary', path),
      write: (path: string, content: string): Promise<void> =>
        ipcRenderer.invoke('file:write', path, content),
    },
    settings: {
      ...settingsApi,
    },
  };
}
