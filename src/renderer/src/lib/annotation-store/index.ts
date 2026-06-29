import { Annotation, Finger, FingerAssignment } from '../../types';
import { AnnotationFile } from './types';

export class AnnotationStoreService {
  private annotations: Map<string, Annotation> = new Map();
  private originalContent = '';
  private currentFilePath: string | null = null;
  private dirty = false;

  constructor() {}

  async load(musicXmlPath: string): Promise<void> {
    this.currentFilePath = musicXmlPath + '.annotation.json';
    try {
      const content = await window.electronAPI.file.read(this.currentFilePath);
      this.originalContent = content;
      const data: AnnotationFile = JSON.parse(content);

      this.annotations.clear();
      for (const ann of data.annotations) {
        if (this.isValidNoteId(ann.noteId)) {
          this.annotations.set(ann.noteId, this.cloneAnnotation(ann));
        }
      }
      this.dirty = false;
    } catch (err) {
      if (!this.isMissingFileError(err)) {
        throw err;
      }
      this.annotations.clear();
      this.originalContent = '';
      this.dirty = false;
    }
  }

  setFinger(noteId: string, finger: Finger): void {
    this.assertValidNoteId(noteId);
    const ann = this.annotations.get(noteId) || this.createEmptyAnnotation(noteId);
    ann.fingerNumber = finger;
    ann.isAISuggested = false;
    ann.isApproved = true;
    this.annotations.set(noteId, ann);
    this.dirty = true;
  }

  setComment(noteId: string, comment: string): void {
    this.assertValidNoteId(noteId);
    const ann = this.annotations.get(noteId) || this.createEmptyAnnotation(noteId);
    ann.comment = comment;
    this.annotations.set(noteId, ann);
    this.dirty = true;
  }

  removeFinger(noteId: string): void {
    this.assertValidNoteId(noteId);
    const ann = this.annotations.get(noteId);
    if (ann) {
      delete ann.fingerNumber;
      if (!ann.comment) {
        this.annotations.delete(noteId);
      }
      this.dirty = true;
    }
  }

  getAnnotation(noteId: string): Annotation | undefined {
    const ann = this.annotations.get(noteId);
    return ann ? this.cloneAnnotation(ann) : undefined;
  }

  getAllAnnotations(): Annotation[] {
    return Array.from(this.annotations.values()).map((ann) => this.cloneAnnotation(ann));
  }

  applyAISuggestions(assignments: FingerAssignment[]): void {
    for (const assignment of assignments) {
      this.assertValidNoteId(assignment.noteId);
      const ann =
        this.annotations.get(assignment.noteId) || this.createEmptyAnnotation(assignment.noteId);
      // Only apply suggestion if it's not approved user manually entered value
      if (!ann.isApproved) {
        ann.fingerNumber = assignment.finger;
        ann.isAISuggested = true;
        ann.isApproved = false;
        this.annotations.set(assignment.noteId, ann);
        this.dirty = true;
      }
    }
  }

  approveAnnotation(noteId: string): void {
    this.assertValidNoteId(noteId);
    const ann = this.annotations.get(noteId);
    if (ann) {
      ann.isApproved = true;
      ann.isAISuggested = false; // Once approved, it's considered user confirmed
      this.dirty = true;
    }
  }

  async save(): Promise<void> {
    if (!this.currentFilePath) return;

    const data: AnnotationFile = {
      version: '1.0',
      annotations: this.getAllAnnotations(),
    };

    const content = JSON.stringify(data, null, 2);

    // Only write if something changed or we are writing for the first time
    if (content !== this.originalContent) {
      await window.electronAPI.file.write(this.currentFilePath, content);
      this.originalContent = content;
    }

    this.dirty = false;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  private createEmptyAnnotation(noteId: string): Annotation {
    this.assertValidNoteId(noteId);
    return {
      noteId,
      isAISuggested: false,
      isApproved: false,
    };
  }

  private isValidNoteId(noteId: unknown): noteId is string {
    return typeof noteId === 'string' && /^.+-M\d+-N\d+$/.test(noteId);
  }

  private assertValidNoteId(noteId: string): void {
    if (!this.isValidNoteId(noteId)) {
      throw new Error(`Invalid noteId: ${noteId}`);
    }
  }

  private cloneAnnotation(ann: Annotation): Annotation {
    return { ...ann };
  }

  private isMissingFileError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const errorWithCode = err as Error & { code?: string };
    return errorWithCode.code === 'ENOENT' || err.message.includes('ENOENT');
  }
}
