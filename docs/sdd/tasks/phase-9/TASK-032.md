# TASK-032: practice-engineの両手・和音同時判定対応

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-032 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | TASK-031 |

## 背景

### 問題の概要

`practice-engine` の位置進行ロジックが小節内ノーツ配列の線形インデックスで1音ずつ進む実装になっており、右手と左手が同時に鳴る音符（両手曲）を1つの判定グループとして扱えない。そのため両手同時演奏の正誤判定が構造的に成立しない。

### 根本原因

- `src/renderer/src/lib/practice-engine/index.ts:104-137`（`advancePosition`）が `currentNoteIndex` をインデックスとして単純に+1し、`measure.notes.length` を超えたら次小節へ移る実装になっている。コード中のコメント自身が「In a real app we'd group chords... In true MusicXML we group by time.」（118-119行目）と簡略化を認めている。
- `measure.notes` はTASK-031改修前まで「P1全音符→P2全音符」の連結順であり、たとえ同時刻でもパートをまたいだ判定グループ化が行われていなかった。
- `handleNoteOn`（`index.ts:15-88`）は `expectedNotes` に対して `filterExpectedNotes`（Left/Right/Bothの練習パートフィルタ、27-31行目）と `judgeChord`（46行目、`judgement.ts`）を組み合わせている。しかし `expectedNotes` 自体が時刻グループ化されていないため、「同時刻の複数ノーツ（和音・両手）が揃ったら進行」という仕様を満たせない。

### 関連する仕様

- TASK-030設計書（`docs/sdd/design/components/data-model-v2.md`）の「和音・両手同時押下の判定仕様」節
- TASK-031で付与されたNoteの `startTick`/`startSeconds`（時刻グループのキー）
- US-003 / REQ-003: Left/Right/Both練習パートフィルタとの整合
- US-004 / REQ-004: MIDI入力の正誤判定
- `docs/sdd/design/components/practice-engine.md`（既存設計書、判定ロジックの参照元）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/practice-engine/index.ts` — `advancePosition`（104-137行目）を時刻グループ単位の進行に改修
- ファイル: `src/renderer/src/lib/practice-engine/judgement.ts` — `judgeChord` を時刻グループ（複数パート混在）に対応させる
- ファイル: `src/renderer/src/lib/practice-engine/practice-engine.test.ts` — 既存テスト期待値更新、両手同時判定の新規テスト追加
- 変更内容: 小節内ノーツを時刻（`startTick`）でグルーピングし、グループ単位で `currentNoteIndex`（または新設する `currentGroupIndex`）を進行させる

### 実装手順（TDD）

1. TASK-030設計書とTASK-031実装後のNote型（`startTick`等）を確認する
2. 既存テスト（`practice-engine.test.ts`）の期待値を、時刻グループ単位の進行を前提に更新し、まず失敗させる（Red）。特に「コードは全音符が揃ったら正解になる」テストを、パートをまたぐ和音（両手同時）のケースに拡張する
3. 小節のノーツを `startTick` でグルーピングするヘルパー（例: `groupNotesByStartTick(notes: Note[]): Note[][]`）を `judgement.ts` または新規 `note-grouping.ts` に実装する
4. `getExpectedNotes`（TASK-014設計のインターフェース参照）を、現在の小節・現在の時刻グループインデックスに対応するグループ全体を返すよう改修する
5. `advancePosition`（`index.ts:104-137`）を、`currentNoteIndex` を「小節内ノーツの配列インデックス」から「小節内時刻グループのインデックス」に意味変更し、グループ数を超えたら次小節へ進むよう改修する
6. `judgeChord`（`judgement.ts`）を、パートをまたいだ時刻グループ（右手ノーツ＋左手ノーツ混在）でも「全ノーツが揃ったら correct」の判定ができるよう改修する。既存の単一パート内和音判定との後方互換を保つ
7. `filterExpectedNotes`（Left/Right/Bothフィルタ）を時刻グループに適用した際、フィルタ後にグループが空になるケース（例: 右手モードで左手のみの時刻グループ）の自動スキップ・進行仕様がTASK-030設計書どおりに動作することを確認する
8. すべてのテストがパスするまで実装を修正する
9. `npm run typecheck` / `npm run lint` を実行する

### 注意事項

- `currentNoteIndex` の意味変更はstore（`src/renderer/src/store/`）の型・他の参照箇所（UI側の表示ロジック等）に影響する可能性があるため、grep で参照箇所を洗い出してから着手すること
- ループ管理（`loop-manager.ts`、`checkLoopBoundary`）は小節番号ベースであり本タスクの変更対象外だが、小節境界の判定（グループが小節内最後のグループかどうか）との整合を確認すること
- 既存のPractice-engineテスト6件（TASK-014記載: 正誤判定、ループ終端、passモード等）を壊さないこと。特に「右手モードで左手パートの音符は判定をスキップする」テストは時刻グループ化後も成立する必要がある

## 受入基準

- [x] 小節内ノーツが `startTick` で時刻グループ化され、`advancePosition` がグループ単位で進行する
- [x] 右手＋左手が同時刻に鳴る和音（両手同時）で、両方揃うまで進行しない
- [x] 右手モードで両手同時刻グループのうち左手ノーツのみを無視し、右手ノーツが揃えば進行する
- [x] 単一パート内の和音（既存仕様）が引き続き正しく判定される（回帰なし）
- [x] フィルタ適用でグループが空となった場合に自動進行する
- [x] 既存のテスト（TASK-014記載6件）が全パス（新仕様に合わせて期待値を更新した上でパス）
- [x] 新規テストが追加されている（両手同時判定・パートまたぎフィルタの組み合わせ）
- [x] `npm run typecheck` / `npm run lint` がパスする

## テスト項目

- [x] 両手同時和音（右手2音＋左手1音、同startTick）が全3音揃うまで進行しない
- [x] Bothモードで両手同時和音が揃った瞬間に次グループへ進行する
- [x] Rightモードで両手同時グループのうち右手音のみ判定され、左手音は無視される
- [x] 単一パートの和音判定（既存テスト「コードは全音符が揃ったら正解になる」）が回帰しない
- [x] ループ終端到達時、時刻グループ化後もloopStartへ正しく戻る
- [x] passモードで誤打鍵時、グループ単位で次に進む

## 完了サマリー（2026-07-04）

- `src/renderer/src/lib/practice-engine/note-grouping.ts` を新設した。ここに `groupNotesByStartTick`（休符除外・startTick昇順の判定グループ導出）と `filterNotesByPracticeMode`（Left/Right/Bothフィルタ）を実装した。
- `src/renderer/src/lib/practice-engine/index.ts` の `advancePosition`/`resetToMeasure` を `resolvePosition`（旧 `advanceGroupPosition` 相当）に置換した。`resolvePosition` は `currentNoteIndex` を「小節内の判定グループインデックス」として扱う。フィルタ後に空となったグループは自動スキップし、ループ境界を跨いだ場合は `pressedKeys`/`incorrectKeys`（部分押下状態）を破棄するようにした。
- `handleNoteOn` は `expectedNotes`（現在グループの全ノーツ、フィルタ前）を保持したまま、判定時のみ `filterNotesByPracticeMode` でフィルタする設計とし、鍵盤ガイドが両手分のノーツを表示できるようにした。`advancePosition` 呼び出し後に `pressedKeys`/`incorrectKeys` を `getState()` から再取得するよう修正し、ループジャンプ時のクリアが呼び出し元の古い参照で上書きされないようにした。
- `judgement.ts` の未使用スタブ `filterNotesByMode` を削除し、`judgeChord` はパート横断の判定グループにもそのまま対応できることをコメントで明記した。
- `App.tsx` の `currentNoteId`（OSMDカーソル制御用）を、`currentNoteIndex` の意味変更に合わせて `groupNotesByStartTick` 経由でグループ先頭ノートのidを使うよう修正した。
- `practice-engine.test.ts` を新仕様のフィクスチャ（両手同時和音・パートをまたぐグループ・左手のみグループの自動スキップ等）で全面的に書き直し、11件のテスト（既存6件の意図を踏襲したもの含む）を追加・更新した。
- `npm run test`（50ファイル/266件、既存の `practice-flow.test.tsx` 統合テスト含め全パス）・`npm run typecheck`・`npm run lint` を実行し、いずれも成功を確認した。

## 情報の明確性

### 明示された情報

- 修正対象: `src/renderer/src/lib/practice-engine/index.ts:104-137`（`advancePosition`）
- 開発方針: TDD、既存テスト期待値更新を含む
- Left/Right/Bothフィルタとの整合を保つこと
- 依存: TASK-031（時刻付与済みNote型）
- 根拠: 分析レポート原因5（`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md`）

### 不明/要確認の情報

- 時刻グループのデータ構造名・インデックス命名（`currentGroupIndex` 等）はTASK-030設計書の確定内容に従う。設計書が未確定の場合は着手前にTASK-030の成果物を確認すること
