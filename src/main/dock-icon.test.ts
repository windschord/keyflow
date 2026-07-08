import { describe, expect, it, vi } from 'vitest';
import type { Dock } from 'electron';
import { applyDockIcon } from './dock-icon';

/**
 * TASK-080: 開発モードのDockアイコン適用（REQ-011-002）。
 *
 * `app.dock.setIcon()`呼び出しをプラットフォーム分岐込みの純関数へ切り出し、
 * Electron実行環境なしでユニットテストできるようにする
 * （window-options.test.tsの既存パターンに倣う）。
 */
describe('applyDockIcon (REQ-011-002, TASK-080)', () => {
  it('darwinかつdockが存在する場合、iconPathでsetIconを呼ぶ', () => {
    const setIcon = vi.fn();
    const dock = { setIcon } as unknown as Dock;

    applyDockIcon({ platform: 'darwin', dock, iconPath: '/path/to/icon.png' });

    expect(setIcon).toHaveBeenCalledWith('/path/to/icon.png');
  });

  it('win32ではdockが存在してもsetIconを呼ばない', () => {
    const setIcon = vi.fn();
    const dock = { setIcon } as unknown as Dock;

    applyDockIcon({ platform: 'win32', dock, iconPath: '/path/to/icon.png' });

    expect(setIcon).not.toHaveBeenCalled();
  });

  it('linuxではdockが存在してもsetIconを呼ばない', () => {
    const setIcon = vi.fn();
    const dock = { setIcon } as unknown as Dock;

    applyDockIcon({ platform: 'linux', dock, iconPath: '/path/to/icon.png' });

    expect(setIcon).not.toHaveBeenCalled();
  });

  it('darwinでもdockがundefinedの場合はエラーにならない（非macOSビルドのElectronを想定）', () => {
    expect(() =>
      applyDockIcon({ platform: 'darwin', dock: undefined, iconPath: '/path/to/icon.png' })
    ).not.toThrow();
  });

  it('非darwinかつdockがundefinedの場合もエラーにならない（既定の実行環境）', () => {
    expect(() =>
      applyDockIcon({ platform: 'win32', dock: undefined, iconPath: '/path/to/icon.png' })
    ).not.toThrow();
  });

  it('setIconが例外を投げても関数が例外を伝播しない（TASK-084、パッケージ版asarパス対策）', () => {
    // console.warnをモックし、捕捉済み警告がテスト出力へ漏れてCIのログ解析に
    // エラーとして誤検知されるのを防ぐ（CodeRabbit PR#28指摘、2026-07-09）。
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setIcon = vi.fn(() => {
      throw new Error('Failed to load image from path');
    });
    const dock = { setIcon } as unknown as Dock;

    expect(() =>
      applyDockIcon({ platform: 'darwin', dock, iconPath: '/path/to/icon.png' })
    ).not.toThrow();
    warn.mockRestore();
  });

  it('setIconが例外を投げた場合はconsole.warnで通知する（TASK-084）', () => {
    const setIcon = vi.fn(() => {
      throw new Error('Failed to load image from path');
    });
    const dock = { setIcon } as unknown as Dock;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    applyDockIcon({ platform: 'darwin', dock, iconPath: '/path/to/icon.png' });

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
