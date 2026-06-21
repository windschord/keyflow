# TASK-016: MIDI→PracticeEngine統合（IPC接続・フルフロー）

**ステータス**: TODO
**推定工数**: 40分
**依存**: TASK-014, TASK-015

---

## 説明

IPCブリッジ経由でMIDIイベントを受け取り、PracticeEngineとAudioEngineを繋いで
エンドツーエンドの練習フロー（MIDI入力→正誤判定→視覚フィードバック）を完成させる。

## 対象ファイル

- `src/renderer/src/hooks/useMidi.ts` — MIDIイベントをRendererでサブスクライブするカスタムフック
- `src/renderer/src/hooks/usePractice.ts` — 練習フローを統合するカスタムフック
- `src/renderer/src/App.tsx` — ルートコンポーネントへの組み込み

## 実装すべきフック

```typescript
// useMidi.ts
export function useMidi() {
  useEffect(() => {
    const unsub1 = window.electronAPI.midi.onNoteOn((event) => {
      practiceEngine.handleNoteOn(event);
    });
    const unsub2 = window.electronAPI.midi.onNoteOff((event) => {
      practiceEngine.handleNoteOff(event);
    });
    return () => { unsub1(); unsub2(); };
  }, []);
}

// usePractice.ts
export function usePractice() {
  const store = usePracticeStore();
  const practiceEngine = useMemo(() => new PracticeEngineService(store), [store]);
  const audioEngine = useMemo(() => new AudioEngineService(), []);
  useMidi(); // MIDIイベントを購読
  return { practiceEngine, audioEngine };
}
```

## 統合フロー確認

```
MIDIキーボード押下
  → node-midi (Main) がNoteOnを検知
  → IPC: win.webContents.send('midi:note-on', event)
  → useMidi フックのコールバック
  → practiceEngine.handleNoteOn(event)
  → Zustand Store更新（pressedKeys, stats, currentNoteIndex）
  → React再レンダリング（ScoreRenderer カーソル移動 + PianoKeyboard ハイライト）
```

## 受入基準

- [ ] MIDIキーボードで音を押すと楽譜カーソルが移動する（手動E2E確認）
- [ ] 正しい音を押すと鍵盤が黄色にハイライトされる
- [ ] 誤った音を押すと鍵盤が赤にハイライトされる
- [ ] MIDIデバイスなしの場合も画面鍵盤クリックで練習できる
- [ ] `useMidi` がコンポーネントアンマウント時にイベントリスナーを解除する

**依存関係**: TASK-014, TASK-015
