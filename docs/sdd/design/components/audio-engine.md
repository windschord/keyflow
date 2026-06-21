# Audio Engine（音声エンジン）

## 概要

**目的**: Tone.jsを使って伴奏・メトロノーム・確認音を再生する

**責務**:
- 非練習パート（右手モード時の左手など）の自動伴奏を再生する
- メトロノームのクリック音をBPMに同期して再生する
- テンポ変更をピッチを変えずに反映する（タイムストレッチ）
- 正解/不正解の確認音（フィードバック音）を再生する

**実行場所**: Renderer Process

---

## インターフェース

```typescript
class AudioEngineService {
  // Tone.js Transport をラップ
  setBpm(bpm: number): void;
  setMetronomeEnabled(enabled: boolean): void;

  // 伴奏再生
  playAccompaniment(score: Score, hand: 'right' | 'left'): void;
  stopAccompaniment(): void;

  // フィードバック音
  playCorrectSound(): void;
  playIncorrectSound(): void;

  // MIDI音のプレビュー（画面鍵盤クリック時）
  playNote(midiNumber: number, duration?: number): void;
}
```

## 内部設計

### テンポ変更（ピッチ維持）

Tone.jsの`Transport.bpm`を変更するだけでピッチが変わらずテンポのみ変更される（Web Audio API の`AudioContext.baseLatency`を使用）。

### 伴奏音源

初期実装は`Tone.Synth`（シンセ音）を使用する。将来的にはピアノ音源サンプル（salamander piano等）への切り替えを検討する。

---

## 関連要件

- [US-003](../../requirements/stories/US-003.md) @../../requirements/stories/US-003.md: 非練習パートの自動伴奏
- [US-006](../../requirements/stories/US-006.md) @../../requirements/stories/US-006.md: テンポ調整・メトロノーム
