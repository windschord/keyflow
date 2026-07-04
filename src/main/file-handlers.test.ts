import { describe, expect, it, vi } from 'vitest';
import { createShowOpenDialogHandler } from './file-handlers';
import { PathAllowlist } from './path-allowlist';
import type { SettingsService } from './settings';

describe('createShowOpenDialogHandler', () => {
  function createSettingsServiceMock(): SettingsService {
    return {
      addRecentFile: vi.fn(),
    } as unknown as SettingsService;
  }

  it('adds the selected path to recent files when a file is chosen (REQ-001-006)', async () => {
    const pathAllowlist = new PathAllowlist();
    const settingsService = createSettingsServiceMock();
    const dialogModule = {
      showOpenDialog: vi
        .fn()
        .mockResolvedValue({ canceled: false, filePaths: ['/scores/example.musicxml'] }),
    };

    const handler = createShowOpenDialogHandler(dialogModule, pathAllowlist, settingsService);
    const result = await handler();

    expect(result).toBe('/scores/example.musicxml');
    expect(settingsService.addRecentFile).toHaveBeenCalledTimes(1);
    expect(settingsService.addRecentFile).toHaveBeenCalledWith('/scores/example.musicxml');
  });

  it('does not touch recent files when the dialog is canceled', async () => {
    const pathAllowlist = new PathAllowlist();
    const settingsService = createSettingsServiceMock();
    const dialogModule = {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    };

    const handler = createShowOpenDialogHandler(dialogModule, pathAllowlist, settingsService);
    const result = await handler();

    expect(result).toBeNull();
    expect(settingsService.addRecentFile).not.toHaveBeenCalled();
  });

  it('does not touch recent files when filePaths is empty even without canceled flag', async () => {
    const pathAllowlist = new PathAllowlist();
    const settingsService = createSettingsServiceMock();
    const dialogModule = {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
    };

    const handler = createShowOpenDialogHandler(dialogModule, pathAllowlist, settingsService);
    const result = await handler();

    expect(result).toBeNull();
    expect(settingsService.addRecentFile).not.toHaveBeenCalled();
  });
});
