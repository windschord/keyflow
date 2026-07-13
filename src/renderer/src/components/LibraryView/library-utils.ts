import type { LibraryEntry } from '../../types/library';

/** 並べ替えキー（US-017、REQ-017-005）。 */
export type LibrarySortKey = 'title' | 'addedAt' | 'lastOpenedAt';

/** 並べ替え順序。 */
export type LibrarySortOrder = 'asc' | 'desc';

/**
 * タイトル・作曲者の部分一致でエントリを絞り込む（REQ-017-004）。大文字と小文字は
 * 区別しない。クエリが空文字（前後の空白のみを含む場合を含む）の場合は全件を返す。
 */
export function filterLibraryEntries(
  entries: readonly LibraryEntry[],
  query: string
): LibraryEntry[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return [...entries];

  return entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(normalized) ||
      entry.composer.toLowerCase().includes(normalized)
  );
}

/**
 * エントリをキー×順序で並べ替える（REQ-017-005）。`Array.prototype.sort`は
 * ES2019以降のNode/V8実装で安定ソートが仕様として保証されているため、
 * 同値キーの相対順序は入力配列の順序を維持する。
 */
export function sortLibraryEntries(
  entries: readonly LibraryEntry[],
  key: LibrarySortKey,
  order: LibrarySortOrder
): LibraryEntry[] {
  const factor = order === 'asc' ? 1 : -1;

  return [...entries].sort((a, b) => {
    if (key === 'title') {
      return a.title.localeCompare(b.title) * factor;
    }
    return (new Date(a[key]).getTime() - new Date(b[key]).getTime()) * factor;
  });
}

/**
 * ISO 8601形式の日時文字列を、実行環境のロケールに従った表示用文字列へ整形する。
 * 不正な値（Date変換できない文字列）はそのまま返す。
 */
export function formatLibraryDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
