import type { Dock } from 'electron';

/**
 * TASK-080: 開発モードのDockアイコン適用（REQ-011-002）。
 *
 * macOSの開発モード（`npm run dev`）ではDockアイコンがElectron既定のままだった
 * （2026-07-08ユーザー実機フィードバック）。パッケージ版は`icon.icns`が自動適用
 * されるが、開発モードは`app.dock.setIcon()`を明示的に呼ぶ必要がある。
 */
export interface ApplyDockIconParams {
  platform: NodeJS.Platform;
  dock: Dock | undefined;
  iconPath: string;
}

/**
 * darwinかつ`app.dock`が利用可能な場合のみ、Dockアイコンを`iconPath`へ設定する。
 *
 * Electron本体をimportせず型のみ利用するため、Electron実行環境なしでも
 * ユニットテストで検証できる（window-options.tsと同じ設計）。
 * 非darwinでは`app.dock`が常にundefinedになるため、`dock`引数のnullチェックのみでも
 * 安全だが、意図を明示するためplatform判定も行う。
 */
export function applyDockIcon({ platform, dock, iconPath }: ApplyDockIconParams): void {
  if (platform !== 'darwin' || !dock) return;
  dock.setIcon(iconPath);
}
