import React, { useEffect, useMemo, useState } from 'react';
import type { LibraryEntry } from '../../types/library';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { formatMessage } from '../../lib/i18n/format';
import {
  filterLibraryEntries,
  sortLibraryEntries,
  formatLibraryDateTime,
  type LibrarySortKey,
  type LibrarySortOrder,
} from './library-utils';

interface LibraryViewProps {
  /** 一覧の行（タイトル）クリックで呼ばれる。開く処理自体はTASK-103で結線する。 */
  onOpenEntry: (path: string) => void;
  /** 空状態の「ファイルを開く」ボタンで呼ばれる。既存のダイアログ導線を再利用する。 */
  onOpenFileDialog: () => void;
  /**
   * `library:open`失敗により欠損と判明したpathの集合（REQ-017-008の表示部分）。
   * 検出処理自体はTASK-103のスコープであり、本コンポーネントは表示のみを担う。
   */
  missingPaths?: ReadonlySet<string>;
}

const SORT_KEYS: readonly LibrarySortKey[] = ['title', 'addedAt', 'lastOpenedAt'];

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenEntry,
  onOpenFileDialog,
  missingPaths,
}) => {
  const t = useTranslation();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<LibrarySortKey>('lastOpenedAt');
  const [sortOrder, setSortOrder] = useState<LibrarySortOrder>('desc');
  const [confirmTarget, setConfirmTarget] = useState<LibraryEntry | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const result = await window.electronAPI.library.getAll();
        if (!cancelled) setEntries(result);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleEntries = useMemo(
    () => sortLibraryEntries(filterLibraryEntries(entries, query), sortKey, sortOrder),
    [entries, query, sortKey, sortOrder]
  );

  const sortKeyLabels: Record<LibrarySortKey, string> = {
    title: t.library.sortKeyTitle,
    addedAt: t.library.sortKeyAddedAt,
    lastOpenedAt: t.library.sortKeyLastOpenedAt,
  };

  const handleRequestDelete = (entry: LibraryEntry): void => {
    setConfirmTarget(entry);
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    try {
      await window.electronAPI.library.remove(target.path);
      setEntries((current) => current.filter((entry) => entry.path !== target.path));
    } catch {
      // 削除失敗時は一覧をそのまま維持し、次回の一覧再取得での整合性に委ねる。
    }
  };

  if (loaded && entries.length === 0) {
    return (
      <div role="region" aria-label={t.library.title} style={styles.container}>
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>{t.library.emptyTitle}</p>
          <p style={styles.emptyDescription}>{t.library.emptyDescription}</p>
          <button style={styles.primaryButton} onClick={onOpenFileDialog}>
            {t.library.emptyOpenFileButton}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="region" aria-label={t.library.title} style={styles.container}>
      <h2 style={styles.heading}>{t.library.title}</h2>

      <div style={styles.controls}>
        <input
          type="search"
          aria-label={t.library.searchLabel}
          placeholder={t.library.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={styles.searchInput}
        />
        <label style={styles.selectLabel}>
          {t.library.sortKeyLabel}
          <select
            aria-label={t.library.sortKeyLabel}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as LibrarySortKey)}
            style={styles.select}
          >
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {sortKeyLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.selectLabel}>
          {t.library.sortOrderLabel}
          <select
            aria-label={t.library.sortOrderLabel}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as LibrarySortOrder)}
            style={styles.select}
          >
            <option value="asc">{t.library.sortOrderAsc}</option>
            <option value="desc">{t.library.sortOrderDesc}</option>
          </select>
        </label>
      </div>

      {visibleEntries.length === 0 ? (
        <p style={styles.noResults}>{t.library.noResults}</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.library.columnTitle}</th>
              <th style={styles.th}>{t.library.columnComposer}</th>
              <th style={styles.th}>{t.library.columnLastOpenedAt}</th>
              <th style={styles.th}>{t.library.columnActions}</th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => {
              const isMissing = missingPaths?.has(entry.path) ?? false;
              return (
                <tr key={entry.path}>
                  <td style={styles.td}>
                    <button style={styles.linkButton} onClick={() => onOpenEntry(entry.path)}>
                      {entry.title}
                    </button>
                    {isMissing && (
                      <span style={styles.missingBadge} title={t.library.missingTitle}>
                        {t.library.missingLabel}
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>{entry.composer}</td>
                  <td style={styles.td}>{formatLibraryDateTime(entry.lastOpenedAt)}</td>
                  <td style={styles.td}>
                    <button
                      aria-label={formatMessage(t.library.deleteButtonAriaLabel, {
                        title: entry.title,
                      })}
                      style={styles.deleteButton}
                      onClick={() => handleRequestDelete(entry)}
                    >
                      {t.library.deleteButton}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {confirmTarget && (
        <div style={styles.overlay}>
          <div role="dialog" aria-label={t.library.confirmDeleteTitle} style={styles.dialog}>
            <p style={styles.dialogMessage}>
              {formatMessage(t.library.confirmDeleteMessage, { title: confirmTarget.title })}
            </p>
            <div style={styles.dialogActions}>
              <button style={styles.secondaryButton} onClick={() => setConfirmTarget(null)}>
                {t.library.confirmDeleteCancelButton}
              </button>
              <button style={styles.dangerButton} onClick={handleConfirmDelete}>
                {t.library.confirmDeleteConfirmButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  heading: { margin: 0, fontSize: '1.25rem', fontWeight: 600 },
  controls: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
  },
  selectLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.875rem',
    color: '#374151',
  },
  select: { padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '0.75rem',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  td: { padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' },
  linkButton: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: '#2563eb',
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'left',
  },
  deleteButton: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #ef4444',
    color: '#ef4444',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.8125rem',
  },
  missingBadge: {
    marginLeft: '8px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    fontSize: '0.75rem',
  },
  noResults: { color: '#6b7280', fontSize: '0.875rem' },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '48px 16px',
    textAlign: 'center',
  },
  emptyTitle: { margin: 0, fontSize: '1.125rem', fontWeight: 600 },
  emptyDescription: { margin: 0, color: '#6b7280', fontSize: '0.875rem' },
  primaryButton: {
    padding: '8px 16px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    backgroundColor: '#fff',
    color: '#111827',
    borderRadius: '8px',
    minWidth: '320px',
    maxWidth: '90vw',
    padding: '20px 24px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
  dialogMessage: { margin: '0 0 16px 0', fontSize: '0.9375rem' },
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  secondaryButton: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    color: '#111827',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '8px 16px',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
  },
};
