import type { Messages } from './types';

/**
 * 英語リソース（TASK-096）。`Messages`型（`ja`の構造から導出）への適合を
 * 型チェックで強制する。キーの欠落・タイポはコンパイルエラーになる（DEC-009）。
 */
export const en: Messages = {
  settings: {
    title: 'Settings',
    language: 'Language',
  },
};
