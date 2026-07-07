import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithStrictMode as render } from '../../tests/test-utils';
import { AboutModal } from './AboutModal';

// ライブラリ一覧はビルド時生成物（TASK-076と同じ理由でAboutPanel.test.tsxに倣いモックする）。
// 本ファイルの関心事はAboutModal自体のオーバーレイ・閉じるボタン・Escape対応であり、
// AboutPanelが表示するライブラリ一覧の内容自体はAboutPanel.test.tsxが担う。
vi.mock('../../generated/licenses.json', () => ({
  default: [],
}));

describe('AboutModal (TASK-082, US-015)', () => {
  it('isOpenがfalseの場合は何もレンダリングしない', () => {
    render(<AboutModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('isOpenがtrueの場合、AboutPanelの内容（アプリ名・バージョン）を表示する（REQ-015-001）', () => {
    render(<AboutModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'このアプリについて' })).toBeInTheDocument();
    expect(screen.getByText('MusicXML Piano Practice')).toBeInTheDocument();
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
});
