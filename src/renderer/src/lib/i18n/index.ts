import { ja } from './ja';
import { en } from './en';
import type { Language, Messages } from './types';

type MessagesLike = Record<string, unknown>;

/**
 * Tの全プロパティ（ネストしたオブジェクトも再帰的に）を省略可能にするユーティリティ型。
 * `mergeMessages`のoverride引数（部分的な翻訳リソースを許容する）の型として使う。
 */
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends MessagesLike ? DeepPartial<T[K]> : T[K];
};

function isRecord(value: unknown): value is MessagesLike {
  return typeof value === 'object' && value !== null;
}

/**
 * baseを基底として、overrideに存在するキーの値で上書きしたオブジェクトを
 * 再帰的に構築する純関数（TASK-096、REQ-016-006の英語フォールバックの実装）。
 * overrideに値が存在しない、または型が不一致（文字列とオブジェクトの取り違え等）の
 * キーはbaseの値をそのまま残す。
 */
export function mergeMessages<T extends MessagesLike>(base: T, override: DeepPartial<T>): T {
  const result: MessagesLike = {};

  for (const key of Object.keys(base)) {
    const baseValue = base[key];
    const overrideValue = (override as MessagesLike)[key];

    if (isRecord(baseValue) && isRecord(overrideValue)) {
      result[key] = mergeMessages(baseValue, overrideValue);
    } else {
      result[key] = typeof overrideValue === 'string' ? overrideValue : baseValue;
    }
  }

  return result as T;
}

const cache = new Map<Language, Messages>();

/**
 * 指定言語のUI文言オブジェクトを返す（TASK-096）。enを基底に選択言語の
 * リソースで上書きすることで、REQ-016-006（翻訳キー欠落時の英語フォールバック）を
 * 満たす。型チェック（`Messages`型適合、DEC-009）によりja/enにキー欠落は
 * 通常発生しないが、実行時の防御としてフォールバック処理も備える。
 * 言語ごとに結果をメモ化し、呼び出しのたびに新しいオブジェクトを生成しない
 * （useTranslation.tsでの毎レンダー再生成を避けるため）。
 */
export function getMessages(language: Language): Messages {
  const cached = cache.get(language);
  if (cached) return cached;

  const overrideResource = language === 'ja' ? ja : en;
  const messages = mergeMessages(en, overrideResource) as Messages;
  cache.set(language, messages);
  return messages;
}
