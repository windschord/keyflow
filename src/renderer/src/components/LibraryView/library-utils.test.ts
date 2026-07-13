import { describe, it, expect } from 'vitest';
import { filterLibraryEntries, sortLibraryEntries, formatLibraryDateTime } from './library-utils';
import type { LibraryEntry } from '../../types/library';

function makeEntry(overrides: Partial<LibraryEntry>): LibraryEntry {
  return {
    path: '/scores/example.musicxml',
    title: 'Example',
    composer: 'Composer',
    addedAt: '2026-07-01T00:00:00.000Z',
    lastOpenedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterLibraryEntries (REQ-017-004)', () => {
  const entries = [
    makeEntry({ path: '/a', title: 'Moonlight Sonata', composer: 'Beethoven' }),
    makeEntry({ path: '/b', title: 'Clair de Lune', composer: 'Debussy' }),
    makeEntry({ path: '/c', title: 'Fur Elise', composer: 'Beethoven' }),
  ];

  it('returns entries whose title partially matches the query', () => {
    expect(filterLibraryEntries(entries, 'sonata')).toEqual([entries[0]]);
  });

  it('returns entries whose composer partially matches the query', () => {
    const result = filterLibraryEntries(entries, 'beethoven');
    expect(result).toEqual([entries[0], entries[2]]);
  });

  it('is case-insensitive', () => {
    expect(filterLibraryEntries(entries, 'MOONLIGHT')).toEqual([entries[0]]);
  });

  it('returns all entries when the query is empty', () => {
    expect(filterLibraryEntries(entries, '')).toEqual(entries);
  });

  it('returns all entries when the query is only whitespace', () => {
    expect(filterLibraryEntries(entries, '   ')).toEqual(entries);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterLibraryEntries(entries, 'nonexistent')).toEqual([]);
  });
});

describe('sortLibraryEntries (REQ-017-005)', () => {
  it('sorts by title ascending using localeCompare', () => {
    const entries = [
      makeEntry({ path: '/b', title: 'Banana' }),
      makeEntry({ path: '/a', title: 'Apple' }),
      makeEntry({ path: '/c', title: 'Cherry' }),
    ];
    const result = sortLibraryEntries(entries, 'title', 'asc');
    expect(result.map((e) => e.title)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('sorts by title descending', () => {
    const entries = [
      makeEntry({ path: '/b', title: 'Banana' }),
      makeEntry({ path: '/a', title: 'Apple' }),
      makeEntry({ path: '/c', title: 'Cherry' }),
    ];
    const result = sortLibraryEntries(entries, 'title', 'desc');
    expect(result.map((e) => e.title)).toEqual(['Cherry', 'Banana', 'Apple']);
  });

  it('sorts by addedAt ascending', () => {
    const entries = [
      makeEntry({ path: '/b', addedAt: '2026-07-03T00:00:00.000Z' }),
      makeEntry({ path: '/a', addedAt: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ path: '/c', addedAt: '2026-07-02T00:00:00.000Z' }),
    ];
    const result = sortLibraryEntries(entries, 'addedAt', 'asc');
    expect(result.map((e) => e.path)).toEqual(['/a', '/c', '/b']);
  });

  it('sorts by lastOpenedAt descending (the default, REQ-017-005)', () => {
    const entries = [
      makeEntry({ path: '/b', lastOpenedAt: '2026-07-03T00:00:00.000Z' }),
      makeEntry({ path: '/a', lastOpenedAt: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ path: '/c', lastOpenedAt: '2026-07-02T00:00:00.000Z' }),
    ];
    const result = sortLibraryEntries(entries, 'lastOpenedAt', 'desc');
    expect(result.map((e) => e.path)).toEqual(['/b', '/c', '/a']);
  });

  it('keeps the original relative order for entries with equal keys (stability)', () => {
    const entries = [
      makeEntry({ path: '/first', lastOpenedAt: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ path: '/second', lastOpenedAt: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ path: '/third', lastOpenedAt: '2026-07-01T00:00:00.000Z' }),
    ];
    const result = sortLibraryEntries(entries, 'lastOpenedAt', 'asc');
    expect(result.map((e) => e.path)).toEqual(['/first', '/second', '/third']);
  });

  it('does not mutate the input array', () => {
    const entries = [
      makeEntry({ path: '/b', title: 'Banana' }),
      makeEntry({ path: '/a', title: 'Apple' }),
    ];
    const original = [...entries];
    sortLibraryEntries(entries, 'title', 'asc');
    expect(entries).toEqual(original);
  });
});

describe('formatLibraryDateTime', () => {
  it('formats a valid ISO 8601 string to a non-empty locale string', () => {
    const result = formatLibraryDateTime('2026-07-01T12:00:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns the original string unchanged when it cannot be parsed as a date', () => {
    expect(formatLibraryDateTime('not-a-date')).toBe('not-a-date');
  });
});
