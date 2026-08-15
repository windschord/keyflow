/**
 * 楽譜ページの配置方向（MuseScore 式のページビュー切替）。
 * 'vertical' = A4 ページを縦に積み重ねて表示（既定） / 'horizontal' = 横に並べて表示。
 * 純 CSS のレイアウト切り替えであり、OSMD の再描画・noteId 座標キャッシュには
 * 影響しない。store（ui-slice）・ScoreRenderer・electron-store 設定のすべてで
 * 同じ型を共有する（型の重複定義による不整合を避けるため）。
 */
export type ScoreLayout = 'vertical' | 'horizontal';
