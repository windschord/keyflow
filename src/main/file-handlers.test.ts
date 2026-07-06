import { describe, expect, it, vi } from 'vitest';
import { createRegisterDroppedFileHandler, createShowOpenDialogHandler } from './file-handlers';
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

describe('createRegisterDroppedFileHandler', () => {
  function createSettingsServiceMock(): SettingsService {
    return {
      addRecentFile: vi.fn(),
    } as unknown as SettingsService;
  }

  it('registers a dropped .xml path into the allowlist and recent files (TASK-053)', async () => {
    const pathAllowlist = new PathAllowlist();
    const allowMusicXmlSpy = vi.spyOn(pathAllowlist, 'allowMusicXml');
    const settingsService = createSettingsServiceMock();

    const handler = createRegisterDroppedFileHandler(pathAllowlist, settingsService);
    const result = await handler({} as never, '/scores/dropped.xml');

    expect(result).toBe(true);
    expect(allowMusicXmlSpy).toHaveBeenCalledWith('/scores/dropped.xml');
    expect(settingsService.addRecentFile).toHaveBeenCalledWith('/scores/dropped.xml');
  });

  it('accepts .musicxml and .mxl extensions (case-insensitive)', async () => {
    const pathAllowlist = new PathAllowlist();
    const settingsService = createSettingsServiceMock();
    const handler = createRegisterDroppedFileHandler(pathAllowlist, settingsService);

    expect(await handler({} as never, '/scores/a.MUSICXML')).toBe(true);
    expect(await handler({} as never, '/scores/b.MXL')).toBe(true);
  });

  it('rejects disallowed extensions and does not touch the allowlist or recent files', async () => {
    const pathAllowlist = new PathAllowlist();
    const allowMusicXmlSpy = vi.spyOn(pathAllowlist, 'allowMusicXml');
    const settingsService = createSettingsServiceMock();

    const handler = createRegisterDroppedFileHandler(pathAllowlist, settingsService);
    const result = await handler({} as never, '/scores/malicious.pdf');

    expect(result).toBe(false);
    expect(allowMusicXmlSpy).not.toHaveBeenCalled();
    expect(settingsService.addRecentFile).not.toHaveBeenCalled();
  });
});
