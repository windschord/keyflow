# TASK-071: 再生音色ファクトリとSalamanderサンプル同梱

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-071 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | なし |

## 背景

再生音色が `Tone.PolySynth(Tone.Synth)` ハードコードで変更できない（US-013）。本タスクは音色ファクトリとAudioEngineServiceの音色切替APIを実装する（設定UI・永続化はTASK-073）。

設計: `docs/sdd/design/components/instrument-voices.md`、`docs/sdd/design/decisions/DEC-006.md`

## 実装内容

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/lib/audio-engine/voices.ts` | 新規。`PlaybackVoiceId`（'grand-piano'/'electric-piano'/'organ'/'synth'）、`PLAYBACK_VOICES` 定義、`createPlaybackInstrument(id)` |
| `src/renderer/src/assets/samples/salamander/*.mp3` | 新規。短3度間隔（A/C/D#/F#×オクターブ、A0〜C8、約30ファイル）、単一ベロシティレイヤー、合計20MB以下 |
| `src/renderer/src/lib/audio-engine/index.ts` | 希望状態 `playbackVoiceId` 追加。`setPlaybackVoice(id): Promise<void>` / `ensurePlaybackVoiceLoaded(): Promise<void>` / `setVoiceLoadingCallback(cb)` 追加。`ensureInitialized()` で希望状態から `accompanimentSynth` / `playSynth` を生成 |
| `src/renderer/src/lib/audio-engine/voices.test.ts` / `audio-engine.test.ts` | テスト追加 |
| `README.md` | Salamanderクレジット（Alexander Holm、CC-BY 3.0）追記 |

### サンプル取得手順（開発時一回きり、READMEに記録）

1. Internet Archive の Salamander Grand Piano V3（48kHz24bit）から中位ベロシティレイヤー（v8）の対象30音を抽出
2. `ffmpeg` でmp3（96kbps mono可）へ変換し20MB以下に収める
3. `src/renderer/src/assets/samples/salamander/` へ配置（ファイル名は `A0.mp3`, `C1.mp3`, `Ds1.mp3`, `Fs1.mp3`, ... のTone.js互換形式）

### 実装要点

- `import.meta.glob('../../assets/samples/salamander/*.mp3', { query: '?url', import: 'default', eager: true })` でURL解決し `Tone.Sampler` の `urls` に渡す
- Samplerロードは `onload` をPromise化して追跡。ロード失敗時はトースト通知+`synth` へフォールバック
- `Tone.Sampler`/`Tone.PolySynth` は `triggerAttackRelease` 互換のため `loadScore`/`playNote` の発音コードは変更しない
- StrictMode耐性: `dispose()` → 再初期化後も `playbackVoiceId` を維持（既存の希望状態パターン準拠）
- 既定音色は `grand-piano`

### 実装手順（TDD）

1. voices.test.ts 作成（Red→コミット）: 各IDで期待種別のインスタンス生成 / grand-pianoのみ `requiresLoading: true`
2. audio-engine.test.ts に追加（Red→コミット）: `setPlaybackVoice` 後の発音が新インスタンスへ委譲される / dispose→再初期化後も音色維持 / `ensurePlaybackVoiceLoaded` がロード完了までpendingになる（Toneモックでonloadを手動発火）
3. 実装 → Green → コミット（サンプルファイル配置は実装コミットに含める）

## 受入基準

- [ ] 全テスト通過、既存テスト非回帰
- [ ] サンプル合計サイズが20MB以下（REQ-013-007）
- [ ] `npm run build` の成果物にサンプルが同梱される（ビルド後の out/ を確認）
- [ ] READMEにクレジット表記
- [ ] 実起動確認: 既定でピアノ音が鳴る（オフラインで）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | Salamander採用・20MB以下・CC-BYクレジット・シンセプリセット追加（DEC-006承認済み） |
| 設計判断として決定 | mp3形式・v8レイヤー・短3度間隔30ファイル・ロード失敗時synthフォールバック |

## 対応要件

REQ-013-001 / REQ-013-002 / REQ-013-003（エンジン側） / REQ-013-007 / REQ-013-008（README側）
