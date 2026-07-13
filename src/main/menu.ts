import type { MenuItemConstructorOptions } from 'electron';
import type { Language } from './locale';

/**
 * TASK-082: Aboutを設定画面から分離し、メニューバー経由で開く独立モーダルへ（US-015）。
 * TASK-083: アプリ名をリポジトリ名「keyflow」へ統一（REQ-011-001改訂）。
 * win32/linuxのヘルプメニュー項目ラベルも「バージョン情報」から「{appTitle}について」へ統一する。
 * TASK-099: メニューのカスタムラベルをja/en辞書で切り替える（US-016、REQ-016-004）。
 *
 * アプリケーションメニューのテンプレートを純関数として組み立てる。Electron本体を
 * importせず型のみ利用するため、Electron実行環境なしでもユニットテストで検証できる
 * （window-options.ts / dock-icon.ts と同じ設計）。
 *
 * 標準の編集・表示・ウィンドウメニュー（role指定）を維持する。カスタムメニューを
 * 設定すると、Electron既定のメニュー（コピー/ペースト等の標準ロールを含む）は
 * 丸ごと置き換わるため、ここで明示的に再現しないとテキスト入力のコピー/ペースト
 * 操作を失う退行につながる。role指定項目はOSが自動でローカライズするため、
 * ここではカスタムラベルを持つ項目のみja/en辞書化する。
 */
export interface CreateApplicationMenuTemplateParams {
  platform: NodeJS.Platform;
  appTitle: string;
  /** メニューのカスタムラベルを切り替える表示言語（TASK-099、REQ-016-004） */
  language: Language;
  /** メニュー項目クリック時にMain側で呼び出すコールバック（対象ウィンドウへのIPC送信は呼び出し側の責務） */
  onOpenAbout: () => void;
}

const MENU_LABELS: Record<
  Language,
  { about: (appTitle: string) => string; edit: string; view: string; window: string; help: string }
> = {
  ja: {
    about: (appTitle) => `${appTitle}について`,
    edit: '編集',
    view: '表示',
    window: 'ウィンドウ',
    help: 'ヘルプ',
  },
  en: {
    about: (appTitle) => `About ${appTitle}`,
    edit: 'Edit',
    view: 'View',
    window: 'Window',
    help: 'Help',
  },
};

export function createApplicationMenuTemplate({
  platform,
  appTitle,
  language,
  onOpenAbout,
}: CreateApplicationMenuTemplateParams): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin';
  const labels = MENU_LABELS[language];

  const aboutMenuItem: MenuItemConstructorOptions = {
    id: 'open-about',
    label: labels.about(appTitle),
    click: () => onOpenAbout(),
  };

  const appMenu: MenuItemConstructorOptions = {
    label: appTitle,
    submenu: [
      aboutMenuItem,
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: labels.edit,
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac
        ? ([
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
          ] as MenuItemConstructorOptions[])
        : ([
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' },
          ] as MenuItemConstructorOptions[])),
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: labels.view,
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: labels.window,
    submenu: isMac
      ? [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' },
        ]
      : [{ role: 'minimize' }, { role: 'close' }],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: labels.help,
    submenu: [aboutMenuItem],
  };

  return [
    ...(isMac ? [appMenu] : []),
    editMenu,
    viewMenu,
    windowMenu,
    ...(isMac ? [] : [helpMenu]),
  ];
}
