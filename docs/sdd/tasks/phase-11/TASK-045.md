# TASK-045: MIDIデバイス選択とズーム/鍵盤高さ設定UI

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-045 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 60分 |
| 依存タスク | TASK-040 |

## 背景

### 問題の概要

設定まわりの3機能がUIから到達不能のまま要件未達になっている。

1. MIDIデバイス選択が未実装: 複数デバイス接続時に使用デバイスを選べない（REQ-004-008）。
2. ズームUIが存在しない: 表示倍率を変更する手段がない（REQ-002-006）。E2Eはstore直呼びで検証しており欠落を隠蔽。
3. 鍵盤の高さ（pianoHeight）が設定不能な固定値。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md` M2・M3）

### 根本原因

- `WebMidiService.getDevices`（`src/renderer/src/lib/midi/web-midi.ts:22`）は実装済みだが呼び出しゼロ。設定キー `midi.selectedDeviceId`（`src/main/settings.ts:5,13`）は定義済みだが読み手ゼロ。しかも `web-midi.ts:32` は**全ての**MIDI入力に `onmidimessage` をバインドしており、デバイスを選ぶ概念自体がない。
- `setZoom`（`src/renderer/src/store/slices/ui-slice.ts:28`）は実装済み・`ScoreRenderer` への結線も済みだが、呼び出すUIが存在しない。
- `pianoHeight` はstoreに値（`ui-slice.ts:25`、150固定）はあるがsetterがない。electron-store側デフォルト（`settings.ts:15`）は120であり、store初期値と不整合。

### 関連する仕様

- REQ-004-008: ユーザーが複数のMIDIデバイスを接続している時、システムは設定画面から使用デバイスを選択できなければならない
- REQ-002-006: ユーザーが表示倍率を変更した時、システムは楽譜のサイズを即座に更新しなければならない
- `docs/sdd/requirements/traceability.md` REQ-004-008行・REQ-002-006行（TASK-045参照が記載済み）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/SettingsModal/index.tsx`
  - 変更内容: (1) MIDI入力デバイス選択select（`WebMidiService.getDevices` の一覧を表示、選択値を `settings.set('midi', ...)` で `midi.selectedDeviceId` へ保存、変更を即時反映）。(2) 鍵盤高さ（pianoHeight）の設定UI（数値入力またはスライダー。`ui` 設定への保存とstore即時反映）。
- ファイル: `src/renderer/src/lib/midi/web-midi.ts`
  - 変更内容: 選択デバイスのみに `onmidimessage` をバインドするAPIを追加する（例: `setSelectedDevice(deviceId | null)`。`null` は従来どおり全デバイス＝既定動作）。デバイス脱着（`devices-changed`）時も選択を維持する。
- ファイル: `src/renderer/src/hooks/useMidi.ts`（または結線箇所）
  - 変更内容: 起動時に `midi.selectedDeviceId` を読み込んで適用し、SettingsModalでの変更に追従する。
- ファイル: `src/renderer/src/components/Toolbar/index.tsx`（または SettingsModal）
  - 変更内容: ズームUI（例: 拡大/縮小ボタンまたはselect）を追加し、`setZoom` を呼ぶ。
- ファイル: `src/renderer/src/store/slices/ui-slice.ts`
  - 変更内容: `setPianoHeight` アクションを追加する。あわせて `pianoHeight` 初期値（150）とelectron-storeデフォルト（120）の不整合を解消する（起動時ロードで揃える）。
- ファイル: 各テスト（SettingsModal / web-midi / ui-slice / ズームUI）

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: (a) SettingsModalにデバイス一覧が表示され選択がsettingsに保存される、(b) `setSelectedDevice` 指定時に選択デバイスのみへバインドされる、(c) 起動時に `midi.selectedDeviceId` が適用される、(d) ズームUI操作で `setZoom` が呼ばれ `ScoreRenderer` の `zoom` propが変わる、(e) `setPianoHeight` でstoreが更新されPianoKeyboardの `height` propが変わる。
2. テストを実行し、失敗（red）を確認してコミットする。
3. `web-midi.ts` にデバイス選択APIを実装する。
4. SettingsModalにデバイス選択・鍵盤高さUIを追加する（TASK-040で確立した「electron-store保存＋store即時反映＋失敗時ロールバック」パターンに従う）。
5. ズームUIを実装する。
6. 起動時ロード（`App.tsx` の既存settingsロードeffect）に `ui.zoom` / `ui.pianoHeight` / `midi.selectedDeviceId` の反映を追加する。
7. テストが通る（green）ことを確認し、traceability.mdの REQ-004-008・REQ-002-006 行を更新する。

### 注意事項

- 依存タスクTASK-040がSettingsModalの「store即時反映＋ロールバック」パターンを確立するため、完了後に着手し同じパターンを踏襲すること。
- 保存済み `selectedDeviceId` のデバイスが接続されていない場合は全デバイス受付（または明示的な未接続表示）へフォールバックし、例外を出さない。
- E2Eのズーム検証がstore直呼び（`__e2eStore__` 経由）になっている場合、UI経由の操作に置き換えるか、UIテストを別途追加する（空虚検証の温存禁止。TASK-046の方針と整合）。
- ズームUIの配置（ToolbarかSettingsModalか）は実装時に決定してよいが、REQ-002-006の「即座に更新」を満たすこと（モーダルを閉じないと反映されない設計は不可）。
- pianoHeightには妥当な範囲のクランプ（例: 80〜300px）を設け、テストで固定する。

## 受入基準

- [x] SettingsModalに接続中のMIDI入力デバイス一覧が表示され、選択できる（REQ-004-008）
- [x] 選択したデバイスのみからMIDI入力を受け付け、選択は `midi.selectedDeviceId` に永続化され再起動後も有効
- [x] UIから表示倍率を変更でき、楽譜サイズが即座に更新される（REQ-002-006）
- [x] UIから鍵盤の高さを変更でき、PianoKeyboardに即時反映・永続化される
- [x] `pianoHeight` のstore初期値とelectron-storeデフォルトの不整合が解消されている
- [x] `docs/sdd/requirements/traceability.md` の REQ-004-008・REQ-002-006 行が更新されている
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規・コンポーネント）SettingsModal: デバイス一覧表示・選択・保存
- [x] （新規・ユニット）web-midi: 選択デバイスのみバインド／未接続デバイス選択時のフォールバック
- [x] （新規・結線）起動時に `midi.selectedDeviceId` / `ui.zoom` / `ui.pianoHeight` がstoreへ反映される
- [x] （新規・結線）ズームUI操作→`setZoom`→ScoreRendererの `zoom` prop更新
- [x] （新規・ユニット）`setPianoHeight` のクランプ挙動
- [x] （回帰）デバイス未選択（null）時は従来どおり全デバイスから入力を受け付ける
- [x] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリー

- `web-midi.ts` に `setSelectedDevice(deviceId: string | null)` / `getSelectedDevice()` を追加。
  `rebindInputs` を選択デバイスのみバインドするよう変更し、選択デバイスが現在接続されていない
  場合は例外を出さず全デバイスバインドへフォールバックする（選択自体は保持し、再接続時に
  再度絞り込む）。
- `ui-slice.ts` に `midiDeviceId` / `setMidiDeviceId`、`setPianoHeight`（80〜300pxクランプ）を追加。
  `pianoHeight` の初期値を150→120に変更し、electron-store側デフォルト（`settings.ts`）と統一
  （起動時ロードのタイミング差によるフラッシュを避けるため、値そのものを揃える方針とした）。
- `useMidi.ts` がstoreの `midiDeviceId` を購読し、変更のたびに `webMidiService.setSelectedDevice`
  へ反映するよう変更。起動時ロード（App.tsx）とSettingsModalでの変更のいずれも同じ経路で
  WebMidiServiceへ適用される。
- `usePractice.ts` の戻り値に `webMidiService` を追加し、App.tsxからSettingsModalへ
  propとして渡せるようにした（SettingsModalがデバイス一覧を取得するため）。
- `App.tsx` の起動時設定ロードeffectを拡張し、`practice` に加えて `ui`（zoom/pianoHeight）・
  `midi`（selectedDeviceId）もロードしてstoreへ反映するようにした。
- `SettingsModal/index.tsx` にMIDI入力デバイス選択UI（`webMidiService.getDevices()` の一覧＋
  「すべてのデバイス」）と鍵盤高さスライダー（80〜300px）を追加。いずれもTASK-040で確立した
  「store即時反映＋electron-store保存＋失敗時ロールバック」パターンに従う。
- `Toolbar` にズームUI（`ZoomControl`、select要素、50%〜400%）を追加し、`setZoom` を直接呼ぶ
  ことでモーダルを介さず即座に反映されるようにした（REQ-002-006の「即座に更新」要件を満たす）。
- SettingsModalの英語ラベルを日本語化（NFR-U-002）: 「設定」「練習」「既定のエラーモード」
  「正しい音を待つ」「誤りがあっても先へ進む」「既定でメトロノームを有効にする」
  「最近使ったファイル」「最近使ったファイルはありません」「完了」「閉じる」。
- `tests/e2e/app.spec.ts` のズーム検証を `__e2eStore__.getState().setZoom(4)` の直接呼び出しから
  `zoom-select` のUI操作（`selectOption('4')`）に置き換えた。
- テスト: `ui-slice.test.ts`（新規）、`web-midi.test.ts`（デバイス選択バインド／フォールバック）、
  `useMidi.test.tsx`（起動時反映・変更追従）、`usePractice.test.ts`（webMidiService公開）、
  `App.test.tsx`（ui/midi起動時ロード）、`SettingsModal.test.tsx`（デバイス選択・鍵盤高さ・
  日本語ラベル）、`ZoomControl.test.tsx`（新規）、`Toolbar.test.tsx`（ズームUI統合）を追加・更新。
  TDDでRed（全対象ファイルで失敗確認）→実装→Green（`npm run test` 276件全通過）を確認。
  `npm run typecheck` / `npm run lint` もパス。

## 情報の明確性

### 明示された情報

- 未実装の根拠（M2・M3、実コードで検証済み: `web-midi.ts:22` 呼び出しゼロ・:32 全デバイスバインド、`ui-slice.ts:28` の `setZoom` UI呼び出しゼロ、`ui-slice.ts:25` pianoHeight setterなし、`settings.ts:13,15` の設定キー）
- 実装方針: SettingsModalへのデバイス選択、ズームUI、pianoHeight setter追加（分析レポート承認待ち方針TASK-045）

### 不明/要確認の情報

- なし（すべて確認済み。ズームUIの配置は「即座に更新」の要件を満たす範囲で実装時判断）
