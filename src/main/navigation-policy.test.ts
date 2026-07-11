import { describe, expect, it } from 'vitest';
import { isAllowedExternalUrl, isAllowedNavigationUrl } from './navigation-policy';

/**
 * TASK-087: ウィンドウナビゲーション強化（openExternalスキーム検証・will-navigate）
 *
 * Electron APIに依存しない純粋関数として実装し、ユニットテストで
 * 許可/拒否の判定ロジックのみを検証できるようにする（window-options.tsと同じパターン）。
 */
describe('isAllowedExternalUrl (TASK-087)', () => {
  it('httpsスキームを許可する', () => {
    expect(isAllowedExternalUrl('https://example.com')).toBe(true);
  });

  it('httpスキームを許可する', () => {
    expect(isAllowedExternalUrl('http://example.com')).toBe(true);
  });

  it('fileスキームを拒否する', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('任意のカスタムスキームを拒否する', () => {
    expect(isAllowedExternalUrl('smb://host/share')).toBe(false);
  });

  it('javascriptスキームを拒否する', () => {
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('空文字を拒否する', () => {
    expect(isAllowedExternalUrl('')).toBe(false);
  });

  it('不正なURL文字列を拒否する', () => {
    expect(isAllowedExternalUrl('not a url')).toBe(false);
  });
});

describe('isAllowedNavigationUrl (TASK-087)', () => {
  it('開発時のHMR URL配下のナビゲーションを許可する', () => {
    expect(
      isAllowedNavigationUrl('http://localhost:5173/index.html', 'http://localhost:5173')
    ).toBe(true);
  });

  it('devServerUrlそのものへのナビゲーションを許可する', () => {
    expect(isAllowedNavigationUrl('http://localhost:5173', 'http://localhost:5173')).toBe(true);
  });

  it('devServerUrlと異なるオリジンのナビゲーションを拒否する', () => {
    expect(
      isAllowedNavigationUrl('http://localhost:9999/index.html', 'http://localhost:5173')
    ).toBe(false);
  });

  it('fileプロトコルのナビゲーションを許可する（本番のindex.html自己遷移）', () => {
    expect(isAllowedNavigationUrl('file:///app/out/renderer/index.html', undefined)).toBe(true);
  });

  it('外部httpsナビゲーションを拒否する', () => {
    expect(isAllowedNavigationUrl('https://evil.example.com', undefined)).toBe(false);
  });

  it('devServerUrl未設定時に外部httpナビゲーションを拒否する', () => {
    expect(isAllowedNavigationUrl('http://example.com', undefined)).toBe(false);
  });

  it('不正なURL文字列を拒否する', () => {
    expect(isAllowedNavigationUrl('not a url', 'http://localhost:5173')).toBe(false);
  });
});
