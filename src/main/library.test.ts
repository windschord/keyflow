import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LibraryService } from './library';

// TASK-101: US-017（楽譜ライブラリ）Main側永続化。SettingsServiceと同様に
// cwdオプションで一時ディレクトリへ書き込み、テスト間で干渉しないようにする。
describe('LibraryService', () => {
  let tempDir: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-test-'));
  });

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('returns an empty list for a brand-new store', () => {
    const service = new LibraryService({ cwd: tempDir });
    expect(service.getAll()).toEqual([]);
  });

  it('upsert: records addedAt and lastOpenedAt on a new entry (REQ-017-001)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T00:00:00.000Z'));

    const service = new LibraryService({ cwd: tempDir });
    service.upsert({ path: '/scores/a.musicxml', title: 'Title A', composer: 'Composer A' });

    const entries = service.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      path: '/scores/a.musicxml',
      title: 'Title A',
      composer: 'Composer A',
      addedAt: '2026-07-12T00:00:00.000Z',
      lastOpenedAt: '2026-07-12T00:00:00.000Z',
    });

    vi.useRealTimers();
  });

  it('upsert: an existing path updates title/composer/lastOpenedAt, keeps addedAt, and does not duplicate (REQ-017-002)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T00:00:00.000Z'));
    const service = new LibraryService({ cwd: tempDir });
    service.upsert({ path: '/scores/a.musicxml', title: 'Title A', composer: 'Composer A' });

    vi.setSystemTime(new Date('2026-07-12T01:00:00.000Z'));
    service.upsert({ path: '/scores/a.musicxml', title: 'Title A2', composer: 'Composer A2' });

    const entries = service.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      path: '/scores/a.musicxml',
      title: 'Title A2',
      composer: 'Composer A2',
      addedAt: '2026-07-12T00:00:00.000Z',
      lastOpenedAt: '2026-07-12T01:00:00.000Z',
    });

    vi.useRealTimers();
  });

  it('remove: deletes only the target entry (REQ-017-006)', () => {
    const service = new LibraryService({ cwd: tempDir });
    service.upsert({ path: '/scores/a.musicxml', title: 'A', composer: '' });
    service.upsert({ path: '/scores/b.musicxml', title: 'B', composer: '' });

    service.remove('/scores/a.musicxml');

    const entries = service.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('/scores/b.musicxml');
  });

  it('getAll: excludes malformed entries (missing/non-string path) as fail-soft validation', () => {
    tempDir = tempDir as string;
    fs.writeFileSync(
      path.join(tempDir, 'library.json'),
      JSON.stringify({
        entries: [
          { path: '/scores/valid.musicxml', title: 'Valid', composer: 'X' },
          { title: 'Missing path' },
          { path: '', title: 'Empty path' },
          { path: 123, title: 'Non-string path' },
          null,
          'not-an-object',
        ],
      })
    );

    const service = new LibraryService({ cwd: tempDir });
    const entries = service.getAll();

    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('/scores/valid.musicxml');
  });

  it('getAll: normalizes non-string title/composer/dates to safe defaults', () => {
    tempDir = tempDir as string;
    fs.writeFileSync(
      path.join(tempDir, 'library.json'),
      JSON.stringify({
        entries: [
          {
            path: '/scores/valid.musicxml',
            title: 42,
            composer: null,
            addedAt: 999,
            lastOpenedAt: false,
          },
        ],
      })
    );

    const service = new LibraryService({ cwd: tempDir });
    const entries = service.getAll();

    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('');
    expect(entries[0].composer).toBe('');
    expect(typeof entries[0].addedAt).toBe('string');
    expect(typeof entries[0].lastOpenedAt).toBe('string');
  });

  it('getAll: treats a non-array entries field as empty (fail-soft)', () => {
    tempDir = tempDir as string;
    fs.writeFileSync(
      path.join(tempDir, 'library.json'),
      JSON.stringify({ entries: 'not-an-array' })
    );

    const service = new LibraryService({ cwd: tempDir });
    expect(service.getAll()).toEqual([]);
  });

  it('persists entries across re-instantiation (restart equivalent, REQ-017-009)', () => {
    const service1 = new LibraryService({ cwd: tempDir });
    service1.upsert({ path: '/scores/a.musicxml', title: 'A', composer: 'C' });

    const service2 = new LibraryService({ cwd: tempDir });
    expect(service2.getAll()).toHaveLength(1);
    expect(service2.getAll()[0].path).toBe('/scores/a.musicxml');
  });
});
