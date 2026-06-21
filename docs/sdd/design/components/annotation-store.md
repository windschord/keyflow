# Annotation Store（アノテーション管理）

## 概要

**目的**: 運指番号・コメントのアノテーションデータを管理し、JSONサイドカーファイルとして永続化する

**責務**:
- アノテーションの CRUD 操作を提供する
- MusicXMLファイルと同じフォルダに `.annotation.json` として保存する
- 同じMusicXMLを再度開いた時にアノテーションを自動復元する
- AI提案と手動入力を区別して管理する

**実行場所**: Renderer Process（保存のみMain Processへ IPC）

---

## アノテーションファイル形式

```json
{
  "schemaVersion": "1.0",
  "musicXmlPath": "path/to/score.xml",
  "updatedAt": "2026-06-21T12:00:00Z",
  "annotations": [
    {
      "noteId": "P1-M3-N0",
      "fingerNumber": 3,
      "comment": "親指から始める",
      "isAISuggested": true,
      "isApproved": false
    }
  ]
}
```

## インターフェース

```typescript
class AnnotationStoreService {
  // 読み込み（MusicXMLを開いた時に自動呼び出し）
  load(musicXmlPath: string): Promise<void>;

  // CRUD
  setFinger(noteId: string, finger: 1|2|3|4|5): void;
  setComment(noteId: string, comment: string): void;
  removeFinger(noteId: string): void;
  getAnnotation(noteId: string): Annotation | undefined;
  getAllAnnotations(): Annotation[];

  // AI提案の一括追加
  applyAISuggestions(assignments: FingerAssignment[]): void;
  approveAnnotation(noteId: string): void;

  // 保存（IPC経由でMain Processがファイル書き込み）
  save(): Promise<void>;
}
```

---

## 関連要件

- [US-008](../../requirements/stories/US-008.md) @../../requirements/stories/US-008.md: 運指メモ書き込み
- [US-009](../../requirements/stories/US-009.md) @../../requirements/stories/US-009.md: 運指提案の保存
