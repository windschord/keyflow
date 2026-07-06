# Toolbar（ツールバー / 練習コントロール群）

## 概要

**目的**: 練習セッションの各種コントロール（ファイルを開く・再生・練習対象・テンポ・ループ・運指提案・統計表示・設定）をまとめて提供する。

**責務**:
- MusicXMLファイルを開く操作の起点を提供する
- 曲の再生・一時停止・停止を操作する（US-010）
- 練習対象パート（左手/右手/両手）を切り替える（US-003）
- テンポ（原曲比・BPM直接指定）とメトロノームを操作する（US-006）
- ループ範囲（開始/終了小節）の有効化・指定を操作する（US-007）
- 運指提案の計算対象の手を選択し、運指を計算する（US-009）
- 正解率・連続正解数を表示する（US-004）
- アプリ設定モーダルを開く

**実行場所**: Renderer Process（React コンポーネント）

**注意（本ドキュメントの位置づけ）**: 本ドキュメントは「Toolbar」という語を、`src/renderer/src/components/Toolbar/`配下のコンポーネント群だけでなく、画面上部のコントロール群全体を指すものとして扱う。
具体的には、`App.tsx`のヘッダー領域に直接実装されている「ファイルを開く」ボタンと`FingeringPanel`（運指提案UI）も対象に含める。
これは実装が2つのコンポーネント階層（ヘッダー領域と`Toolbar`本体）に分かれているためであり、本タスク（TASK-036）はこの構成を正として設計書を後追いで作成する。将来の統合方針は「注意事項」を参照。

---

## 配置構成（実装ファイル対応）

| 領域 | ファイル | 内容 |
|------|---------|------|
| ヘッダー領域（`App.tsx`内、`Toolbar`の外） | `src/renderer/src/App.tsx` | 「ファイルを開く」ボタン、`FingeringPanel`（運指対象選択＋運指提案ボタン） |
| Toolbar本体 | `src/renderer/src/components/Toolbar/index.tsx` | 下記の子コンポーネントを横並びに配置し、末尾に設定ボタンを配置する |
| 練習対象選択 | `src/renderer/src/components/Toolbar/PracticeModeSelector.tsx` | 左手/右手/両手の切り替え |
| テンポ・メトロノーム | `src/renderer/src/components/Toolbar/TempoControl.tsx` | テンポスライダー・BPM入力・リセット・メトロノームチェックボックス |
| ループ | `src/renderer/src/components/Toolbar/LoopControl.tsx` | ループ有効チェックボックス・開始/終了小節入力 |
| 再生コントロール | `src/renderer/src/components/Toolbar/PlaybackControls.tsx` | 再生・一時停止・停止ボタン（Spaceキー対応） |
| 統計表示 | `src/renderer/src/components/StatsDisplay/index.tsx` | 正解率・連続正解数 |
| 運指提案 | `src/renderer/src/components/FingeringPanel/index.tsx` | 運指計算対象の手選択・運指提案ボタン・進捗表示 |

---

## コントロール一覧（用途・ラベル・ツールチップ・無効化条件）

| コントロール | 実装 | 日本語ラベル | ツールチップ（`title`属性） | 無効化条件 | 対応要件ID |
|------------|------|-------------|---------------------------|-----------|-----------|
| ファイルを開く | `App.tsx`（ボタン） | `ファイルを開く` | `MusicXMLファイルを開きます` | なし（常時有効） | US-001 / REQ-001 |
| 運指対象（手選択） | `FingeringPanel`（`select`） | `運指対象:`＋`右手`/`左手` | `運指を計算する対象の手を選択します（練習対象パートの設定とは別です）` | 運指計算中（`computing`）、または楽譜未読み込み時に無効 | US-009 / REQ-009 |
| 運指提案（実行ボタン） | `FingeringPanel`（ボタン） | `運指提案`（計算中は`{進捗%}`表示） | なし（ボタンラベル自体が用途を示す。計算中は進捗バーとパーセンテージを表示） | 計算中、楽譜未読み込み、または`disabled`prop指定時（アノテーション読み込み中）に無効 | US-009 / REQ-009 |
| 練習対象: 左手 | `PracticeModeSelector`（ボタン） | `左手 (L)` | `左手のみを練習対象にします（ショートカット: L）` | なし（常時有効。選択中はアクティブ表示） | US-003 / REQ-003 |
| 練習対象: 右手 | `PracticeModeSelector`（ボタン） | `右手 (R)` | `右手のみを練習対象にします（ショートカット: R）` | なし | US-003 / REQ-003 |
| 練習対象: 両手 | `PracticeModeSelector`（ボタン） | `両手 (B)` | `両手を練習対象にします（ショートカット: B）` | なし | US-003 / REQ-003 |
| テンポスライダー | `TempoControl`（`input[type=range]`） | `テンポ:` | `テンポ（原曲テンポに対する割合。20%〜200%）` | なし（`originalBpm`未設定＝楽譜未読み込み時は120を基準にフォールバックするため操作自体は可能） | US-006 / REQ-006 |
| BPM数値入力 | `TempoControl`（`input[type=number]`） | `BPM:` | `テンポをBPM（1分あたりの拍数）で直接指定します` | なし（20〜400の範囲外はフォーカスアウト時に丸め込み） | US-006 / REQ-006 |
| テンポリセット | `TempoControl`（ボタン） | `リセット` | `テンポを楽譜本来のテンポに戻します` | なし | US-006 / REQ-006 |
| メトロノーム | `TempoControl`（チェックボックス） | `メトロノーム` | `メトロノームの音を鳴らします` | なし（状態はZustand `metronomeEnabled`で一元管理。実際の音出力にはAudioEngineとの結線が必要、後述） | US-006 / REQ-006 |
| ループ有効化 | `LoopControl`（チェックボックス） | `ループ` | `ループ再生（指定した小節範囲の繰り返し）の有効/無効を切り替えます` | なし | US-007 / REQ-007 |
| ループ開始小節 | `LoopControl`（`input[type=number]`） | `開始小節:` | `ループの開始小節番号` | なし（1未満または終了小節以上の値はフォーカスアウト時にエラー表示、値は反映されない） | US-007 / REQ-007 |
| ループ終了小節 | `LoopControl`（`input[type=number]`） | `終了小節:` | `ループの終了小節番号` | なし（同上のバリデーション） | US-007 / REQ-007 |
| 再生 | `PlaybackControls`（ボタン） | `再生`（ツールチップに`(Space)`表記） | `再生 (Space)`（楽譜未読込時は`楽譜を開くと再生できます`） | `score === null`（楽譜未読込）または`playbackState === 'playing'`のとき無効（REQ-010-002） | US-010 / REQ-010 |
| 一時停止 | `PlaybackControls`（ボタン） | `一時停止`（ツールチップに`(Space)`表記） | `一時停止 (Space)`（楽譜未読込時は`楽譜を開くと再生できます`） | `score === null`（楽譜未読込）または`playbackState !== 'playing'`のとき無効（REQ-010-002） | US-010 / REQ-010 |
| 停止 | `PlaybackControls`（ボタン） | `停止` | `停止`（楽譜未読込時は`楽譜を開くと再生できます`） | `score === null`（楽譜未読込）または`playbackState === 'stopped'`のとき無効（REQ-010-002） | US-010 / REQ-010 |
| 統計表示（正解率） | `StatsDisplay`（テキスト） | `正解率: {n}%` | なし（表示専用、操作不可） | 該当なし（操作コントロールではない） | US-004 / REQ-004 |
| 統計表示（連続正解数） | `StatsDisplay`（テキスト） | `連続正解数: {n}` | なし（表示専用、操作不可） | 該当なし | US-004 / REQ-004 |
| 設定 | `Toolbar`（アイコンボタン） | なし（歯車アイコンのみ） | `設定` | なし | NFR-U-002（日本語UI）、アプリ設定全般 |

---

## 「手」を選択する2種類のUIが併存する理由

本Toolbar領域には、意味の異なる2つの「手」選択UIが存在する。

1. **練習対象パート**（`PracticeModeSelector`: 左手/右手/両手）— MIDI入力に対する正誤判定・画面鍵盤ガイドの対象を決める（US-003）。
2. **運指対象**（`FingeringPanel`の`select`: 右手/左手）— 運指提案エンジン（Web Worker）が運指番号を計算する対象パートを選ぶ（US-009）。練習対象とは独立して指定できる（例: 両手で練習しつつ右手だけ運指提案を先に計算する、といった使い方を想定）。

両者は目的が異なるため意図的に分離しているが、UIラベルが似ているため誤操作を招きやすい。`FingeringPanel`側の`select`には`title`属性で「練習対象パートの設定とは別です」と明記することで区別を促している（実装済み）。将来的なUI統合（例: 運指対象のデフォルト値を練習対象と同期させる等）を行う場合は、本ドキュメントの改訂と合わせてUXレビューを実施すること。

---

## メトロノームの音出力に必要な結線

`TempoControl`の「メトロノーム」チェックボックスは、Zustandストアの`metronomeEnabled`状態を切り替えるのみであり、それ自体はAudioEngineServiceのメトロノーム再生と直接結線されていない。実際の音出力は`usePractice.ts`が`metronomeEnabled`の変化を購読し、`AudioEngineService.setMetronomeEnabled()`を呼び出すことで実現している（TASK-027で対応）。UIコンポーネント単体のレビューでは「チェックボックスを操作しても音が鳴らない」ように見えるが、これは`usePractice`フック経由の結線を前提とした設計であり、死んだコントロールではない。

---

## 各コントロールの共通無効化方針

- 楽譜未読み込み（`score === null`）の状態でも、テンポ・ループ・練習対象の各コントロールは操作自体が可能である（値は保持されるが、実際の判定・再生に影響するのは楽譜読み込み後）。「運指提案」ボタンと「運指対象」選択は`FingeringPanel`が、「再生」「一時停止」「停止」は`PlaybackControls`が、それぞれ`score`の有無を見て明示的に無効化する（TASK-047、REQ-010-002）。
- `PlaybackControls`の`score`prop（`Toolbar`経由でApp.tsxの`score`を受け取る）が`undefined`（未指定）の場合は、呼び出し側が楽譜有無を管理していないケースとみなし後方互換のため無効化しない。実際のApp.tsx経由の呼び出しでは常に`score`（`Score | null`）が渡される。
- 「ファイルを開く」ボタンは常時有効（読み込み中の二重クリックによる競合はApp.tsx側の`isLoadingAnnotations`ガードで抑止する）。

---

## 関連要件

- [US-001](../../requirements/stories/US-001.md) @../../requirements/stories/US-001.md: MusicXMLファイルのインポート
- [US-003](../../requirements/stories/US-003.md) @../../requirements/stories/US-003.md: 右手/左手分離練習
- [US-004](../../requirements/stories/US-004.md) @../../requirements/stories/US-004.md: MIDI入力と正誤判定
- [US-006](../../requirements/stories/US-006.md) @../../requirements/stories/US-006.md: テンポ調整
- [US-007](../../requirements/stories/US-007.md) @../../requirements/stories/US-007.md: 繰り返し練習（ループ範囲設定）
- [US-009](../../requirements/stories/US-009.md) @../../requirements/stories/US-009.md: 運指提案
- [US-010](../../requirements/stories/US-010.md) @../../requirements/stories/US-010.md: 曲の再生（お手本演奏）
- [NFR-U-002](../../requirements/nfr/usability.md) @../../requirements/nfr/usability.md: 日本語UI必須

## 参照タスク

- [phase-8/TASK-028](../../tasks/phase-8/TASK-028.md) @../../tasks/phase-8/TASK-028.md: Toolbar UXの全面改善（日本語ラベル・機能整理、本ドキュメントが仕様根拠とする実装）
- [phase-8/TASK-027](../../tasks/phase-8/TASK-027.md) @../../tasks/phase-8/TASK-027.md: テンポ・メトロノーム・効果音の結線
