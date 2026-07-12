import { describe, it, expect } from 'vitest';
import { formatMessage } from './format';

// TASK-096: formatMessageはUI文言中の`{name}`プレースホルダをparamsの値で
// 置換する純関数（REQ-016-007の可変値埋め込みに使う）。
describe('formatMessage', () => {
  it('テンプレート中の{name}をparamsの値で置換する', () => {
    expect(formatMessage('こんにちは、{name}さん', { name: '太郎' })).toBe('こんにちは、太郎さん');
  });

  it('複数のプレースホルダをそれぞれ対応する値で置換する', () => {
    expect(formatMessage('{a}と{b}', { a: '1', b: '2' })).toBe('1と2');
  });

  it('同じプレースホルダが複数回出現する場合はすべて置換する', () => {
    expect(formatMessage('{name}、{name}さん', { name: '花子' })).toBe('花子、花子さん');
  });

  it('数値のparamsは文字列化して置換する', () => {
    expect(formatMessage('残り{count}件', { count: 3 })).toBe('残り3件');
  });

  it('paramsが省略された場合はテンプレートをそのまま返す', () => {
    expect(formatMessage('プレースホルダなし')).toBe('プレースホルダなし');
  });

  it('paramsに存在しない未知のプレースホルダは置換せずそのまま残す', () => {
    expect(formatMessage('{known}と{unknown}', { known: '既知' })).toBe('既知と{unknown}');
  });

  it('paramsが空オブジェクトの場合はすべてのプレースホルダを未知として残置する', () => {
    expect(formatMessage('{a}{b}', {})).toBe('{a}{b}');
  });
});
