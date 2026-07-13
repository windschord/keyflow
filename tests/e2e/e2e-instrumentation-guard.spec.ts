import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import {
  createIsolatedUserDataDir,
  removeIsolatedUserDataDir,
  userDataDirArg,
} from './e2e-user-data';

/**
 * TASK-088: E2E計装（__e2eStore__/__e2eMidiHooks__）の本番ビルド無効化の検証。
 *
 * app.spec.ts の他のテストはすべて `KEYFLOW_E2E=1` を渡して起動しており、この
 * フラグに依存して計装（__e2eStore__/__e2eMidiHooks__）を読み書きしている。
 * 本ファイルはそれとは逆に、環境変数を渡さない「本番ビルドと同一の起動」を行い、
 * 計装がwindowへ一切公開されないことを確認する（受入基準: 環境変数なしの起動で
 * window.__e2eStore__ / window.__e2eMidiHooks__ が公開されない）。
 *
 * app.spec.ts のトップレベルbeforeEach（KEYFLOW_E2E=1で起動）とは独立させるため、
 * 別ファイルとして分離している。
 */

const REPO_ROOT = path.resolve(__dirname, '../..');
const MAIN_ENTRY = path.join(REPO_ROOT, 'out/main/index.js');

declare global {
  interface Window {
    __e2eStore__?: unknown;
    __e2eMidiHooks__?: unknown;
  }
}

test.beforeAll(() => {
  if (!fs.existsSync(MAIN_ENTRY)) {
    throw new Error(
      `ビルド成果物が見つかりません: ${MAIN_ENTRY}\n` +
        '先に `npm run build` を実行してから `npm run test:e2e` を実行してください。'
    );
  }
});

let electronApp: ElectronApplication;
let window: Page;
// テスト本体の途中失敗時はundefinedのままafterEachへ到達し得る
// （removeIsolatedUserDataDirがundefinedを許容する）。
let userDataDir: string | undefined;

test.afterEach(async () => {
  await electronApp?.close();
  removeIsolatedUserDataDir(userDataDir);
});

test('KEYFLOW_E2Eなしの起動（本番ビルド相当）ではE2E計装がwindowに一切公開されない', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { KEYFLOW_E2E: _omitted, ...envWithoutFlag } = process.env;

  // TASK-100: 開発者の実環境のuserDataを変更しないよう隔離ディレクトリで起動する
  // （本テストは言語表示に依存しないが、他のE2Eと同様の隔離方針を適用する）。
  userDataDir = createIsolatedUserDataDir('ja');

  electronApp = await electron.launch({
    args: [MAIN_ENTRY, userDataDirArg(userDataDir)],
    env: envWithoutFlag,
  });
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  await expect
    .poll(async () =>
      electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
    )
    .toBeGreaterThan(0);

  // アプリが実際に描画を終えたことを先にassertする（前提要素の存在確認、
  // CLAUDE.md記載の再発防止策1: 前提を確認せずに結論を出さない）。
  await expect(window.getByTestId('app-container')).toBeVisible();

  const instrumentation = await window.evaluate(() => ({
    hasStore: typeof window.__e2eStore__ !== 'undefined',
    hasMidiHooks: typeof window.__e2eMidiHooks__ !== 'undefined',
  }));

  expect(instrumentation).toEqual({ hasStore: false, hasMidiHooks: false });
});
