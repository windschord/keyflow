export interface ElectronAPI {
  file: {
    showOpenDialog(): Promise<string | null>;
    read(path: string): Promise<string>;
    readBinary(path: string): Promise<ArrayBuffer>;
    write(path: string, content: string): Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
