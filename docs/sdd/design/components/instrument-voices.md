# Instrument Voices（再生音色・メトロノーム音色）

## 概要

**目的**: 楽曲再生とメトロノームの音色を選択可能にする（US-013、[DEC-006](../decisions/DEC-006.md)）。

**責務**:
- 再生音色（グランドピアノ=Salamanderサンプル、シンセプリセット3種以上）の生成・切替
- メトロノーム音色（クリック/ウッドブロック/ビープ/カウベル）の生成・切替
- Salamanderサンプルの同梱・遅延ロードとロード状態の公開
- 音色設定のelectron-store永続化

**実行場所**: Renderer Process（`src/renderer/src/lib/audio-engine/`）

---

## 音色定義

### 再生音色（PlaybackVoice）

```typescript
// src/renderer/src/lib/audio-engine/voices.ts
export type PlaybackVoiceId = 'grand-piano' | 'electric-piano' | 'organ' | 'synth';

export interface PlaybackVoiceDefinition {
  id: PlaybackVoiceId;
  label: string;                     // 例: 'グランドピアノ'
  /** Tone.Sampler（要ロード）または Tone.PolySynth（即時利用可）を生成する */
  create(): Tone.Sampler | Tone.PolySynth;
  requiresLoading: boolean;          // grand-pianoのみtrue
}
```

| ID | 実装 | 備考 |
|----|------|------|
| `grand-piano`（既定） | `Tone.Sampler` + Salamanderサンプル | 要ロード（下記） |
| `electric-piano` | `Tone.PolySynth(Tone.FMSynth)` エレピ系設定 | 即時利用可 |
| `organ` | `Tone.PolySynth(Tone.Synth)` 持続系エンベロープ+倍音 | 即時利用可 |
| `synth` | `Tone.PolySynth(Tone.Synth)` 現行相当（後方互換） | 即時利用可 |

- 対象は伴奏（`accompanimentSynth`）と手動プレビュー（`playSynth`）の両方。正誤効果音（`clickSynth`）は対象外（US-013備考）
- `Tone.Sampler` と `Tone.PolySynth` は `triggerAttackRelease(note, duration, time)` インターフェース互換であり、`loadScore` / `playNote` の発音コードは変更不要

### Salamanderサンプル同梱（REQ-013-007）

- 配置: `src/renderer/src/assets/samples/salamander/*.mp3`
- 構成: 短3度間隔（A, C, D#, F# × 各オクターブ、A0〜C8で計30ファイル）、単一ベロシティレイヤー（中位レイヤー）
  - Tone.js公式サンプル集と同じ構成。中間音は `Tone.Sampler` のピッチシフト補間で再生
  - 合計容量目標: 20MB以下（REQ-013-007。mp3再エンコードで調整）
- 取得と加工: 実装タスクで Internet Archive の Salamander V3 配布物から該当ファイルを抽出し `ffmpeg` で変換（開発時の一回きり作業。手順はスクリプト化せず、README化する）
- Viteの `import.meta.glob('...assets/samples/salamander/*.mp3', { query: '?url' })` でURL解決し、`Tone.Sampler` の `urls` に渡す（ビルド成果物に自動同梱、オフライン動作）
- クレジット: `README.md` と Aboutページ（[about-page.md](about-page.md)）に「Salamander Grand Piano V3 by Alexander Holm (CC-BY 3.0)」を表記（REQ-013-008）

### メトロノーム音色（MetronomeVoice）

```typescript
// src/renderer/src/lib/audio-engine/metronome-voices.ts
export type MetronomeVoiceId = 'click' | 'woodblock' | 'beep' | 'cowbell';

export interface MetronomeVoiceDefinition {
  id: MetronomeVoiceId;
  label: string;
  create(): MetronomeVoiceInstance;  // synth本体 + trigger(accent, time) を持つ
}

export interface MetronomeVoiceInstance {
  /** アクセント有無・音量を音色ごとに解決して発音する */
  trigger(time: number, accent: boolean, velocity: number): void;
  dispose(): void;
}
```

| ID | 実装 | アクセントの区別（REQ-013-005） |
|----|------|-------------------------------|
| `click`（既定） | `Tone.Synth`（現行改良: 短いエンベロープ） | 音高 C6/C5 + 音量差（現行踏襲） |
| `woodblock` | `Tone.MembraneSynth` 短decay | 音高差 + 音量差 |
| `beep` | `Tone.Synth`（矩形波） | 音高差 + 音量差 |
| `cowbell` | `Tone.MetalSynth` 短decay | 音量差 + ピッチ差 |

- `Metronome` クラスの `startSequence` / `startClock` 内の `this.synth.triggerAttackRelease(...)` を `this.voice.trigger(time, isAccent, volume)` に置き換える。アクセント判定ロジック（measureStartTicks照合・beatCounter）は変更しない

---

## AudioEngineService / Metronome の拡張

### 希望状態パターン（StrictMode耐性）

既存の `metronomeBpm` 等と同様、音色IDを希望状態フィールドとして保持し、`ensureInitialized()` での再生成後に再適用する:

```typescript
private playbackVoiceId: PlaybackVoiceId = 'grand-piano';
private metronomeVoiceId: MetronomeVoiceId = 'click';
```

### 公開API追加

```typescript
/** 再生音色を切り替える。Samplerの場合はロードを開始する（await可能） */
setPlaybackVoice(id: PlaybackVoiceId): Promise<void>;

/** メトロノーム音色を切り替える（即時反映） */
setMetronomeVoice(id: MetronomeVoiceId): void;

/** 現在の再生音色が発音可能になるまで待つ（ロード済みなら即resolve） */
ensurePlaybackVoiceLoaded(): Promise<void>;

/** ロード状態の購読（UIのローディング表示用） */
setVoiceLoadingCallback(cb: ((loading: boolean) => void) | null): void;
```

- `setPlaybackVoice`: 旧インスタンスを `dispose` し、新インスタンスを生成して `accompanimentSynth` / `playSynth` を差し替える。`loadScore` 済みの `Tone.Part` はコールバック内で `this.accompanimentSynth` を参照しているため再スケジュール不要（REQ-013-002: 次の発音から反映）
- `Tone.Sampler` のロードは `Tone.loaded()` ではなく生成時 `onload` コールバック＋Promise化で追跡する。ロード失敗（ファイル欠落等）はトースト通知し、`synth` プリセットへフォールバックする（エラーハンドリング戦略準拠）

### 再生開始時のロード待ち（REQ-013-003）

- `usePractice.ts` の再生開始ハンドラで `await audioEngine.ensurePlaybackVoiceLoaded()` してから `playAccompaniment()` を呼ぶ
- ロード中はZustandの `voiceLoading: boolean` を立て、再生ボタンをスピナー表示・無効化する
- 想定ロード時間: ローカルファイル20MB以下のデコードで数百ms〜2秒程度（初回のみ。切替時は都度ロードだがロード済みSamplerはキャッシュ保持してよい）

---

## 設定永続化（REQ-013-006）

### AppSettingsスキーマ拡張（`src/main/settings.ts`）

```typescript
audio: {
  playbackVoice: PlaybackVoiceId;    // 既定 'grand-piano'
  metronomeVoice: MetronomeVoiceId;  // 既定 'click'
}
```

- 既存の `settings:get` / `settings:set` IPCをそのまま使用（IPC追加なし）
- 既存設定ファイルとの後方互換: `audio` キー不在時は既定値をマージ（`DEFAULT_SETTINGS` 準拠の既存パターン）

### UI（設定モーダル）

- `SettingsModal` に「音色」セクションを追加: 再生音色select + メトロノーム音色select
- 変更時: Zustand更新 → `settings:set` 永続化 → `AudioEngineService.setPlaybackVoice / setMetronomeVoice` 呼び出し（既存の設定反映パターンに従い、結線テストを対で書く）
- 起動時: 設定読み込み後に両音色をAudioEngineへ適用（既存の初期化フローに追加）

---

## テスト観点

- 音色ファクトリ: 各IDで正しい種別のインスタンスが生成されること（ユニット）
- 希望状態: `dispose()` → 再初期化後も選択中の音色が維持されること（StrictMode耐性、ユニット）
- 結線: SettingsModalの変更がAudioEngineService呼び出しと`settings:set`に到達すること（結線テスト）
- ロード待ち: 未ロード時の再生要求がロード完了後に開始されること（ユニット+E2E）
- メトロノーム: 全音色でアクセント有無の発音差が保たれること（ユニット: triggerの引数検証）
- E2E: 音色を変更して再起動し、設定が復元されること

## 対応要件

| 要件ID | 対応設計 |
|--------|---------|
| REQ-013-001 | PlaybackVoice 4種 + voices.ts ファクトリ |
| REQ-013-002 | シンセ差し替え方式（Part再スケジュール不要） |
| REQ-013-003 | ensurePlaybackVoiceLoaded + voiceLoading状態 |
| REQ-013-004 | MetronomeVoice 4種 + metronome-voices.ts |
| REQ-013-005 | MetronomeVoiceInstance.trigger(accent) |
| REQ-013-006 | AppSettings.audio + SettingsModal音色セクション |
| REQ-013-007 | Viteアセット同梱（import.meta.glob） |
| REQ-013-008 | README + Aboutページのクレジット表記 |
