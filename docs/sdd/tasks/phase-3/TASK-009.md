# TASK-009: IPC Bridge実装（Preload Script + 型付きAPI）

**ステータス**: DONE
**推定工数**: 20分
**依存**: TASK-008

---

## 説明

Preload Scriptで `contextBridge` を使い、Main↔Renderer間の型付きIPCブリッジを定義する。
Renderer側はこのAPIのみを通じてMain Processと通信する（`nodeIntegration: false`を維持）。

## 対象ファイル

- `src/preload/index.ts` — contextBridge API定義
- `src/renderer/src/types/electron-api.d.ts` — Renderer側の型宣言

## 実装すべきAPI

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  midi: {
    getDevices: () => ipcRenderer.invoke('midi:get-devices'),
    selectDevice: (index: number) => ipcRenderer.send('midi:select-device', index),
    onNoteOn: (cb: (e: MidiNoteEvent) => void) => {
      ipcRenderer.on('midi:note-on', (_, e) => cb(e));
      return () => ipcRenderer.removeAllListeners('midi:note-on');
    },
    onNoteOff: (cb: (e: MidiNoteEvent) => void) => { /* 同様 */ },
    onDevicesChanged: (cb: (devices: MidiDevice[]) => void) => { /* 同様 */ },
  },
  file: {
    read: (path: string): Promise<string> => ipcRenderer.invoke('file:read', path),
    write: (path: string, content: string): Promise<void> => ipcRenderer.invoke('file:write', path, content),
    showOpenDialog: (): Promise<string | null> => ipcRenderer.invoke('file:show-open-dialog'),
  },
  settings: {
    get: <K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> => ipcRenderer.invoke('settings:get', key),
    set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> => ipcRenderer.invoke('settings:set', key, value),
    getRecentFiles: (): Promise<RecentFile[]> => ipcRenderer.invoke('settings:get-recent-files'),
  },
});

// src/renderer/src/types/electron-api.d.ts
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

## 受入基準

- [ ] `contextIsolation: true`, `nodeIntegration: false` がmain/index.tsで設定されている
- [ ] Rendererから `window.electronAPI.midi.getDevices()` が呼び出せる
- [ ] `window.electronAPI.file.showOpenDialog()` でOSネイティブダイアログが開く
- [ ] TypeScript型宣言により `window.electronAPI` に型補完が効く

**依存関係**: TASK-008

---

## 実行情報

- **実行方式**: Jules API + ローカル修正
- **Jules Session ID**: 3598245982887663378
- **Jules ブランチ名**: feat/ipc-musicxml-parser-3598245982887663378
- **PR作成先**: main
- **開始日時**: 2026-06-23 10:43
- **PR番号**: #10
- **PR URL**: https://github.com/windschord/keyflow/pull/10
- **PR作成日時**: 2026-06-23
- **CI結果**: 全ジョブパス（2026-06-24）
