# トラブルシューティング分析レポート — 再生ボタンを押しても何も起きない（Windows 11 / Portable版）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| 報告日 | 2026-08-11 |
| 分析完了日 | 2026-08-11 |
| 報告者 | ユーザー（実機確認） |
| ステータス | 分析完了・修正実施（TASK-106） |

## 問題事象

### 報告された現象

「Win11でPortable版を実行したが再生ボタンを押しても何も起きなかった」。

### 期待動作

US-010: 再生操作で読み込み済みの楽曲が演奏され（REQ-010-001）、楽譜上のカーソルが
再生位置に同期して移動する（REQ-010-005）。

### 発生環境

- OS: Windows 11
- 配布形態: Windows Portable版（`v0.1.0-rc.3` / `v0.1.0-rc.4` のGitHub Releases成果物。
  Windows向けexe配布は`v0.1.0`（US-019）でMicrosoft Store（MSIX）へ移行し廃止済み）
- 追試: 同一ブランチを Windows 11 上で `npm run start`（`electron-vite preview`。内部でビルドを実行する）
  により確認。エラーダイアログは出ず、音も出ない
- 開発者環境（macOS / `npm run dev`）および実起動E2E（`npm run test:e2e`）では再現しない。
  原因0は**ファイル依存**であり、同梱サンプル（`sample-two-hands.musicxml`）は
  小節番号が正しく採番されているため再現しない

## 根本原因分析

### 前提: 再生ボタンのクリックは「Promiseの連鎖の完了」を待って初めてUIへ反映される

`PlaybackControls.handlePlay`（修正前）は次の逐次awaitで構成されていた。

```typescript
const handlePlay = useCallback(async () => {
  if (noScoreLoaded || voiceLoading) return;
  await ensureToneStarted();          // = await Tone.start()
  await audioEngine?.playAccompaniment(); // = await ensurePlaybackVoiceLoaded() → Transport.start()
  setPlaybackState('playing');
}, [...]);
```

呼び出し側は `onClick={() => void handlePlay()}` であり、**戻り値のPromiseを誰も監視していない**。
したがって、この連鎖のどこかで例外が起きても、あるいはPromiseが決着しないまま留まっても、
`setPlaybackState('playing')` に到達しない。ボタンの見た目・楽譜カーソル・音のいずれも変化せず、
エラーダイアログも出ない。**「押しても何も起きない」は、この経路の設計上の帰結として起こりうる。**
パッケージ版はDevToolsを開けないため、原因を特定する手段も利用者には無い。

まず実機報告の直接原因（原因0）を示し、続いてこの連鎖を止めうる3つの原因を示す。

### 原因0: 小節番号が一意でないMusicXMLを解析すると全小節が1つへ統合される（実機報告の直接原因）

**実機で報告された無音の直接原因はこれである**（2026-08-11、利用者提供のファイルで確定）。

報告者のファイル（music21 v9.9.2出力、16小節）は、**全小節が `<measure number="0">`** になっていた。
MusicXML仕様上 `number` は表示用のラベル（CDATA）であり、一意である保証は無く、整数とも限らない。
しかし `parser.ts` は小節の同一性をこの `number` で決めていた（`measureStartTicks` / `measuresMap` の
どちらもキーが `number`）。その結果、次の二重の破壊が起きる。

1. **全16小節が1つの小節へ統合される**（`measuresMap` のキーが衝突する）
2. **`startTick` が最後の小節の値で上書きされる**（`measureStartTicks.set(0, runningTick)` を
   小節ごとに繰り返すため、残るのは最終小節の開始tick）

利用者ファイルを実際にパーサへ通した結果:

```text
measureCount= 1
measures(number, startTick, noteCount)= [[0, 28800, 171]]
startTick range= 28800 .. 30480
ticksPerQuarter= 480
```

全171音が tick 28800〜30480（約3.5拍ぶん）へ密集し、しかも曲の開始位置が tick 28800 になる。
一方、再生開始位置は `practiceEngine.getCurrentPositionTick()` が
`measures.find((m) => m.number === state.currentMeasure)` で決める。
`currentMeasure` の初期値は `1` だが、一致する小節が存在しない（唯一の小節は番号0）。
そのため `null` が返り、Transportは **tick 0 から**再生を開始する。

つまりアプリとしては正常に再生中であり、**最初の音が鳴るまで無音のまま約30秒待つ**状態だった
（PPQ 480・120BPMで 28800 tick = 60拍）。カーソル連動のコールバックもすべて 28800 以降にしか
無いため、その間カーソルも動かない。エラーが出ないのも当然で、失敗していないからである。
メトロノーム（楽譜スケジュールと独立したクロック）だけが鳴るという観測とも整合する。

なお `noteId`（`{partId}-M{小節番号}-N{索引}`）も小節ごとに衝突しており、
運指メモ・アノテーションの紐付けも壊れていた。

### 原因1: `Tone.start()`（`AudioContext.resume()`）が決着しない・失敗する経路が無防備

`Tone.start()` は `AudioContext.resume()` を呼ぶ。Chromiumの `resume()` が返すPromiseは
**音声出力デバイスの起動に成功して初めて解決する**。出力先が使用不能な環境
（出力デバイスが無い・無効化されている、他アプリが排他モードで占有している、
Bluetooth機器が切断されている等）では、解決されず拒否もされないまま留まりうる。
Windows環境（WASAPI）はこの状態に入りやすく、開発者のmacOS環境では再現しない。

修正前は上限時間と例外処理のどちらも無かったため、この時点でクリックの処理が永久に停止する。
また `Tone.start()` が解決しても AudioContext が `running` にならない場合、Transportは
一切進まず、無音かつカーソル停止のまま「再生中」表示にもならない。

### 原因2: 再生音色のサンプルロードが決着しないと再生要求が永久にpendingになる

`playAccompaniment`（`App.tsx` のラッパー）は `audioEngine.ensurePlaybackVoiceLoaded()` を待つ。
このPromiseは既定音色 `grand-piano` の `Tone.Sampler` 2インスタンスの `onload` が揃うか、
`onerror` が発火して synth プリセットへフォールバックしたときにだけ解決する。
**`onload` と `onerror` のどちらも返らない状態に陥ると永久にpending**となる。
こうなると原因1と同じくクリックが決着しない。上限時間による打ち切りが無かった。

### 原因3: `voiceLoading` が `true` のまま残り、再生ボタンが無効状態から復帰しない経路

`applyPlaybackVoice` は、ロードが必要な音色に対してのみ `voiceLoadingCallback(true)` を通知し、
`finishLoading` で `false` を通知する。ただし `finishLoading` は世代が最新のときだけ
`false` を通知する（`setPlaybackVoice` 連打時に古い世代が最新状態を上書きしないための措置）。
一方、**ロード不要な音色（synth系）への切り替えは `false` を一切通知しない**実装だった。

このため「`grand-piano` のロード中に設定モーダルで synth 系音色へ切り替える」と、
`voiceLoading` が `true` のまま残る。再生ボタンは「読込中...」表示の無効状態で固定され、
押しても何も起きない状態になる（原因1・2とは独立に再現可能）。

### 参考: 検証で確認した「原因ではない」もの

- パッケージ相当（`file://` 読み込み）でのサンプルmp3の取得は成功する。
  実起動E2E（`out/renderer/index.html` を `loadFile` で起動）で `fetch` が200を返し、
  `Tone.Sampler` のフォールバックも発火しないことを確認した
- CSP（`worker-src 'self' blob:` を含む）は現行のままでTransportのTickerを阻害しない
  （2026-07-05の原因4は解消済みのまま）
- 楽譜が未読み込みの場合は再生ボタンが `disabled` になるため、クリックイベント自体が発火しない。
  この場合も画面上は無反応だが、報告の再現条件としては区別できない
  （ツールチップ「楽譜を開くと再生できます」のみが手がかりとなる）

## 仕様照合結果

### 関連する要件

- REQ-010-001（再生）: 上記いずれの原因でも未達となる
- REQ-013-003（音色ロード待ち）: 待ち時間の上限が定義されておらず、
  ロードが決着しない場合の振る舞いが未規定だった
- CLAUDE.md「エラーハンドリング」（ユーザーへのエラー表示は必ずダイアログまたはトースト通知で行う）:
  再生開始経路のみがこの規約から漏れていた（他の失敗経路はすべて `alert` で通知している）

### 乖離の分類

- [x] 実装バグ（原因0: MusicXMLの`number`属性を小節の一意キーとして扱っていた）
- [x] 実装バグ（原因3: ロード状態の解除漏れ）
- [x] 堅牢性・エラーハンドリングの欠落（原因1・2: 上限時間なし、例外の握り潰し）

## 修正内容（TASK-106）

### 0. 小節の同一性を「文書順」で決める（`musicxml-parser/parser.ts`、TASK-107）

- Pass 1 / Pass 2 の双方で、小節のキーを `number` 属性から**文書順のindex**へ変更する
- `Measure.number` は表示・参照用のラベルとして残すが、全小節の番号が
  「整数かつ一意」のときだけXMLの値を採用し、それ以外は文書順の連番（1始まり）へ振り直す
  （`resolveMeasureNumbers`）。正しく採番されたファイルの解析結果は従来と変わらない
- 最終的な `measures` 配列の並び順も `number` ではなく文書順（index）で決める

### 1. 再生開始経路の失敗を必ず利用者へ提示する（`PlaybackControls.tsx`）

- `handlePlay` 全体を `try/catch` で囲み、失敗時は `console.error` に詳細を残したうえで
  エラーダイアログ（i18n: `playbackControls.startError`）を表示する
- `Tone.start()` に上限時間 `AUDIO_START_TIMEOUT_MS`（5秒）を設ける
- `Tone.start()` の完了後に `Tone.getContext().state === 'running'` を確認し、
  そうでなければエラーとして扱う（音声デバイスを開けない環境の検出）
- 再生要求全体にも上限時間 `PLAY_REQUEST_TIMEOUT_MS`（30秒）を設ける（UI側の最終防衛線）
- 失敗時は `toneStartedRef` を倒し、次回クリックで AudioContext の起動からやり直せるようにする

### 2. サンプルロードの決着を保証する（`audio-engine/index.ts`）

- `SAMPLE_LOAD_TIMEOUT_MS`（20秒）を超えたロードは、既存の `onerror` と同じ
  フォールバック経路（synthプリセット）へ倒す。無音・無反応ではなく
  「音色は簡易だが再生はできる」状態を保証する
- ロード決着時はタイマーを解除する（完了後の誤フォールバックを防ぐ）
- `dispose()` で世代カウンタを進め、破棄後に届くコールバックを常に古い世代として扱う

### 3. `voiceLoading` の解除漏れを修正（`audio-engine/index.ts`）

- ロード不要な音色への切り替え時にも `voiceLoadingCallback(false)` を通知する

### 4. レビュー指摘への追加対応（CodeRabbit PR#77）

- **再生開始要求の同時実行を1件に制限**（`PlaybackControls.tsx`）:
  `playbackState` が `'playing'` になるのは開始処理の完了後であり、それまで再生ボタンは
  押下可能なままだった。上限時間を最大30秒待つようになったことで再入の窓が広がり、
  連打すると複数の開始要求が並行する。先行要求が後からタイムアウトすると、
  成功済みの状態を巻き戻して不要なエラーダイアログを表示してしまう。
  実行中フラグ（`useRef` で再入を弾き、stateでボタンを無効化）を導入し、
  `finally` で必ず解除する
- **古い世代のロード上限タイマーを解除**（`audio-engine/index.ts`）:
  `fallbackToSynth` は世代を判定する前にフォールバック音源を生成するため、
  `dispose()` 後や音色切り替え後に古いタイマーが発火すると、使われないTone.jsノードを
  2個生成してから破棄することになる。タイマーIDをインスタンスフィールドで保持し、
  音色切り替え時・ロード決着時・`dispose()` 時に解除する

### 5. 新規ユーティリティ

- `lib/audio-engine/with-timeout.ts`: 決着しないPromiseを `TimeoutError` で打ち切る純関数

### 修正対象ファイル

1. `src/renderer/src/lib/musicxml-parser/parser.ts`
2. `src/renderer/src/components/Toolbar/PlaybackControls.tsx`
3. `src/renderer/src/lib/audio-engine/index.ts`
4. `src/renderer/src/lib/audio-engine/with-timeout.ts`（新規）
5. `src/renderer/src/lib/i18n/ja.ts` / `en.ts`（`playbackControls.startError`）

## 再発防止（テスト）

「テストの期待値は要件から導く」「失敗は握り潰さない」の原則に沿い、
**修正前のコードでは失敗する**ことを確認したうえで以下を追加した（29件）。
内訳は `parser.test.ts` 9件・`PlaybackControls.test.tsx` 9件・`audio-engine.test.ts` 6件・
`with-timeout.test.ts` 5件である。下表は主な検証内容を示す。

| 検証内容 | 場所 |
| --- | --- |
| 全小節が`number="0"`でも小節が統合されない | `parser.test.ts` |
| 同上で`startTick`が小節長ぶん進む（最初の音がtick 0で鳴る） | 同上 |
| 同上で`noteId`が小節ごとに一意になる | 同上 |
| `number`が重複・非整数の場合も文書順の連番へ振り直す | 同上 |
| 正しく採番されたファイル・アウフタクトの番号は維持する（既存挙動を変えない） | 同上 |
| `playAccompaniment()` の失敗時にダイアログを表示し `playing` にしない | `PlaybackControls.test.tsx` |
| `Tone.start()` の失敗時にダイアログを表示し伴奏を開始しない | 同上 |
| AudioContextが `running` にならない場合にダイアログを表示する | 同上 |
| `Tone.start()` が決着しない場合、上限時間の経過でダイアログを表示する | 同上 |
| `playAccompaniment()` が決着しない場合、上限時間の経過でダイアログを表示する | 同上 |
| 失敗後の再クリックで `Tone.start()` からやり直す | 同上 |
| サンプルロードが決着しないとき、上限時間でsynthへフォールバックし解決する | `audio-engine.test.ts` |
| フォールバック時にローディング状態を `false` へ戻す | 同上 |
| ロード中からロード不要な音色へ切り替えた際にローディング状態を戻す | 同上 |
| `withTimeout` の解決・拒否・タイムアウト・タイマー解除 | `with-timeout.test.ts` |
| 開始処理中は再生ボタンを無効化し、連打しても要求は1件に制限される | `PlaybackControls.test.tsx` |
| 開始処理の失敗後も再生ボタンが再び押下可能になる | 同上 |
| `dispose()` 後に上限時間が経過してもフォールバック音源を生成しない | `audio-engine.test.ts` |
| 音色を切り替えると旧世代の上限タイマーを解除する | 同上 |
| `number`が小数表記・余分な文字つきでも整数として受理せず連番へ振り直す | `parser.test.ts` |
| AudioContextが`suspended`へ戻ったら次の再生で`Tone.start()`をやり直す | `PlaybackControls.test.tsx` |

### E2Eについて

実起動E2E（`tests/e2e/app.spec.ts`）は正常系（クリック→カーソル進行）を既に検証しており、
本修正後も合格する。異常系（音声デバイスを開けない状態）は実バイナリ上で決定的に再現できないため、
E2Eではなくユニットテストで担保する方針とした。

## 訂正

当初、実機報告の主因を「原因1（`AudioContext.resume()` が決着しない）」と推定したが、
これは誤りだった。利用者環境ではメトロノームが鳴っており、AudioContextは `running` で、
`handlePlay` も最後まで成功していた。実機報告の直接原因は原因0（パーサの小節統合）である。
原因1〜3は、いずれも「失敗しても利用者に何も伝わらない」という同じ症状を生む実在の欠陥であり、
今回の調査を著しく困難にした要因でもあるため、修正はそのまま維持する。

## 残課題・申し送り

- 楽譜未読み込み時、再生ボタンは `disabled` であり、理由はツールチップでしか伝わらない。
  起動直後はライブラリ画面が初期表示される（REQ-017-010）ため、
  「押しても何も起きない」という同じ体感につながりうる。常時見える導線での案内は別途検討する
- 本レポートの対象であるWindows Portable版は `v0.1.0`（US-019）で配布を終了しており、
  現行の配布物はMicrosoft Store（MSIX）版である。本修正はMSIX版・macOS版にも等しく適用される
