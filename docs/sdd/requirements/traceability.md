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
| REQ-002-007 | ○ | osmd-controller.test（note単位グレーアウトのoverlay描画）+ ScoreRenderer.test（practiceMode right/left/bothごとのsetGrayedOutNotes結線をアサート）。TASK-046で対応済み。TASK-048でパート単位(setPartOpacity)からNote.hand単位(setGrayedOutNotes)へ変更し、1パート2段譜でも検証。TASK-049でnoteIdの照合ベース化・リサイズ/setZoom時のマップ再構築によりグレーアウト座標のstale化を解消（osmd-controller.testでrender→buildNoteIdMap→reapplyOverlaysの呼び出し順序を検証） |
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
| REQ-005-001/002 | ○ | PianoKeyboard.test（keyboard-renderer.tsのfillStyleアサーション）。Note.hand（parser算出済み、TASK-048でPart.hand単位からNote単位に変更）に基づきguidRight/guidLeft色を検証。partId文字列ヒューリスティックのバグを修正（TASK-041）。1パート2段譜（同一partId・staff違い）の色分けも検証（TASK-048） |
| REQ-005-003/004 | △ | ロジックは○、鍵盤描画は× |
| REQ-005-005 | △ | getNotePosition範囲外throwのみ |
| REQ-005-006 | ○ | usePractice.test（handleKeyClickがaudioEngine.playNote(midiNumber)を呼ぶことを検証）+ 従来通りの正誤判定・note-offスケジュール検証。TASK-047で対応済み |
| REQ-005-007 | ○ | PianoKeyboard.test（実描画関数への座標アサーション）。TASK-055で運指の一括表示/非表示トグル追加。App.test（showFingerings=false時にPianoKeyboardへ空のannotationsが渡ることを結線検証、ONで復元） |
| REQ-006-001 | ○ | parser + practice-flow.test（App経路） |
| REQ-006-002 | ○ | Toolbar.test + App.test + audio-engine.test |
| REQ-006-003 | ○ | ui-slice.test（setBpmがoriginalBpm比20%-200%でクランプ、境界値含む）+ Toolbar.test（BPM入力の実クランプ挙動）+ TempoControl（title文言とUI表示範囲を比率ベースへ統一）。TASK-046で対応済み |
| REQ-006-004 | × | ピッチ不変（Tone.js委譲） |
| REQ-006-005 | ○ | audio-engine.test（TASK-042）。metronome.tsからTransport.start()を削除し、setEnabled(true)はSequence.start(0)のみでTransportライフサイクルは再生コントロール側に一本化 |
| REQ-006-006 | ○ | Toolbar.test |
| REQ-006-007 | △ | parserのtempoMapは○。再生時のテンポ変化再現は無検証 |
| REQ-007-001/002 | △ | practice-engine.test + audio-engine setLoopPoints。App/E2E経路のループなし |
| REQ-007-003 | ×※ | ドラッグ選択未実装 |
| REQ-007-004 | ×※ | ループ回数カウンターUI未実装 |
| REQ-007-005 | ×※ | 自動解除（将来予定と明記済み・意図的） |
| REQ-007-006 | △ | store toggleLoopのみ |
| REQ-008-001 | ○ | osmd-controller.test（contextmenu座標→noteId解決）+ NoteContextMenu.test（指番号1-5選択）+ ScoreRenderer.test（結線）+ App.test（右クリック→setFinger→save統合）。TASK-044で対応済み |
| REQ-008-002 | ○ | ScoreRenderer.test（annotations→showFingerings、isApproved色分け含む）。TASK-044で対応済み。TASK-049でnoteIdの照合ベース化（多声部・2段譜での誤対応解消）とリサイズ/setZoom時の再構築により、運指番号の座標stale化を解消。TASK-050で和音（同一カーソル位置の複数構成音）を音高順の縦オフセットで重ならず描画することをosmd-controller.testで検証。TASK-055で運指の一括表示/非表示トグル追加。App.test（showFingerings=false時にScoreRendererへ空のannotationsが渡りfingering-layerが消えること、ONで即復元されること、運指提案実行時にOFFなら自動でONへ戻ることを結線検証）+ ui-slice.test（showFingerings/setShowFingerings）+ FingeringToggle.test（トグルUI・永続化） |
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
| REQ-010-005 | ○ | audio-engine schedule + 結線 + practice-engine + E2E poll（模範パターン） |
| REQ-010-006 | △ | setBpmチェーンは○、再生中の即時反映は未検証 |
| REQ-010-007 | ○ | practice-engine.test |
| REQ-010-008 | △ | setLoopPointsユニット+結線。実ループは代理指標 |
| REQ-010-009 | ○ | audio-engine.test（setMasterVolumeのdB変換・ミュート・境界値）+ ui-slice.test（volume/setVolumeクランプ）+ VolumeControl.test（スライダー操作・ラベル・ツールチップ・electron-store永続化）+ usePractice.test（store→audioEngine同期）+ App.test（起動時ロード）。TASK-052で対応済み |
| REQ-010-010 | ○ | audio-engine.test（loadScoreがpracticeMode='left'/'right'/'both'でスケジュール対象ノーツをNote.hand基準に絞り込むことを検証、カーソル連動スケジュールはpracticeModeに関わらず不変であることも検証）+ usePractice.test（score/practiceMode変更時にaudioEngine.loadScoreを再スケジュールし、再生中の変更は停止することを検証）。TASK-051で対応済み |

## 運用ルール

1. タスク完了時、対応するREQの行を更新する（△→○ 等）
2. 新規REQ追加時は本表に行を追加する
3. ×※（実装自体なし）の行は、対応タスクIDを備考に記載して追跡する
4. 「○」の基準: 実装ロジックのテストに加え、本体経路での結線または観測可能な結果（E2E）が検証されていること
