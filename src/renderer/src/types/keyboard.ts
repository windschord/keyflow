/**
 * 画面下鍵盤の鍵盤数プリセット（TASK-056）。実際の電子キーボード/ポータブル
 * キーボード製品でよく見られる鍵盤数（88/76/61/49）を表す。
 * store（ui-slice）・SettingsModal・PianoKeyboard・electron-store設定の
 * すべてで同じ型を共有する（型の重複定義による不整合を避けるため）。
 */
export type KeyboardSize = 88 | 76 | 61 | 49;

/** SettingsModalの選択肢・実行時バリデーションで使う許容値一覧。 */
export const KEYBOARD_SIZES: readonly KeyboardSize[] = [88, 76, 61, 49];
