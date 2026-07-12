import { describe, it, expect } from 'vitest';
import { getMessages, mergeMessages } from './index';

// TASK-096, REQ-016-006: getMessagesはenを基底に選択言語で上書きしたオブジェクトを
// 返す。ja/enは型チェック（Messages型適合）により実運用ではキー欠落が発生しないため、
// フォールバック経路自体はgetMessagesが内部で使うmergeMessagesを人工的な部分
// リソースで直接検証する。
describe('mergeMessages (getMessagesのフォールバック実装)', () => {
  it('overrideに存在するキーの値を優先する', () => {
    const base = { settings: { title: 'Settings', language: 'Language' } };
    const override = { settings: { title: '設定', language: '言語' } };

    expect(mergeMessages(base, override)).toEqual({
      settings: { title: '設定', language: '言語' },
    });
  });

  it('overrideで未定義（人工的な部分リソース）のキーはbase（英語）の値へフォールバックする', () => {
    const base = { settings: { title: 'Settings', language: 'Language' } };
    // 'language'キーを意図的に欠落させた人工的な部分リソース
    const override = { settings: { title: '設定' } };

    const result = mergeMessages(base, override);

    expect(result.settings.title).toBe('設定');
    expect(result.settings.language).toBe('Language');
  });

  it('overrideにセクション自体が存在しない場合もbase全体へフォールバックする', () => {
    const base = { settings: { title: 'Settings' }, errors: { generic: 'Something went wrong' } };
    const override = { settings: { title: '設定' } };

    const result = mergeMessages(base, override);

    expect(result.errors.generic).toBe('Something went wrong');
  });
});

describe('getMessages', () => {
  it('"ja"を指定するとMessages型に適合するオブジェクトを返す', () => {
    const messages = getMessages('ja');
    expect(typeof messages.settings.language).toBe('string');
  });

  it('"en"を指定するとMessages型に適合するオブジェクトを返す', () => {
    const messages = getMessages('en');
    expect(typeof messages.settings.language).toBe('string');
  });

  it('同じ言語に対しては同一の参照をメモ化して返す（毎レンダーのオブジェクト生成を避けるため）', () => {
    expect(getMessages('ja')).toBe(getMessages('ja'));
    expect(getMessages('en')).toBe(getMessages('en'));
  });
});
