import type { MenuItemConstructorOptions } from 'electron';

/**
 * TASK-082: Aboutを設定画面から分離し、メニューバー経由で開く独立モーダルへ（US-015）。
 *
 * アプリケーションメニューのテンプレートを純関数として組み立てる。Electron本体を
 * importせず型のみ利用するため、Electron実行環境なしでもユニットテストで検証できる
 * （window-options.ts / dock-icon.ts と同じ設計）。
 *
 * 標準の編集・表示・ウィンドウメニュー（role指定）を維持する。カスタムメニューを
 * 設定すると、Electron既定のメニュー（コピー/ペースト等の標準ロールを含む）は
 * 丸ごと置き換わるため、ここで明示的に再現しないとテキスト入力のコピー/ペースト
 * 操作を失う退行につながる。
 */
export interface CreateApplicationMenuTemplateParams {
  platform: NodeJS.Platform;
  appTitle: string;
  /** メニュー項目クリック時にMain側で呼び出すコールバック（対象ウィンドウへのIPC送信は呼び出し側の責務） */
  onOpenAbout: () => void;
}

export function createApplicationMenuTemplate({
  platform,
  appTitle,
  onOpenAbout,
}: CreateApplicationMenuTemplateParams): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin';

  const aboutMenuItem: MenuItemConstructorOptions = {
    id: 'open-about',
    label: isMac ? `${appTitle}について` : 'バージョン情報',
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
    label: '編集',
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
    label: '表示',
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
    label: 'ウィンドウ',
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
    label: 'ヘルプ',
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
