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
 *
 * TASK-084: パッケージ版はasar内パスに対する`dock.setIcon()`呼び出しで画像読み込み例外を
 * 送出し、ウィンドウ生成前の起動処理全体を中断させる事故を起こした。詳細は
 * docs/sdd/troubleshooting/2026-07-08-packaged-no-window/analysis.md を参照。
 * 装飾的な処理の失敗でアプリ起動を止めないよう、try/catchで防御し警告ログのみ出す。
 */
export function applyDockIcon({ platform, dock, iconPath }: ApplyDockIconParams): void {
  if (platform !== 'darwin' || !dock) return;
  try {
    dock.setIcon(iconPath);
  } catch (err) {
    console.warn('Dockアイコンの設定に失敗した。', err);
  }
}
