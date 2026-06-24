import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnnotationStoreService } from './index';
import type { FingerAssignment } from '../../types/annotation';

describe('AnnotationStoreService', () => {
  let service: AnnotationStoreService;
  const mockPath = '/path/to/test.musicxml';
  const expectedAnnotationPath = '/path/to/test.annotation.json';

  beforeEach(() => {
    // Mock window.electronAPI
    vi.stubGlobal('window', {
      electronAPI: {
        file: {
          read: vi.fn(),
          write: vi.fn(),
        },
      },
    });

    service = new AnnotationStoreService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize empty and not dirty', () => {
    expect(service.getAllAnnotations()).toEqual([]);
    expect(service.isDirty()).toBe(false);
  });

  it('setFinger and getAnnotation should work correctly', () => {
    service.setFinger('note1', 3);
    const annotation = service.getAnnotation('note1');
    expect(annotation).toBeDefined();
    expect(annotation?.fingerNumber).toBe(3);
    expect(annotation?.isAISuggested).toBe(false);
    expect(annotation?.isApproved).toBe(false);
    expect(service.isDirty()).toBe(true);
  });

  it('setComment should update comment correctly', () => {
    service.setComment('note2', 'difficult part');
    const annotation = service.getAnnotation('note2');
    expect(annotation?.comment).toBe('difficult part');
    expect(service.isDirty()).toBe(true);
  });

  it('removeFinger should remove finger but keep comment', () => {
    service.setFinger('note3', 1);
    service.setComment('note3', 'test');
    service.removeFinger('note3');
    const annotation = service.getAnnotation('note3');
    expect(annotation?.fingerNumber).toBeUndefined();
    expect(annotation?.comment).toBe('test');
  });

  it('applyAISuggestions should set isAISuggested to true and isApproved to false', () => {
    const assignments: FingerAssignment[] = [
      { noteId: 'note4', finger: 2, cost: 0 },
      { noteId: 'note5', finger: 4, cost: 0 },
    ];
    service.applyAISuggestions(assignments);

    const ann4 = service.getAnnotation('note4');
    expect(ann4?.fingerNumber).toBe(2);
    expect(ann4?.isAISuggested).toBe(true);
    expect(ann4?.isApproved).toBe(false);

    const ann5 = service.getAnnotation('note5');
    expect(ann5?.fingerNumber).toBe(4);
    expect(ann5?.isAISuggested).toBe(true);
    expect(ann5?.isApproved).toBe(false);

    expect(service.isDirty()).toBe(true);
  });

  it('approveAnnotation should set isApproved to true', () => {
    service.setFinger('note6', 1);
    service.approveAnnotation('note6');
    const ann = service.getAnnotation('note6');
    expect(ann?.isApproved).toBe(true);
    expect(service.isDirty()).toBe(true);
  });

  it('load should fetch existing annotations correctly', async () => {
    const mockData = {
      version: '1.0',
      annotations: [{ noteId: 'note7', fingerNumber: 5, isAISuggested: false, isApproved: true }],
    };

    window.electronAPI.file.read = vi.fn().mockResolvedValue(JSON.stringify(mockData));

    await service.load(mockPath);

    expect(window.electronAPI.file.read).toHaveBeenCalledWith(expectedAnnotationPath);
    expect(service.getAllAnnotations()).toHaveLength(1);
    const ann = service.getAnnotation('note7');
    expect(ann?.fingerNumber).toBe(5);
    expect(service.isDirty()).toBe(false);
  });

  it('load should handle file not found or invalid format gracefully', async () => {
    window.electronAPI.file.read = vi.fn().mockRejectedValue(new Error('File not found'));

    await service.load(mockPath);

    expect(service.getAllAnnotations()).toEqual([]);
    expect(service.isDirty()).toBe(false);
  });

  it('save should write to file and clear dirty flag', async () => {
    window.electronAPI.file.read = vi.fn().mockRejectedValue(new Error('File not found'));
    await service.load(mockPath); // Setup path

    service.setFinger('note8', 1);
    expect(service.isDirty()).toBe(true);

    window.electronAPI.file.write = vi.fn().mockResolvedValue(undefined);

    await service.save();

    expect(window.electronAPI.file.write).toHaveBeenCalled();
    const writeMock = window.electronAPI.file.write as import('vitest').Mock;
    const writeArgs = writeMock.mock.calls[0];
    expect(writeArgs[0]).toBe(expectedAnnotationPath);
    const savedData = JSON.parse(writeArgs[1]);
    expect(savedData.version).toBe('1.0');
    expect(savedData.annotations).toHaveLength(1);
    expect(savedData.annotations[0].noteId).toBe('note8');

    expect(service.isDirty()).toBe(false);
  });
});
