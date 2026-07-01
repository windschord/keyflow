# TASK-015: Audio Engine実装（Tone.js伴奏・メトロノーム）

**ステータス**: DONE
**推定工数**: 40分
**依存**: Phase 4

---

## 説明

Tone.jsを使って伴奏・メトロノーム・確認音を実装するサービスを作成する。

## 対象ファイル

- `src/renderer/src/lib/audio-engine/index.ts` — AudioEngineService
- `src/renderer/src/lib/audio-engine/metronome.ts` — メトロノームロジック
- `src/renderer/src/lib/audio-engine/audio-engine.test.ts` — テスト（Tone.jsをモック）

## 依存ライブラリ

```bash
npm install tone
```

## 参照設計

- [design/components/audio-engine.md](../../design/components/audio-engine.md)

## 実装すべきインターフェース

```typescript
export class AudioEngineService {
  setBpm(bpm: number): void;
  setMetronomeEnabled(enabled: boolean): void;

  // 右手/左手の伴奏（非練習パートの音を鳴らす）
  async loadAccompaniment(score: Score, accompanimentHand: Hand): Promise<void>;
  playAccompaniment(): void;
  stopAccompaniment(): void;
  pauseAccompaniment(): void;

  // 確認音
  playCorrectSound(): void;    // 高音ビープ（短い）
  playIncorrectSound(): void;  // 低音ビープ（短い）

  // キー音（画面鍵盤クリック時）
  playNote(midiNumber: number, duration?: string): void;

  dispose(): void;
}
```

## 実装詳細

### BPM変更
```typescript
setBpm(bpm: number): void {
  Tone.getTransport().bpm.value = bpm;
}
```

### 伴奏音源（初期実装）
Tone.Synthを使った簡易シンセ音源。将来的にはピアノサンプラーに置き換え予定。

### メトロノーム
```typescript
// Tone.Sequence で拍をスケジュール
const metronome = new Tone.Sequence((time) => {
  clickSynth.triggerAttackRelease('C5', '32n', time);
}, [null], '4n');
```

## 受入基準

- [ ] `setBpm(120)` でTone.TransportのBPMが120になる
- [ ] `setMetronomeEnabled(true)` でメトロノーム音が鳴る（テストではモック）
- [ ] `playNote(60)` でC4の音が再生される
- [ ] `dispose()` でTone.jsリソースが解放される

**依存関係**: Phase 4完了
