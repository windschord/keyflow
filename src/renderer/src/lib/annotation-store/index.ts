import { Annotation, Finger, FingerAssignment } from '../../types';
import { AnnotationFile } from './types';

export class AnnotationStoreService {
  private annotations: Map<string, Annotation> = new Map();
  private originalContent = '';
  private currentFilePath: string | null = null;
  private dirty = false;

  constructor() {}

  /**
   * アノテーションファイルを読み込む。
   * `validNoteIds` を指定した場合、現在のScoreに存在しないnoteIdを持つアノテーションは
   * ファイルを破壊せず（保存しない限り元ファイルは変更しない）メモリ上でスキップし、
   * console.warn で警告を出す。noteId採番方式の変更（TASK-031/DEC-005）により
   * 2パート曲の既存アノテーションが一部非互換になるための後方互換措置。
   * `validNoteIds` を省略した場合は従来通りフィルタしない。
   *
   * @returns スキップされたnoteIdの一覧（フィルタなしの場合は常に空配列）
   */
  async load(musicXmlPath: string, validNoteIds?: Iterable<string>): Promise<string[]> {
    this.currentFilePath = musicXmlPath + '.annotation.json';
    const skipped: string[] = [];
    try {
      const content = await window.electronAPI.file.read(this.currentFilePath);
      this.originalContent = content;
      const data: AnnotationFile = JSON.parse(content);

      const validSet = validNoteIds ? new Set(validNoteIds) : null;

      this.annotations.clear();
      for (const ann of data.annotations) {
        if (validSet && !validSet.has(ann.noteId)) {
          skipped.push(ann.noteId);
          console.warn(
            `[AnnotationStore] 現在の楽譜に存在しないnoteIdのためアノテーションをスキップしました: ${ann.noteId}`
          );
          continue;
        }
        this.annotations.set(ann.noteId, ann);
      }
      this.dirty = false;
    } catch (err) {
      // If file does not exist or fails to parse, just start empty.
      this.annotations.clear();
      this.originalContent = '';
      this.dirty = false;
    }
    return skipped;
  }

  setFinger(noteId: string, finger: Finger): void {
    const ann = this.annotations.get(noteId) || this.createEmptyAnnotation(noteId);
    ann.fingerNumber = finger;
    this.annotations.set(noteId, ann);
    this.dirty = true;
  }

  setComment(noteId: string, comment: string): void {
    const ann = this.annotations.get(noteId) || this.createEmptyAnnotation(noteId);
    ann.comment = comment;
    this.annotations.set(noteId, ann);
    this.dirty = true;
  }

  removeFinger(noteId: string): void {
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
    return this.annotations.get(noteId);
  }

  getAllAnnotations(): Annotation[] {
    return Array.from(this.annotations.values());
  }

  applyAISuggestions(assignments: FingerAssignment[]): void {
    for (const assignment of assignments) {
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
      annotations: Array.from(this.annotations.values()),
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
    return {
      noteId,
      isAISuggested: false,
      isApproved: false,
    };
  }
}
