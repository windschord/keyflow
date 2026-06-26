export interface ElectronAPI {
  file: {
    showOpenDialog(): Promise<string | null>;
    read(path: string): Promise<string>;
    readBinary(path: string): Promise<ArrayBuffer>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
