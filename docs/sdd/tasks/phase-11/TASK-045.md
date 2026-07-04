# TASK-045: MIDIデバイス選択とズーム/鍵盤高さ設定UI

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-045 |
| タイプ | feature |
| ステータス | TODO |
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

- [ ] SettingsModalに接続中のMIDI入力デバイス一覧が表示され、選択できる（REQ-004-008）
- [ ] 選択したデバイスのみからMIDI入力を受け付け、選択は `midi.selectedDeviceId` に永続化され再起動後も有効
- [ ] UIから表示倍率を変更でき、楽譜サイズが即座に更新される（REQ-002-006）
- [ ] UIから鍵盤の高さを変更でき、PianoKeyboardに即時反映・永続化される
- [ ] `pianoHeight` のstore初期値とelectron-storeデフォルトの不整合が解消されている
- [ ] `docs/sdd/requirements/traceability.md` の REQ-004-008・REQ-002-006 行が更新されている
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている（必要な場合）

## テスト項目

- [ ] （新規・コンポーネント）SettingsModal: デバイス一覧表示・選択・保存
- [ ] （新規・ユニット）web-midi: 選択デバイスのみバインド／未接続デバイス選択時のフォールバック
- [ ] （新規・結線）起動時に `midi.selectedDeviceId` / `ui.zoom` / `ui.pianoHeight` がstoreへ反映される
- [ ] （新規・結線）ズームUI操作→`setZoom`→ScoreRendererの `zoom` prop更新
- [ ] （新規・ユニット）`setPianoHeight` のクランプ挙動
- [ ] （回帰）デバイス未選択（null）時は従来どおり全デバイスから入力を受け付ける
- [ ] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 情報の明確性

### 明示された情報

- 未実装の根拠（M2・M3、実コードで検証済み: `web-midi.ts:22` 呼び出しゼロ・:32 全デバイスバインド、`ui-slice.ts:28` の `setZoom` UI呼び出しゼロ、`ui-slice.ts:25` pianoHeight setterなし、`settings.ts:13,15` の設定キー）
- 実装方針: SettingsModalへのデバイス選択、ズームUI、pianoHeight setter追加（分析レポート承認待ち方針TASK-045）

### 不明/要確認の情報

- なし（すべて確認済み。ズームUIの配置は「即座に更新」の要件を満たす範囲で実装時判断）
