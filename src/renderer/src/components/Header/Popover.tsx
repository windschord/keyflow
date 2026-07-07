import React, { useEffect, useRef } from 'react';

export interface PopoverProps {
  /** ポップオーバーの開閉状態。falseの場合は何もレンダリングしない。 */
  isOpen: boolean;
  /**
   * 外側mousedown・Escapeキー押下時に呼び出されるコールバック。
   * 開閉状態自体は呼び出し元（Header）が管理する（本コンポーネントはローカルstateを持たない）。
   */
  onClose: () => void;
  /**
   * ポップオーバーを開閉するトリガー（アンカー）要素への参照。
   * 指定した場合、このトリガー要素上のmousedownは「外側クリック」として扱わず、
   * onCloseを呼び出さない。トリガー自身のonClickによる開閉トグルと
   * 外側クリック検知が競合して意図せず再オープンする問題を防ぐ。
   */
  anchorRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

/**
 * 汎用ポップオーバー（TASK-074、REQ-012-003）。
 * アンカー要素直下に絶対配置で表示することを想定しており、呼び出し側で
 * `position: relative` なコンテナ内に配置する（QuickPanelでの利用例を参照）。
 *
 * 閉じる条件:
 * - ポップオーバー外側の mousedown（`anchorRef` が指す要素上は除外）
 * - Escapeキー押下
 * - 開閉ボタンの再クリックはHeader側のトグルロジックに委ねる。
 *   `anchorRef` 上のmousedownをonCloseの対象外にすることでトグルと競合しない
 *
 * documentへのイベントリスナー登録はuseEffect内で行い、cleanupで確実に解除する。
 * StrictModeのマウント→クリーンアップ→再マウントに耐える
 * （プロジェクトのReactリソース管理原則）。
 */
export const Popover: React.FC<PopoverProps> = ({ isOpen, onClose, anchorRef, children }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (contentRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      data-testid="popover"
      role="dialog"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '4px',
        // モーダル（SettingsModal: zIndex 1000）未満（design/components/header.md）
        zIndex: 900,
        backgroundColor: '#fff',
        color: '#111827',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)',
        padding: '12px',
        minWidth: '260px',
      }}
    >
      {children}
    </div>
  );
};
