import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TASK-068: アプリのブランディング（アイコン生成・ウィンドウタイトル）
 *
 * US-011 / REQ-011-001〜003 に対応する検証。
 * ウィンドウタイトルが「Electron」のままであること、
 * `build/icon.ico` が欠落していることを是正する。
 */

const REPO_ROOT = resolve(__dirname, '../../../..');

describe('App branding (US-011)', () => {
  it('index.htmlの<title>が「MusicXML Piano Practice」である（REQ-011-001）', () => {
    const html = readFileSync(resolve(REPO_ROOT, 'src/renderer/index.html'), 'utf-8');
    expect(html).toMatch(/<title>MusicXML Piano Practice<\/title>/);
  });

  it('resources/icon.pngが生成されておりサイズ>0である（REQ-011-002/003）', () => {
    const stats = statSync(resolve(REPO_ROOT, 'resources/icon.png'));
    expect(stats.size).toBeGreaterThan(0);
  });

  it('build/icon.icnsが生成されておりサイズ>0である（REQ-011-003, macOSパッケージ用）', () => {
    const stats = statSync(resolve(REPO_ROOT, 'build/icon.icns'));
    expect(stats.size).toBeGreaterThan(0);
  });

  it('build/icon.icoが生成されておりサイズ>0である（REQ-011-003, Windowsパッケージ用。electron-builder.ymlの参照欠落解消）', () => {
    const stats = statSync(resolve(REPO_ROOT, 'build/icon.ico'));
    expect(stats.size).toBeGreaterThan(0);
  });
});
