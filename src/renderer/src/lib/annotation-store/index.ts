import { Annotation, Finger, FingerAssignment } from '../../types';
import { AnnotationFile } from './types';

/**
 * `JSON.parse` の結果を `Annotation` として検証・正規化する（TASK-092）。
 * 悪意ある・破損したサイドカーファイルの不正値を採用しないための実行時検証。
 * 検証に通らない要素は `null` を返し、呼び出し側で除外する（フェイルソフト）。
 *
 * 検証項目は `src/renderer/src/types/annotation.ts` の型定義に厳密に合わせる:
 * - `noteId`: 非空文字列
 * - `fingerNumber`: 省略可。存在する場合は整数かつ 1〜5（`Finger`）
 * - `comment`: 省略可。存在する場合は文字列
 * - `isAISuggested` / `isApproved`: boolean（欠落・非booleanは false へ正規化）
 */
function normalizeAnnotation(value: unknown): Annotation | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (typeof v.noteId !== 'string' || v.noteId.length === 0) return null;

  const result: Annotation = {
    noteId: v.noteId,
    isAISuggested: typeof v.isAISuggested === 'boolean' ? v.isAISuggested : false,
    isApproved: typeof v.isApproved === 'boolean' ? v.isApproved : false,
  };

  if (v.fingerNumber !== undefined) {
    const fn = v.fingerNumber;
    if (typeof fn !== 'number' || !Number.isInteger(fn) || fn < 1 || fn > 5) {
      return null;
    }
    result.fingerNumber = fn as Finger;
  }

  if (v.comment !== undefined) {
    if (typeof v.comment !== 'string') return null;
    result.comment = v.comment;
  }

  return result;
}

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
      // 初回オープン時にサイドカーファイルが存在しないのは正常なため、
      // ENOENTでエラーログを出さない readIfExists を使う（2026-07-05）。
      const content = await window.electronAPI.file.readIfExists(this.currentFilePath);
      if (content === null) {
        this.annotations.clear();
        this.originalContent = '';
        this.dirty = false;
        return skipped;
      }
      this.originalContent = content;
      const data = JSON.parse(content) as Partial<AnnotationFile>;

      const validSet = validNoteIds ? new Set(validNoteIds) : null;

      this.annotations.clear();
      // 入力堅牢化（TASK-092）: annotationsが配列でないファイルは空状態で継続する。
      const rawAnnotations = Array.isArray(data.annotations) ? data.annotations : [];
      for (const raw of rawAnnotations) {
        // 入力堅牢化（TASK-092）: スキーマ・値域検証に通らない要素は採用しない。
        const ann = normalizeAnnotation(raw);
        if (ann === null) continue;
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
