import { describe, it, expect } from 'vitest';
import { resolveLanguage } from './locale';

// TASK-099, REQ-016-002/005: Renderer側resolve-language.tsと同一規則をMain側で
// 独立して実装したもの（Main/Rendererでコードを共有しない既存パターンに従う）。
// テストケースはRenderer側resolve-language.test.tsと対応させている。
describe('resolveLanguage (main)', () => {
  it('保存値が"ja"の場合はOSロケールに関わらず"ja"を返す', () => {
    expect(resolveLanguage('ja', 'en-US')).toBe('ja');
  });

  it('保存値が"en"の場合はOSロケールに関わらず"en"を返す', () => {
    expect(resolveLanguage('en', 'ja-JP')).toBe('en');
  });

  it('保存値が"auto"かつOSロケールが"ja-JP"の場合は"ja"を返す', () => {
    expect(resolveLanguage('auto', 'ja-JP')).toBe('ja');
  });

  it('保存値が"auto"かつOSロケールが"en-US"の場合は"en"を返す', () => {
    expect(resolveLanguage('auto', 'en-US')).toBe('en');
  });

  it('保存値が未定義（undefined）の場合はOSロケール判定にフォールバックする', () => {
    expect(resolveLanguage(undefined, 'ja-JP')).toBe('ja');
  });

  it('保存値が不正な値（既知の言語でも"auto"でもない）の場合はOSロケール判定にフォールバックする', () => {
    expect(resolveLanguage('fr', 'ja-JP')).toBe('ja');
  });

  it('OSロケールが"ja"始まりでない場合は"en"にフォールバックする（中国語ロケール等）', () => {
    expect(resolveLanguage('auto', 'zh-CN')).toBe('en');
  });
});
