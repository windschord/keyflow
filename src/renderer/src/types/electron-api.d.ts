import { AppSettings } from './settings';

export interface ElectronAPI {
  file: {
    showOpenDialog(): Promise<string | null>;
    read(path: string): Promise<string>;
    readBinary(path: string): Promise<ArrayBuffer>;
    write(path: string, content: string): Promise<void>;
  };
  settings: {
    get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]>;
    set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
    getRecentFiles(): Promise<Array<{ path: string; openedAt: string }>>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
