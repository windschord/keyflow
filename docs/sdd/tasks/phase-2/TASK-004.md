# TASK-004: 内部データモデル型定義

**ステータス**: DONE
**推定工数**: 30分
**依存**: Phase 1

---

## 説明

アプリ全体で使用するTypeScriptの型定義ファイルを作成する。
TASK-005〜007が並列実行する際の共通基盤となる。

## 対象ファイル

- `src/renderer/src/types/score.ts` — Score/Part/Measure/Note
- `src/renderer/src/types/annotation.ts` — Annotation/FingerAssignment
- `src/renderer/src/types/practice.ts` — PracticeSessionState/PracticeStats/NoteJudgement
- `src/renderer/src/types/midi.ts` — MidiDevice/MidiNoteEvent
- `src/renderer/src/types/settings.ts` — AppSettings/HandSettings
- `src/renderer/src/types/index.ts` — 全型の再エクスポート

## 参照設計

- [design/index.md「中心データ構造」セクション](../../design/index.md)
- [design/components/practice-engine.md](../../design/components/practice-engine.md)
- [design/components/fingering-engine.md](../../design/components/fingering-engine.md)

## 実装すべき型（最低限）

```typescript
// score.ts
export type Hand = 'right' | 'left' | 'unknown';
export interface Score { title: string; parts: Part[]; measures: Measure[]; tempo: number; timeSignature: { beats: number; beatType: number }; keySignature: number; }
export interface Part { id: string; name: string; hand: Hand; clef: 'treble' | 'bass'; }
export interface Measure { number: number; notes: Note[]; }
export interface Note { id: string; partId: string; measureNumber: number; noteIndex: number; pitch: { step: string; octave: number; alter?: number }; midiNumber: number; duration: number; isChord: boolean; isRest: boolean; }

// annotation.ts
export type Finger = 1 | 2 | 3 | 4 | 5;
export interface Annotation { noteId: string; fingerNumber?: Finger; comment?: string; isAISuggested: boolean; isApproved: boolean; }
export interface FingerAssignment { noteId: string; finger: Finger; cost: number; }

// practice.ts
export type PracticeMode = 'right' | 'left' | 'both';
export type ErrorMode = 'wait' | 'pass';
export type JudgementResult = 'correct' | 'incorrect' | 'ignored';
export interface NoteJudgement { result: JudgementResult; note: Note | null; advanced: boolean; }
```

## 実装手順（TDD）

1. `src/renderer/src/types/` ディレクトリを作成
2. 各型定義ファイルを作成
3. `src/renderer/src/types/index.ts` で全型を再エクスポート
4. `src/renderer/src/types/score.test.ts` を作成して型が正しく import できることを確認
5. `npm run test` でパスを確認

## 受入基準

- [ ] 全型定義ファイルが存在し、TypeScriptコンパイルエラーなし
- [ ] `Note.id` のフォーマット: `{partId}-M{measureNumber}-N{noteIndex}` が型コメントで明記されている
- [ ] `import type { Score, Note, Annotation } from '@/types'` でインポートできる
- [ ] `npm run test` でパス（型インポートテスト）

**依存関係**: Phase 1（TASK-003まで完了）

---

## 実行情報

**実行方式**: Jules API
**Jules Session ID**: 6261273643889928189
**Jules ブランチ名**: ui-design-verification-components-6261273643889928189
**PR作成先**: main
**開始日時**: 2026-06-22 11:42
**PR番号**: #8
**PR URL**: https://github.com/windschord/keyflow/pull/8
**PR作成日時**: 2026-06-22 12:18
