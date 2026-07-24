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

  // M-2: 不正な入力（非文字列フィールド・空path・非オブジェクト）は永続化ストアを汚さない。
  it('不正な入力（非文字列/空path/非オブジェクト）はupsertを呼ばない', async () => {
    const libraryService = createLibraryServiceMock();
    const handler = createLibraryUpsertHandler(libraryService);

    const invalidInputs = [
      { path: '', title: 'A', composer: 'C' },
      { path: 42, title: 'A', composer: 'C' },
      { path: '/a.musicxml', title: 123, composer: 'C' },
      { path: '/a.musicxml', title: 'A', composer: null },
      null,
      'a string',
    ];
    for (const input of invalidInputs) {
      await handler({} as never, input as never);
    }

    expect(libraryService.upsert).not.toHaveBeenCalled();
  });
});

describe('createLibraryRemoveHandler', () => {
  it('forwards the path to LibraryService.remove', async () => {
    const libraryService = createLibraryServiceMock();
    const handler = createLibraryRemoveHandler(libraryService);

    await handler({} as never, '/a.musicxml');

    expect(libraryService.remove).toHaveBeenCalledWith('/a.musicxml');
  });

  // M-2: 非文字列・空文字のpathでは削除しない（不正入力による予期しない削除を防ぐ）。
  it('非文字列/空文字のpathではremoveを呼ばない', async () => {
    const libraryService = createLibraryServiceMock();
    const handler = createLibraryRemoveHandler(libraryService);

    await handler({} as never, '' as never);
    await handler({} as never, 42 as never);
    await handler({} as never, null as never);

    expect(libraryService.remove).not.toHaveBeenCalled();
  });
});

// TASK-101: library:open は file:register-dropped-file と同様に拡張子検証するが、
// 加えてファイル存在確認を行い、例外を投げず構造化された失敗理由を返す（REQ-017-007/008）。
describe('createLibraryOpenHandler', () => {
  // M-1: library:open は「ライブラリに登録済みの楽譜」のみ開ける。テストのlibraryService
  // モックは、指定したパス群を登録済みとして返すよう構成する。
  function createLibraryServiceMockWithPaths(paths: string[]): LibraryService {
    const entries = paths.map((path) => ({
      path,
      title: '',
      composer: '',
      addedAt: 'x',
      lastOpenedAt: 'y',
    }));
    return { getAll: vi.fn().mockReturnValue(entries) } as unknown as LibraryService;
  }

  it('registers the allowlist and recent files on success (ok: true)', async () => {
    const pathAllowlist = new PathAllowlist();
    const allowMusicXmlSpy = vi.spyOn(pathAllowlist, 'allowMusicXml');
    const settingsService = createSettingsServiceMock();
    const fsModule = { access: vi.fn().mockResolvedValue(undefined) };
    const libraryService = createLibraryServiceMockWithPaths(['/scores/a.musicxml']);

    const handler = createLibraryOpenHandler(
      pathAllowlist,
      settingsService,
      fsModule,
      libraryService
    );
    const result = await handler({} as never, '/scores/a.musicxml');

    expect(result).toEqual({ ok: true });
    expect(allowMusicXmlSpy).toHaveBeenCalledWith('/scores/a.musicxml');
    expect(settingsService.addRecentFile).toHaveBeenCalledWith('/scores/a.musicxml');
  });

  it('accepts .xml/.musicxml/.mxl case-insensitively', async () => {
    const pathAllowlist = new PathAllowlist();
    const settingsService = createSettingsServiceMock();
    const fsModule = { access: vi.fn().mockResolvedValue(undefined) };
    const libraryService = createLibraryServiceMockWithPaths(['/a.XML', '/b.MusicXML', '/c.MXL']);
    const handler = createLibraryOpenHandler(
      pathAllowlist,
      settingsService,
      fsModule,
      libraryService
    );

    expect(await handler({} as never, '/a.XML')).toEqual({ ok: true });
    expect(await handler({} as never, '/b.MusicXML')).toEqual({ ok: true });
    expect(await handler({} as never, '/c.MXL')).toEqual({ ok: true });
  });

  it('returns invalid-extension without touching the filesystem, allowlist, or recent files', async () => {
    const pathAllowlist = new PathAllowlist();
    const allowMusicXmlSpy = vi.spyOn(pathAllowlist, 'allowMusicXml');
    const settingsService = createSettingsServiceMock();
    const fsModule = { access: vi.fn().mockResolvedValue(undefined) };
    const libraryService = createLibraryServiceMockWithPaths(['/scores/malicious.pdf']);

    const handler = createLibraryOpenHandler(
      pathAllowlist,
      settingsService,
      fsModule,
      libraryService
    );
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
    const libraryService = createLibraryServiceMockWithPaths(['/scores/gone.musicxml']);

    const handler = createLibraryOpenHandler(
      pathAllowlist,
      settingsService,
      fsModule,
      libraryService
    );
    const result = await handler({} as never, '/scores/gone.musicxml');

    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(allowMusicXmlSpy).not.toHaveBeenCalled();
    expect(settingsService.addRecentFile).not.toHaveBeenCalled();
  });

  it('does not throw when the underlying filesystem check rejects', async () => {
    const pathAllowlist = new PathAllowlist();
    const settingsService = createSettingsServiceMock();
    const fsModule = { access: vi.fn().mockRejectedValue(new Error('EPERM')) };
    const libraryService = createLibraryServiceMockWithPaths(['/scores/locked.musicxml']);

    const handler = createLibraryOpenHandler(
      pathAllowlist,
      settingsService,
      fsModule,
      libraryService
    );

    await expect(handler({} as never, '/scores/locked.musicxml')).resolves.toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  // M-1: ライブラリ未登録のパスは、拡張子が正しく実在しても allowlist へ載せない。
  it('returns not-found and does not allowlist a path that is not registered in the library', async () => {
    const pathAllowlist = new PathAllowlist();
    const allowMusicXmlSpy = vi.spyOn(pathAllowlist, 'allowMusicXml');
    const settingsService = createSettingsServiceMock();
    const fsModule = { access: vi.fn().mockResolvedValue(undefined) };
    // ライブラリには別のファイルのみ登録されている。
    const libraryService = createLibraryServiceMockWithPaths(['/scores/registered.musicxml']);

    const handler = createLibraryOpenHandler(
      pathAllowlist,
      settingsService,
      fsModule,
      libraryService
    );
    const result = await handler({} as never, '/Users/victim/secret.musicxml');

    expect(result).toEqual({ ok: false, reason: 'not-found' });
    // 未登録パスは存在確認すら行わず allowlist・履歴にも載せない。
    expect(fsModule.access).not.toHaveBeenCalled();
    expect(allowMusicXmlSpy).not.toHaveBeenCalled();
    expect(settingsService.addRecentFile).not.toHaveBeenCalled();
  });
});
