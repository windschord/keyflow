import React, { useEffect, useRef, useState } from 'react';
import { Annotation, Finger } from '../../types';

const FINGER_OPTIONS: Finger[] = [1, 2, 3, 4, 5];

export interface NoteContextMenuProps {
  /** 対象音符のnoteId（`{partId}-M{measureNumber}-N{noteIndex}`形式）。表示用。 */
  noteId: string;
  /** メニュー表示位置（画面座標。OSMDControllerのcontextmenuイベント由来）。 */
  x: number;
  y: number;
  /** 対象音符に既に存在するアノテーション（未設定の場合は undefined）。 */
  annotation?: Annotation;
  onSelectFinger: (finger: Finger) => void;
  onRemoveFinger: () => void;
  onSaveComment: (comment: string) => void;
  onApprove: () => void;
  onClose: () => void;
}

/**
 * 楽譜上の音符を右クリックした際に表示する運指メモ編集メニュー
 * （REQ-008-001: 指番号1-5選択、REQ-008-003: コメント編集、
 * REQ-008-006: 指番号削除、REQ-009-005: AI提案の承認）。
 *
 * Escキーまたはメニュー外クリックで閉じる。CRUD操作自体はannotation-storeの
 * 既存API呼び出しをApp.tsx側に委譲し、本コンポーネントは入力UIのみを担当する。
 */
export const NoteContextMenu: React.FC<NoteContextMenuProps> = ({
  noteId,
  x,
  y,
  annotation,
  onSelectFinger,
  onRemoveFinger,
  onSaveComment,
  onApprove,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [commentDraft, setCommentDraft] = useState(annotation?.comment ?? '');

  useEffect(() => {
    setCommentDraft(annotation?.comment ?? '');
  }, [noteId, annotation?.comment]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // AI提案由来（isAISuggested: true）かつ未承認の場合のみ「承認」を表示する
  // （REQ-009-005）。手動入力（isAISuggested: false）には承認操作は不要。
  const canApprove = annotation?.isAISuggested === true && annotation.isApproved !== true;

  return (
    <div
      ref={menuRef}
      data-testid="note-context-menu"
      role="menu"
      style={{
        position: 'fixed',
        top: `${y}px`,
        left: `${x}px`,
        backgroundColor: '#fff',
        color: '#111827',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)',
        padding: '12px',
        minWidth: '220px',
        zIndex: 2000,
        fontSize: '14px',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '8px', wordBreak: 'break-all' }}>
        運指メモ: {noteId}
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ marginBottom: '4px', color: '#374151' }}>指番号</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {FINGER_OPTIONS.map((finger) => (
            <button
              key={finger}
              type="button"
              data-testid={`finger-option-${finger}`}
              onClick={() => onSelectFinger(finger)}
              aria-pressed={annotation?.fingerNumber === finger}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                border: '1px solid #9ca3af',
                backgroundColor: annotation?.fingerNumber === finger ? '#2563eb' : '#fff',
                color: annotation?.fingerNumber === finger ? '#fff' : '#111827',
                cursor: 'pointer',
              }}
            >
              {finger}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        data-testid="remove-finger-button"
        onClick={onRemoveFinger}
        disabled={annotation?.fingerNumber === undefined}
        style={{
          width: '100%',
          marginBottom: '8px',
          padding: '6px',
          borderRadius: '4px',
          border: '1px solid #9ca3af',
          backgroundColor: '#fff',
          cursor: annotation?.fingerNumber === undefined ? 'not-allowed' : 'pointer',
          opacity: annotation?.fingerNumber === undefined ? 0.5 : 1,
        }}
      >
        指番号を削除
      </button>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ marginBottom: '4px', color: '#374151' }}>コメント</div>
        <textarea
          data-testid="comment-textarea"
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          rows={2}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
        />
        <button
          type="button"
          data-testid="save-comment-button"
          onClick={() => onSaveComment(commentDraft)}
          style={{
            marginTop: '4px',
            width: '100%',
            padding: '6px',
            borderRadius: '4px',
            border: '1px solid #9ca3af',
            backgroundColor: '#fff',
            cursor: 'pointer',
          }}
        >
          コメントを保存
        </button>
      </div>

      {canApprove && (
        <button
          type="button"
          data-testid="approve-annotation-button"
          onClick={onApprove}
          style={{
            width: '100%',
            marginBottom: '8px',
            padding: '6px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          AI提案を承認
        </button>
      )}

      <button
        type="button"
        data-testid="close-context-menu-button"
        onClick={onClose}
        style={{
          width: '100%',
          padding: '4px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: 'transparent',
          color: '#6b7280',
          cursor: 'pointer',
        }}
      >
        閉じる
      </button>
    </div>
  );
};
