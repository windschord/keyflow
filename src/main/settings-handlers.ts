import type { AppSettings, SettingsService } from './settings';

/**
 * `settings:set` IPCハンドラのファクトリ（TASK-099）。
 *
 * uiキーが変更され、かつlanguageの値が変化した場合にのみonLanguageChangedを呼ぶ
 * （メニュー再構築が必要なのは言語変更時のみのため、ui内の他フィールド変更や
 * ui以外のキー変更では呼ばない、REQ-016-004）。
 */
export function createSettingsSetHandler(
  settingsService: SettingsService,
  onLanguageChanged: (language: AppSettings['ui']['language']) => void
): (event: unknown, key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => void {
  return (_event, key, value) => {
    const previousLanguage = key === 'ui' ? settingsService.get('ui').language : undefined;

    settingsService.set(key, value);

    if (key === 'ui') {
      // keyが'ui'であることを上で確認済みだが、keyとvalueは別引数のため
      // 型システム上はvalueの型が自動では絞り込まれず、明示キャストが必要になる。
      const newLanguage = (value as AppSettings['ui']).language;
      if (newLanguage !== previousLanguage) {
        onLanguageChanged(newLanguage);
      }
    }
  };
}
