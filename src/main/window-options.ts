import type { BrowserWindowConstructorOptions } from 'electron';

/**
 * TASK-068: アプリのブランディング（アイコン生成・ウィンドウタイトル）
 * TASK-083: アプリ名をリポジトリ名「keyflow」へ統一（REQ-011-001改訂）
 *
 * ウィンドウタイトルを一元管理する（REQ-011-001）。
 * `electron-builder.yml` の productName と一致させる。
 */
export const APP_TITLE = 'keyflow';

export interface CreateWindowOptionsParams {
  platform: NodeJS.Platform;
  iconPath: string;
}

/**
 * BrowserWindow生成オプションを組み立てる。
 *
 * Electron本体をimportせず型のみ利用するため、Electron実行環境なしでも
 * ユニットテストで検証できる（REQ-011-001/002）。
 *
 * - title: 全プラットフォーム共通で設定する
 * - icon: win32/linuxでは開発モードのタスクバー/ウィンドウアイコン表示のために設定する。
 *   darwinはパッケージ版でicon.icnsが適用されるため、開発モードのDockアイコンは
 *   Electronデフォルトのまま許容する（design/components/app-branding.md参照）
 */
export function createWindowOptions({
  platform,
  iconPath,
}: CreateWindowOptionsParams): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: APP_TITLE,
    ...(platform === 'linux' || platform === 'win32' ? { icon: iconPath } : {}),
  };
}
