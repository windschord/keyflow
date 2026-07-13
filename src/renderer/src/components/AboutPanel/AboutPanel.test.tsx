import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithStrictMode as render } from '../../tests/test-utils';
import { AboutPanel } from './index';
import { usePracticeStore } from '../../store';

// ライブラリ一覧はビルド時生成物（src/renderer/src/generated/licenses.json、gitignore対象）。
// ユニットテストではnode_modulesの実データに依存させず、決定的なフィクスチャで検証する
// （TASK-076、about-page.md「テスト観点」）。predev/prebuild/pretest各フックにより
// 実行環境では実ファイルが存在するため、本モックはこのテストの決定性のためのものである。
vi.mock('../../generated/licenses.json', () => ({
  default: [
    {
      name: 'tone',
      version: '15.1.22',
      license: 'MIT',
      licenseText: 'MIT License\n\nCopyright (c) Tone.js contributors\n',
    },
  ],
}));

describe('AboutPanel', () => {
  afterEach(() => {
    // TASK-098: 言語切り替えテストによる変更値の後続テストへの残留を防ぐためリセットする。
    usePracticeStore.setState({ language: 'ja' });
  });

  it('アプリ名・バージョン・本体ライセンスが表示される（REQ-015-001、TASK-083: アプリ名は「keyflow」）', () => {
    render(<AboutPanel />);

    expect(screen.getByText('keyflow')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(__APP_VERSION__))).toBeInTheDocument();
    expect(screen.getByText(/Apache License 2\.0/)).toBeInTheDocument();
  });

  it('Salamanderの音源クレジットが表示される（REQ-015-003 / REQ-013-008）', () => {
    render(<AboutPanel />);

    expect(screen.getByText(/Salamander/)).toBeInTheDocument();
    expect(screen.getByText(/Alexander Holm/)).toBeInTheDocument();
    expect(screen.getByText(/CC-BY 3\.0/)).toBeInTheDocument();
  });

  it('ライブラリ一覧が表示され、行クリックでライセンス本文が展開する（REQ-015-002/005）', () => {
    render(<AboutPanel />);

    expect(screen.getByText('tone')).toBeInTheDocument();
    expect(screen.getByText(/15\.1\.22/)).toBeInTheDocument();
    expect(screen.queryByText(/Copyright \(c\) Tone\.js contributors/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('tone'));

    expect(screen.getByText(/Copyright \(c\) Tone\.js contributors/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('tone'));

    expect(screen.queryByText(/Copyright \(c\) Tone\.js contributors/)).not.toBeInTheDocument();
  });

  // TASK-098, US-016: 文言外部化の確認として、store言語が"en"の場合に英語表記へ
  // 切り替わることを検証する。固有名詞（Salamanderクレジット・ライブラリ名）は対象外。
  it('shows English strings when the store language is "en" (TASK-098)', () => {
    usePracticeStore.setState({ language: 'en' });

    render(<AboutPanel />);

    expect(screen.getByText('Libraries used')).toBeInTheDocument();
  });
});
