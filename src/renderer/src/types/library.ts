/**
 * 楽譜ライブラリの1エントリ（US-017、TASK-101）。pathが一意キー。
 * main側（src/main/library.ts）と同じ形だが、main/rendererは別プロセス・別バンドルの
 * ため型定義は独立して持つ（AppSettings等の既存パターン）。
 */
export interface LibraryEntry {
  path: string;
  title: string;
  composer: string;
  addedAt: string;
  lastOpenedAt: string;
}

/** `library:open` の結果（TASK-101）。失敗時は例外ではなく理由付きの構造化値で返る。 */
export type LibraryOpenResult =
  { ok: true } | { ok: false; reason: 'not-found' | 'invalid-extension' };
