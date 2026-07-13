import Store from 'electron-store';

/**
 * 楽譜ライブラリの1エントリ（US-017）。pathが一意キー。
 * renderer側（src/renderer/src/types/library.ts）と同じ形だが、main/rendererは
 * 別プロセス・別バンドルのため型定義は独立して持つ（AppSettings等の既存パターン）。
 */
export interface LibraryEntry {
  path: string;
  title: string;
  composer: string;
  addedAt: string;
  lastOpenedAt: string;
}

interface LibraryStoreSchema {
  entries: LibraryEntry[];
}

const DEFAULT_LIBRARY_STORE: LibraryStoreSchema = { entries: [] };

/**
 * `JSON.parse` 済みの生データを `LibraryEntry` として検証・正規化する（TASK-101）。
 * アノテーション読み込み（TASK-092）と同方針のフェイルソフト検証。
 * `path` が非空文字列でない要素は不正とみなし `null` を返す（呼び出し側で除外）。
 */
function normalizeEntry(value: unknown): LibraryEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (typeof v.path !== 'string' || v.path.length === 0) return null;

  const now = new Date().toISOString();
  return {
    path: v.path,
    title: typeof v.title === 'string' ? v.title : '',
    composer: typeof v.composer === 'string' ? v.composer : '',
    addedAt: typeof v.addedAt === 'string' ? v.addedAt : now,
    lastOpenedAt: typeof v.lastOpenedAt === 'string' ? v.lastOpenedAt : now,
  };
}

export class LibraryService {
  private store: Store<LibraryStoreSchema>;

  /**
   * @param options.cwd テスト用にストアファイルの保存先ディレクトリを差し替える
   *   （SettingsServiceと同パターン）。省略時はelectron-store既定の解決に従う。
   *   本番コードでは指定しない。
   */
  constructor(options?: { cwd?: string }) {
    this.store = new Store<LibraryStoreSchema>({
      name: 'library',
      defaults: DEFAULT_LIBRARY_STORE,
      cwd: options?.cwd,
    });
  }

  /**
   * 全エントリを取得する。フェイルソフト検証（TASK-092と同方針）を経由するため、
   * ストアファイルが外部改変され不正な要素を含んでいても例外を投げず除外する。
   */
  getAll(): LibraryEntry[] {
    const rawEntries = this.store.get('entries');
    const list = Array.isArray(rawEntries) ? rawEntries : [];
    const result: LibraryEntry[] = [];
    for (const raw of list) {
      const entry = normalizeEntry(raw);
      if (entry !== null) result.push(entry);
    }
    return result;
  }

  /**
   * pathをキーに登録・更新する（REQ-017-001/002）。既存pathは
   * title/composer/lastOpenedAtのみ更新しaddedAtは維持する。新規はaddedAtも記録する。
   */
  upsert(input: { path: string; title: string; composer: string }): void {
    const entries = this.getAll();
    const now = new Date().toISOString();
    const existingIndex = entries.findIndex((entry) => entry.path === input.path);

    if (existingIndex !== -1) {
      entries[existingIndex] = {
        ...entries[existingIndex],
        title: input.title,
        composer: input.composer,
        lastOpenedAt: now,
      };
    } else {
      entries.push({
        path: input.path,
        title: input.title,
        composer: input.composer,
        addedAt: now,
        lastOpenedAt: now,
      });
    }

    this.store.set('entries', entries);
  }

  /**
   * 対象pathのエントリのみ削除する。ファイル本体・アノテーションは触らない（REQ-017-006）。
   */
  remove(path: string): void {
    const entries = this.getAll().filter((entry) => entry.path !== path);
    this.store.set('entries', entries);
  }
}
