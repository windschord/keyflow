import { describe, it, expect } from 'vitest';
import { resolveLanguage } from './resolve-language';

// TASK-096, REQ-016-002/005: 保存済み設定値とOSロケールから表示言語を解決する
// 純関数。優先順位は「保存値の'ja'/'en' > 'auto'・不正値・未定義はOSロケール判定」。
describe('resolveLanguage', () => {
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

  it('OSロケールが"jam-XX"のような"ja"始まりでも異なる言語コードの場合は"ja"判定される仕様どおりの前方一致とする', () => {
    // 仕様は「osLocaleがja始まりならja」という前方一致規則であり、
    // 3文字以上の言語コードとの誤判定余地は仕様上許容する（実際のnavigator.language/
    // app.getLocale()はISO言語コードのためこのケースは実運用では発生しない）。
    expect(resolveLanguage('auto', 'jam-XX')).toBe('ja');
  });
});
