export interface ElectronAPI {
  file: {
    showOpenDialog(): Promise<string | null>;
    read(path: string): Promise<string>;
    readBinary(path: string): Promise<ArrayBuffer>;
    write(path: string, content: string): Promise<void>;
  };
  settings: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get(key: string): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set(key: string, value: any): Promise<void>;
    getRecentFiles(): Promise<Array<{ path: string; openedAt: string }>>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
