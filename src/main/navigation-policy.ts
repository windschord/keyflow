/**
 * TASK-087: ウィンドウナビゲーション強化（openExternalスキーム検証・will-navigate）
 *
 * Electron APIに依存しない純粋関数として実装し、Electron実行環境なしで
 * ユニットテストできるようにする（window-options.tsと同じパターン）。
 */

/**
 * `shell.openExternal` に渡してよいURLかを判定する。
 * OSへ委譲するプロトコルを http/https のみへ制限し、file: や任意のカスタムスキームを拒否する。
 * URLのパースに失敗した場合も拒否する。
 */
export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * メインウィンドウのトップレベルナビゲーション（`will-navigate`）を許可してよいURLかを判定する。
 *
 * - 本番ビルドの `file:` プロトコル（自身の index.html への遷移）は常に許可する
 * - 開発モードでは `devServerUrl`（`ELECTRON_RENDERER_URL`）と同一オリジンへのナビゲーションのみ許可する
 * - それ以外（外部の http/https 等）はすべて拒否する
 */
export function isAllowedNavigationUrl(url: string, devServerUrl: string | undefined): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === 'file:') {
    return true;
  }

  if (!devServerUrl) {
    return false;
  }

  try {
    return parsed.origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}
