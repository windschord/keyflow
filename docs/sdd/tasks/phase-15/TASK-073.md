# TASK-073: 音色設定の永続化と設定UI・再生時ロード待ち

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-073 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 50分 |
| 依存タスク | TASK-071, TASK-072 |

## 背景

TASK-071/072で音色切替APIが整った。本タスクで設定スキーマ・設定UI・起動時適用・再生時のロード待ちUXを結線する（US-013）。

設計: `docs/sdd/design/components/instrument-voices.md`（設定永続化・ロード待ちの節）

## 実装内容

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/main/settings.ts` | `AppSettings` に `audio: { playbackVoice, metronomeVoice }` 追加、`DEFAULT_SETTINGS` に既定値（'grand-piano' / 'click'）追加 |
| `src/renderer/src/store/`（該当slice） | `playbackVoice` / `metronomeVoice` / `voiceLoading` state追加 |
| `src/renderer/src/components/SettingsModal/index.tsx` | 「音色」セクション追加（再生音色select + メトロノーム音色select）。変更時: store更新→`settings:set`→AudioEngine反映 |
| `src/renderer/src/hooks/usePractice.ts`（結線箇所） | 起動時: 設定読込後に `setPlaybackVoice`/`setMetronomeVoice` 適用。再生開始時: `await ensurePlaybackVoiceLoaded()` してから `playAccompaniment()`。`setVoiceLoadingCallback` → `voiceLoading` state結線 |
| 再生ボタン（PlaybackControls） | `voiceLoading` 中はスピナー表示+無効化 |
| 各テストファイル | 結線テスト追加 |

### 実装手順（TDD）

1. settings.tsテスト（Red→コミット）: `audio` キー不在の既存設定ファイルに既定値がマージされる（後方互換）
2. SettingsModal結線テスト（Red→コミット）: 音色selectの変更が (a) `settings:set` 呼び出し (b) `AudioEngineService.setPlaybackVoice`/`setMetronomeVoice` 呼び出し の両方に到達する
3. usePractice結線テスト（Red→コミット）: 起動時適用 / 未ロード時の再生要求がロード完了後に `playAccompaniment` へ到達し、`voiceLoading` がtrue→falseと遷移する
4. 実装 → Green → コミット

## 受入基準

- [ ] 全テスト通過（モック境界の結線テストを対で用意）
- [ ] 音色変更→アプリ再起動で選択が復元される（E2Eまたは実起動確認、REQ-013-006）
- [ ] 起動直後にグランドピアノ音色のロードが始まり、ロード中の再生要求が待たされる（REQ-013-003）
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` 通過

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 音色UIは設定モーダル配置（分類基準）、electron-store永続化 |
| 設計判断として決定 | 既存 `settings:get/set` IPC流用（IPC追加なし）、ロード中の再生ボタンスピナー |

## 対応要件

REQ-013-003（UI側） / REQ-013-006
