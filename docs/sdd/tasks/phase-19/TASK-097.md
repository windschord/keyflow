# TASK-097: 操作系UIの文言外部化（Header・Toolbar・Stats・Fingering・NoteContextMenu）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-097 |
| タイプ | feat（US-016） |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 90分 |
| 依存タスク | TASK-096 |

## 背景

US-016のREQ-016-007（全UI文言への適用）のうち、操作系コンポーネント群を翻訳キー化する。
設計は [design/components/i18n.md](../../design/components/i18n.md) を正とする。

## 実装内容

### 対象コンポーネント

- `components/Header/`（index.tsx・QuickPanel.tsx・MetronomeToggle.tsx・Popover.tsx）
- `components/Toolbar/` 配下の各コントロール（PlaybackControls / LoopControl /
  TempoControl / PracticeModeSelector / VolumeControl / ZoomControl / FingeringToggle）
- `components/StatsDisplay/`
- `components/FingeringPanel/`
- `components/NoteContextMenu/`
- `components/PianoKeyboard/`・`components/ScoreRenderer/` にUI文言（aria-label等）が
  あれば対象に含める

### 作業内容

1. 対象コンポーネントの表示文言・`aria-label`・`title`属性・プレースホルダを洗い出す
2. `lib/i18n/ja.ts` へコンポーネント別の名前空間で追加し、`en.ts` へ対訳を追加する
3. 各コンポーネントを `useTranslation()` 経由の参照へ置き換える
4. 既存テストの文言参照（getByText / getByRole name等）が壊れた場合は、テストも
   ja.tsの値を参照する形へ更新する（期待値の意味を変えない。テストを弱めない）

### 注意事項

- 固有名詞（音色名のSalamander等のクレジット文言）は翻訳対象外。ただし音色の表示名
  （グランドピアノ/Grand Piano等）は翻訳対象
- 可変値埋め込みは `formatMessage` を使う（文字列連結でメッセージを組み立てない）
- 英訳はUI幅を考慮して簡潔にする（ヘッダーは1行48pxレイアウト、US-012）

## 実装手順（TDD）

1. 対象コンポーネントごとに文言を洗い出し、ja/enリソースを追加
2. コンポーネント置き換え→`npm run test`で既存テストの回帰を確認
3. 言語を`en`に切り替えた場合の表示テストを主要コンポーネントに追加
   （ui-sliceのsetLanguage後にボタンのアクセシブルネームが英語になる等）
4. 全チェック（test/typecheck/lint/lint:jp:ts/format:check）通過を確認しコミット

## 受入基準

- [x] 対象コンポーネントにハードコードされた日本語UI文言が残っていない
- [x] `en` 切り替え時に対象コンポーネントの文言・aria-labelが英語表示になる
- [x] 既存テストが全通過（文言参照の更新はja.ts参照へ置き換え）
- [x] 全チェック通過

## テスト項目

- [x] Header: 言語enでボタン群のアクセシブルネームが英語になる
- [x] Toolbar系コントロール: 代表2つ以上で言語切り替えの表示テスト
      （PlaybackControls・FingeringToggle）
- [x] 既存テストスイートの回帰なし（814件→817件、全通過）

## 完了サマリー（2026-07-12）

Header・QuickPanel・MetronomeToggle・Toolbar配下7コントロール（PlaybackControls/
LoopControl/TempoControl/PracticeModeSelector/VolumeControl/ZoomControl/
FingeringToggle）・StatsDisplay・FingeringPanel・NoteContextMenu・ScoreRenderer
（プレースホルダのみ）の表示文言・aria-label・title属性を`useTranslation()`経由へ
置き換えた。PianoKeyboardはcanvas描画（矢印記号・指番号のみ）で翻訳対象の
UI文言が存在しないため対象外。

`ja.ts`/`en.ts`へ13の名前空間（header/quickPanel/metronome/playbackControls/
loopControl/tempoControl/practiceModeSelector/volumeControl/zoomControl/
fingeringToggle/statsDisplay/fingeringPanel/noteContextMenu/scoreRenderer）を
追加した。既存の日本語文言を`ja.ts`の値としてそのまま採用したため、既存テスト
814件は無変更のまま全通過（`beforeEach`へ`language: 'ja'`の明示追加のみ）。
可変値埋め込み（NoteContextMenuのnoteId、FingeringPanelの対象手ラベル）は
`formatMessage()`を使用し文字列連結を避けた。

言語en切り替え時のアクセシブルネーム検証テストをHeader.test.tsx・
PlaybackControls.test.tsx・FingeringToggle.test.tsxへ追加（3件）。
