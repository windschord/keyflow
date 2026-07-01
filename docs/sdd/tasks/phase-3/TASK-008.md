# TASK-008: MIDI Controller実装（Web MIDI API）

**ステータス**: DONE
**推定工数**: 40分
**依存**: Phase 2

---

## 設計変更メモ

当初の設計では node-midi を使った Main Process での実装を想定していたが、
実装時に Renderer Process での Web MIDI API 方式に変更した。

**変更内容:**
- 実装箇所: `src/renderer/src/lib/midi/web-midi.ts`（Renderer Process）
- 使用API: Web MIDI API（`navigator.requestMIDIAccess()`）
- `src/main/midi-controller.ts` は作成せず

**変更理由:** Web MIDI APIはChromiumで標準サポートされており、
node-midi（electron-rebuildが必要なNativeModule）を避けることができる。
IPC通信のオーバーヘッドがなく、レイテンシも低い。

---

## 説明（当初設計）

Electron Main Process上でnode-midiを使ってMIDIデバイスを管理し、
ノートオン/オフイベントをIPCでRenderer Processへ転送する。

## 対象ファイル（実際の実装）

- `src/renderer/src/lib/midi/web-midi.ts` — Web MIDI APIラッパー（実装済）

## 参照設計

- [design/components/midi-controller.md](../../design/components/midi-controller.md)
- [design/decisions/DEC-004.md](../../design/decisions/DEC-004.md)

## 実装すべきインターフェース

```typescript
import midi from 'midi';
import { BrowserWindow } from 'electron';

export class MidiControllerService {
  private input: midi.Input;
  private win: BrowserWindow | null;

  constructor(win: BrowserWindow);
  initialize(): void;
  listDevices(): MidiDevice[];
  selectDevice(index: number): void;
  dispose(): void;

  private onMessage(deltaTime: number, message: [number, number, number]): void;
  // message[0] & 0xF0 === 0x90 → NoteOn
  // message[0] & 0xF0 === 0x80 → NoteOff
}
```

## IPCイベント

```typescript
// Main → Renderer（Renderer側でlistenする）
win.webContents.send('midi:note-on', {
  noteNumber: message[1],
  velocity: message[2],
  channel: (message[0] & 0x0F) + 1,
  timestamp: Date.now(),
} satisfies MidiNoteEvent);

win.webContents.send('midi:note-off', { ... });
win.webContents.send('midi:devices-changed', devices);
```

## Main Process への組み込み

```typescript
// src/main/index.ts
app.whenReady().then(() => {
  const win = createWindow();
  const midiController = new MidiControllerService(win);
  midiController.initialize();

  // IPCハンドラー（Rendererからのデバイス一覧取得リクエスト）
  ipcMain.handle('midi:get-devices', () => midiController.listDevices());
  ipcMain.on('midi:select-device', (_, index) => midiController.selectDevice(index));
});
```

## 実装手順（TDD）

1. `midi-controller.test.ts` を作成（node-midiをモックしてテスト）:
   - `listDevices()` が正しいデバイス名の配列を返す
   - NoteOnメッセージ(0x90)が `midi:note-on` IPCイベントとして送信される
   - デバイス未接続時に `listDevices()` が空配列を返す
2. `MidiControllerService` を実装
3. `src/main/index.ts` に組み込み

## 受入基準

- [ ] `listDevices()` が接続デバイスの配列を返す
- [ ] NoteOnイベントが正しいnoteNumber/velocityで転送される
- [ ] デバイス未接続でもアプリがクラッシュしない
- [ ] `dispose()` がMIDI入力をクローズする
- [ ] テストが4件以上ありすべてパス

**依存関係**: Phase 2完了
