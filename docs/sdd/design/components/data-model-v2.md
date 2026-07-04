# データモデル v2 — 時刻ベースモデル

2026-07-04のトラブルシューティング分析（[analysis.md](../../troubleshooting/2026-07-04-app-unusable/analysis.md) 原因5）を受けた再設計。
関連決定: [DEC-005](../decisions/DEC-005.md)。実装タスク: TASK-031（パーサー）、TASK-032（practice-engine）。

## 解決する問題

1. **時刻の不在**: 現行 `Note` 型に発音時刻がなく、パーサーは複数パートの音符を「P1全音符→P2全音符」の順で `Measure.notes` に連結する（`parser.ts:120-201`）。practice-engineは配列を線形に1音ずつ進むため、両手曲の同時演奏判定が構造的に不可能。
2. **noteId不整合**: パーサーはパート横断連番（`parser.ts:186`）、osmd-controllerはパート毎連番（`osmd-controller.ts:233-243`）でIDを導出しており、2パート曲でカーソル追従・運指描画位置が破綻する。
3. **再生要件**: US-010（曲の再生）の再生スケジューリングとカーソル連動に発音時刻・デュレーションが必須。

## 型定義（v2）

```typescript
// 変更なし
export type Hand = 'right' | 'left' | 'unknown';
export interface Part { id: string; name: string; hand: Hand; clef: 'treble' | 'bass'; }

export interface Score {
  title: string;
  parts: Part[];
  measures: Measure[];
  tempo: number;                    // 曲頭BPM（既存）
  ticksPerQuarter: number;          // [追加] 正規化PPQ。定数480（DEC-005）
  tempoMap: TempoEvent[];           // [追加] テンポ変化列。最低1要素（曲頭）
  timeSignature: { beats: number; beatType: number };
  keySignature: number;
}

// [追加] テンポイベント（MusicXMLの <sound tempo> / metronome 指示由来）
export interface TempoEvent {
  tick: number;                     // 絶対tick（曲頭=0）
  bpm: number;
}

export interface Measure {
  number: number;
  startTick: number;                // [追加] 小節頭の絶対tick
  notes: Note[];                    // [意味変更] 全パート混在のまま、startTick昇順でソート
}

export interface Note {
  id: string;                       // [意味変更] noteIndexがパート毎連番に統一（下記）
  partId: string;
  measureNumber: number;
  noteIndex: number;                // [意味変更] パート内・小節内の連番（0始まり）
  pitch: { step: string; octave: number; alter?: number };
  midiNumber: number;
  duration: number;                 // [維持] 四分音符=1.0。durationTicks / ticksPerQuarter に等しい
  startTick: number;                // [追加] 絶対tick（曲頭=0）
  durationTicks: number;            // [追加]
  startSeconds: number;             // [追加] tempoMapに基づく楽譜記載テンポでの秒
  durationSeconds: number;          // [追加] 同上
  voice: number;                    // [追加] MusicXML <voice>。既定1
  isChord: boolean;
  isRest: boolean;
}
```

### 判定グループ（派生構造・保存しない）

```typescript
// practice-engineが実行時に導出する。Scoreには保存しない（単一の真実源はNote.startTick）
export interface NoteGroup {
  startTick: number;
  notes: Note[];   // 同一startTickの発音ノーツ（休符除外、練習パートフィルタ適用後）
}
```

## tick算出規則（パーサー）

パートごとに小節内カーソル `cursor`（tick）を持ち、以下で進める。`scale = ticksPerQuarter / divisions`（divisionsはMusicXMLの `<attributes><divisions>`、パート・小節ごとに更新されうる）。

| 要素 | 処理 |
|------|------|
| `<note>`（`<chord>`なし） | `note.startTick = measure.startTick + cursor`、`cursor += duration × scale` |
| `<note><chord/>` | `note.startTick = 直前の非chord音符と同じ`、cursorは進めない |
| `<backup>` | `cursor -= duration × scale`（多声部の巻き戻し） |
| `<forward>` | `cursor += duration × scale` |
| 休符（`<rest/>`） | 通常の `<note>` と同様にstartTickを付与しcursorを進める（判定からは除外、時刻進行には必要） |

- `Measure.startTick` はパート1の小節長累積で決定し全パート共通とする。各パートの小節内カーソルは小節頭で0にリセットする（パート間の累積誤差を防ぐ）。
- `startSeconds` は `tempoMap` を区間積分して算出する: 区間 `[tick_i, tick_{i+1})` のbpmを `bpm_i` として `seconds += (tickSpan / ticksPerQuarter) × (60 / bpm_i)`。
- UIのテンポ変更（20〜200%）は `startSeconds` を再計算しない。再生側（Tone.Transport.bpm）でスケールする（責務分離、DEC-005）。

### 机上検証例（両手・和音・backup）

divisions=2、4/4、右手P1に四分音符C4→和音(E4+G4)、左手P2に二分音符C2:

```
P1: C4  startTick=0,   durationTicks=240
    E4  startTick=240, durationTicks=240   (<note>通常)
    G4  startTick=240  (<chord/>、cursor進まず)
P2: C2  startTick=0,   durationTicks=480
Measure.notes（startTick昇順）: [C4(P1), C2(P2), E4(P1), G4(P1)]
判定グループ: {0: [C4, C2]}, {240: [E4, G4]}   ← 両手同時・和音が正しく同一グループ化
```

## noteId採番の統一

**正**: `{partId}-M{measureNumber}-N{noteIndex}`、`noteIndex` は**パート内・小節内の `<note>` 要素の出現順連番（0始まり、休符・和音構成音を含む）**。osmd-controller.ts:233-243の方式に一致させ、`parser.ts:186` のパート横断連番（`currentMeasure.notes.length` 使用）を廃止する。

- OSMDのカーソルイテレータはタイムスタンプ順で全パートを横断するため、v2の `Measure.notes`（startTick昇順）と自然に整合する。
- **アノテーション互換性**: 既存 `*.annotation.json` のnoteIdは、単一パート曲では変化なし。2パート曲ではP2側のインデックスが変わるため互換性がない。読み込み時に新モデルに存在しないnoteIdはトースト警告つきでスキップする（破壊しない）。手動運指メモUI（US-008）は未実装で実在するアノテーションはAI生成のみのため、再計算で復元可能（DEC-005）。

## 和音・両手同時押下の判定仕様（practice-engine）

1. **同時の定義**: `startTick` が等しい発音ノーツ（`isRest: false`）の集合を1つの判定グループとする。
2. **フィルタ**: 練習モード（Left/Right/Both）適用後のノーツでグループを構成する。フィルタ後に空になったグループはスキップし、次の非空グループへ自動進行する（例: 右手練習中の左手のみのグループ。該当区間は伴奏が担う）。
3. **グループ正解**: グループ内の全ノーツに対応するMIDIノート番号が押下されたら正解として次グループへ進む。**押下順は不問**。同一グループ内で既に照合済みのノートの重複押下は無視する。
4. **誤打鍵**: グループに含まれないノート番号の押下は誤りとしてフィードバック（効果音・鍵盤の赤表示）するが、照合済みノーツの状態は維持し、進行位置は動かさない（既存REQ-004の挙動を踏襲）。
5. **グループ内押下状態のリセット**: グループが完成する前にループ境界・小節ジャンプ・停止が発生した場合、部分押下状態は破棄する。
6. **カーソル**: カーソル位置は「現在の判定グループのstartTick」。osmd-controllerはこのtickに一致する音符集合をハイライトする。

## 影響コンポーネントと差分

| コンポーネント | 影響 | 対応タスク |
|---------------|------|-----------|
| musicxml-parser（`parser.ts`） | tick/秒の算出、`<backup>`/`<forward>`/`<chord>` 対応、noteId採番変更、`Measure.notes` のstartTickソート、tempoMap抽出 | TASK-031 |
| practice-engine（`index.ts:104-137`） | 線形インデックス進行を判定グループ進行に置換。expectedNotesはNoteGroup列に | TASK-032 |
| osmd-controller（`:233-243`） | noteIdが一致するため既存のパート毎連番マップをそのまま使用可能（変更最小） | TASK-032（検証） |
| audio-engine | 再生スケジューリングに `startSeconds`/`durationSeconds` を使用（US-010） | TASK-033以降 |
| fingering worker（`workers/fingering/types.ts`） | 入力Noteに追加フィールドが増えるが、既存の `duration`（四分音符=1.0）は維持されるため**互換。変更不要** | - |
| annotation-store | noteId意味変更（2パート曲のみ非互換）。存在しないnoteIdのスキップ処理を追加 | TASK-031 |
| Zustand store / UI | `expectedNotes: Note[]` → グループ対応（`currentGroup` の全ノーツを鍵盤ガイドに表示） | TASK-032 |

### フィールド差分サマリ

| 型 | 追加 | 意味変更 | 削除 |
|----|------|---------|------|
| Score | `ticksPerQuarter`, `tempoMap` | - | なし |
| Measure | `startTick` | `notes` の並び順（パート連結順→startTick昇順） | なし |
| Note | `startTick`, `durationTicks`, `startSeconds`, `durationSeconds`, `voice` | `noteIndex`/`id`（パート毎連番に統一） | なし（`duration` は維持） |

## 要件トレーサビリティ

- REQ-003（右手/左手/両手モード）: 判定仕様2（フィルタと空グループスキップ）
- REQ-004（MIDI正誤判定）: 判定仕様1〜5
- REQ-006（テンポ調整）: tempoMapとTone.Transport.bpmの責務分離
- REQ-010（曲の再生・カーソル連動）: `startSeconds`/`durationSeconds`、判定仕様6
- CLAUDE.md「noteIdフォーマット」: noteId採番の統一（本設計で正式化）
