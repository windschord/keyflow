#!/usr/bin/env node
import { _electron as electron } from 'playwright-core';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * TASK-084: パッケージ版アプリのメインウィンドウ表示スモークテスト。
 *
 * `dock.setIcon()`がapp.asar内のアイコンパスで例外を送出し、`createWindow()`より
 * 前でapp.whenReady()内の処理が中断されウィンドウが表示されない事故が起きた
 * （分析: docs/sdd/troubleshooting/2026-07-08-packaged-no-window/analysis.md）。
 * 既存のE2E（`npm run test:e2e`）は`out/main/index.js`を直接起動しておりasar構成
 * を経由しないため、パッケージ版特有の事故を検出できなかった。本スクリプトは
 * `npm run build:mac`が生成する実バイナリを起動し、ウィンドウ出現・タイトル・
 * 起動ログの3点を検証する。`npm run test:packaged`として登録し、macビルド
 * 環境が無いCIでは実行しないローカル専用のチェックとする。
 */

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const APP_EXECUTABLE_PATH = path.join(
  REPO_ROOT,
  'dist-electron/mac-arm64/keyflow.app/Contents/MacOS/keyflow'
);
const EXPECTED_TITLE = 'keyflow';
const WINDOW_APPEAR_TIMEOUT_MS = 30_000;
// UnhandledPromiseRejectionはプロセス起動直後の非同期処理で発生するため、
// stderr出力が揃うまでウィンドウ出現後に少し待ってから判定する。
const STDERR_SETTLE_WAIT_MS = 1_000;

async function main() {
  if (!existsSync(APP_EXECUTABLE_PATH)) {
    console.error(`パッケージ済みバイナリが見つからない: ${APP_EXECUTABLE_PATH}`);
    console.error('先に `npm run build:mac` を実行してください。');
    process.exitCode = 1;
    return;
  }

  let stderrOutput = '';
  const electronApp = await electron.launch({ executablePath: APP_EXECUTABLE_PATH });
  electronApp.process().stderr?.on('data', (chunk) => {
    stderrOutput += chunk.toString();
  });

  try {
    const mainWindow = await electronApp.firstWindow({ timeout: WINDOW_APPEAR_TIMEOUT_MS });
    await mainWindow.waitForLoadState('domcontentloaded');
    const actualTitle = await mainWindow.title();

    await new Promise((resolve) => setTimeout(resolve, STDERR_SETTLE_WAIT_MS));

    if (actualTitle !== EXPECTED_TITLE) {
      throw new Error(`ウィンドウタイトルが不正: 期待値="${EXPECTED_TITLE}" 実際="${actualTitle}"`);
    }

    if (stderrOutput.includes('UnhandledPromiseRejection')) {
      throw new Error(`起動ログにUnhandledPromiseRejectionが含まれる:\n${stderrOutput}`);
    }

    console.log('OK: メインウィンドウが表示され、タイトルと起動ログを確認した。');
  } finally {
    await electronApp.close();
  }
}

main().catch((err) => {
  console.error('NG:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
