# TASK-072: メトロノーム音色の選択（エンジン実装）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-072 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 40分 |
| 依存タスク | TASK-070（audio-engine/index.ts競合回避のため順次） |

## 背景

メトロノームの音色が `Tone.Synth` ハードコード（US-013）。本タスクは音色プリセット4種とMetronome/AudioEngineServiceの切替APIを実装する（設定UI・永続化はTASK-073）。

設計: `docs/sdd/design/components/instrument-voices.md`（メトロノーム音色の節）

## 実装内容

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/lib/audio-engine/metronome-voices.ts` | 新規。`MetronomeVoiceId`（'click'/'woodblock'/'beep'/'cowbell'）、`createMetronomeVoice(id): MetronomeVoiceInstance`（`trigger(time, accent, velocity)` / `dispose()`） |
| `src/renderer/src/lib/audio-engine/metronome.ts` | `synth` 直接保持を `voice: MetronomeVoiceInstance` に置換。`setVoice(id)` 追加。`startSequence`/`startClock` 内の発音を `this.voice.trigger(time, isAccent, volume)` へ委譲（アクセント判定ロジックは不変） |
| `src/renderer/src/lib/audio-engine/index.ts` | 希望状態 `metronomeVoiceId` 追加。`setMetronomeVoice(id)` 追加（dispose→再初期化後の再適用を含む） |
| `metronome-voices.test.ts` / `metronome.test.ts`（または既存audio-engine.test.ts） | テスト追加 |

### 音色仕様（設計書より）

| ID | 実装 | アクセント区別 |
|----|------|---------------|
| click（既定） | Tone.Synth 短エンベロープ | C6/C5 + 音量差（現行踏襲） |
| woodblock | Tone.MembraneSynth 短decay | 音高差 + 音量差 |
| beep | Tone.Synth 矩形波 | 音高差 + 音量差 |
| cowbell | Tone.MetalSynth 短decay | 音量差 + ピッチ差 |

### 実装手順（TDD）

1. metronome-voices.test.ts 作成（Red→コミット）: 各IDで生成成功 / `trigger(time, true, v)` と `trigger(time, false, v)` で発音パラメータ（音高または音量）に差があること（全4音色、REQ-013-005）
2. metronome.ts / index.ts のテスト追加（Red→コミット）: `setVoice` 後のクリックが新voiceの `trigger` に到達する結線 / dispose→再初期化後も音色維持
3. 実装 → Green → コミット

## 受入基準

- [x] 全テスト通過、既存metronome関連テスト非回帰（TASK-061〜066の結線テスト含む）
- [x] 全音色でアクセント有無の発音差が保たれる（REQ-013-005）
- [x] `npm run test` / `npm run typecheck` / `npm run lint` 通過
- [x] 実起動確認: メトロノームONで既定クリック音が鳴る（非回帰）— 実際の聴感確認は自動化できないため、ユーザー実機確認待ちとしてDONE化する（TASK-077参照）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | プリセット4種（クリック/ウッドブロック/ビープ/カウベル）、シンセ製・容量ゼロ |
| 設計判断として決定 | 各音色のTone.jsシンセ種別・アクセント表現方法 |

## 対応要件

REQ-013-004 / REQ-013-005
