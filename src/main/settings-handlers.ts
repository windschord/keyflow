import type { AppSettings, SettingsService } from './settings';

/**
 * `settings:set` で書き込みを許可する既知のキー集合（セキュリティレビュー対応 M-2）。
 * IPCはRendererが任意のJSON値（キー含む）を送れるため、静的型（`keyof AppSettings`）は
 * 実行時の防御にならない。electron-storeはドット記法でパスを解釈するため、`__proto__`や
 * `ui.language`のような文字列を無検証で渡すと未知キーの永続化やプロトタイプ汚染の攻撃面に
 * なりうる。既知のトップレベルキー以外は書き込まない。
 */
// CodeRabbit #59指摘（Nitpick）: 配列リテラルでの手動列挙は AppSettings への
// フィールド追加時に更新漏れがあってもコンパイルエラーにならず、当該キーの
// settings:set が静かに無視される。Record<keyof AppSettings, true> で網羅性を
// コンパイル時に保証し、追加フィールドの列挙漏れをビルドで検出する。
const KNOWN_SETTINGS_KEYS_MAP: Record<keyof AppSettings, true> = {
  recentFiles: true,
  midi: true,
  handSettings: true,
  ui: true,
  practice: true,
  audio: true,
};
const KNOWN_SETTINGS_KEYS: ReadonlySet<string> = new Set(Object.keys(KNOWN_SETTINGS_KEYS_MAP));

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

    // M-2: AppSettingsの全トップレベル値はオブジェクトまたは配列であり、プリミティブ値は
    // 想定しない。既知キーであっても文字列・数値・nullなどの不正なvalueがそのまま
    // ストアへ書き込まれ、参照側で想定外の形になるのを防ぐため、書き込み前に検証する
    // （CodeRabbit #59指摘）。
    if (typeof value !== 'object' || value === null) {
      return;
    }

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
