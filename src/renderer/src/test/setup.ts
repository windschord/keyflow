import { vi } from 'vitest';

vi.stubGlobal('electron', {
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  process: {
    versions: {
      electron: '29.0.0',
      chrome: '122.0.0',
      node: '20.0.0',
    },
  },
});
