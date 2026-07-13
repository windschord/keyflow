import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithStrictMode as render } from '../../tests/test-utils';
import { AboutModal } from './AboutModal';
import { usePracticeStore } from '../../store';

// ライブラリ一覧はビルド時生成物（TASK-076と同じ理由でAboutPanel.test.tsxに倣いモックする）。
// 本ファイルの関心事はAboutModal自体のオーバーレイ・閉じるボタン・Escape対応であり、
// AboutPanelが表示するライブラリ一覧の内容自体はAboutPanel.test.tsxが担う。
vi.mock('../../generated/licenses.json', () => ({
  default: [],
}));

describe('AboutModal (TASK-082, US-015)', () => {
  afterEach(() => {
    // TASK-098: 言語切り替えテストによる変更値の後続テストへの残留を防ぐためリセットする。
    usePracticeStore.setState({ language: 'ja' });
  });

  it('isOpenがfalseの場合は何もレンダリングしない', () => {
    render(<AboutModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('isOpenがtrueの場合、AboutPanelの内容（アプリ名・バージョン）を表示する（REQ-015-001、TASK-083: アプリ名は「keyflow」）', () => {
    render(<AboutModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'このアプリについて' })).toBeInTheDocument();
    expect(screen.getByText('keyflow')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(__APP_VERSION__))).toBeInTheDocument();
  });

  it('閉じるボタンのクリックでonCloseが呼ばれる', () => {
    const onClose = vi.fn();
    render(<AboutModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escapeキー押下でonCloseが呼ばれる', () => {
    const onClose = vi.fn();
    render(<AboutModal isOpen onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('isOpenがfalseの間はEscapeキー購読を行わない（クローズ後にonCloseが誤って呼ばれない）', () => {
    const onClose = vi.fn();
    render(<AboutModal isOpen={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('aria-modal属性がtrueである（アクセシビリティ、PR#28指摘対応）', () => {
    render(<AboutModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'このアプリについて' })).toHaveAttribute(
      'aria-modal',
      'true'
    );
  });

  it('開いた時、初期フォーカスがダイアログ内へ移動する（アクセシビリティ、PR#28指摘対応）', () => {
    render(<AboutModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'このアプリについて' })).toHaveFocus();
  });

  it('閉じた後、開く直前にフォーカスしていた要素へフォーカスが復帰する（アクセシビリティ、PR#28指摘対応）', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <div>
        <button type="button">トリガー</button>
        <AboutModal isOpen={false} onClose={onClose} />
      </div>
    );
    const trigger = screen.getByRole('button', { name: 'トリガー' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(
      <div>
        <button type="button">トリガー</button>
        <AboutModal isOpen onClose={onClose} />
      </div>
    );
    expect(screen.getByRole('dialog', { name: 'このアプリについて' })).toHaveFocus();

    rerender(
      <div>
        <button type="button">トリガー</button>
        <AboutModal isOpen={false} onClose={onClose} />
      </div>
    );

    expect(trigger).toHaveFocus();
  });

  // TASK-098, US-016: 文言外部化の確認として、store言語が"en"の場合に英語表記へ
  // 切り替わることを検証する。
  it('shows English strings when the store language is "en" (TASK-098)', () => {
    usePracticeStore.setState({ language: 'en' });

    render(<AboutModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
