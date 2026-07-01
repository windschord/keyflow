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

## 実装概要

`src/renderer/src/lib/midi/web-midi.ts` に Web MIDI API ラッパーとして実装済み。
`navigator.requestMIDIAccess()` でデバイス一覧を取得し、NoteOn/NoteOff イベントをコールバックで通知する。

**依存関係**: Phase 2完了

---

## 廃止済み設計（参考）

> 以下は当初の node-midi + IPC 方式の設計仕様。設計変更により実装されていない。

当初の設計では、Electron Main Process上でnode-midiを使いMIDIデバイスを管理する予定だった。
`MidiControllerService` が NoteOn/NoteOff を検知し、`ipcMain` 経由でRenderer Processへ転送する設計だった。
