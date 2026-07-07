import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

/**
 * TASK-034: 実起動E2Eテスト（Playwright for Electron）
 *
 * docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md の原因6で
 * 指摘された「実際にアプリを起動してUI操作を行う検証が皆無」という問題に
 * 対応するためのテストスイート。既存のVitest統合テストは手動初期化
 * （resetToMeasure等）でアプリ本体の結線漏れを隠蔽していたため、本テストは
 * ビルド済みの実バイナリを実際に起動し、実UI操作のみを通じて検証する。
 *
 * ファイル選択ダイアログはOS依存で自動化が不安定なため、Playwright公式の推奨手法
 * （`electronApp.evaluate()` でメインプロセスの `ipcMain` ハンドラを直接差し替える）
 * を用いて `file:show-open-dialog` の戻り値のみを固定パスに差し替える
 * （contextBridgeが公開する `window.electronAPI` はrenderer側から再代入できない
 * ため、rendererではなくmainプロセス側のIPCハンドラを差し替える方式を採る。
 * それ以外のIPC呼び出し・レンダリング・判定ロジックはすべて実処理を使用する）。
 *
 * MIDI入力は実ハードウェアに依存させず、実際のMIDI受信時に呼ばれるコールバック
 * （usePractice.tsの`handleMidiNoteOn`/`handleMidiNoteOff`）をwindow経由で
 * そのまま呼び出すことで、本番と同一の判定コードパスを検証する。
 */

const REPO_ROOT = path.resolve(__dirname, '../..');
const MAIN_ENTRY = path.join(REPO_ROOT, 'out/main/index.js');
const FIXTURE_PATH = path.join(__dirname, 'fixtures/sample-two-hands.musicxml');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

interface E2EPracticeStats {
  totalNotes: number;
  correctNotes: number;
  incorrectNotes: number;
  accuracy: number;
  consecutiveCorrect: number;
}

interface E2EPracticeStoreState {
  currentMeasure: number;
  currentNoteIndex: number;
  playbackState: 'stopped' | 'paused' | 'playing';
  stats: E2EPracticeStats;
  zoom: number;
  volume: number;
  metronomeEnabled: boolean;
}

declare global {
  interface Window {
    // App.tsxで公開される実際のZustandストア（TASK-034計装、読み取り専用の状態検査用）。
    __e2eStore__?: {
      getState: () => E2EPracticeStoreState;
    };
    // usePractice.tsで公開される実際のMIDIコールバック（TASK-034計装）。
    __e2eMidiHooks__?: {
      noteOn: (midiNumber: number, velocity: number, channel: number) => void;
      noteOff: (midiNumber: number, velocity: number, channel: number) => void;
    };
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

test.beforeEach(async () => {
  electronApp = await electron.launch({ args: [MAIN_ENTRY] });
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterEach(async () => {
  await electronApp?.close();
});

test('ウィンドウタイトルが「MusicXML Piano Practice」である（TASK-068, REQ-011-001）', async () => {
  await expect
    .poll(async () =>
      electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
    )
    .toBeGreaterThan(0);

  expect(await window.title()).toBe('MusicXML Piano Practice');
});

test('アプリ起動→サンプルMusicXML読み込み→再生→手動スクロール→MIDIモック注入で正誤判定・カーソル進行', async () => {
  // 1. アプリ起動: メインウィンドウが表示される
  await expect
    .poll(async () =>
      electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())
    )
    .toBe(true);

  // ファイル未読み込み時のプレースホルダーが表示されていることを確認する。
  await expect(window.getByTestId('placeholder')).toBeVisible();

  // TASK-075: ヘッダーが1行・高さ56px以下であることを確認する（REQ-012-001/005）。
  // 楽譜表示領域を拡大するため、旧App.tsx上段バー+Toolbarの2ブロック構成
  // （実質3〜4行）を1行のHeaderへ統合した結果を、実際のbounding boxで検証する。
  const headerBox = await window.getByTestId('app-header').boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.height).toBeLessThanOrEqual(56);

  // 2. サンプルMusicXMLファイルを開く。
  // ファイルダイアログのみをバイパスするため、mainプロセスの
  // `file:show-open-dialog` IPCハンドラを固定パスを返すものに差し替える
  // （contextBridgeで公開されたrenderer側の`window.electronAPI`は再代入できない
  // ため、この方式を採る）。それ以外のIPC呼び出し（file:read）・パース処理・
  // レンダリングはすべて実処理を使用する。
  await electronApp.evaluate(({ ipcMain }, fixturePath) => {
    ipcMain.removeHandler('file:show-open-dialog');
    ipcMain.handle('file:show-open-dialog', () => fixturePath);
  }, FIXTURE_PATH);

  // TASK-053のドロップ案内文にも「ファイルを開く」が含まれるため、ロールで特定する
  await window.getByRole('button', { name: 'ファイルを開く' }).click();

  // 3. 楽譜（OSMD）が表示される
  await expect(window.locator('[data-testid="osmd-container"] svg')).toBeVisible({
    timeout: 15_000,
  });
  await expect(window.getByTestId('placeholder')).toHaveCount(0);

  // 練習対象を右手のみに絞り、単一パートのMIDIノートで判定できるようにする。
  await window.getByTestId('mode-right').click();

  // 4. 再生ボタンで再生が開始される
  await expect(window.getByTestId('playback-play')).toBeEnabled();

  // __e2eStore__ の最初の使用前に、その存在を明示的にassertする
  // （2026-07-05トラブルシューティング再発防止策1: 前提要素の存在を確認せずに
  // `!` で参照する「暗黙の前提」を禁止する）。以降はこのpollで存在確認済みの
  // ため、参照スタイルを `!` に統一する（`?.` との混在をやめる）。
  // `__e2eStore__` はZustandストアフック（関数）そのものであるため、
  // typeofは'object'ではなく'function'になる。
  await expect.poll(() => window.evaluate(() => typeof window.__e2eStore__)).toBe('function');

  const positionBeforePlay = await window.evaluate(() => {
    const state = window.__e2eStore__!.getState();
    return { measure: state.currentMeasure, noteIndex: state.currentNoteIndex };
  });

  await window.getByTestId('playback-play').click();
  await expect(window.getByTestId('playback-play')).toBeDisabled();
  await expect(window.getByTestId('playback-pause')).toBeEnabled();
  await expect
    .poll(() => window.evaluate(() => window.__e2eStore__!.getState().playbackState))
    .toBe('playing');

  // 再生開始後、カーソル（判定グループ位置）が実際に進行することを確認する
  // （REQ-010-005。2026-07-05トラブルシューティング原因2の再発防止）。
  // 「再生状態になっただけ」ではなく「音符が実際にスケジュールされ、再生位置が
  // 進んだ」ことを検証する。
  await expect
    .poll(
      async () => {
        const position = await window.evaluate(() => {
          const state = window.__e2eStore__!.getState();
          return { measure: state.currentMeasure, noteIndex: state.currentNoteIndex };
        });
        return (
          position.measure !== positionBeforePlay.measure ||
          position.noteIndex !== positionBeforePlay.noteIndex
        );
      },
      { timeout: 10_000, intervals: [100] }
    )
    .toBe(true);

  await window.getByTestId('playback-stop').click();
  await expect
    .poll(() => window.evaluate(() => window.__e2eStore__!.getState().playbackState))
    .toBe('stopped');

  // 停止操作で先頭小節（ループ無効時）に位置が復帰することを確認する（REQ-010-004）。
  await expect
    .poll(async () => {
      const state = await window.evaluate(() => {
        const s = window.__e2eStore__!.getState();
        return { measure: s.currentMeasure, noteIndex: s.currentNoteIndex };
      });
      return state;
    })
    .toEqual({ measure: 1, noteIndex: 0 });

  // TASK-079: メトロノームON/OFFはQuickPanelからヘッダー常駐ボタンへ移動した
  // （DEC-007改訂、2026-07-08）。QuickPanelを開かずとも操作できることを
  // 座標ヒットテストを伴う実クリック（`click()`）で検証し、チェック状態の変化
  // （ユーザー観測可能な結果、aria-pressed）とストアの反転を確認する
  // （TASK-078のクリップ再発防止の検証意図は維持: 実クリックでの操作性検証）。
  const metronomeToggle = window.getByTestId('metronome-toggle');
  await expect(metronomeToggle).toBeVisible();
  const metronomeEnabledBefore = await window.evaluate(
    () => window.__e2eStore__!.getState().metronomeEnabled
  );
  expect(metronomeEnabledBefore).toBe(false);
  await expect(metronomeToggle).toHaveAttribute('aria-pressed', 'false');

  await metronomeToggle.click();

  await expect(metronomeToggle).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => window.evaluate(() => window.__e2eStore__!.getState().metronomeEnabled))
    .toBe(true);

  // 5. 手動スクロール: ズームUI（QuickPanel内ZoomControl、REQ-002-006・TASK-045）を
  // 実際に操作して表示倍率を引き上げ、スクロール可能な状態を作った上で、
  // scrollTopが実際に変化することを確認する（TASK-025のスクロール対応）。
  // ストアを直接呼ぶのではなくUI操作経由で検証することで、ズームUIの結線漏れ
  // （TASK-045の背景参照）を再発防止する。
  // TASK-075: ズーム・音量はヘッダーの`...`ボタン→QuickPanel経由の操作になった
  // （REQ-012-002: 2クリック以内）。まずQuickPanelを開く。
  await window.getByTestId('quick-panel-toggle').click();
  await expect(window.getByTestId('quick-panel')).toBeVisible();

  // QuickPanel経由の代表操作として音量変更も検証する（REQ-012-004: 機能の喪失禁止）。
  await window.getByTestId('volume-slider').fill('40');
  await expect.poll(() => window.evaluate(() => window.__e2eStore__!.getState().volume)).toBe(40);

  await window.getByTestId('zoom-select').selectOption('4');
  await expect.poll(() => window.evaluate(() => window.__e2eStore__!.getState().zoom)).toBe(4);

  const scrollContainer = window.getByTestId('score-scroll-container');
  await expect
    .poll(() => scrollContainer.evaluate((el) => (el.scrollHeight > el.clientHeight ? 1 : 0)))
    .toBe(1);

  const scrollTopBefore = await scrollContainer.evaluate((el) => el.scrollTop);
  await scrollContainer.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const scrollTopAfter = await scrollContainer.evaluate((el) => el.scrollTop);
  expect(scrollTopAfter).toBeGreaterThan(scrollTopBefore);

  // 6. MIDIイベント（モック）を注入すると正誤判定・カーソル進行が起きる。
  // フィクスチャの最初の右手ノート（P1-M1-N0）はC4（MIDI番号60）である
  // （tests/e2e/fixtures/sample-two-hands.musicxml参照）。
  await expect.poll(() => window.evaluate(() => typeof window.__e2eMidiHooks__)).toBe('object');

  // カーソル要素（#cursorImg-0）が実在することを先にassertする
  // （2026-07-05トラブルシューティング再発防止策1: 前提要素が取得できない場合に
  // アサーションを実行せず暗黙に合格する「空虚合格」パターンを禁止する）。
  await expect(window.locator('[data-testid="osmd-container"] #cursorImg-0')).toHaveCount(1);

  const cursorBoundsBefore = await window.evaluate(() => {
    const cursor = document.querySelector('[data-testid="osmd-container"] #cursorImg-0');
    const rect = cursor!.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  });

  const beforeState = await window.evaluate(() => {
    const state = window.__e2eStore__!.getState();
    return {
      measure: state.currentMeasure,
      noteIndex: state.currentNoteIndex,
      correctNotes: state.stats.correctNotes,
    };
  });

  await window.evaluate(() => {
    window.__e2eMidiHooks__!.noteOn(60, 100, 1);
  });
  await window.evaluate(() => {
    window.__e2eMidiHooks__!.noteOff(60, 0, 1);
  });

  const afterState = await window.evaluate(() => {
    const state = window.__e2eStore__!.getState();
    return {
      measure: state.currentMeasure,
      noteIndex: state.currentNoteIndex,
      correctNotes: state.stats.correctNotes,
    };
  });

  // 正誤判定が実際に行われたこと（正解カウントが増加したこと）を確認する。
  expect(afterState.correctNotes).toBe(beforeState.correctNotes + 1);
  // カーソル（判定グループ）が進行したことを確認する。
  expect(
    afterState.measure !== beforeState.measure || afterState.noteIndex !== beforeState.noteIndex
  ).toBe(true);

  // 正解率の表示（StatsDisplay）が更新されていることを確認する。
  await expect(window.getByTestId('stats-accuracy')).toContainText('100%');

  // OSMDのカーソル描画位置が実際に移動したことを確認する（視覚的なカーソル進行）。
  // カーソル要素が引き続き存在することを先にassertしてから座標変化を検証する
  // （再発防止策1: ifガードによる無言スキップの禁止）。
  await expect(window.locator('[data-testid="osmd-container"] #cursorImg-0')).toHaveCount(1);

  const cursorBoundsAfter = await window.evaluate(() => {
    const cursor = document.querySelector('[data-testid="osmd-container"] #cursorImg-0');
    const rect = cursor!.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  });
  expect(
    cursorBoundsAfter.x !== cursorBoundsBefore.x || cursorBoundsAfter.y !== cursorBoundsBefore.y
  ).toBe(true);
});

test('設定モーダル→音色セクションの表示、Aboutセクションが存在しないこと（TASK-077/082, REQ-013-006）', async () => {
  await expect
    .poll(async () =>
      electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
    )
    .toBeGreaterThan(0);

  // 設定（歯車）ボタンから設定モーダルを開く。
  await window.getByRole('button', { name: '設定' }).click();

  // 音色セクション（TASK-073, US-013）: 再生音色・メトロノーム音色のselectが表示される。
  const playbackVoiceSelect = window.locator('#playbackVoice');
  const metronomeVoiceSelect = window.locator('#metronomeVoice');
  await expect(playbackVoiceSelect).toBeVisible();
  await expect(metronomeVoiceSelect).toBeVisible();

  // 既定音色（voices.ts/metronome-voices.tsの定義）が選択肢に含まれることを確認する。
  await expect(playbackVoiceSelect.locator('option')).toContainText(['グランドピアノ']);
  await expect(metronomeVoiceSelect.locator('option')).toContainText(['クリック']);

  // TASK-082: Aboutはメニューバー経由のAboutModalへ分離したため、設定モーダル内には
  // 「このアプリについて」セクションが存在しないことを回帰防止として検証する。
  await expect(window.getByText('このアプリについて')).toHaveCount(0);
});

test('メニュー「バージョン情報/…について」→Aboutモーダルが開きバージョン・ライセンスが表示される（TASK-082, REQ-015-001/003/005）', async () => {
  await expect
    .poll(async () =>
      electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
    )
    .toBeGreaterThan(0);

  // アプリケーションメニュー（src/main/menu.tsのcreateApplicationMenuTemplate）から
  // id: 'open-about' の項目を取得しclick()することで、メニュー→`menu:open-about`送信→
  // preloadのonOpenAbout購読→AboutModal表示、という実結線を検証する。
  await electronApp.evaluate(({ Menu }) => {
    Menu.getApplicationMenu()?.getMenuItemById('open-about')?.click();
  });

  await expect(window.getByRole('dialog', { name: 'このアプリについて' })).toBeVisible();

  // バージョン表示がpackage.jsonのversionと一致する。
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
    version: string;
  };
  await expect(window.getByText(`v${packageJson.version}`)).toBeVisible();

  // ライセンス表示（Apache License 2.0へのリンク）が表示される。
  await expect(window.getByRole('link', { name: 'Apache License 2.0' })).toBeVisible();

  // Salamanderピアノサンプルのクレジット表記が表示される。
  await expect(window.getByText('Salamander Grand Piano', { exact: false })).toBeVisible();

  // 閉じるボタンでモーダルが閉じる（AboutModalのオーバーレイ・閉じるボタン対応）。
  await window.getByRole('button', { name: '閉じる' }).click();
  await expect(window.getByRole('dialog', { name: 'このアプリについて' })).toHaveCount(0);
});
