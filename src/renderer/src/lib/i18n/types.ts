import { ja } from './ja';

/** UI表示言語（US-016、REQ-016-001）。 */
export type Language = 'ja' | 'en';

/**
 * ネストしたオブジェクトの末端の値の型をすべて`string`へ広げるユーティリティ型。
 * `ja`は`as const`でリテラル型（例: '設定'）を持つため、`Messages`型としては
 * リテラルではなく`string`として扱えるようにする（`en`側が同じ構造の別の文字列を
 * 持つことを許容するため）。
 */
export type DeepStringify<T> = T extends string
  ? string
  : T extends Record<string, unknown>
    ? { [K in keyof T]: DeepStringify<T[K]> }
    : T;

/**
 * UI文言オブジェクトの型。`ja`の構造を正とし、値を`string`へ広げたもの。
 * `en.ts`はこの型への適合を型チェックで強制される（DEC-009）ため、
 * 翻訳キーの欠落・タイポはコンパイルエラーになる。
 */
export type Messages = DeepStringify<typeof ja>;
