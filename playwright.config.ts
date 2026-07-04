import { defineConfig } from '@playwright/test';

/**
 * TASK-034: 実起動E2Eテスト（Playwright for Electron）設定。
 *
 * 既存のVitest（jsdom上のユニット/統合テスト、`npm run test`）とは完全に
 * 独立したテストランナー・スクリプト（`npm run test:e2e`）として実行する。
 * ビルド済みのElectronアプリ（`out/main/index.js`）を実際に起動して検証するため、
 * ヘッドレスLinux環境（CI）ではXvfb等の仮想ディスプレイが無いと実行できない
 * 場合がある。まずはローカルでの手動実行を必達要件とし、CI組み込みは
 * 別途動作確認の上で対応する（docs/sdd/tasks/phase-10/TASK-034.md参照）。
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: './test-results/e2e',
});
