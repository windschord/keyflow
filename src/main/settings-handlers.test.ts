import { describe, expect, it, vi } from 'vitest';
import { createSettingsSetHandler } from './settings-handlers';
import type { AppSettings, SettingsService } from './settings';

/**
 * TASK-099: settings:set ハンドラの結線テスト（REQ-016-004）。
 *
 * モック境界（SettingsService）と再構築コールバックの結線を検証する。
 * ui.languageの変更検知のみが対象で、それ以外の変更では
 * コールバックを呼ばないことも確認する。
 */
describe('createSettingsSetHandler', () => {
  const baseUi: AppSettings['ui'] = {
    theme: 'light',
    zoom: 1.0,
    pianoHeight: 120,
    language: 'auto',
    volume: 80,
    showFingerings: true,
    keyboardSize: 88,
  };

  function createSettingsServiceMock(currentUi: AppSettings['ui']): SettingsService {
    return {
      get: vi.fn((key: keyof AppSettings) => {
        if (key === 'ui') return currentUi;
        throw new Error(`unexpected key in test mock: ${String(key)}`);
      }),
      set: vi.fn(),
    } as unknown as SettingsService;
  }

  it('ui.languageが変化した場合、変更後の言語でonLanguageChangedを呼ぶ', () => {
    const settingsService = createSettingsServiceMock(baseUi);
    const onLanguageChanged = vi.fn();
    const handler = createSettingsSetHandler(settingsService, onLanguageChanged);

    const nextUi: AppSettings['ui'] = { ...baseUi, language: 'en' };
    handler(undefined, 'ui', nextUi);

    expect(settingsService.set).toHaveBeenCalledWith('ui', nextUi);
    expect(onLanguageChanged).toHaveBeenCalledTimes(1);
    expect(onLanguageChanged).toHaveBeenCalledWith('en');
  });

  it('ui.languageが変化しない場合はonLanguageChangedを呼ばない', () => {
    const settingsService = createSettingsServiceMock(baseUi);
    const onLanguageChanged = vi.fn();
    const handler = createSettingsSetHandler(settingsService, onLanguageChanged);

    const nextUi: AppSettings['ui'] = { ...baseUi, volume: 50 };
    handler(undefined, 'ui', nextUi);

    expect(settingsService.set).toHaveBeenCalledWith('ui', nextUi);
    expect(onLanguageChanged).not.toHaveBeenCalled();
  });

  it('ui以外のキー変更ではonLanguageChangedを呼ばない', () => {
    const settingsService = createSettingsServiceMock(baseUi);
    const onLanguageChanged = vi.fn();
    const handler = createSettingsSetHandler(settingsService, onLanguageChanged);

    const nextMidi: AppSettings['midi'] = { selectedDeviceId: 'device-1', selectedDeviceIndex: 2 };
    handler(undefined, 'midi', nextMidi);

    expect(settingsService.set).toHaveBeenCalledWith('midi', nextMidi);
    expect(onLanguageChanged).not.toHaveBeenCalled();
  });

  // M-2: 既知でないキー（プロトタイプ汚染面・未知キーの永続化）は書き込まず副作用も呼ばない。
  it('既知でないキーは書き込まず、onLanguageChangedも呼ばない', () => {
    const settingsService = createSettingsServiceMock(baseUi);
    const onLanguageChanged = vi.fn();
    const handler = createSettingsSetHandler(settingsService, onLanguageChanged);

    for (const badKey of ['__proto__', 'constructor', 'ui.language', 'unknownKey']) {
      handler(undefined, badKey as unknown as keyof AppSettings, { evil: true } as never);
    }

    expect(settingsService.set).not.toHaveBeenCalled();
    expect(onLanguageChanged).not.toHaveBeenCalled();
  });

  it('keyが非文字列の場合も書き込まない', () => {
    const settingsService = createSettingsServiceMock(baseUi);
    const onLanguageChanged = vi.fn();
    const handler = createSettingsSetHandler(settingsService, onLanguageChanged);

    handler(undefined, 42 as unknown as keyof AppSettings, {} as never);

    expect(settingsService.set).not.toHaveBeenCalled();
    expect(onLanguageChanged).not.toHaveBeenCalled();
  });

  // M-2（CodeRabbit #59）: 既知キーでもvalueが非オブジェクト（プリミティブ・null）なら
  // 破損データの永続化を防ぐため書き込まない。例外も投げない。
  it('既知キーでもvalueが非オブジェクト/nullなら書き込まず例外も投げない', () => {
    const settingsService = createSettingsServiceMock(baseUi);
    const onLanguageChanged = vi.fn();
    const handler = createSettingsSetHandler(settingsService, onLanguageChanged);

    for (const badValue of ['not-an-object', 42, null, undefined, true]) {
      expect(() =>
        handler(undefined, 'ui', badValue as unknown as AppSettings['ui'])
      ).not.toThrow();
    }

    expect(settingsService.set).not.toHaveBeenCalled();
    expect(onLanguageChanged).not.toHaveBeenCalled();
  });

  // M-2: 配列値（recentFiles）は typeof 'object' として許可される。
  it('配列値（recentFiles）は書き込む', () => {
    const settingsService = createSettingsServiceMock(baseUi);
    const onLanguageChanged = vi.fn();
    const handler = createSettingsSetHandler(settingsService, onLanguageChanged);

    const recent: AppSettings['recentFiles'] = [{ path: '/a.musicxml', openedAt: 'x' }];
    handler(undefined, 'recentFiles', recent);

    expect(settingsService.set).toHaveBeenCalledWith('recentFiles', recent);
  });
});
