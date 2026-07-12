import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * TASK-100: E2E実行ごとに隔離したElectronのuserDataディレクトリを用意するヘルパー。
 *
 * 目的は2つ:
 * 1. 開発者の実環境のuserData（本来のアプリ設定保存先）を一切変更・破壊しないこと。
 * 2. E2E起動時は設定未保存のためOSロケール解決（resolveLanguage）となり、非日本語
 *    ロケール環境では既存E2Eの日本語アクセシブルネーム依存が壊れるため、
 *    `ui.language: 'ja'` をあらかじめ設定ファイルへシードして言語を決定的にすること。
 *
 * アプリ本体（src/）へテスト専用の分岐を追加せず、Electronが標準で解釈する
 * `--user-data-dir`起動引数（Chromium由来のコマンドラインスイッチ）で
 * `app.getPath('userData')`の解決先そのものを差し替える方式を採る
 * （`electronApp.evaluate()`によるapp.setPath呼び出しは、settings:getが
 * app.whenReady直後に読み込みを完了させてしまうため間に合わない）。
 *
 * electron-store（src/main/settings.ts）はcwd省略時、`app.getPath('userData')`直下の
 * `config.json`をストアファイルとして使う。このファイルはトップレベルキー単位でしか
 * defaultsとマージされない（ネストしたuiオブジェクトは、キーが存在すれば完全に
 * ファイルの内容で上書きされ、欠落フィールドはdefaultsで補われない）ため、
 * `ui`をシードする場合は全フィールドを明示する必要がある。
 */

interface SeededUiSettings {
  theme: 'light' | 'dark';
  zoom: number;
  pianoHeight: number;
  language: 'auto' | 'ja' | 'en';
  volume: number;
  showFingerings: boolean;
  keyboardSize: 88 | 76 | 61 | 49;
}

/** src/main/settings.tsのDEFAULT_SETTINGS.uiと同じ値（language以外は既定値のまま）。 */
const SEEDED_UI_DEFAULTS: SeededUiSettings = {
  theme: 'light',
  zoom: 1.0,
  pianoHeight: 120,
  language: 'ja',
  volume: 80,
  showFingerings: true,
  keyboardSize: 88,
};

/**
 * 隔離されたuserDataディレクトリを一時作成し、`ui.language`をシードした
 * `config.json`を配置してディレクトリパスを返す。
 */
export function createIsolatedUserDataDir(language: 'ja' | 'en' = 'ja'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keyflow-e2e-userdata-'));
  const seededConfig = {
    ui: { ...SEEDED_UI_DEFAULTS, language },
  };
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(seededConfig, null, 2), 'utf-8');
  return dir;
}

/** テスト終了時に隔離userDataディレクトリを削除する。 */
export function removeIsolatedUserDataDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Electron起動引数（`--user-data-dir=<dir>`）を生成する。 */
export function userDataDirArg(dir: string): string {
  return `--user-data-dir=${dir}`;
}
