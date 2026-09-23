import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LibraryEntry } from '../../types/library';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { usePracticeStore } from '../../store';
import { formatMessage } from '../../lib/i18n/format';
import {
  filterLibraryEntries,
  sortLibraryEntries,
  formatLibraryDateShort,
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
  /**
   * CodeRabbit #46指摘4対応: App.tsx側で欠損エントリの削除が成功した場合など、
   * 本コンポーネントの外側で一覧に影響する変更が起きた際にこの値をインクリメントすると
   * `getAll()`を再実行して一覧を再取得する。値そのものに意味はなく変化のみを見る。
   */
  reloadSignal?: number;
  /**
   * 楽譜表示への復帰導線（TASK-105、REQ-017-012）。指定時のみ画面上部に
   * 「楽譜へ戻る」ボタンを表示する。App.tsx側は楽譜読み込み済みのときのみ渡す。
   */
  onReturnToScore?: () => void;
  /** 設定（歯車）ボタンクリック時に呼ばれる。ライブラリ画面はヘッダー非表示のため、
   *  タイトル行に配置したボタンから設定モーダルを開く（App.tsx側が結線）。 */
  onOpenSettings?: () => void;
}

const SORT_KEYS: readonly LibrarySortKey[] = ['title', 'addedAt', 'lastOpenedAt'];

/* 内联 SVG 图标（继承 currentColor） */
const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const RetryIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 12a9 9 0 1 0 2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

const MusicIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const PianoIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="7" width="20" height="10" rx="2" />
    <path d="M5.5 7v3M9 7v3M12.5 7v3M16 7v3M19.5 7v3" />
  </svg>
);

const FolderIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

interface SortDropdownProps {
  id: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  /** 触发按钮中显示的前缀文本，例如 "Sort by"。 */
  prefix?: string;
}

/**
 * 库页面的自定义下拉选择器。
 * 原生 <select> 的展开列表由操作系统渲染，无法统一为极简设计系统
 * （会出现直角边框与蓝色悬停），因此用 button + popover 重新实现。
 */
const SortDropdown: React.FC<SortDropdownProps> = ({ id, value, options, onChange, prefix }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const triggerLabel = prefix ? `${prefix}: ${selectedLabel}` : selectedLabel;

  return (
    <div className="kf-dropdown" ref={containerRef}>
      <button
        id={id}
        type="button"
        className="kf-dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="kf-dropdown__menu" role="listbox" aria-labelledby={id}>
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`kf-dropdown__item${selected ? ' kf-dropdown__item--selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                <span className="kf-dropdown__check" aria-hidden="true">
                  <CheckIcon />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenEntry,
  onOpenFileDialog,
  missingPaths,
  reloadSignal,
  onReturnToScore,
  onOpenSettings,
}) => {
  const t = useTranslation();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  // CodeRabbit #46 Major指摘5: getAll()失敗を「0件の空状態」と区別して表示するためのフラグ。
  const [loadError, setLoadError] = useState(false);
  // 再読み込みボタン押下時にuseEffectを再実行させるためのトークン（値自体に意味はない）。
  const [retryToken, setRetryToken] = useState(0);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<LibrarySortKey>('lastOpenedAt');
  const [sortOrder, setSortOrder] = useState<LibrarySortOrder>('desc');
  const [confirmTarget, setConfirmTarget] = useState<LibraryEntry | null>(null);
  // CodeRabbit #46 Major指摘6: 削除確認ダイアログのアクセシビリティ
  // （AboutModal.tsxと同パターン: 初期フォーカス移動・閉じた際のフォーカス復帰）。
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const result = await window.electronAPI.library.getAll();
        if (!cancelled) {
          setEntries(result);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [retryToken, reloadSignal]);

  useEffect(() => {
    if (!confirmTarget) return undefined;

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmDialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setConfirmTarget(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [confirmTarget]);

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
      // CodeRabbit #46 Major指摘5: 削除失敗時も一覧は維持しつつユーザーへ通知する。
      alert(formatMessage(t.library.deleteErrorMessage, { title: target.title }));
    }
  };

  const handleRetryLoad = (): void => {
    setRetryToken((current) => current + 1);
  };



  // ライブラリ画面ではヘッダーが非表示のため、トップバーにファイル・設定の
  // カプセルボタンを配置する。

  const topBar = (
    <header className="kf-library__topbar">
      <div className="kf-library__brand">
        <span className="kf-library__brand-icon" aria-hidden="true">
          <MusicIcon />
        </span>
        <span className="kf-library__brand-text">KeyFlow</span>
      </div>
      <div className="kf-library__topbar-actions">
        {onReturnToScore && (
          <button
            type="button"
            onClick={onReturnToScore}
            data-testid="library-return-to-score-button"
            className="kf-pill-btn"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            {t.library.returnToScoreButton}
          </button>
        )}
        {onOpenFileDialog && (
          <button
            type="button"
            onClick={onOpenFileDialog}
            aria-label={t.header.openFileAriaLabel}
            title={t.header.openFileTitle}
            data-testid="library-open-file-button"
            className="kf-pill-btn"
          >
            <FolderIcon />
            <span>{t.library.emptyOpenFileButton}</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title={t.header.settingsTitle}
            aria-label={t.header.settingsAriaLabel}
            data-testid="library-settings-button"
            className="kf-pill-btn"
          >
            <SettingsIcon />
            <span>{t.header.settingsTitle}</span>
          </button>
        )}
      </div>
    </header>
  );

  const confirmDialog = confirmTarget ? (
    <div className="kf-modal">
      <div
        ref={confirmDialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.library.confirmDeleteTitle}
        tabIndex={-1}
        className="kf-modal__card"
      >
        <p className="kf-modal__title">
          <span style={{ color: 'var(--kf-danger)', display: 'inline-flex' }} aria-hidden="true">
            <TrashIcon />
          </span>
          {t.library.confirmDeleteTitle}
        </p>
        <p className="kf-modal__message">
          {formatMessage(t.library.confirmDeleteMessage, { title: confirmTarget.title })}
        </p>
        <div className="kf-modal__actions">
          <button className="kf-btn" onClick={() => setConfirmTarget(null)}>
            {t.library.confirmDeleteCancelButton}
          </button>
          <button className="kf-btn kf-btn--primary" onClick={handleConfirmDelete}>
            {t.library.confirmDeleteConfirmButton}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const controls = (
    <div className="kf-library__controls">
      <div className="kf-search">
        <span className="kf-search__icon">
          <SearchIcon />
        </span>
        <input
          type="search"
          aria-label={t.library.searchLabel}
          placeholder={t.library.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="kf-search__input"
        />
      </div>
      <div className="kf-library__sort">
        <label className="kf-library__field" htmlFor="library-sort-key">
          <span className="kf-sr-only">{t.library.sortKeyLabel}</span>
          <SortDropdown
            id="library-sort-key"
            value={sortKey}
            prefix={t.library.sortKeyLabel}
            options={SORT_KEYS.map((key) => ({ value: key, label: sortKeyLabels[key] }))}
            onChange={(value) => setSortKey(value as LibrarySortKey)}
          />
        </label>
        <label className="kf-library__field" htmlFor="library-sort-order">
          <span className="kf-sr-only">{t.library.sortOrderLabel}</span>
          <SortDropdown
            id="library-sort-order"
            value={sortOrder}
            prefix={t.library.sortOrderLabel}
            options={[
              { value: 'asc', label: t.library.sortOrderAsc },
              { value: 'desc', label: t.library.sortOrderDesc },
            ]}
            onChange={(value) => setSortOrder(value as LibrarySortOrder)}
          />
        </label>
      </div>
    </div>
  );

  const list = (
    <div className="kf-library-list" role="table" aria-label={t.library.title}>
      {visibleEntries.map((entry) => {
        const isMissing = missingPaths?.has(entry.path) ?? false;
        return (
          <div
            key={entry.path}
            role="row"
            className="kf-library-card"
            onClick={() => onOpenEntry(entry.path)}
          >
            <div className="kf-library-card__icon" role="cell" aria-hidden="true">
              <MusicIcon />
            </div>
            <div className="kf-library-card__main" role="cell">
              <button
                type="button"
                className="kf-library-card__title"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenEntry(entry.path);
                }}
              >
                {entry.title}
              </button>
              <span className="kf-library-card__composer">{entry.composer}</span>
              <div className="kf-library-card__meta">
                <span className="kf-library-card__date">
                  {formatLibraryDateShort(entry.lastOpenedAt)}
                </span>
                {isMissing && (
                  <span className="kf-badge--danger" title={t.library.missingTitle}>
                    {t.library.missingLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="kf-library-card__actions" role="cell">
              <span className="kf-library-card__chevron" aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </span>
              <button
                type="button"
                aria-label={formatMessage(t.library.deleteButtonAriaLabel, {
                  title: entry.title,
                })}
                className="kf-library-card__delete"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRequestDelete(entry);
                }}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div role="region" aria-label={t.library.title} className="kf-library">
      <div className="kf-library__panel">
        {topBar}
        <div className="kf-library__body">
          {loaded && loadError && (
            <div className="kf-empty">
              <div className="kf-empty__icon" aria-hidden="true">
                <FolderIcon />
              </div>
              <p className="kf-empty__title">{t.library.loadErrorTitle}</p>
              <p className="kf-empty__desc">{t.library.loadErrorDescription}</p>
              <button
                className="kf-btn kf-btn--primary kf-empty__action"
                onClick={handleRetryLoad}
              >
                <RetryIcon />
                {t.library.retryButton}
              </button>
            </div>
          )}

          {loaded && !loadError && entries.length === 0 && (
            <div className="kf-empty">
              <div className="kf-empty__icon" aria-hidden="true">
                <PianoIcon />
              </div>
              <p className="kf-empty__title">{t.library.emptyTitle}</p>
              <p className="kf-empty__desc">{t.library.emptyDescription}</p>
            </div>
          )}

          {!loaded && (
            <div className="kf-library-skeleton" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="kf-library-skeleton__card">
                  <span className="kf-library-skeleton__icon" />
                  <span className="kf-library-skeleton__lines">
                    <span className="kf-library-skeleton__line kf-library-skeleton__line--title" />
                    <span className="kf-library-skeleton__line kf-library-skeleton__line--meta" />
                  </span>
                </div>
              ))}
            </div>
          )}

          {loaded && entries.length > 0 && (
            <>
              <div className="kf-library__heading">
                <h1 className="kf-library__heading-title">{t.library.title}</h1>
                <span className="kf-library__heading-badge">{entries.length}</span>
              </div>
              {controls}
              {visibleEntries.length === 0 ? (
                <div className="kf-empty">
                  <div className="kf-empty__icon" aria-hidden="true">
                    <SearchIcon />
                  </div>
                  <p className="kf-empty__title">{t.library.noResults}</p>
                </div>
              ) : (
                list
              )}
            </>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
};
