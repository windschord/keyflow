# TASK-067: 再生中のテンポ設定UIロック

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-067 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

ユーザー要望（2026-07-07）: 「再生中はテンポ切り替えができないので、設定を変えられない
ようにして」。実測ではスライダーによるテンポ変更は再生中も正確に追随していたが
（分析レポート第5節）、要望に基づき再生中はテンポ設定UIを無効化する（REQ-006-010）。

（分析レポート: `docs/sdd/troubleshooting/2026-07-07-metronome-feedback/analysis.md`）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/Toolbar/TempoControl.tsx`
  - store の `playbackState` を購読し、`'playing'` の間はテンポスライダー
    （`tempo-slider`）・数値入力（`tempo-input`）・リセットボタンを `disabled` にする。
  - 一時停止（`'paused'`）・停止（`'stopped'`）中は操作可能のままとする。
  - メトロノーム・1拍目強調のチェックボックスは無効化しない（再生中も切り替え可能）。
  - 無効化中であることが視覚的に分かるよう、既存のdisabledスタイル慣行に従う
    （ブラウザ標準のdisabled表現で十分。新規CSSは最小限とする）。
- ファイル: `src/renderer/src/components/Toolbar/TempoControl.test.tsx`
  - 下記テスト項目を追加する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く:
   - (a) `playbackState = 'playing'` のとき、スライダー・数値入力・リセットボタンが
     `disabled` である。
   - (b) `'stopped'` と `'paused'` のときは操作可能である。
   - (c) `'playing'` でもメトロノーム・1拍目強調チェックボックスは操作可能である。
2. Red を確認してコミットする。
3. 実装して Green を確認する。
4. `docs/sdd/requirements/traceability.md` に REQ-006-010 行を追加する。

### 注意事項

- 再生中のテンポ変更はエンジンとしては機能している（分析レポート第5節）。本タスクは
  UI仕様としてのロックであり、`setBpm` 等のエンジン側は変更しない。
- `playbackState` は playback-slice が管理する既存の状態を購読する（新規状態を作らない）。

## 受入基準

- [ ] 再生中はテンポスライダー・数値入力・リセットボタンが無効化される
- [ ] 一時停止・停止中は操作可能に戻る
- [ ] メトロノーム・1拍目強調チェックボックスは再生中も操作可能
- [ ] `docs/sdd/requirements/traceability.md` に REQ-006-010 行が追加されている
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm run lint:jp` が全てパスする

## テスト項目

- [ ] （新規・UI）playing でテンポUI3要素が disabled
- [ ] （新規・UI）stopped / paused で操作可能
- [ ] （新規・UI）playing でもメトロノーム系チェックボックスは操作可能
- [ ] （回帰）`npm run test` 全件グリーン

## 情報の明確性

### 明示された情報

- 要望（2026-07-07）と対象UI・無効化条件（承認済み方針）

### 不明/要確認の情報

- なし（すべて確認済み）
