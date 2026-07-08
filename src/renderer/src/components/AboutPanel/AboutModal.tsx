import React, { useEffect, useRef } from 'react';
import { AboutPanel } from './index';

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * TASK-082: Aboutを設定画面から分離し、メニューバー経由で開く独立モーダル（US-015）。
 *
 * SettingsModalと同様のオーバーレイ・閉じるボタンに加え、Escapeキーでの
 * クローズにも対応する（Popover.tsxのEscape購読パターンに倣う）。
 * documentへのイベントリスナー登録はuseEffect内で行い、cleanupで確実に解除する
 * （StrictModeのマウント→クリーンアップ→再マウントに耐える）。
 *
 * PR#28指摘対応（アクセシビリティ）: 開いた際にダイアログ要素自体（tabIndex=-1）へ
 * 初期フォーカスを移動し、閉じた際は開く直前のdocument.activeElementへフォーカスを
 * 復帰する。記憶した要素がDOMから消えている場合は何もしない。
 */
export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
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
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="このアプリについて"
        tabIndex={-1}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#fff',
          color: '#111827',
          borderRadius: '8px',
          minWidth: '400px',
          maxWidth: '480px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>このアプリについて</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6b7280',
            }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          <AboutPanel />
        </div>
      </div>
    </div>
  );
};
