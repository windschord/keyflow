# 要件トレーサビリティ表（REQ → テスト）

2026-07-05のテスト妥当性検査で作成。タスク完了時に対応行を更新すること。

凡例: ○=十分（実装テスト＋結線＋観測可能な結果のいずれかで要件を検証） / △=部分的（ロジックのみ・結線未検証など） / ×=検証なし / ※=実装自体が存在しない

| REQ | 検証 | 検証箇所 / 備考 |
|---|---|---|
| REQ-001-001 | △ | parser.test / E2E表示。「5秒以内」の性能検証なし |
| REQ-001-002 | △ | App.test（エラーダイアログ）。「前の状態維持」未アサート |
| REQ-001-003 | ○ | parser.test hand-detector / 統合テスト。1パート2段譜（`<staves>2</staves>`）のNote.staff/hand判定を追加検証（TASK-048） |
| REQ-001-004 | ○ | parser.test（tempo/time/key、tempoMap含む） |
| REQ-001-005 | × | MusicXML 3.1準拠スイートなし |
| REQ-001-006 | ○ | file-handlers.test（createShowOpenDialogHandlerがaddRecentFileを呼ぶ結線を検証）。TASK-039で対応済み |
| REQ-001-007 | ○ | App.test（D&D→openMusicXmlFile結線、.xml/.mxl両経路、拒否拡張子・Main側拒否の通知、ドロップ可能表示、視覚フィードバック）+ file-handlers.test（createRegisterDroppedFileHandlerの拡張子検証・allowlist登録・addRecentFile結線）。TASK-053で対応済み |
| REQ-002-001 | △ | E2E: svg可視のみ |
| REQ-002-002 | × | OSMD委譲、無検証 |
| REQ-002-003 | △ | osmd-controller.test（scrollIntoView、モック）+ E2Eカーソル移動 |
| REQ-002-004 | ○ | osmd-controller.test + ScoreRenderer.test（クリック位置→音符解決）+ practice-engine.test（resetToPosition: 指定判定グループへの移動、フィルタ空グループの自動スキップ、押鍵状態リセット）+ App.test（クリックした音自身の判定グループへ移動し、小節頭に丸めないことを確認、TASK-051）。E2Eクリックはなし。TASK-049でbuildNoteIdMapを独立採番から（小節番号・tick・midiNumber・staff）照合ベースへ変更し、2段譜・多声部での誤対応を解消。リサイズ/setZoom後もnoteIdToSvgCoordが再構築されクリック解決が追随することをosmd-controller.testで検証 |
| REQ-002-005 | × | showFingerings テストゼロ |
| REQ-002-006 | ○ | ZoomControl.test（Toolbar常設、Japanese label・値反映）+ Toolbar.test（統合）+ ScoreRenderer/osmd-controller.test（zoom prop→setZoom結線、既存）+ E2E（`zoom-select`のUI操作でストアのzoomが変わることを検証、store直接呼び出しを廃止）。TASK-045で対応済み |
| REQ-002-007 | ○ | osmd-controller.test（note単位グレーアウトのoverlay描画）+ ScoreRenderer.test（practiceMode right/left/bothごとのsetGrayedOutNotes結線をアサート）。TASK-046で対応済み。TASK-048でパート単位(setPartOpacity)からNote.hand単位(setGrayedOutNotes)へ変更し、1パート2段譜でも検証。TASK-049でnoteIdの照合ベース化・リサイズ/setZoom時のマップ再構築によりグレーアウト座標のstale化を解消（osmd-controller.testでrender→buildNoteIdMap→reapplyOverlaysの呼び出し順序を検証）。TASK-060で白半透明ベール（座標バグあり）を廃止し、GNotesUnderCursor由来の音符SVG要素を減光する方式へ変更（osmd-controller.testで適用・解除・置き換え・白矩形非生成を検証） |
| REQ-003-001〜003 | ○ | practice-engine.test（モードフィルタ、スキップ）+ note-grouping.test（filterNotesByPracticeModeがNote.hand基準でフィルタすることを検証、TASK-048） |
| REQ-003-004 | - | 保留・将来拡張へスコープ変更（2026-07-05、US-003参照）。曲を聴く用途はUS-010の再生で代替 |
| REQ-003-005 | × | モード切替時の位置維持: 無検証 |
| REQ-004-001 | △ | web-midi.test初期化のみ。ホットプラグ未検証 |
| REQ-004-002 | × | 10ms以内のレイテンシ検証なし |
| REQ-004-003 | ○ | practice-engine + usePractice + osmd-controller + E2E。TASK-049でnoteId照合ベース化・リサイズ/setZoom後のマップ再構築によりハイライト座標のstale化を解消 |
| REQ-004-004 | ○ | 同上 |
| REQ-004-005 | △ | 正解率statsは○。タイミング記録は無検証 |
| REQ-004-006 | ○ | practice-slice.test（setErrorMode）+ SettingsModal.test（変更即時反映・ロールバック）+ App.test（起動時ロード）+ practice-flow.test（SettingsModal→store→practice-engineのUI→store→engine結線）。TASK-040で対応済み |
| REQ-004-007 | △ | handleKeyClick（モック経由）。座標→MIDI変換未検証 |
| REQ-004-008 | ○ | web-midi.test（setSelectedDeviceによる選択デバイスのみバインド・未接続時フォールバック）+ SettingsModal.test（デバイス一覧表示・選択・保存・ロールバック）+ useMidi.test（storeのmidiDeviceId→WebMidiService.setSelectedDeviceの結線、起動時反映）+ App.test（起動時ロード）。TASK-045で対応済み |
| REQ-005-001/002 | ○ | PianoKeyboard.test（keyboard-renderer.tsのfillStyleアサーション）。Note.hand（parser算出済み、TASK-048でPart.hand単位からNote単位に変更）に基づきguidRight/guidLeft色を検証。partId文字列ヒューリスティックのバグを修正（TASK-041）。1パート2段譜（同一partId・staff違い）の色分けも検証（TASK-048）。TASK-057: 再生中は判定グループ（expectedNotes）とは独立した「発音中ノーツ」表示（新色sounding、優先度は誤答＞正解押鍵＞発音中＞ガイド）を追加し、音価（durationTicks）満了まで点灯し続けるようにした（keyboard-renderer.test/PianoKeyboard.test/audio-engine.test/usePractice.test） |
| REQ-005-003/004 | △ | ロジックは○、鍵盤描画は× |
| REQ-005-005 | △ | getNotePosition範囲外throwのみ。TASK-056で88鍵（既定・後方互換）に加え76/61/49鍵のプリセット選択に対応（KEYBOARD_PRESETS、key-layout.test/keyboard-renderer.test/PianoKeyboard.test）。「最低でも88鍵」の既定は変更なし（keyboardSize省略時は従来通り88鍵）。「スクロール可能」部分は引き続き無検証。TASK-058で鍵盤のセンタリング（safe center）と余白のヘッダー同色化（#e0e0e0）を追加し、センタリング下のクリック座標→MIDI変換をPianoKeyboard.testで検証 |
| REQ-005-006 | ○ | usePractice.test（handleKeyClickがaudioEngine.playNote(midiNumber)を呼ぶことを検証）+ 従来通りの正誤判定・note-offスケジュール検証。TASK-047で対応済み |
| REQ-005-007 | ○ | PianoKeyboard.test（実描画関数への座標アサーション）。TASK-055で運指の一括表示/非表示トグル追加。App.test（showFingerings=false時にPianoKeyboardへ空のannotationsが渡ることを結線検証、ONで復元） |
| REQ-006-001 | ○ | parser + practice-flow.test（App経路） |
| REQ-006-002 | ○ | Toolbar.test + App.test + audio-engine.test |
| REQ-006-003 | ○ | ui-slice.test（setBpmがoriginalBpm比20%-200%でクランプ、境界値含む）+ Toolbar.test（BPM入力の実クランプ挙動）+ TempoControl（title文言とUI表示範囲を比率ベースへ統一）。TASK-046で対応済み |
| REQ-006-004 | × | ピッチ不変（Tone.js委譲） |
| REQ-006-005 | ○ | audio-engine.test（TASK-042、TASK-061、TASK-064、TASK-065）。metronome.tsからTransport.start()を削除し、setEnabled(true)はSequence.start(0)のみでTransportライフサイクルは再生コントロール側に一本化。TASK-061でSequenceのイベント配列が`[null]`のためコールバックが発火せず無音になっていたバグを修正（`[0]`へ変更）し、fireSequenceTickヘルパーによる発音結線テストを追加（Tone.jsのnullスキップ仕様をエミュレート）。TASK-064でSequenceが生成時点のPPQでクリック間隔を固定し楽譜読み込み前のON操作では間隔がPPQ変更へ追随しないバグを修正（Metronome.rebuildSequenceを追加しloadScoreのPPQ設定直後に再生成する）。結線・順序（PPQ設定→Sequence再生成）・無効時非生成・再生成後のクリック発音とアクセント判定の回帰をaudio-engine.testで検証。TASK-065で一度stop()したSequenceはstart(0)で再開できない仕様（内部Partに停止イベントが残る）が原因の再有効化無音バグを修正し（setEnabled(true)が毎回dispose＋再生成）、あわせてアクセント無効時の通常拍velocityを0.6から1.0へ変更（承認済み仕様変更） |
| REQ-006-006 | ○ | Toolbar.test |
| REQ-006-007 | △ | parserのtempoMapは○。再生時のテンポ変化再現は無検証 |
| REQ-006-008 | ○ | audio-engine.test（TASK-062: 小節頭tick一致でC6/1.0、非一致でC5/0.6、setMetronomeAccentEnabled(false)で全拍C5/0.6、弱起相当の不等間隔小節頭tickでの正判定、loadScoreからのsetMeasureStartTicks結線、dispose後の再初期化でアクセント設定が維持されることを検証）+ ui-slice.test（metronomeAccentEnabled初期値true・setter）+ TempoControl.test（「1拍目強調」チェックボックスの表示・操作・store反映、メトロノームOFF時も操作可能）+ usePractice.test（store→audioEngine.setMetronomeAccentEnabled結線）+ SettingsModal.test（既定値変更→保存＋store即時反映）+ App.test（起動時の永続化値反映、キー欠落時のtrueフォールバック）。TASK-063でUI結線・永続化まで対応済み |
| REQ-006-009 | ○ | audio-engine.test（TASK-066: 停止中にメトロノーム有効化でTone.Clockがbpm/60Hzで生成・開始されTransportは起動されないこと、拍カウンター%beatsPerMeasureによるアクセント判定（4拍子・3拍子、アクセント無効時は全拍C5/1.0）、playAccompanimentで独立クロックが停止しstopAccompanimentで（有効中なら）カウンター0から再開すること、setBpmによる周波数更新、loadScoreのtimeSignature.beats反映、無効化での停止、dispose後の再初期化でbpm・拍子が維持されることを検証）。Metronome.setTransportRunningでSequence（楽譜同期）とClockを切り替える設計 |
| REQ-006-010 | ○ | TempoControl.test（TASK-067: playbackState='playing'でテンポスライダー・数値入力・リセットボタンがdisabled、'stopped'/'paused'で操作可能、メトロノーム・1拍目強調チェックボックスは'playing'中も操作可能であることを検証） |
| REQ-007-001/002 | △ | practice-engine.test + audio-engine setLoopPoints。App/E2E経路のループなし |
| REQ-007-003 | ×※ | ドラッグ選択未実装 |
| REQ-007-004 | ×※ | ループ回数カウンターUI未実装 |
| REQ-007-005 | ×※ | 自動解除（将来予定と明記済み・意図的） |
| REQ-007-006 | △ | store toggleLoopのみ |
| REQ-008-001 | ○ | osmd-controller.test（contextmenu座標→noteId解決）+ NoteContextMenu.test（指番号1-5選択）+ ScoreRenderer.test（結線）+ App.test（右クリック→setFinger→save統合）。TASK-044で対応済み |
| REQ-008-002 | ○ | ScoreRenderer.test（annotations→showFingerings、isApproved色分け含む）。TASK-044で対応済み。TASK-049でnoteIdの照合ベース化（多声部・2段譜での誤対応解消）とリサイズ/setZoom時の再構築により、運指番号の座標stale化を解消。TASK-050で和音（同一カーソル位置の複数構成音）を音高順の縦オフセットで重ならず描画することをosmd-controller.testで検証。TASK-055で運指の一括表示/非表示トグル追加。App.test（showFingerings=false時にScoreRendererへ空のannotationsが渡りfingering-layerが消えること、ONで即復元されること、運指提案実行時にOFFなら自動でONへ戻ることを結線検証）+ ui-slice.test（showFingerings/setShowFingerings）+ FingeringToggle.test（トグルUI・永続化）。TASK-059でトグルをスイッチ型UI（状態文言「表示中/非表示」付き）へ変更し、文言切替をFingeringToggle.testで検証 |
| REQ-008-003 | ○ | NoteContextMenu.test（コメント編集UI）+ App.test（コメント保存→annotation-store結線）。TASK-044で対応済み |
| REQ-008-004 | ○ | annotation-store.test + path-allowlist.test + App結線 |
| REQ-008-005 | △ | load（validNoteIdsフィルタ）は○。App結線未アサート |
| REQ-008-006 | ○ | NoteContextMenu.test（削除ボタン活性制御）+ App.test（右クリック→removeFinger→save統合）。TASK-044で対応済み |
| REQ-009-001 | △ | dp-solver + service（モックWorker）。実Worker未検証。TASK-050で和音（同一startTick/isChord連続）をコードユニット化するDPへ刷新し、3和音の全音割当・SPAN_TABLE実行可能性・指重複なしをdp-solver.testで検証 |
| REQ-009-002 | △ | FingeringPanel.test（左手/右手選択でNote.hand基準の対象音符フィルタ・エラー文言を検証、1パート2段譜のstaff2音符を含む。TASK-048）。TASK-050で左手和音（音高昇順に対して指降順）のDP割当をdp-solver.testで追加検証。DP計算結果自体の詳細な左手固有ロジック検証は引き続き弱い |
| REQ-009-003 | × | プログレスバー表示未検証 |
| REQ-009-004 | × | showFingerings未検証 |
| REQ-009-005 | ○ | NoteContextMenu.test（AI提案時のみ承認ボタン表示）+ App.test（承認→approveAnnotation→isApproved:true反映）。TASK-044で対応済み |
| REQ-009-006 | ○ | annotation-store.test（applyAISuggestionsが承認済みを上書きしない）+ App.test（承認後に新規AI提案を適用しても手動承認値が維持される回帰テスト）。TASK-044で対応済み |
| REQ-009-007 | △ | モックWorkerのみ |
| REQ-009-A01 | △ | dp-solver.test（アサーション弱い） |
| REQ-009-A02 | △ | spanCostユニット○。TASK-050で和音内のSPAN_TABLE実行可能性チェック（隣接・端点ペア、超過時Infinity）をdp-solver.testで検証。単旋律のDP統合検証は引き続き弱い |
| REQ-009-A03 | △ | cost-functions.test（thumbPassingCostの親指くぐり/指越え発生・非発生ケース）を追加。DP統合での検証は引き続き弱い。TASK-046で対応済み |
| REQ-009-A04 | △ | cost-functions.test（fiveOnBlackCostの黒鍵/白鍵・小指以外のケース）を追加。DP統合での検証は引き続き弱い。TASK-046で対応済み |
| REQ-009-A05 | △※ | 手の大きさ設定UIなし。DPテストは空虚 |
| REQ-009-A06 | ○ | computeFingering内でapplyScalePatternを優先適用済み（dp-solver.test、TASK-043） |
| REQ-010-001 | ○ | audio-engine.test（loadScoreスケジューリング、playAccompaniment開始tickオフセット）+ practice-engine.test（getCurrentPositionTick）+ App.test（停止中の再生操作は現在のカーソル位置のtickから開始、一時停止からの再開はtickを渡さず一時停止位置を維持することを確認、TASK-051）+ E2E |
| REQ-010-002 | ○ | PlaybackControls.test（score===nullで再生/一時停止/停止がdisabled＋title「楽譜を開くと再生できます」、読込後に有効化・通常ツールチップへ復帰）。TASK-047で対応済み |
| REQ-010-003 | △ | 状態遷移＋ユニット。実機聴感は不可 |
| REQ-010-004 | ○ | usePractice結線 + audio-engine setOnStop + E2E（模範パターン） |
| REQ-010-005 | ○ | audio-engine schedule + 結線 + practice-engine + E2E poll（模範パターン）。TASK-057: カーソル連動（判定グループ単位）とは別系統で、ノーツ単位の発音開始/終了境界（同一tickは1回のTransport.scheduleへ集約）を追跡し、鍵盤の発音中表示を音価（durationTicks）に追随させる仕組みを追加（audio-engine.test）。停止/一時停止/スコア差し替え時のクリアも検証済み |
| REQ-010-006 | △ | setBpmチェーンは○、再生中の即時反映は未検証 |
| REQ-010-007 | ○ | practice-engine.test |
| REQ-010-008 | △ | setLoopPointsユニット+結線。実ループは代理指標 |
| REQ-010-009 | ○ | audio-engine.test（setMasterVolumeのdB変換・ミュート・境界値）+ ui-slice.test（volume/setVolumeクランプ）+ VolumeControl.test（スライダー操作・ラベル・ツールチップ・electron-store永続化）+ usePractice.test（store→audioEngine同期）+ App.test（起動時ロード）。TASK-052で対応済み |
| REQ-010-010 | ○ | audio-engine.test（loadScoreがpracticeMode='left'/'right'/'both'でスケジュール対象ノーツをNote.hand基準に絞り込むことを検証、カーソル連動スケジュールはpracticeModeに関わらず不変であることも検証）+ usePractice.test（score/practiceMode変更時にaudioEngine.loadScoreを再スケジュールし、再生中の変更は停止することを検証）。TASK-051で対応済み |
| REQ-011-001 | ○ | branding.test（index.htmlの`<title>`）+ window-options.test（BrowserWindowのtitle、プラットフォーム問わず）+ E2E（`window.title()`が実バイナリで一致することを検証）。TASK-068で対応済み |
| REQ-011-002 | ○ | branding.test（`resources/icon.png`生成・サイズ>0）+ window-options.test（win32/linuxでiconオプション設定、darwinは非設定＝パッケージ版のicon.icns適用に委譲）。実機でのタスクバー/Dock表示の目視確認は本タスク（TASK-077）の`build:mac`成果物で`icon.icns`同梱を確認したが、実際のDock表示の目視はユーザー実機確認待ち |
| REQ-011-003 | ○ | branding.test（`build/icon.icns`/`build/icon.ico`の生成・サイズ>0）+ TASK-077で`npm run build:mac`実行しicon.icnsがapp.asar外の`Contents/Resources/icon.icns`として実際に同梱されることを確認。Windows向け`build:win`はWindows環境がないため`icon.ico`のファイル存在確認までが対象（設計判断としてTASK-077記載済み） |
| REQ-012-001 | ○ | Header.test（bounding box高さ56px以下）+ E2E（実バイナリでのapp-header高さ検証、TASK-075） |
| REQ-012-002 | ○ | Header.test（QuickPanelが「...」ボタン1クリックで開閉）+ E2E（QuickPanel経由の音量・ズーム操作） |
| REQ-012-003 | ○ | Popover.test（outside mousedown/Escapeで閉じる、内側クリック・anchor要素クリックでは閉じない、リスナーリークなし）+ Header.test（QuickPanel文脈での同挙動） |
| REQ-012-004 | ○ | QuickPanel.test（音量・ズーム・運指・メトロノーム・成績の全セクションが既存コンポーネントの再利用で表示）+ Header.test（頻用操作の常時表示）+ E2E（開く→再生→ループ→音量→運指提案の一連操作） |
| REQ-012-005 | △ | Header.test/E2Eはヘッダーが56px以下であることのみ検証。「現状より拡大」という旧構成との相対比較の自動検証はなし。TASK-075受入基準の実起動確認（開発モードStrictMode有効）で譜面表示領域拡大を目視確認済みだが、E2Eでの定量的な前後比較はしていない |
| REQ-012-006 | ○ | Header.test（playbackState='playing'中はテンポスライダー・数値入力・リセットボタンがdisabled、メトロノーム系は操作可能） |
| REQ-014-001 | ○ | parser.test（`<pedal type="start/stop/change">`の解析、pedalSpans生成、区間分割、ペダルなし楽曲でのpedalSpans空配列、既存フィクスチャ非回帰） |
| REQ-014-002 | ○ | pedal-extension.test（resolveEffectiveEndTick/resolveEffectiveDurations、境界値・同音再打鍵での切り詰め）+ audio-engine.test（Tone.Partイベントのduration延長結線） |
| REQ-014-003 | ○ | parser.test（`change`による区間分割）+ pedal-extension.test（複数区間にまたがる延長・切り詰めロジック） |
| REQ-014-004 | ○ | pedal-extension.test（pedalSpansなし時は記譜どおりのdurationを維持、non-regression）+ parser.test（既存フィクスチャのパース結果がpedalSpans追加以外不変）+ audio-engine.test（non-regression） |
| REQ-014-005 | ○ | audio-engine.test（stop/pause/ループ折り返し時に`accompanimentSynth.releaseAll()`が呼ばれることを検証）。ただし「実際に音が残留しないこと」の聴感確認はTASK-070の実起動確認項目が未実施のまま残っており、ユーザー実機確認待ち |
| REQ-013-001 | ○ | voices.test（PLAYBACK_VOICES 4種のid・requiresLoading・ラベル、各idごとのTone.Sampler/PolySynth生成）。TASK-071で対応済み |
| REQ-013-002 | ○ | audio-engine.test（setPlaybackVoiceが旧Sampler/PolySynthをdisposeし新音色へ差し替え、loadScore済みTone.Partの再スケジュールなしで次発音から反映されることを検証）。TASK-071で対応済み |
| REQ-013-003 | ○ | audio-engine.test（ensurePlaybackVoiceLoadedがSampler onload/onerrorに応じて解決、synth系音色は即時解決、setVoiceLoadingCallbackのtrue/false通知）+ usePractice.test（store.playbackVoice→setPlaybackVoice結線、setVoiceLoadingCallback→ui-slice.voiceLoading結線）+ PlaybackControls.test（voiceLoading中は再生ボタン無効化・「読込中...」表示、audioEngine.playAccompaniment()の解決を待ってからplaybackStateを'playing'にする）+ App.test（playbackAudioEngineラッパーがensurePlaybackVoiceLoadedを内包）。TASK-073で対応済み |
| REQ-013-004 | ○ | metronome-voices.test（METRONOME_VOICES 4種のid・ラベル、各idごとのTone.Synth/MembraneSynth/MetalSynth生成）+ audio-engine.test（setMetronomeVoiceの差し替え結線）。TASK-072で対応済み |
| REQ-013-005 | ○ | metronome-voices.test（各音色のtrigger(time, accent, velocity)がアクセント有無で音高・音量を書き分けることを検証）。TASK-072で対応済み |
| REQ-013-006 | ○ | settings.test（DEFAULT_SETTINGS.audioの既定値、audioキー不在の既存設定ファイルへの後方互換マージ、settings:set/get往復）+ SettingsModal.test（音色selectの変更がui-slice即時反映＋settings:set永続化に到達、保存失敗時ロールバック）+ App.test（起動時にaudio.playbackVoice/metronomeVoiceをAudioEngineへ適用、キー欠落時は既定値維持）+ usePractice.test（store→audioEngine.setPlaybackVoice/setMetronomeVoice結線）。TASK-073で対応済み。「音色変更→アプリ再起動で選択が復元される」という実機での往復確認（electron-storeの実ファイル永続化を挟む）はユニット・結線レベルの検証にとどまり、TASK-077でも自動化しておらず、ユーザー実機確認待ち |
| REQ-013-007 | ○ | voices.test（import.meta.globで解決したSalamanderサンプルURLがシャープ表記ノート名へ正規化されることを検証） |
| REQ-013-008 | ○ | README（同梱音源クレジット節）+ AboutPanel.test（Salamander/Alexander Holm/CC-BY 3.0表示）+ credits.ts静的定義。TASK-076で対応済み |
| REQ-015-001 | ○ | AboutPanel.test（アプリ名・`__APP_VERSION__`・Apache License 2.0表示）+ E2E（実バイナリで設定モーダル→Aboutセクションのバージョン表示`v{package.jsonのversion}`とApache License 2.0リンクを検証、TASK-077で追加） |
| REQ-015-002 | ○ | AboutPanel.test（licenses.json由来のライブラリ一覧表示、モックで決定的に検証）+ generate-licenses.test（実データ生成のユニット検証）。TASK-076で対応済み |
| REQ-015-003 | ○ | AboutPanel.test（Salamander/Alexander Holm/CC-BY 3.0表示）+ credits.ts + E2E（実バイナリでSalamanderクレジット文言の表示を検証、TASK-077で追加）。TASK-076で対応済み |
| REQ-015-004 | ○ | generate-licenses.test（dependencies全件収集・devDependencies除外・LICENSE本文取得・SPDXフォールバック）+ 実行確認（licenses.json未生成状態からのnpm run dev/buildでpredev/prebuildフックが再生成することを確認）。TASK-076で対応済み |
| REQ-015-005 | ○ | AboutPanel.test（ライブラリ行クリックでlicenseTextが展開・再クリックで折りたたみ）。TASK-076で対応済み |

## Phase 17: セキュリティ強化（2026-07-11）の検証状況

2026-07-11のセキュリティ調査（重大な脆弱性なし・多層防御の改善推奨5件）に基づく修正フェーズ。
新規ユーザーストーリー・REQは追加していない（既存の非機能的なセキュリティ強化のため）ため、
上表への行追加ではなくフェーズ横断の検証状況としてここに記録する。

| タスク | 内容 | 検証 |
|---|---|---|
| TASK-086 | file:read系IPCの読み取りallowlist化 | ○ — `path-allowlist.test.ts`（`assertAllowedReadPath`の許可/拒否8ケース）+ `file-handlers.test.ts`（3ハンドラがモックfsへ到達する前にallowlist判定を通過することを検証、モック境界の結線テスト） |
| TASK-087 | openExternalスキーム検証・will-navigate・sandbox: true採用 | ○ — `navigation-policy.test.ts`（14ケース）+ TASK-090での`npm run test:e2e`全件通過（sandbox: true状態での実起動確認） |
| TASK-088 | E2E計装（`__e2eStore__`/`__e2eMidiHooks__`）の本番ビルド無効化 | ○ — `usePractice.test.ts`/`App.test.tsx`（isE2Eフラグでのガード）+ `tests/e2e/e2e-instrumentation-guard.spec.ts`（環境変数なし起動でundefinedであることを実起動検証）+ `tests/e2e/app.spec.ts`（KEYFLOW_E2E=1起動での結線検証） |
| TASK-089 | 開発依存の既知脆弱性解消（textlint 15系） | ○ — TASK-090での`npm audit`が0 vulnerabilitiesであることを再確認済み |
| TASK-090 | Phase 17統合検証・ドキュメント同期 | ○ — 本タスクで`npm run test`（777件）/`typecheck`/`lint`/`npm run test:e2e`（5件）/`npm audit`（0件）の全件通過を統合状態で確認 |

## 運用ルール

1. タスク完了時、対応するREQの行を更新する（△→○ 等）
2. 新規REQ追加時は本表に行を追加する
3. ×※（実装自体なし）の行は、対応タスクIDを備考に記載して追跡する
4. 「○」の基準: 実装ロジックのテストに加え、本体経路での結線または観測可能な結果（E2E）が検証されていること
