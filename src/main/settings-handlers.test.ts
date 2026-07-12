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
});
