# QuickPanelが表示されない問題の分析（2026-07-08）

## 問題事象

| 項目 | 内容 |
|------|------|
| 現象 | ヘッダー右上の三点ドット（⋯）をクリックしても何も起きず、QuickPanelが表示されない。QuickPanel内へ移設したメトロノームON/OFFに到達できない |
| 期待動作 | ⋯クリックでQuickPanel（音量・表示倍率・運指・メトロノーム・成績）がヘッダー直下に表示される（REQ-012-002） |
| 再現手順 | アプリ起動 → ヘッダー右上の⋯をクリック |
| 発生環境 | ユーザー実機（macOS、feature/phase-15-uiux-improvements）。パッケージ版・開発版の両方で再現する（環境非依存、後述） |
| 報告 | 2026-07-08 ユーザー実機確認 |

## 根本原因

**Headerルート要素の `overflow: 'hidden'`（`src/renderer/src/components/Header/index.tsx:78`）が、内部に絶対配置されたPopoverをクリップしている。**

- Popoverは `position: relative` なラッパー（Header内、`index.tsx:113-121`）を包含ブロックとして `position: absolute; top: 100%` で配置される（`Popover.tsx:69-70`）。つまり描画位置はヘッダーの外（下）
- Headerルートは1行レイアウト維持のため `height: 48px; overflow: hidden` を指定しており、絶対配置の子孫であってもこのボックスで切り取られる（CSSの仕様どおりの挙動）
- 結果、⋯クリックによりstateは正しくトグルされ、PopoverもDOMへ挿入されるが、視覚上、上端の数pxしか残らない

### 実測による裏付け（実バイナリ + Playwright、scratchpadの検証スクリプト）

```json
{
  "headerBottom": 48,
  "popoverTop": 45.5,
  "popoverHeight": 452.3,
  "headerOverflow": "hidden",
  "hitIsInsidePopover": false,
  "hitElement": "DIV testid=score-scroll-container"
}
```

Popover（高さ452px）の中心座標での `document.elementFromPoint` はPopoverではなく背後の楽譜コンテナを返した。クリップにより不可視・操作不能であることが確定。

## E2Eテストがすり抜けた理由（テストエスケープ）

`tests/e2e/app.spec.ts` のQuickPanel検証は以下を使用していた:

- `expect(quick-panel).toBeVisible()` — Playwrightのvisible判定は「バウンディングボックスが空でない かつ visibility:hidden/display:noneでない」のみで、**祖先のoverflowクリッピングを考慮しない**。約2pxの残存領域で通過した
- `fill()` / `selectOption()` — フォーカス・値設定ベースの操作で、**クリック座標のヒットテストを伴わない**。クリップされた要素にも成功する

「E2Eはユーザー観測可能な結果を合格条件にする」原則（2026-07-05再発防止策）に対し、視覚的な到達可能性が検証できていなかった。座標ヒットテストを伴う実クリック（`click()`）であれば本問題で失敗していた。

## 仕様との照合

- REQ-012-002（ポップオーバー表示）・REQ-012-003（閉じる操作）: 仕様は正しい。**実装バグ**（overflow:hiddenの副作用の見落とし）
- design/components/header.md はPopoverを「アンカー直下にabsolute表示」と規定しており、ヘッダー側のoverflow指定との相互作用に言及がない（設計の記載不足も一因）

## 修正方針の選択肢

| 案 | 内容 | 評価 |
|----|------|------|
| C) Popoverをoverflow:hiddenの外へ移動（推奨） | Headerを「外側ラッパー（position:relative、overflowなし）＋内側1行row（overflow:hidden）」に再構成し、Popoverを外側ラッパー直下に置く | クリップ回避と「極小幅で1行を維持する」意図の両立。変更はHeader内に閉じる |
| A) overflow:hiddenを単純削除 | Headerルートのoverflow指定を外す | 最小変更だが、極小幅時にコントロールがウィンドウ外へはみ出し水平スクロールが発生し得る |
| B) Portal化 | PopoverをcreatePortalでbody直下に描画し、アンカー座標から位置決め | あらゆる祖先クリップに強いが、リサイズ追従等の実装が増え過剰 |

いずれの案でも、E2Eに「QuickPanel内コントロールの実クリック（座標ヒットテストを伴う`click()`）＋ユーザー観測可能な結果」の検証を追加し、本すり抜けを再発防止する。

## 修正タスク

- [TASK-078](../../tasks/phase-15/TASK-078.md): 方針C（ユーザー承認済み、2026-07-08）で修正
