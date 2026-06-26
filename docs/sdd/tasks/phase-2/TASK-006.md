# TASK-006: Annotation Store実装（CRUD + JSON永続化）

**ステータス**: REVIEW
**推定工数**: 40分
**依存**: TASK-004

---

## 説明

運指番号とコメントのアノテーションをメモリ上で管理し、
MusicXMLと同ディレクトリの `.annotation.json` ファイルに永続化するサービスを実装する。

## 対象ファイル

- `src/renderer/src/lib/annotation-store/index.ts` — AnnotationStoreService
- `src/renderer/src/lib/annotation-store/types.ts` — AnnotationFile型
- `src/renderer/src/lib/annotation-store/annotation-store.test.ts` — テスト

## 参照設計

- [design/components/annotation-store.md](../../design/components/annotation-store.md)
- [design/database/schema.md](../../design/database/schema.md)

## 実装すべきインターフェース

```typescript
export class AnnotationStoreService {
  async load(musicXmlPath: string): Promise<void>;
  setFinger(noteId: string, finger: Finger): void;
  setComment(noteId: string, comment: string): void;
  removeFinger(noteId: string): void;
  getAnnotation(noteId: string): Annotation | undefined;
  getAllAnnotations(): Annotation[];
  applyAISuggestions(assignments: FingerAssignment[]): void;
  approveAnnotation(noteId: string): void;
  async save(): Promise<void>;
  isDirty(): boolean;
}
```

## ファイル保存はIPC経由

ファイル読み書きはMain Processのみが行う（セキュリティ要件）。
Rendererは `window.electronAPI.file.read(path)` / `window.electronAPI.file.write(path, content)` を使う（TASK-009で定義）。

## 実装手順（TDD）

1. テストファイルを作成:
   - `setFinger` → `getAnnotation` でfingerが返ること
   - `removeFinger` → `getAnnotation` がundefinedになること
   - `applyAISuggestions` → `isAISuggested: true` で保存されること
   - `approveAnnotation` → `isApproved: true` になること
2. テスト実行（失敗確認）
3. `AnnotationStoreService` を実装
4. `save()`/`load()` はIPC呼び出しをモックしてテスト

## 受入基準

- [ ] `setFinger` / `getAnnotation` が正常動作する
- [ ] `applyAISuggestions` で `isAISuggested: true` / `isApproved: false` で保存される
- [ ] `approveAnnotation` で `isApproved: true` になる
- [ ] `isDirty()` が未保存変更時に `true` を返す
- [ ] テストが6件以上ありすべてパス

**依存関係**: TASK-004

---

## 実行情報
