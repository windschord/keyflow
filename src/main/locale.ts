export type Language = 'ja' | 'en';

/**
 * 保存済み設定値とOSロケールから表示言語を解決する純関数（TASK-099、REQ-016-002/005）。
 * Renderer側（src/renderer/src/lib/i18n/resolve-language.ts）と同一規則だが、
 * main/rendererは別プロセス・別バンドルのため定義は独立して持つ（既存パターン）。
 *
 * - 保存値が`'ja'`/`'en'`ならそのまま採用する
 * - `'auto'`・不正値・未定義の場合はosLocaleが`ja`始まりなら`'ja'`、
 *   それ以外は`'en'`とする
 */
export function resolveLanguage(stored: unknown, osLocale: string): Language {
  if (stored === 'ja' || stored === 'en') return stored;

  return osLocale.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
