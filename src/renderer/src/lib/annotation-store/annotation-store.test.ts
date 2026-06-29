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
    store.setFinger('N1', 3);
    const ann = store.getAnnotation('N1');
    expect(ann).toBeDefined();
    expect(ann?.fingerNumber).toBe(3);
    expect(store.isDirty()).toBe(true);
  });

  it('removeFinger removes the finger but keeps comment if exists', () => {
    store.setFinger('N1', 3);
    store.setComment('N1', 'test comment');
    store.removeFinger('N1');

    const ann = store.getAnnotation('N1');
    expect(ann).toBeDefined();
    expect(ann?.fingerNumber).toBeUndefined();
    expect(ann?.comment).toBe('test comment');
    expect(store.isDirty()).toBe(true);
  });

  it('removeFinger completely removes annotation if no comment', () => {
    store.setFinger('N1', 3);
    store.removeFinger('N1');
    expect(store.getAnnotation('N1')).toBeUndefined();
  });

  it('applyAISuggestions marks as isAISuggested: true and isApproved: false', () => {
    store.applyAISuggestions([
      { noteId: 'N1', finger: 2, cost: 0 },
      { noteId: 'N2', finger: 4, cost: 0 },
    ]);

    const ann1 = store.getAnnotation('N1');
    expect(ann1?.fingerNumber).toBe(2);
    expect(ann1?.isAISuggested).toBe(true);
    expect(ann1?.isApproved).toBe(false);

    const ann2 = store.getAnnotation('N2');
    expect(ann2?.fingerNumber).toBe(4);
    expect(ann2?.isAISuggested).toBe(true);
    expect(ann2?.isApproved).toBe(false);
  });

  it('applyAISuggestions does not overwrite approved annotations', () => {
    store.setFinger('N1', 5);
    store.approveAnnotation('N1');

    store.applyAISuggestions([{ noteId: 'N1', finger: 1, cost: 0 }]);

    const ann = store.getAnnotation('N1');
    expect(ann?.fingerNumber).toBe(5);
    expect(ann?.isApproved).toBe(true);
  });

  it('approveAnnotation sets isApproved: true', () => {
    store.applyAISuggestions([{ noteId: 'N1', finger: 2, cost: 0 }]);
    store.approveAnnotation('N1');

    const ann = store.getAnnotation('N1');
    expect(ann?.isApproved).toBe(true);
    expect(ann?.isAISuggested).toBe(false);
  });

  it('save and load interact with IPC', async () => {
    const mockData = {
      version: '1.0',
      annotations: [{ noteId: 'N1', fingerNumber: 1, isAISuggested: false, isApproved: true }],
    };

    // @ts-expect-error test mock
    vi.mocked(window.electronAPI.file.read).mockResolvedValue(JSON.stringify(mockData));

    await store.load('/test.xml');

    // @ts-expect-error test mock
    expect(window.electronAPI.file.read).toHaveBeenCalledWith('/test.xml.annotation.json');
    expect(store.getAnnotation('N1')?.fingerNumber).toBe(1);
    expect(store.isDirty()).toBe(false);

    store.setFinger('N2', 5);
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
});
