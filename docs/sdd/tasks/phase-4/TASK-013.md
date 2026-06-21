# TASK-013: Toolbar / Controls UI実装

**ステータス**: TODO
**推定工数**: 40分
**依存**: TASK-010

---

## 説明

練習操作に必要なツールバーUIを実装する。
右手/左手/両手モード切替・テンポスライダー・メトロノーム・ループ設定を含む。

## 対象ファイル

- `src/renderer/src/components/Toolbar/index.tsx` — メインツールバー
- `src/renderer/src/components/Toolbar/PracticeModeSelector.tsx` — 右手/左手/両手ボタン
- `src/renderer/src/components/Toolbar/TempoControl.tsx` — BPMスライダー+数値入力
- `src/renderer/src/components/Toolbar/LoopControl.tsx` — ループ範囲設定

## 実装すべきUI要素

### PracticeModeSelector
```tsx
// 右手 / 左手 / 両手 の3ボタン（ラジオボタン形式）
// キーボードショートカット: R/L/B キー
```

### TempoControl
```tsx
// スライダー: min=20% of original, max=200% of original
// 数値入力フィールド（直接BPM入力）
// 「元に戻す」ボタン（originalBpmにリセット）
// メトロノームON/OFFトグル
```

### LoopControl
```tsx
// 開始小節・終了小節の数値入力
// ループON/OFFトグル
// ループ回数カウンター表示
```

## キーボードショートカット

```typescript
// グローバルキーハンドラー（useEffect + document.addEventListener）
'Space': 再生/停止
'KeyR': practiceMode = 'right'
'KeyL': practiceMode = 'left'
'KeyB': practiceMode = 'both'
```

## 受入基準

- [ ] 「右手」ボタンクリックで `practiceMode` が `'right'` になる
- [ ] BPMスライダー操作で `bpm` が即時更新される
- [ ] BPM数値入力フィールドが20〜400の範囲でバリデーションされる
- [ ] ループ開始小節 >= 終了小節の場合にエラー表示される
- [ ] キーボードショートカット（R/L/B/Space）が動作する

**依存関係**: TASK-010
