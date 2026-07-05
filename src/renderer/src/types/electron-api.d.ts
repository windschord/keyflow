import { AppSettings } from './settings';

export interface ElectronAPI {
  file: {
    showOpenDialog(): Promise<string | null>;
    read(path: string): Promise<string>;
    /**
     * 存在しないのが正常なファイル（*.annotation.json等）用。ENOENTはエラーではなく
     * nullを返す（メインプロセスへの未処理エラーログを避ける。2026-07-05）。
     */
    readIfExists(path: string): Promise<string | null>;
    readBinary(path: string): Promise<ArrayBuffer>;
    /** Writes only to main-process approved targets such as `{MusicXMLPath}.annotation.json`. */
    write(path: string, content: string): Promise<void>;
    /**
     * ドラッグ＆ドロップされた File オブジェクトから絶対パスを取得する（TASK-053）。
     * contextIsolation 下では File.path が使えないため、preload 経由で
     * `webUtils.getPathForFile` を呼び出す。取得できない場合は空文字列を返す。
     */
    getDroppedFilePath(file: File): string;
    /**
     * ドラッグ＆ドロップで開いたファイルを Main プロセスの PathAllowlist に登録し、
     * ファイル履歴（addRecentFile）へ反映する（TASK-053）。
     * `.xml` / `.musicxml` / `.mxl` 以外の拡張子は Main 側で拒否され false が返る。
     */
    registerDroppedFile(path: string): Promise<boolean>;
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
