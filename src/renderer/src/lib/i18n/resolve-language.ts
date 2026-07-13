import type { Language } from './types';

/**
 * 保存済み設定値とOSロケールから表示言語を解決する純関数
 * （TASK-096、REQ-016-002/005）。
 *
 * - 保存値が`'ja'`/`'en'`ならそのまま採用する
 * - `'auto'`・不正値・未定義の場合はosLocaleが`ja`始まりなら`'ja'`、
 *   それ以外は`'en'`とする
 */
export function resolveLanguage(stored: unknown, osLocale: string): Language {
  if (stored === 'ja' || stored === 'en') return stored;

  return osLocale.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
