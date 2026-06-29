import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnnotationStoreService } from './index';

describe('AnnotationStoreService', () => {
  let store: AnnotationStoreService;

  beforeEach(() => {
    // Mock electron API
    // @ts-expect-error - overriding window property for tests
    global.window = {
      electronAPI: {
        file: {
          read: vi.fn(),
          write: vi.fn(),
        },
      },
    };
    store = new AnnotationStoreService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('setFinger and getAnnotation work correctly', () => {
    store.setFinger('P1-M1-N0', 3);
    const ann = store.getAnnotation('P1-M1-N0');
    expect(ann).toBeDefined();
    expect(ann?.fingerNumber).toBe(3);
    expect(store.isDirty()).toBe(true);
  });

  it('rejects invalid noteId values at write boundaries', () => {
    expect(() => store.setFinger('N1', 3)).toThrow(/Invalid noteId/);
    expect(() => store.setComment('part-1', 'comment')).toThrow(/Invalid noteId/);
    expect(() => store.applyAISuggestions([{ noteId: 'bad-id', finger: 2, cost: 0 }])).toThrow(
      /Invalid noteId/
    );
  });

  it('removeFinger removes the finger but keeps comment if exists', () => {
    store.setFinger('P1-M1-N0', 3);
    store.setComment('P1-M1-N0', 'test comment');
    store.removeFinger('P1-M1-N0');

    const ann = store.getAnnotation('P1-M1-N0');
    expect(ann).toBeDefined();
    expect(ann?.fingerNumber).toBeUndefined();
    expect(ann?.comment).toBe('test comment');
    expect(store.isDirty()).toBe(true);
  });

  it('removeFinger completely removes annotation if no comment', () => {
    store.setFinger('P1-M1-N0', 3);
    store.removeFinger('P1-M1-N0');
    expect(store.getAnnotation('P1-M1-N0')).toBeUndefined();
  });

  it('applyAISuggestions marks as isAISuggested: true and isApproved: false', () => {
    store.applyAISuggestions([
      { noteId: 'P1-M1-N0', finger: 2, cost: 0 },
      { noteId: 'P1-M1-N1', finger: 4, cost: 0 },
    ]);

    const ann1 = store.getAnnotation('P1-M1-N0');
    expect(ann1?.fingerNumber).toBe(2);
    expect(ann1?.isAISuggested).toBe(true);
    expect(ann1?.isApproved).toBe(false);

    const ann2 = store.getAnnotation('P1-M1-N1');
    expect(ann2?.fingerNumber).toBe(4);
    expect(ann2?.isAISuggested).toBe(true);
    expect(ann2?.isApproved).toBe(false);
  });

  it('applyAISuggestions does not overwrite approved annotations', () => {
    store.setFinger('P1-M1-N0', 5);

    store.applyAISuggestions([{ noteId: 'P1-M1-N0', finger: 1, cost: 0 }]);

    const ann = store.getAnnotation('P1-M1-N0');
    expect(ann?.fingerNumber).toBe(5);
    expect(ann?.isApproved).toBe(true);
    expect(ann?.isAISuggested).toBe(false);
  });

  it('approveAnnotation sets isApproved: true', () => {
    store.applyAISuggestions([{ noteId: 'P1-M1-N0', finger: 2, cost: 0 }]);
    store.approveAnnotation('P1-M1-N0');

    const ann = store.getAnnotation('P1-M1-N0');
    expect(ann?.isApproved).toBe(true);
    expect(ann?.isAISuggested).toBe(false);
  });

  it('save and load interact with IPC', async () => {
    const mockData = {
      version: '1.0',
      annotations: [
        { noteId: 'P1-M1-N0', fingerNumber: 1, isAISuggested: false, isApproved: true },
      ],
    };

    // @ts-expect-error test mock
    vi.mocked(window.electronAPI.file.read).mockResolvedValue(JSON.stringify(mockData));

    await store.load('/test.xml');

    // @ts-expect-error test mock
    expect(window.electronAPI.file.read).toHaveBeenCalledWith('/test.xml.annotation.json');
    expect(store.getAnnotation('P1-M1-N0')?.fingerNumber).toBe(1);
    expect(store.isDirty()).toBe(false);

    store.setFinger('P1-M1-N1', 5);
    expect(store.isDirty()).toBe(true);

    await store.save();

    // @ts-expect-error test mock
    expect(window.electronAPI.file.write).toHaveBeenCalled();
    // @ts-expect-error test mock
    const writeArg = vi.mocked(window.electronAPI.file.write).mock.calls[0][1] as string;
    const writtenData = JSON.parse(writeArg);

    expect(writtenData.annotations).toHaveLength(2);
    expect(store.isDirty()).toBe(false);
  });

  it('skips invalid persisted noteIds when loading', async () => {
    const mockData = {
      version: '1.0',
      annotations: [
        { noteId: 'P1-M1-N0', fingerNumber: 1, isAISuggested: false, isApproved: true },
        { noteId: 'bad-id', fingerNumber: 2, isAISuggested: false, isApproved: true },
      ],
    };

    // @ts-expect-error test mock
    vi.mocked(window.electronAPI.file.read).mockResolvedValue(JSON.stringify(mockData));

    await store.load('/test.xml');

    expect(store.getAllAnnotations()).toHaveLength(1);
    expect(store.getAnnotation('P1-M1-N0')).toBeDefined();
  });

  it('propagates corrupted annotation files instead of clearing state', async () => {
    // @ts-expect-error test mock
    vi.mocked(window.electronAPI.file.read).mockResolvedValue('{not json');

    await expect(store.load('/test.xml')).rejects.toThrow();
  });

  it('keeps empty state for missing annotation files only', async () => {
    const missingFileError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    // @ts-expect-error test mock
    vi.mocked(window.electronAPI.file.read).mockRejectedValue(missingFileError);

    await store.load('/test.xml');

    expect(store.getAllAnnotations()).toEqual([]);
    expect(store.isDirty()).toBe(false);
  });

  it('returns copies so callers cannot mutate internal state silently', () => {
    store.setFinger('P1-M1-N0', 3);

    const ann = store.getAnnotation('P1-M1-N0');
    if (ann) ann.fingerNumber = 5;

    expect(store.getAnnotation('P1-M1-N0')?.fingerNumber).toBe(3);
  });
});
