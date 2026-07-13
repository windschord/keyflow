import { usePracticeStore } from '../../store';
import { getMessages } from './index';
import type { Messages } from './types';

/**
 * ui-sliceの`language`を購読し、現在の表示言語のUI文言オブジェクトを返すフック
 * （TASK-096、US-016）。`getMessages`は言語ごとにメモ化されているため、
 * `language`が変化しない限り同一の参照を返し不要な再レンダーを避ける。
 */
export function useTranslation(): Messages {
  const language = usePracticeStore((s) => s.language);
  return getMessages(language);
}
