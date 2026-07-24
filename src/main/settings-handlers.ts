import type { AppSettings, SettingsService } from './settings';

/**
 * `settings:set` で書き込みを許可する既知のキー集合（セキュリティレビュー対応 M-2）。
 * IPCはRendererが任意のJSON値（キー含む）を送れるため、静的型（`keyof AppSettings`）は
 * 実行時の防御にならない。electron-storeはドット記法でパスを解釈するため、`__proto__`や
 * `ui.language`のような文字列を無検証で渡すと未知キーの永続化やプロトタイプ汚染の攻撃面に
 * なりうる。既知のトップレベルキー以外は書き込まない。
 */
const KNOWN_SETTINGS_KEYS: ReadonlySet<string> = new Set<keyof AppSettings>([
  'recentFiles',
  'midi',
  'handSettings',
  'ui',
  'practice',
  'audio',
]);

/**
 * `settings:set` IPCハンドラのファクトリ（TASK-099）。
 *
 * uiキーが変更され、かつlanguageの値が変化した場合にのみonLanguageChangedを呼ぶ
 * （メニュー再構築が必要なのは言語変更時のみのため、ui内の他フィールド変更や
 * ui以外のキー変更では呼ばない、REQ-016-004）。
 *
 * セキュリティレビュー対応（M-2）: `key`が既知のトップレベル設定キーでない場合は
 * 書き込みも副作用（onLanguageChanged）も行わずに無視する。
 */
export function createSettingsSetHandler(
  settingsService: SettingsService,
  onLanguageChanged: (language: AppSettings['ui']['language']) => void
): (event: unknown, key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => void {
  return (_event, key, value) => {
    if (typeof key !== 'string' || !KNOWN_SETTINGS_KEYS.has(key)) {
      return;
    }

    const previousLanguage = key === 'ui' ? settingsService.get('ui').language : undefined;

    settingsService.set(key, value);

    if (key === 'ui' && typeof value === 'object' && value !== null) {
      // keyが'ui'であることを上で確認済みだが、keyとvalueは別引数のため
      // 型システム上はvalueの型が自動では絞り込まれず、明示キャストが必要になる。
      // M-2: valueが非オブジェクト（null含む）でも .language 参照でクラッシュしないよう
      // オブジェクトであることを確認してから読む。
      const newLanguage = (value as AppSettings['ui']).language;
      if (newLanguage !== previousLanguage) {
        onLanguageChanged(newLanguage);
      }
    }
  };
}
