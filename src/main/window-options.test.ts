import { describe, expect, it } from 'vitest';
import { APP_TITLE, createWindowOptions } from './window-options';

/**
 * TASK-068: アプリのブランディング（アイコン生成・ウィンドウタイトル）
 *
 * BrowserWindow生成オプションを純粋関数として切り出し、Electron実行環境なしで
 * `title` / `icon` オプションの内容を検証できるようにする（REQ-011-001/002）。
 */
describe('createWindowOptions (REQ-011-001, REQ-011-002)', () => {
  it('プラットフォームによらずtitleが「MusicXML Piano Practice」である', () => {
    const options = createWindowOptions({ platform: 'darwin', iconPath: '/path/to/icon.png' });

    expect(options.title).toBe('MusicXML Piano Practice');
    expect(options.title).toBe(APP_TITLE);
  });

  it('win32では開発モードのタスクバー表示のためiconオプションが設定される', () => {
    const options = createWindowOptions({ platform: 'win32', iconPath: '/path/to/icon.png' });

    expect(options.icon).toBe('/path/to/icon.png');
  });

  it('linuxではiconオプションが設定される（既存挙動の維持）', () => {
    const options = createWindowOptions({ platform: 'linux', iconPath: '/path/to/icon.png' });

    expect(options.icon).toBe('/path/to/icon.png');
  });

  it('darwinではiconオプションを設定しない（パッケージ版はicon.icnsが適用され、開発モードのDockはデフォルト許容）', () => {
    const options = createWindowOptions({ platform: 'darwin', iconPath: '/path/to/icon.png' });

    expect(options.icon).toBeUndefined();
  });
});
