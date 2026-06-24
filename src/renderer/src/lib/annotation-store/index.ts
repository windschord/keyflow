import type { Annotation, Finger, FingerAssignment } from '../../types/annotation';
import type { AnnotationFile } from './types';

export class AnnotationStoreService {
  private annotations: Map<string, Annotation> = new Map();
  private dirty: boolean = false;
  private currentPath: string | null = null;

  private getOrCreateAnnotation(noteId: string): Annotation {
    if (!this.annotations.has(noteId)) {
      this.annotations.set(noteId, {
        noteId,
        isAISuggested: false,
        isApproved: false,
      });
    }
    return this.annotations.get(noteId)!;
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private getAnnotationPath(musicXmlPath: string): string {
    const lastDotIndex = musicXmlPath.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return `${musicXmlPath}.annotation.json`;
    }
    return `${musicXmlPath.substring(0, lastDotIndex)}.annotation.json`;
  }

  async load(musicXmlPath: string): Promise<void> {
    this.currentPath = this.getAnnotationPath(musicXmlPath);
    this.annotations.clear();
    this.dirty = false;

    try {
      const content = await window.electronAPI.file.read(this.currentPath);
      const data = JSON.parse(content) as AnnotationFile;
      if (data && Array.isArray(data.annotations)) {
        for (const ann of data.annotations) {
          this.annotations.set(ann.noteId, ann);
        }
      }
    } catch (error) {
      // File not found or invalid format
    }
  }

  setFinger(noteId: string, finger: Finger): void {
    const ann = this.getOrCreateAnnotation(noteId);
    ann.fingerNumber = finger;
    ann.isAISuggested = false; // Manual assignment
    ann.isApproved = false;
    this.markDirty();
  }

  setComment(noteId: string, comment: string): void {
    const ann = this.getOrCreateAnnotation(noteId);
    ann.comment = comment;
    this.markDirty();
  }

  removeFinger(noteId: string): void {
    const ann = this.annotations.get(noteId);
    if (ann && ann.fingerNumber !== undefined) {
      ann.fingerNumber = undefined;
      // If it has no comment either, maybe clean it up?
      // But keeping it is fine as it still has properties.
      this.markDirty();
    }
  }

  getAnnotation(noteId: string): Annotation | undefined {
    return this.annotations.get(noteId);
  }

  getAllAnnotations(): Annotation[] {
    return Array.from(this.annotations.values());
  }

  applyAISuggestions(assignments: FingerAssignment[]): void {
    for (const assignment of assignments) {
      const ann = this.getOrCreateAnnotation(assignment.noteId);
      ann.fingerNumber = assignment.finger;
      ann.isAISuggested = true;
      ann.isApproved = false;
    }
    if (assignments.length > 0) {
      this.markDirty();
    }
  }

  approveAnnotation(noteId: string): void {
    const ann = this.annotations.get(noteId);
    if (ann && !ann.isApproved) {
      ann.isApproved = true;
      this.markDirty();
    }
  }

  async save(): Promise<void> {
    if (!this.currentPath) return;

    const data: AnnotationFile = {
      version: '1.0',
      annotations: this.getAllAnnotations(),
    };

    try {
      await window.electronAPI.file.write(this.currentPath, JSON.stringify(data, null, 2));
      this.dirty = false;
    } catch (error) {
      console.error('Failed to save annotations', error);
      throw error;
    }
  }

  isDirty(): boolean {
    return this.dirty;
  }
}
