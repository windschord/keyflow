# TASK-106: [BugFix] ライブラリ往復時のOSMD再レンダリング抑止（即時復帰）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-106 |
| タイプ | fix（US-017 / REQ-017-012、2026-07-13実機フィードバック） |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 45分 |
| 依存タスク | TASK-105 |

## 背景

「楽譜へ戻る」を押した後、数秒間真っ白となる実装バグを修正する。根本原因分析は
[docs/sdd/troubleshooting/2026-07-13-library-return-blank/analysis.md](../../troubleshooting/2026-07-13-library-return-blank/analysis.md)
を参照（承認済み方針: 案A）。

原因の要点: `display:none`でコンテナが0×0になるとResizeObserver経由で幅0の
`osmd.render()`が走りSVGは破棄される。さらに復帰時にも楽譜全体の同期再レンダリングが走る。

## 実装内容

### 修正対象: `src/renderer/src/components/ScoreRenderer/osmd-controller.ts`

`handleResize()` に以下のガードを追加する。

1. **不可視スキップ**: コンテナが不可視（`clientWidth === 0 || clientHeight === 0`）の
   間は何もしない（SVGを破棄しない）
2. **同一サイズスキップ**: 直近に描画した際のコンテナサイズを記録し、サイズが
   変わっていなければ再レンダリングしない（隠す→同一サイズで戻すの往復を無再描画にする）
3. **保留フラグ**: 不可視中に描画要求（`setZoom`等のrender経路）が発生した場合は
   即時renderせず保留フラグを立て、可視復帰時のResizeObserver発火で一度だけ
   再レンダリングする

### 注意事項

- ウィンドウリサイズ時の既存挙動（TASK-049: render→noteIdマップ再構築→
  オーバーレイ再適用）を変えない
- 記録する「描画時サイズ」は実際にrenderを実行した経路すべて（load/handleResize/
  保留消化等）で更新し、不整合を残さない
- StrictMode・dispose済みガード等の既存防御は維持する

## 実装手順（TDD）

1. テスト先行: osmd-controllerの単体テストへ以下を追加し、失敗を確認してコミット
   - サイズ0のリサイズ通知ではrenderが呼ばれない
   - 同一サイズへの復帰ではrenderが呼ばれない（SVG維持）
   - サイズが実際に変わった場合はrenderが呼ばれる（既存挙動の回帰なし）
   - 不可視中のsetZoomは保留され、可視復帰時に一度だけrenderされる
2. 実装してテストを通す
3. E2E: library.spec.tsの往復テストへ「戻った直後（再レンダリング待ちなし）に
   楽譜SVGが表示されている」ことのassertを強化する
4. 全チェック（test/typecheck/lint/lint:jp/format:check/test:e2e）通過を確認しコミット

## 受入基準

- [x] 楽譜を開いた状態でライブラリ→楽譜へ戻るの往復が即時（再レンダリングなし）で表示される
- [x] 不可視中に幅0のrenderが実行されない（SVGが破棄されない）
- [x] ウィンドウリサイズ時の再描画・オーバーレイ再適用の既存挙動に回帰がない
- [x] 不可視中のズーム変更が可視復帰時に正しく反映される
- [x] 全チェック通過

## テスト項目

- [x] サイズ0通知でrenderスキップ
- [x] 同一サイズ復帰でrenderスキップ
- [x] サイズ変更時はrender実行（回帰なし）
- [x] 不可視中のsetZoom→可視復帰で一度だけrender
- [x] E2E: 戻った直後にSVGが表示されている

## 完了サマリー

`osmd-controller.ts`のhandleResize/setZoomへ、不可視スキップ・同一サイズスキップ・
保留フラグの3ガードを追加した。直近描画時サイズは`lastRenderedWidth`/
`lastRenderedHeight`に記録し、load/handleResize/setZoom消化時すべてで更新する。
不可視中のsetZoomは`pendingRenderWhileHidden`を立てるのみとし、可視復帰時の
ResizeObserver発火で一度だけ描画して消化する。

既存のリサイズ・setZoom単体テスト3件は、jsdomのコンテナが既定でサイズ0となり
新ガードと矛盾するため、非0サイズを明示するよう調整した（意味は維持）。
新規テストはosmd-controller.test.tsへ4件追加し、library.spec.tsの往復テスト2箇所に
戻り直後500msでの即時可視assertを追加した。

チェック結果: unitテスト64ファイル922件全通過（新規4件含む）、typecheck/lint/
lint:jp/format:check全通過、E2E 8件全通過（library.spec.ts含む）。
コミット: d44a245（テスト先行）、37d6608（実装）。
