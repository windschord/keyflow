import { describe, expect, it, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { createApplicationMenuTemplate } from './menu';

/**
 * TASK-082: Aboutを設定画面から分離しメニューバーから開く独立モーダルへ（US-015）。
 *
 * アプリケーションメニューのテンプレート生成を純関数として切り出し、Electron実行環境
 * なしでプラットフォーム分岐・クリック結線を検証できるようにする
 * （window-options.ts / dock-icon.ts の既存パターンに倣う）。
 */

function findMenuItem(
  items: MenuItemConstructorOptions[],
  predicate: (item: MenuItemConstructorOptions) => boolean
): MenuItemConstructorOptions | undefined {
  for (const item of items) {
    if (predicate(item)) return item;
    if (Array.isArray(item.submenu)) {
      const found = findMenuItem(item.submenu as MenuItemConstructorOptions[], predicate);
      if (found) return found;
    }
  }
  return undefined;
}

function clickItem(item: MenuItemConstructorOptions | undefined): void {
  (item?.click as unknown as (() => void) | undefined)?.();
}

const APP_TITLE = 'MusicXML Piano Practice';

describe('createApplicationMenuTemplate (REQ-015, TASK-082)', () => {
  it('darwinではアプリメニュー内に「{appTitle}について」項目（id: open-about）を持ち、クリックでonOpenAboutを呼ぶ', () => {
    const onOpenAbout = vi.fn();
    const template = createApplicationMenuTemplate({
      platform: 'darwin',
      appTitle: APP_TITLE,
      onOpenAbout,
    });

    const aboutItem = findMenuItem(template, (item) => item.id === 'open-about');
    expect(aboutItem?.label).toBe(`${APP_TITLE}について`);

    clickItem(aboutItem);
    expect(onOpenAbout).toHaveBeenCalledTimes(1);
  });

  it('win32/linuxではヘルプメニュー内に「バージョン情報」項目（id: open-about）を持ち、クリックでonOpenAboutを呼ぶ', () => {
    for (const platform of ['win32', 'linux'] as const) {
      const onOpenAbout = vi.fn();
      const template = createApplicationMenuTemplate({
        platform,
        appTitle: APP_TITLE,
        onOpenAbout,
      });

      const aboutItem = findMenuItem(template, (item) => item.id === 'open-about');
      expect(aboutItem?.label).toBe('バージョン情報');

      clickItem(aboutItem);
      expect(onOpenAbout).toHaveBeenCalledTimes(1);
    }
  });

  it('darwinのみ先頭にappTitleラベルのアプリメニューが存在する', () => {
    const darwinTemplate = createApplicationMenuTemplate({
      platform: 'darwin',
      appTitle: APP_TITLE,
      onOpenAbout: vi.fn(),
    });
    expect(darwinTemplate[0]?.label).toBe(APP_TITLE);

    const win32Template = createApplicationMenuTemplate({
      platform: 'win32',
      appTitle: APP_TITLE,
      onOpenAbout: vi.fn(),
    });
    expect(win32Template.some((item) => item.label === APP_TITLE)).toBe(false);
  });

  it('編集メニューが標準ロール（undo/redo/cut/copy/paste/selectAll）を維持している（テキスト入力のコピー/ペースト退行防止）', () => {
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      const template = createApplicationMenuTemplate({
        platform,
        appTitle: APP_TITLE,
        onOpenAbout: vi.fn(),
      });

      const editMenu = template.find((item) => item.label === '編集');
      const roles = (editMenu?.submenu as MenuItemConstructorOptions[] | undefined)?.map(
        (item) => item.role
      );
      expect(roles).toEqual(
        expect.arrayContaining(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'])
      );
    }
  });

  it('表示メニュー・ウィンドウメニューが全プラットフォームで存在する', () => {
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      const template = createApplicationMenuTemplate({
        platform,
        appTitle: APP_TITLE,
        onOpenAbout: vi.fn(),
      });

      expect(template.some((item) => item.label === '表示')).toBe(true);
      expect(template.some((item) => item.label === 'ウィンドウ')).toBe(true);
    }
  });
});
