import { describe, expect, it, vi } from 'vitest';
import {
  createReadBinaryFileHandler,
  createReadFileHandler,
  createReadFileIfExistsHandler,
  createRegisterDroppedFileHandler,
  createShowOpenDialogHandler,
} from './file-handlers';
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

// L-2: 読み取りハンドラは lstat も注入する。既定は「シンボリックリンクでない」を返す。
function notSymlinkLstat(): (path: string) => Promise<{ isSymbolicLink(): boolean }> {
  return vi.fn(async () => ({ isSymbolicLink: () => false }));
}

// TASK-086: file:read系ハンドラがPathAllowlist.assertAllowedReadPathという
// モック境界を実際に経由していることを検証する結線テスト。
describe('createReadFileHandler', () => {
  it('reads a registered MusicXML path via the injected fs module', async () => {
    const pathAllowlist = new PathAllowlist();
    pathAllowlist.allowMusicXml('/scores/example.musicxml');
    const fsModule = { readFile: vi.fn().mockResolvedValue('<score/>'), lstat: notSymlinkLstat() };

    const handler = createReadFileHandler(pathAllowlist, fsModule);
    const result = await handler({} as never, '/scores/example.musicxml');

    expect(result).toBe('<score/>');
    expect(fsModule.readFile).toHaveBeenCalledWith('/scores/example.musicxml', 'utf-8');
  });

  it('rejects an unregistered path without touching the fs module', async () => {
    const pathAllowlist = new PathAllowlist();
    const fsModule = { readFile: vi.fn().mockResolvedValue('<score/>'), lstat: notSymlinkLstat() };

    const handler = createReadFileHandler(pathAllowlist, fsModule);

    await expect(handler({} as never, '/etc/hosts')).rejects.toThrow(
      /Refused to read from disallowed path/
    );
    expect(fsModule.readFile).not.toHaveBeenCalled();
  });
});

describe('createReadFileIfExistsHandler', () => {
  it('reads a registered annotation sidecar path via the injected fs module', async () => {
    const pathAllowlist = new PathAllowlist();
    pathAllowlist.allowMusicXml('/scores/example.musicxml');
    const fsModule = { readFile: vi.fn().mockResolvedValue('{}'), lstat: notSymlinkLstat() };

    const handler = createReadFileIfExistsHandler(pathAllowlist, fsModule);
    const result = await handler({} as never, '/scores/example.musicxml.annotation.json');

    expect(result).toBe('{}');
    expect(fsModule.readFile).toHaveBeenCalledWith(
      '/scores/example.musicxml.annotation.json',
      'utf-8'
    );
  });

  it('returns null when the allowed path does not exist yet (ENOENT)', async () => {
    const pathAllowlist = new PathAllowlist();
    pathAllowlist.allowMusicXml('/scores/example.musicxml');
    const enoent = Object.assign(new Error('not found'), { code: 'ENOENT' });
    const fsModule = { readFile: vi.fn().mockRejectedValue(enoent), lstat: notSymlinkLstat() };

    const handler = createReadFileIfExistsHandler(pathAllowlist, fsModule);
    const result = await handler({} as never, '/scores/example.musicxml.annotation.json');

    expect(result).toBeNull();
  });

  it('rejects an unregistered path without touching the fs module', async () => {
    const pathAllowlist = new PathAllowlist();
    const fsModule = { readFile: vi.fn().mockResolvedValue('{}'), lstat: notSymlinkLstat() };

    const handler = createReadFileIfExistsHandler(pathAllowlist, fsModule);

    await expect(handler({} as never, '/etc/hosts.annotation.json')).rejects.toThrow(
      /Refused to read from disallowed path/
    );
    expect(fsModule.readFile).not.toHaveBeenCalled();
  });

  // L-2: 許可済みだが実体がシンボリックリンクのサイドカーは読み取りを拒否する。
  it('rejects reading an annotation sidecar that is a symlink (L-2)', async () => {
    const pathAllowlist = new PathAllowlist();
    pathAllowlist.allowMusicXml('/scores/example.musicxml');
    const fsModule = {
      readFile: vi.fn().mockResolvedValue('{}'),
      lstat: vi.fn().mockResolvedValue({ isSymbolicLink: () => true }),
    };

    const handler = createReadFileIfExistsHandler(pathAllowlist, fsModule);

    await expect(handler({} as never, '/scores/example.musicxml.annotation.json')).rejects.toThrow(
      /Refused to read through symlink/
    );
    expect(fsModule.readFile).not.toHaveBeenCalled();
  });
});

describe('createReadBinaryFileHandler', () => {
  it('reads a registered .mxl path via the injected fs module and returns an ArrayBuffer', async () => {
    const pathAllowlist = new PathAllowlist();
    pathAllowlist.allowMusicXml('/scores/example.mxl');
    const buffer = Buffer.from([1, 2, 3, 4]);
    const fsModule = { readFile: vi.fn().mockResolvedValue(buffer), lstat: notSymlinkLstat() };

    const handler = createReadBinaryFileHandler(pathAllowlist, fsModule);
    const result = await handler({} as never, '/scores/example.mxl');

    expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(fsModule.readFile).toHaveBeenCalledWith('/scores/example.mxl');
  });

  it('rejects an unregistered path without touching the fs module', async () => {
    const pathAllowlist = new PathAllowlist();
    const fsModule = {
      readFile: vi.fn().mockResolvedValue(Buffer.from([])),
      lstat: notSymlinkLstat(),
    };

    const handler = createReadBinaryFileHandler(pathAllowlist, fsModule);

    await expect(handler({} as never, '/etc/hosts')).rejects.toThrow(
      /Refused to read from disallowed path/
    );
    expect(fsModule.readFile).not.toHaveBeenCalled();
  });
});
