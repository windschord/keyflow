/**
 * 日本語リソース（TASK-096）。UI多言語対応（US-016）の構造のソースオブトゥルースであり、
 * `Messages`型（types.ts）はこのオブジェクトの構造から導出する。
 *
 * この時点では全UI文言の洗い出しは行わず、基盤検証用の最小セットのみを定義する。
 * 実際の文言追加はTASK-097/098で行う（設計: docs/sdd/design/components/i18n.md）。
 */
export const ja = {
  settings: {
    title: '設定',
    language: '言語',
  },
} as const satisfies Record<string, Record<string, string>>;
