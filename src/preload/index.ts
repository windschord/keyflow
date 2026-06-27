import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { IpcChannels } from '../main/ipc-channels';

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
        showOpenDialog: (): Promise<string | null> =>
          ipcRenderer.invoke(IpcChannels.FILE_SHOW_OPEN_DIALOG),
        read: (path: string): Promise<string> => ipcRenderer.invoke(IpcChannels.FILE_READ, path),
        readBinary: (path: string): Promise<ArrayBuffer> =>
          ipcRenderer.invoke(IpcChannels.FILE_READ_BINARY, path),
        write: (path: string, content: string): Promise<void> =>
          ipcRenderer.invoke(IpcChannels.FILE_WRITE, path, content),
      },
      settings: {
        get: (key: string) => ipcRenderer.invoke(IpcChannels.SETTINGS_GET, key),
        set: (key: string, value: unknown) =>
          ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),
      },
      midi: {
        getDevices: () => ipcRenderer.invoke(IpcChannels.MIDI_GET_DEVICES),
        selectDevice: (index: number) => ipcRenderer.send(IpcChannels.MIDI_SELECT_DEVICE, index),
        onDevicesChanged: (callback: (devices: { name: string; index: number }[]) => void) => {
          ipcRenderer.on(IpcChannels.MIDI_DEVICES_CHANGED, (_, devices) => callback(devices));
        },
        onNoteOn: (callback: (event: unknown) => void) => {
          ipcRenderer.on(IpcChannels.MIDI_NOTE_ON, (_, event) => callback(event));
        },
        onNoteOff: (callback: (event: unknown) => void) => {
          ipcRenderer.on(IpcChannels.MIDI_NOTE_OFF, (_, event) => callback(event));
        },
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
      showOpenDialog: (): Promise<string | null> =>
        ipcRenderer.invoke(IpcChannels.FILE_SHOW_OPEN_DIALOG),
      read: (path: string): Promise<string> => ipcRenderer.invoke(IpcChannels.FILE_READ, path),
      readBinary: (path: string): Promise<ArrayBuffer> =>
        ipcRenderer.invoke(IpcChannels.FILE_READ_BINARY, path),
      write: (path: string, content: string): Promise<void> =>
        ipcRenderer.invoke(IpcChannels.FILE_WRITE, path, content),
    },
    settings: {
      get: (key: string) => ipcRenderer.invoke(IpcChannels.SETTINGS_GET, key),
      set: (key: string, value: unknown) =>
        ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),
    },
    midi: {
      getDevices: () => ipcRenderer.invoke(IpcChannels.MIDI_GET_DEVICES),
      selectDevice: (index: number) => ipcRenderer.send(IpcChannels.MIDI_SELECT_DEVICE, index),
      onDevicesChanged: (callback: (devices: { name: string; index: number }[]) => void) => {
        ipcRenderer.on(IpcChannels.MIDI_DEVICES_CHANGED, (_, devices) => callback(devices));
      },
      onNoteOn: (callback: (event: unknown) => void) => {
        ipcRenderer.on(IpcChannels.MIDI_NOTE_ON, (_, event) => callback(event));
      },
      onNoteOff: (callback: (event: unknown) => void) => {
        ipcRenderer.on(IpcChannels.MIDI_NOTE_OFF, (_, event) => callback(event));
      },
    },
  };
}
