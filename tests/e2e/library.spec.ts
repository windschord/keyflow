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
 * TASK-104: 楽譜ライブラリ（US-017）の一連操作E2E。
 *
 * TASK-103でui-slice.activeViewの初期値が'library'になったことで、起動直後は
 * ライブラリ画面（空状態）が表示されるようになった（REQ-017-010）。本ファイルは
 * 「空状態→楽譜を開く→ライブラリへ自動登録される→ライブラリから再度開ける→
 * 削除で一覧から消える」という一連の操作を、ユーザー観測可能な結果（画面遷移・
 * 一覧表示・削除後の再表示）を合格条件として検証する。既存のapp.spec.ts（起動・
 * 再生・MIDI等の既存フロー）とは対象範囲が異なるため、別ファイルとして分離する。
 */

const REPO_ROOT = path.resolve(__dirname, '../..');
const MAIN_ENTRY = path.join(REPO_ROOT, 'out/main/index.js');
const FIXTURE_PATH = path.join(__dirname, 'fixtures/sample-two-hands.musicxml');
// tests/e2e/fixtures/sample-two-hands.musicxml の <work-title> の値。
// パーサー（musicxml-parser/parser.ts）がwork-titleをScore.titleとして抽出し、
// TASK-103のderiveLibraryTitleがこれをそのままライブラリ登録タイトルに使う。
const FIXTURE_TITLE = 'TASK-034 E2E Sample (Two Hands)';

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
let userDataDir: string;

test.beforeEach(async () => {
  // TASK-100と同じ隔離userData方式（開発者の実環境を変更しない、日本語表示を決定的にする）。
  // ライブラリストア（library.json相当のelectron-store）もこのuserDataDir配下に作られるため、
  // テストごとに独立し、他のE2Eやユーザー環境のライブラリを汚染しない。
  userDataDir = createIsolatedUserDataDir('ja');

  electronApp = await electron.launch({
    args: [MAIN_ENTRY, userDataDirArg(userDataDir)],
    env: { ...process.env, KEYFLOW_E2E: '1' },
  });
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterEach(async () => {
  await electronApp?.close();
  removeIsolatedUserDataDir(userDataDir);
});

test('起動時ライブラリ空状態→開く→自動登録→ライブラリから再度開ける→削除で一覧から消える（TASK-104, REQ-017-001/006/007/010）', async () => {
  await expect
    .poll(async () =>
      electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
    )
    .toBeGreaterThan(0);

  // 1. 起動直後はライブラリ画面（空状態）が表示される（REQ-017-010）。
  await expect(window.getByRole('region', { name: 'ライブラリ' })).toBeVisible();
  await expect(window.getByText('ライブラリに楽譜がありません')).toBeVisible();

  // 2. サンプルMusicXMLを開く（app.spec.tsと同一のダイアログモック方式）。
  // ファイルダイアログのみをバイパスするため、mainプロセスの`file:show-open-dialog`
  // IPCハンドラを固定パスを返すものに差し替える。それ以外のIPC呼び出し・パース処理・
  // レンダリングはすべて実処理を使用する。
  await electronApp.evaluate(({ ipcMain }, fixturePath) => {
    ipcMain.removeHandler('file:show-open-dialog');
    ipcMain.handle('file:show-open-dialog', () => fixturePath);
  }, FIXTURE_PATH);

  // TASK-086のPathAllowlist検証を満たすため、本物のfile:register-dropped-file IPC
  // （拡張子検証を満たせばallowMusicXmlを呼ぶ）を経由して補う（app.spec.tsと同じ理由）。
  await window.evaluate(
    (fixturePath) => window.electronAPI.file.registerDroppedFile(fixturePath),
    FIXTURE_PATH
  );

  await window.getByTestId('header-open-file-button').click();

  // 楽譜（OSMD）が表示され、楽譜画面へ遷移する（ライブラリ画面はアンマウントされる）。
  await expect(window.locator('[data-testid="osmd-container"] svg')).toBeVisible({
    timeout: 15_000,
  });
  await expect(window.getByRole('region', { name: 'ライブラリ' })).toHaveCount(0);

  // 3. ヘッダーのライブラリボタンで戻ると、開いた楽譜が自動登録されている（REQ-017-001）。
  await window.getByRole('button', { name: 'ライブラリ' }).click();
  await expect(window.getByRole('region', { name: 'ライブラリ' })).toBeVisible();
  // exact: true必須。削除ボタンのaria-label（`${title} をライブラリから削除`）が
  // 部分一致でヒットしてしまい、行の開くボタンと2件マッチする（strict-mode違反）ため。
  const entryOpenButton = window.getByRole('button', { name: FIXTURE_TITLE, exact: true });
  await expect(entryOpenButton).toBeVisible();

  // 4. 一覧の行（タイトル）クリックで再び楽譜が開ける（REQ-017-007）。
  await entryOpenButton.click();
  await expect(window.locator('[data-testid="osmd-container"] svg')).toBeVisible({
    timeout: 15_000,
  });
  await expect(window.getByRole('region', { name: 'ライブラリ' })).toHaveCount(0);

  // 5. 削除→確認→一覧から消える（REQ-017-006）。
  await window.getByRole('button', { name: 'ライブラリ' }).click();
  await expect(window.getByRole('button', { name: FIXTURE_TITLE, exact: true })).toBeVisible();
  await window.getByRole('button', { name: `${FIXTURE_TITLE} をライブラリから削除` }).click();

  const confirmDialog = window.getByRole('dialog', { name: 'ライブラリから削除しますか' });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: '削除する' }).click();

  // 削除後は一覧から消え、エントリがゼロになったことで空状態表示へ戻る
  // （LibraryViewのloaded && entries.length === 0分岐）。
  await expect(window.getByRole('button', { name: FIXTURE_TITLE, exact: true })).toHaveCount(0);
  await expect(window.getByText('ライブラリに楽譜がありません')).toBeVisible();
});

test('楽譜を開く→ライブラリ→戻るボタンで楽譜表示へ復帰（再パースなし、TASK-105, REQ-017-012）', async () => {
  await expect
    .poll(async () =>
      electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
    )
    .toBeGreaterThan(0);

  // 1. サンプルMusicXMLを開く（app.spec.ts/上のテストと同一のダイアログモック方式）。
  await electronApp.evaluate(({ ipcMain }, fixturePath) => {
    ipcMain.removeHandler('file:show-open-dialog');
    ipcMain.handle('file:show-open-dialog', () => fixturePath);
  }, FIXTURE_PATH);

  await window.evaluate(
    (fixturePath) => window.electronAPI.file.registerDroppedFile(fixturePath),
    FIXTURE_PATH
  );

  await window.getByTestId('header-open-file-button').click();
  await expect(window.locator('[data-testid="osmd-container"] svg')).toBeVisible({
    timeout: 15_000,
  });

  // 2. テンポを既定値から変更しておく。再パースが発生すればoriginalBpm由来の値へ
  // リセットされるため、この値が変化せず維持されることを「再パースなし」の
  // 観測可能な合格条件として使う。
  const tempoInput = window.getByTestId('tempo-input');
  await tempoInput.fill('90');
  await tempoInput.blur();
  await expect(tempoInput).toHaveValue('90');

  // 3. ヘッダーの「ライブラリ」ボタンでライブラリ画面へ遷移する
  // （data-testidで指定するのは、ライブラリ画面表示中はLibraryView側にも
  // 同じラベル「楽譜へ戻る」のボタンが現れ、テキストだけでは一意に特定できないため）。
  const headerLibraryButton = window.getByTestId('header-library-button');
  await headerLibraryButton.click();
  await expect(window.getByRole('region', { name: 'ライブラリ' })).toBeVisible();
  await expect(headerLibraryButton).toHaveAccessibleName('楽譜へ戻る');

  // 4. ライブラリ画面上部の「楽譜へ戻る」ボタンで楽譜表示へ復帰する。
  await window.getByTestId('library-return-to-score-button').click();

  await expect(window.getByRole('region', { name: 'ライブラリ' })).toHaveCount(0);
  // TASK-106: 隠す→同一サイズで戻す往復は再レンダリングされないため、
  // 楽譜SVGは戻った直後から既に表示されている想定である。既定の15秒（playwright.config.ts）
  // ではなく短いタイムアウトで検証し、数秒の再レンダリング待ちが発生する回帰を検出する。
  await expect(window.locator('[data-testid="osmd-container"] svg')).toBeVisible({
    timeout: 500,
  });
  await expect(tempoInput).toHaveValue('90');
  await expect(headerLibraryButton).toHaveAccessibleName('ライブラリ');

  // 5. ヘッダーボタン自体もトグルとして機能する。「楽譜へ戻る」表示のヘッダーボタンで
  // ライブラリ画面へ入り、同じヘッダーボタンで楽譜表示へ復帰できる。
  await headerLibraryButton.click();
  await expect(window.getByRole('region', { name: 'ライブラリ' })).toBeVisible();

  await headerLibraryButton.click();
  await expect(window.getByRole('region', { name: 'ライブラリ' })).toHaveCount(0);
  // TASK-106: こちらもヘッダーボタン経由の往復であり、即時復帰を同様に検証する。
  await expect(window.locator('[data-testid="osmd-container"] svg')).toBeVisible({
    timeout: 500,
  });
  await expect(tempoInput).toHaveValue('90');
});
