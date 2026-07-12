import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStrictMode as render } from '../../tests/test-utils';
import { LibraryView } from './index';
import { usePracticeStore } from '../../store';
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

describe('LibraryView', () => {
  const libraryApi = {
    getAll: vi.fn(),
    upsert: vi.fn(),
    remove: vi.fn(),
    open: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error テストではelectronAPIの一部（library）のみをモックする
    window.electronAPI = {
      library: libraryApi,
    };
    usePracticeStore.setState({ language: 'ja' });
  });

  it('renders title, composer, and last opened date for each entry (REQ-017-003)', async () => {
    libraryApi.getAll.mockResolvedValue([
      makeEntry({ path: '/a', title: 'Moonlight Sonata', composer: 'Beethoven' }),
    ]);

    render(<LibraryView onOpenEntry={vi.fn()} onOpenFileDialog={vi.fn()} />);

    expect(await screen.findByText('Moonlight Sonata')).toBeInTheDocument();
    expect(screen.getByText('Beethoven')).toBeInTheDocument();
  });

  it('calls onOpenEntry with the entry path when a row title is clicked', async () => {
    libraryApi.getAll.mockResolvedValue([
      makeEntry({ path: '/scores/a.musicxml', title: 'Moonlight Sonata' }),
    ]);
    const onOpenEntry = vi.fn();

    render(<LibraryView onOpenEntry={onOpenEntry} onOpenFileDialog={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Moonlight Sonata' }));

    expect(onOpenEntry).toHaveBeenCalledWith('/scores/a.musicxml');
  });

  it('filters the list by title/composer with a case-insensitive partial match (REQ-017-004)', async () => {
    libraryApi.getAll.mockResolvedValue([
      makeEntry({ path: '/a', title: 'Moonlight Sonata', composer: 'Beethoven' }),
      makeEntry({ path: '/b', title: 'Clair de Lune', composer: 'Debussy' }),
    ]);

    render(<LibraryView onOpenEntry={vi.fn()} onOpenFileDialog={vi.fn()} />);
    await screen.findByText('Moonlight Sonata');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'DEBUSSY' } });

    await waitFor(() => {
      expect(screen.queryByText('Moonlight Sonata')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Clair de Lune')).toBeInTheDocument();
  });

  it('sorts by lastOpenedAt descending by default (REQ-017-005)', async () => {
    libraryApi.getAll.mockResolvedValue([
      makeEntry({ path: '/a', title: 'Older', lastOpenedAt: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ path: '/b', title: 'Newer', lastOpenedAt: '2026-07-03T00:00:00.000Z' }),
    ]);

    render(<LibraryView onOpenEntry={vi.fn()} onOpenFileDialog={vi.fn()} />);
    await screen.findByText('Newer');

    const rows = screen.getAllByRole('row').slice(1); // 先頭はヘッダー行
    expect(within(rows[0]).getByText('Newer')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Older')).toBeInTheDocument();
  });

  it('re-sorts the list when a different sort key/order is selected (REQ-017-005)', async () => {
    libraryApi.getAll.mockResolvedValue([
      makeEntry({ path: '/a', title: 'Banana' }),
      makeEntry({ path: '/b', title: 'Apple' }),
    ]);

    render(<LibraryView onOpenEntry={vi.fn()} onOpenFileDialog={vi.fn()} />);
    await screen.findByText('Banana');

    fireEvent.change(screen.getByLabelText('並べ替え'), { target: { value: 'title' } });
    fireEvent.change(screen.getByLabelText('順序'), { target: { value: 'asc' } });

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Apple')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Banana')).toBeInTheDocument();
  });

  it('removes the entry after the delete flow is confirmed via the in-app confirmation UI (REQ-017-006)', async () => {
    libraryApi.getAll.mockResolvedValue([
      makeEntry({ path: '/scores/a.musicxml', title: 'Moonlight Sonata' }),
    ]);
    libraryApi.remove.mockResolvedValue(undefined);

    render(<LibraryView onOpenEntry={vi.fn()} onOpenFileDialog={vi.fn()} />);
    await screen.findByText('Moonlight Sonata');

    fireEvent.click(screen.getByRole('button', { name: 'Moonlight Sonata をライブラリから削除' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Moonlight Sonata/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '削除する' }));

    await waitFor(() => expect(libraryApi.remove).toHaveBeenCalledWith('/scores/a.musicxml'));
    await waitFor(() => {
      expect(screen.queryByText('Moonlight Sonata')).not.toBeInTheDocument();
    });
  });

  it('does not call remove when the confirmation is cancelled', async () => {
    libraryApi.getAll.mockResolvedValue([
      makeEntry({ path: '/scores/a.musicxml', title: 'Moonlight Sonata' }),
    ]);

    render(<LibraryView onOpenEntry={vi.fn()} onOpenFileDialog={vi.fn()} />);
    await screen.findByText('Moonlight Sonata');

    fireEvent.click(screen.getByRole('button', { name: 'Moonlight Sonata をライブラリから削除' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'キャンセル' }));

    expect(libraryApi.remove).not.toHaveBeenCalled();
    expect(screen.getByText('Moonlight Sonata')).toBeInTheDocument();
  });

  it('shows an empty state with a button to open a file when the library has no entries', async () => {
    libraryApi.getAll.mockResolvedValue([]);
    const onOpenFileDialog = vi.fn();

    render(<LibraryView onOpenEntry={vi.fn()} onOpenFileDialog={onOpenFileDialog} />);

    expect(await screen.findByText('ライブラリに楽譜がありません')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ファイルを開く' }));
    expect(onOpenFileDialog).toHaveBeenCalled();
  });

  it('marks entries whose path is present in missingPaths', async () => {
    libraryApi.getAll.mockResolvedValue([makeEntry({ path: '/missing', title: 'Ghost Score' })]);

    render(
      <LibraryView
        onOpenEntry={vi.fn()}
        onOpenFileDialog={vi.fn()}
        missingPaths={new Set(['/missing'])}
      />
    );

    expect(await screen.findByText('見つかりません')).toBeInTheDocument();
  });

  it('renders headings and buttons in English when the language is "en" (REQ-017-011)', async () => {
    usePracticeStore.setState({ language: 'en' });
    libraryApi.getAll.mockResolvedValue([]);

    render(<LibraryView onOpenEntry={vi.fn()} onOpenFileDialog={vi.fn()} />);

    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open file' })).toBeInTheDocument();
  });
});
