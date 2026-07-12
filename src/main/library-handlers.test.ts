import { describe, expect, it, vi } from 'vitest';
import {
  createLibraryGetAllHandler,
  createLibraryUpsertHandler,
  createLibraryRemoveHandler,
  createLibraryOpenHandler,
} from './library-handlers';
import { PathAllowlist } from './path-allowlist';
import type { LibraryService } from './library';
import type { SettingsService } from './settings';

function createLibraryServiceMock(): LibraryService {
  return {
    getAll: vi.fn().mockReturnValue([]),
    upsert: vi.fn(),
    remove: vi.fn(),
  } as unknown as LibraryService;
}

function createSettingsServiceMock(): SettingsService {
  return {
    addRecentFile: vi.fn(),
  } as unknown as SettingsService;
}

describe('createLibraryGetAllHandler', () => {
  it('returns entries from LibraryService.getAll', async () => {
    const libraryService = createLibraryServiceMock();
    (libraryService.getAll as ReturnType<typeof vi.fn>).mockReturnValue([
      { path: '/a.musicxml', title: 'A', composer: '', addedAt: 'x', lastOpenedAt: 'y' },
    ]);

    const handler = createLibraryGetAllHandler(libraryService);
    const result = await handler();

    expect(result).toEqual([
      { path: '/a.musicxml', title: 'A', composer: '', addedAt: 'x', lastOpenedAt: 'y' },
    ]);
  });
});

describe('createLibraryUpsertHandler', () => {
  it('forwards the input to LibraryService.upsert', async () => {
    const libraryService = createLibraryServiceMock();
    const handler = createLibraryUpsertHandler(libraryService);

    await handler({} as never, { path: '/a.musicxml', title: 'A', composer: 'C' });

    expect(libraryService.upsert).toHaveBeenCalledWith({
      path: '/a.musicxml',
      title: 'A',
      composer: 'C',
    });
  });
});

describe('createLibraryRemoveHandler', () => {
  it('forwards the path to LibraryService.remove', async () => {
    const libraryService = createLibraryServiceMock();
    const handler = createLibraryRemoveHandler(libraryService);

    await handler({} as never, '/a.musicxml');

    expect(libraryService.remove).toHaveBeenCalledWith('/a.musicxml');
  });
});

// TASK-101: library:open は file:register-dropped-file と同様に拡張子検証を行うが、
// 加えてファイル存在確認を行い、例外を投げず構造化された失敗理由を返す（REQ-017-007/008）。
describe('createLibraryOpenHandler', () => {
  it('registers the allowlist and recent files on success (ok: true)', async () => {
    const pathAllowlist = new PathAllowlist();
    const allowMusicXmlSpy = vi.spyOn(pathAllowlist, 'allowMusicXml');
    const settingsService = createSettingsServiceMock();
    const fsModule = { access: vi.fn().mockResolvedValue(undefined) };

    const handler = createLibraryOpenHandler(pathAllowlist, settingsService, fsModule);
    const result = await handler({} as never, '/scores/a.musicxml');

    expect(result).toEqual({ ok: true });
    expect(allowMusicXmlSpy).toHaveBeenCalledWith('/scores/a.musicxml');
    expect(settingsService.addRecentFile).toHaveBeenCalledWith('/scores/a.musicxml');
  });

  it('accepts .xml/.musicxml/.mxl case-insensitively', async () => {
    const pathAllowlist = new PathAllowlist();
    const settingsService = createSettingsServiceMock();
    const fsModule = { access: vi.fn().mockResolvedValue(undefined) };
    const handler = createLibraryOpenHandler(pathAllowlist, settingsService, fsModule);

    expect(await handler({} as never, '/a.XML')).toEqual({ ok: true });
    expect(await handler({} as never, '/b.MusicXML')).toEqual({ ok: true });
    expect(await handler({} as never, '/c.MXL')).toEqual({ ok: true });
  });

  it('returns invalid-extension without touching the filesystem, allowlist, or recent files', async () => {
    const pathAllowlist = new PathAllowlist();
    const allowMusicXmlSpy = vi.spyOn(pathAllowlist, 'allowMusicXml');
    const settingsService = createSettingsServiceMock();
    const fsModule = { access: vi.fn().mockResolvedValue(undefined) };

    const handler = createLibraryOpenHandler(pathAllowlist, settingsService, fsModule);
    const result = await handler({} as never, '/scores/malicious.pdf');

    expect(result).toEqual({ ok: false, reason: 'invalid-extension' });
    expect(fsModule.access).not.toHaveBeenCalled();
    expect(allowMusicXmlSpy).not.toHaveBeenCalled();
    expect(settingsService.addRecentFile).not.toHaveBeenCalled();
  });

  it('returns not-found without touching the allowlist or recent files when the file does not exist', async () => {
    const pathAllowlist = new PathAllowlist();
    const allowMusicXmlSpy = vi.spyOn(pathAllowlist, 'allowMusicXml');
    const settingsService = createSettingsServiceMock();
    const fsModule = {
      access: vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' })),
    };

    const handler = createLibraryOpenHandler(pathAllowlist, settingsService, fsModule);
    const result = await handler({} as never, '/scores/gone.musicxml');

    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(allowMusicXmlSpy).not.toHaveBeenCalled();
    expect(settingsService.addRecentFile).not.toHaveBeenCalled();
  });

  it('does not throw when the underlying filesystem check rejects', async () => {
    const pathAllowlist = new PathAllowlist();
    const settingsService = createSettingsServiceMock();
    const fsModule = { access: vi.fn().mockRejectedValue(new Error('EPERM')) };

    const handler = createLibraryOpenHandler(pathAllowlist, settingsService, fsModule);

    await expect(handler({} as never, '/scores/locked.musicxml')).resolves.toEqual({
      ok: false,
      reason: 'not-found',
    });
  });
});
