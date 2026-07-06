# TASK-028: Toolbar UXの全面改善（日本語ラベル・機能整理）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-028 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | TASK-026 |

## 背景

### 問題の概要

ツールバー上のコントロール（テンポスライダー、BPM欄、ループ小節欄、手選択ドロップダウン）の用途が見た目から分からない。ラベルが欠落しているものが多く、似た機能（運指計算対象の手 vs 練習対象パート）が説明なしで併存し混乱を招く。Metronome/Loopは無効化されておらず、単に未チェックの標準描画のためグレーに見えるだけである。Metronomeは消費コードが存在しない死にコントロールとなっている。ループ範囲もハードコードで楽譜上に可視化されない。全体的にUIがほぼ英語でNFR-U-002（日本語UI必須）に違反している。

（分析レポート: `docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md` 原因4）

### 根本原因

- `docs/sdd/design/components/` にToolbarの設計書が存在せず、ラベル・ツールチップ・無効化理由表示のUX仕様が未定義のまま実装された。
- `src/renderer/src/components/Toolbar/TempoControl.tsx` 46-53行目のテンポスライダー、55-64行目のBPM数値欄、`LoopControl.tsx` 64-80行目のループ小節欄（start/end）にラベル・ツールチップが一切ない。
- **2つの異なる「手」選択**が、区別を示すラベルなしで併存している。1つは `src/renderer/src/components/FingeringPanel/index.tsx:73-96` の「手:」ドロップダウン（運指計算対象、`hand` state）である。もう1つは `src/renderer/src/components/Toolbar/PracticeModeSelector.tsx:52-76` のLeft(L)/Right(R)/Both(B)ボタン（練習対象パート、`practiceMode`）である。
- `LoopControl.tsx:56-63` のMetronome相当（本コンポーネントでは`Loop`）チェックボックスと`TempoControl.tsx:89-96`のMetronomeチェックボックスは、`disabled`属性を使わず未チェック時に標準のグレーがかった描画になるだけで「無効」に見える。Metronomeチェックボックス自体はチェックしても`audioEngine.setMetronomeEnabled`と未結線（TASK-027で対処）のため、本タスク実施時点では死にコントロールになっている。
- `src/renderer/src/components/Toolbar/TempoControl.tsx:66` のResetボタンの戻し先 `originalBpm` は、TASK-024実施前は120固定（`ui-slice.ts:16`）。
- `src/renderer/src/App.tsx:159` で `<ScoreRenderer ... loopRange={null} .../>` がハードコードされている。このため`ScoreRenderer`が受け取る`loopRange`（`ScoreRenderer/index.tsx:10,21`）にストアの`loopStart`/`loopEnd`/`loopEnabled`（`practice-slice.ts:12-14`）が渡らない。結果としてループ範囲が楽譜上に可視化されない（`osmd-controller.ts:98-100`の`drawLoopBracket`はダミー実装で未接続）。
- `LoopControl.tsx:37` にはバリデーション`if (start >= end) { setError('開始 < 終了'); return; }`がある。一方、`practice-slice.ts:37-38`の初期値は`loopStart: 1, loopEnd: 1`であり、初期状態で`start >= end`となる。これはバリデーションに矛盾した初期値である。
- UIラベルは「Open File」（`App.tsx:138`）、「Loop」（`LoopControl.tsx:62`）、「Metronome」（`TempoControl.tsx:95`）、「Settings」（`Toolbar/index.tsx:46-47`）など英語表記が中心である。これはNFR-U-002「日本語UI必須」に違反している。

### 関連する仕様

- NFR-U-002（日本語UI必須）: 全コントロールへの日本語ラベル付与が必要
- US-006（テンポ/メトロノーム/ループ調整）: 各コントロールの用途が視覚的に明確であることが前提
- US-003（A-Bループ練習）: ループ範囲の楽譜上可視化が期待される

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/App.tsx`
  - 変更内容: 138行目「Open File」を日本語ラベルに変更。159行目 `loopRange={null}` のハードコードを解消し、ストアの`loopEnabled`/`loopStart`/`loopEnd`から`loopRange`オブジェクトを生成して`ScoreRenderer`へ渡す。
- ファイル: `src/renderer/src/components/Toolbar/TempoControl.tsx`
  - 変更内容: テンポスライダー（46-53行目）・BPM数値欄（55-64行目）にラベルとツールチップ（`title`属性）を追加。「Reset」（77行目）「Metronome」（95行目）を日本語化。
- ファイル: `src/renderer/src/components/Toolbar/LoopControl.tsx`
  - 変更内容: 「Loop」（62行目）を日本語化しラベル・ツールチップ追加。ループ小節開始・終了欄（64-80行目）にラベル・ツールチップを追加。
- ファイル: `src/renderer/src/store/slices/practice-slice.ts`
  - 変更内容: 37-38行目の初期値 `loopStart: 1, loopEnd: 1` を、`LoopControl.tsx:37`のバリデーション（`start < end`）と整合する初期値（例: `loopStart: 1, loopEnd: 2`）に変更する。
- ファイル: `src/renderer/src/components/FingeringPanel/index.tsx`
  - 変更内容: 77行目の「手:」ラベルを「運指対象:」等に変更し、`PracticeModeSelector`の練習対象パート選択と区別できるようにする（既に運指提案ボタンとグループ化された見た目のため、ラベル文言の明確化で対応）。
- ファイル: `src/renderer/src/components/Toolbar/PracticeModeSelector.tsx`
  - 変更内容: Left(L)/Right(R)/Both(B)ボタン群に「練習対象:」等のグループラベルを追加し、日本語化する（例: 「左手 (L)」「右手 (R)」「両手 (B)」）。
- ファイル: `src/renderer/src/components/Toolbar/index.tsx`
  - 変更内容: 「Settings」（46-47行目）のツールチップ・aria-labelを日本語化する。
- ファイル: `src/renderer/src/components/ScoreRenderer/osmd-controller.ts`
  - 変更内容: `drawLoopBracket`（98-100行目）のダミー実装を、渡された`loopRange`に基づきループ範囲を楽譜上で可視化する最小限の実装に置き換える（本タスクの受入基準「ループ範囲の楽譜上可視化」を満たすために必要な範囲）。

### 実装手順

TDDで進める。

1. まず失敗するテストを書く: 各コントロールに期待する日本語ラベル・`title`属性が存在することを検証するテスト（`TempoControl.test.tsx`, `LoopControl.test.tsx` が無ければ新規作成、`Toolbar.test.tsx`に追記）。`App.tsx`が`loopRange`をストア値から生成して`ScoreRenderer`に渡すことを検証するテスト（`App.test.tsx`）。
2. テストを実行し、失敗（red）を確認してコミットする。
3. `TempoControl.tsx` / `LoopControl.tsx` / `PracticeModeSelector.tsx` / `Toolbar/index.tsx` に日本語ラベル・`title`属性を追加する。
4. `FingeringPanel/index.tsx:77` のラベルを「運指対象:」に変更する。
5. `practice-slice.ts` の`loopStart`/`loopEnd`初期値を`LoopControl`のバリデーションと整合させる。
6. `App.tsx:159` の`loopRange={null}`を、`loopEnabled ? { start: loopStart, end: loopEnd } : null`のようなロジックに置き換える。必要なストア値（`loopEnabled`, `loopStart`, `loopEnd`）を`useShallow`のselectorに追加する。
7. `osmd-controller.ts`の`drawLoopBracket`を最小限実装し、`ScoreRenderer`から`loopRange`変更時に呼び出す配線を追加する（`ScoreRenderer/index.tsx`に`loopRange`変更を監視する`useEffect`を追加）。
8. テストが通る（green）ことを確認する。
9. `npm run dev`で手動E2E確認: 全コントロールに日本語ラベルが表示され、ホバーでツールチップが出ること、ループ範囲設定で楽譜上に範囲が表示されること。

### 注意事項

- 「手:」（運指対象）と「練習対象」（Left/Right/Both）は機能として統合せず、区分を明確にする方針（分析レポートの修正方針「統合または明確な区分」のうち区分を採用）。統合すると運指計算対象と演奏対象が常に一致する前提になり、右手を練習しながら左手の運指のみ確認する等のユースケースを壊すため。
- Metronomeチェックボックスの死にコントロール状態はTASK-027で結線されるため、本タスクではラベル・ツールチップ付与のみ行い、機能結線はTASK-027に委ねる（重複実装を避ける）。
- `drawLoopBracket`の実装は最小限（矩形や色付けなど）にとどめ、詳細なビジュアルデザインは本タスクのスコープ外とする。
- 日本語ラベル追加時、`data-testid`は変更しない（既存テストの安定性を保つため）。

## 受入基準

- [x] テンポスライダー・BPM欄に日本語ラベルとツールチップが付与されている
- [x] ループ開始・終了小節欄に日本語ラベルとツールチップが付与されている
- [x] 「手:」（運指対象）と練習対象パート選択（Left/Right/Both）が異なるラベルで区別できる
- [x] Metronome/Loopチェックボックスに日本語ラベルが付与されている
- [x] 「Open File」「Settings」など主要な英語ラベルが日本語化されている
- [x] `loopStart`/`loopEnd`の初期値が`start < end`のバリデーションと矛盾しない
- [x] `App.tsx`の`loopRange`がストアの`loopEnabled`/`loopStart`/`loopEnd`から生成され、ハードコード`null`が解消されている
- [ ] ループ有効時に楽譜上でループ範囲が可視化される。根拠: `osmd-controller.test.ts`と`ScoreRenderer.test.tsx`のユニットテストで`drawLoopBracket`/`clearLoopBracket`の呼び出しとSVG矩形描画を検証済み。ただし本環境はGUIを起動できないため、実際に`npm run dev`でElectron/ブラウザを開いての目視確認は未実施。実機確認が必要。
- [x] 死にコントロール（クリックしても何も起きないUI）が残っていない（コードレビューで全コントロールがstoreないしaudioEngine/osmdControllerへ結線済みであることを確認。目視でのUI操作確認は上記と同様に未実施）
- [x] 既存のテストが通る（`npm run test -- --run` 251件全件パス）
- [x] 新規テストが追加されている

## テスト項目

- [x] （新規）TempoControlの各要素に期待する日本語ラベル・title属性が存在する
- [x] （新規）LoopControlの各要素に期待する日本語ラベル・title属性が存在する
- [x] （新規）FingeringPanelの「手:」ラベルが「運指対象:」等に変更されている
- [x] （新規）PracticeModeSelectorに練習対象を示すグループラベルが存在する
- [x] （新規）App.tsxが`loopEnabled`/`loopStart`/`loopEnd`から`loopRange`を正しく生成する
- [ ] （手動E2E）ループ範囲を設定し有効化すると楽譜上に範囲が表示される（本環境でGUI起動不可のため未実施。`osmd-controller.test.ts`のユニットテストで描画ロジック自体は検証済み）
- [x] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリー

TempoControl / LoopControl / PracticeModeSelector / FingeringPanel / Toolbar(設定ボタン) / App.tsx(ファイルを開く) の全コントロールに日本語ラベル・ツールチップ（`title`属性）を付与した。これによりNFR-U-002準拠のUIに改善した。「手:」ドロップダウンは「運指対象:」に変更し、`PracticeModeSelector`の「練習対象:」グループラベルと区別できるようにした。`practice-slice.ts`の`loopStart`/`loopEnd`初期値を`1`/`2`に変更しバリデーションと整合させた。`App.tsx`の`loopRange={null}`ハードコードを解消し、ストアの`loopEnabled`/`loopStart`/`loopEnd`から実際の値を生成して`ScoreRenderer`へ渡すよう修正した。`osmd-controller.ts`の`drawLoopBracket`/新設`clearLoopBracket`を実装し、ループ範囲に該当する音符座標のバウンディングボックスに破線矩形を描画する最小実装とした（詳細なビジュアルはTASK-033で本格実装予定）。`ScoreRenderer`に`loopRange`変更を監視する`useEffect`を追加し、`OSMDController`へ結線した。

TDDに従い、各コントロールの日本語ラベル・title属性、App.tsxのloopRange生成ロジック、OSMDControllerのループブラケット描画/削除を検証する新規テストをRed状態で先にコミットし、実装後に全テストがGreenになることを確認した。

- `npm run test -- --run`: 251 tests passed（既存231件 + 新規20件）
- `npm run typecheck`: エラーなし
- `npm run lint`: エラーなし
- 実機（`npm run dev`でのブラウザ/Electron目視）確認: 本エージェント実行環境ではGUIを起動できないため未実施。ループ範囲の楽譜上可視化と全コントロールの死活について、ユーザー側での実機確認を推奨する。

## 情報の明確性

### 明示された情報

- 根本原因のfile:line（分析レポート原因4、実コードで検証済み）。対象はTempoControl.tsx, LoopControl.tsx, FingeringPanel/index.tsx:73-96, PracticeModeSelector.tsx:52-76。ほかにApp.tsx:159, practice-slice.ts:37-38, osmd-controller.ts:98-100も対象である。
- 実装対象: 全コントロールへの日本語ラベル・ツールチップ付与、「手:」ドロップダウンと練習対象パート選択の区分明確化（運指用は「運指対象」と明示）。加えてApp.tsx:159のloopRange={null}ハードコード解消とループ範囲可視化、ループ小節欄初期値のバリデーション整合、死にコントロールの解消

### 不明/要確認の情報

- なし（すべて確認済み）
