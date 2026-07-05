# 要件トレーサビリティ表（REQ → テスト）

2026-07-05のテスト妥当性検査で作成。タスク完了時に対応行を更新すること。

凡例: ○=十分（実装テスト＋結線＋観測可能な結果のいずれかで要件を検証） / △=部分的（ロジックのみ・結線未検証など） / ×=検証なし / ※=実装自体が存在しない

| REQ | 検証 | 検証箇所 / 備考 |
|---|---|---|
| REQ-001-001 | △ | parser.test / E2E表示。「5秒以内」の性能検証なし |
| REQ-001-002 | △ | App.test（エラーダイアログ）。「前の状態維持」未アサート |
| REQ-001-003 | ○ | parser.test hand-detector / 統合テスト |
| REQ-001-004 | ○ | parser.test（tempo/time/key、tempoMap含む） |
| REQ-001-005 | × | MusicXML 3.1準拠スイートなし |
| REQ-001-006 | ○ | file-handlers.test（createShowOpenDialogHandlerがaddRecentFileを呼ぶ結線を検証）。TASK-039で対応済み |
| REQ-002-001 | △ | E2E: svg可視のみ |
| REQ-002-002 | × | OSMD委譲、無検証 |
| REQ-002-003 | △ | osmd-controller.test（scrollIntoView、モック）+ E2Eカーソル移動 |
| REQ-002-004 | △ | osmd-controller.test + ScoreRenderer.test。E2Eクリックなし |
| REQ-002-005 | × | showFingerings テストゼロ |
| REQ-002-006 | ○ | ZoomControl.test（Toolbar常設、Japanese label・値反映）+ Toolbar.test（統合）+ ScoreRenderer/osmd-controller.test（zoom prop→setZoom結線、既存）+ E2E（`zoom-select`のUI操作でストアのzoomが変わることを検証、store直接呼び出しを廃止）。TASK-045で対応済み |
| REQ-002-007 | △ | osmd-controller.test（overlay描画）。ScoreRenderer結線は未アサート（TASK-046） |
| REQ-003-001〜003 | ○ | practice-engine.test（モードフィルタ、スキップ） |
| REQ-003-004 | ×※ | 非練習パート自動伴奏が未実装。TASK-047で要件再整理 |
| REQ-003-005 | × | モード切替時の位置維持: 無検証 |
| REQ-004-001 | △ | web-midi.test初期化のみ。ホットプラグ未検証 |
| REQ-004-002 | × | 10ms以内のレイテンシ検証なし |
| REQ-004-003 | ○ | practice-engine + usePractice + osmd-controller + E2E |
| REQ-004-004 | ○ | 同上 |
| REQ-004-005 | △ | 正解率statsは○。タイミング記録は無検証 |
| REQ-004-006 | ○ | practice-slice.test（setErrorMode）+ SettingsModal.test（変更即時反映・ロールバック）+ App.test（起動時ロード）+ practice-flow.test（SettingsModal→store→practice-engineのUI→store→engine結線）。TASK-040で対応済み |
| REQ-004-007 | △ | handleKeyClick（モック経由）。座標→MIDI変換未検証 |
| REQ-004-008 | ○ | web-midi.test（setSelectedDeviceによる選択デバイスのみバインド・未接続時フォールバック）+ SettingsModal.test（デバイス一覧表示・選択・保存・ロールバック）+ useMidi.test（storeのmidiDeviceId→WebMidiService.setSelectedDeviceの結線、起動時反映）+ App.test（起動時ロード）。TASK-045で対応済み |
| REQ-005-001/002 | ○ | PianoKeyboard.test（keyboard-renderer.tsのfillStyleアサーション）。Part.hand（parser算出済み）に基づきguidRight/guidLeft色を検証。partId文字列ヒューリスティックのバグを修正（TASK-041） |
| REQ-005-003/004 | △ | ロジックは○、鍵盤描画は× |
| REQ-005-005 | △ | getNotePosition範囲外throwのみ |
| REQ-005-006 | △※ | 「その音を再生」が未実装（TASK-047で整理） |
| REQ-005-007 | ○ | PianoKeyboard.test（実描画関数への座標アサーション） |
| REQ-006-001 | ○ | parser + practice-flow.test（App経路） |
| REQ-006-002 | ○ | Toolbar.test + App.test + audio-engine.test |
| REQ-006-003 | △ | 実装が絶対値20-400クランプで要件（元テンポ比20-200%）と不一致（TASK-046） |
| REQ-006-004 | × | ピッチ不変（Tone.js委譲） |
| REQ-006-005 | ○ | audio-engine.test（TASK-042）。metronome.tsからTransport.start()を削除し、setEnabled(true)はSequence.start(0)のみでTransportライフサイクルは再生コントロール側に一本化 |
| REQ-006-006 | ○ | Toolbar.test |
| REQ-006-007 | △ | parserのtempoMapは○。再生時のテンポ変化再現は無検証 |
| REQ-007-001/002 | △ | practice-engine.test + audio-engine setLoopPoints。App/E2E経路のループなし |
| REQ-007-003 | ×※ | ドラッグ選択未実装 |
| REQ-007-004 | ×※ | ループ回数カウンターUI未実装 |
| REQ-007-005 | ×※ | 自動解除（将来予定と明記済み・意図的） |
| REQ-007-006 | △ | store toggleLoopのみ |
| REQ-008-001 | ×※ | 右クリック運指入力UIが存在しない（TASK-044） |
| REQ-008-002 | × | showFingeringsテストゼロ |
| REQ-008-003 | △※ | setCommentユニットのみ。コメントUIなし（TASK-044） |
| REQ-008-004 | ○ | annotation-store.test + path-allowlist.test + App結線 |
| REQ-008-005 | △ | load（validNoteIdsフィルタ）は○。App結線未アサート |
| REQ-008-006 | △※ | removeFingerユニットのみ。削除UIなし（TASK-044） |
| REQ-009-001 | △ | dp-solver + service（モックWorker）。実Worker未検証 |
| REQ-009-002 | △ | 左手固有の検証なし |
| REQ-009-003 | × | プログレスバー表示未検証 |
| REQ-009-004 | × | showFingerings未検証 |
| REQ-009-005 | △※ | approveAnnotationユニットのみ。承認UIなし（TASK-044） |
| REQ-009-006 | ×※ | 個別上書きUIなし（TASK-044） |
| REQ-009-007 | △ | モックWorkerのみ |
| REQ-009-A01 | △ | dp-solver.test（アサーション弱い） |
| REQ-009-A02 | △ | spanCostユニット○、DP統合は弱い |
| REQ-009-A03 | × | thumbPassingCost実装済み・テストゼロ（TASK-046） |
| REQ-009-A04 | × | fiveOnBlackCost実装済み・テストゼロ（TASK-046） |
| REQ-009-A05 | △※ | 手の大きさ設定UIなし。DPテストは空虚 |
| REQ-009-A06 | ○ | computeFingering内でapplyScalePatternを優先適用済み（dp-solver.test、TASK-043） |
| REQ-010-001 | ○ | audio-engine.test（loadScoreスケジューリング）+ E2E |
| REQ-010-002 | ×※ | 未読込時の再生無効化＋理由ツールチップ未実装（TASK-047で整理） |
| REQ-010-003 | △ | 状態遷移＋ユニット。実機聴感は不可 |
| REQ-010-004 | ○ | usePractice結線 + audio-engine setOnStop + E2E（模範パターン） |
| REQ-010-005 | ○ | audio-engine schedule + 結線 + practice-engine + E2E poll（模範パターン） |
| REQ-010-006 | △ | setBpmチェーンは○、再生中の即時反映は未検証 |
| REQ-010-007 | ○ | practice-engine.test |
| REQ-010-008 | △ | setLoopPointsユニット+結線。実ループは代理指標 |

## 運用ルール

1. タスク完了時、対応するREQの行を更新する（△→○ 等）
2. 新規REQ追加時は本表に行を追加する
3. ×※（実装自体なし）の行は、対応タスクIDを備考に記載して追跡する
4. 「○」の基準: 実装ロジックのテストに加え、本体経路での結線または観測可能な結果（E2E）が検証されていること
