/**
 * 日本語リソース（TASK-096/097）。UI多言語対応（US-016）の構造のソースオブトゥルースであり、
 * `Messages`型（types.ts）はこのオブジェクトの構造から導出する。
 *
 * TASK-097でHeader・Toolbar・StatsDisplay・FingeringPanel・NoteContextMenu・
 * ScoreRendererの操作系文言をコンポーネント別の名前空間で追加した。
 * SettingsModal・AboutPanel・App.tsxのエラー文言はTASK-098で追加する。
 */
export const ja = {
  settings: {
    title: '設定',
    language: '言語',
  },
  header: {
    openFileAriaLabel: 'ファイルを開く',
    openFileTitle: 'MusicXMLファイルを開きます',
    quickPanelAriaLabel: '表示・補助',
    quickPanelTitle: '表示・補助（音量・表示倍率・運指・成績）',
    settingsAriaLabel: '設定',
    settingsTitle: '設定',
  },
  quickPanel: {
    displaySection: '表示',
    fingeringSection: '運指',
    statsSection: '成績',
    metronomeDetailSection: 'メトロノーム詳細',
  },
  metronome: {
    toggleLabel: 'メトロノーム',
    accentLabel: '1拍目強調',
    accentTitle: 'メトロノームの一拍目のクリック音を他拍より強く鳴らします',
  },
  playbackControls: {
    play: '再生',
    playTitle: '再生 (Space)',
    pause: '一時停止',
    pauseTitle: '一時停止 (Space)',
    stop: '停止',
    stopTitle: '停止',
    noScoreTooltip: '楽譜を開くと再生できます',
    voiceLoadingTooltip: '音色を読み込み中です',
    voiceLoadingLabel: '読込中...',
  },
  loopControl: {
    toggleTitle: 'ループ再生（指定した小節範囲の繰り返し）の有効/無効を切り替えます',
    toggleAriaLabel: 'ループ',
    startTitle: 'ループの開始小節番号',
    endTitle: 'ループの終了小節番号',
    errorInvalidValue: '無効な値',
    errorStartAfterEnd: '開始 < 終了',
  },
  tempoControl: {
    bpmIconTitle: 'テンポ（BPM: 1分あたりの拍数）',
    inputTitle: 'テンポをBPM（1分あたりの拍数）で直接指定します',
    sliderTitle: 'テンポ（原曲テンポに対する割合。20%〜200%）',
    resetTitle: 'テンポを楽譜本来のテンポに戻します',
    resetAriaLabel: 'テンポをリセット',
  },
  practiceModeSelector: {
    groupTitle: '練習対象（左手/右手/両手）を切り替えます。運指対象の選択とは別です',
    left: '左手 (L)',
    leftTitle: '左手のみを練習対象にします（ショートカット: L）',
    right: '右手 (R)',
    rightTitle: '右手のみを練習対象にします（ショートカット: R）',
    both: '両手 (B)',
    bothTitle: '両手を練習対象にします（ショートカット: B）',
  },
  volumeControl: {
    label: '音量:',
    title: '音量を調整します（0でミュート、再生・メトロノーム・効果音すべてに反映されます）',
  },
  zoomControl: {
    label: '表示倍率:',
    title: '楽譜の表示倍率を変更します',
  },
  fingeringToggle: {
    label: '運指',
    titleShow: '運指を表示します（楽譜・鍵盤上の指番号を一括で表示します）',
    titleHide: '運指を非表示にします（楽譜・鍵盤上の指番号を一括で隠します）',
    statusShown: '表示中',
    statusHidden: '非表示',
  },
  statsDisplay: {
    accuracyLabel: '正解率:',
    consecutiveLabel: '連続正解数:',
  },
  fingeringPanel: {
    handSelectLabel: '運指対象:',
    handOptionRight: '右手',
    handOptionLeft: '左手',
    handSelectTitle: '運指を計算する対象の手を選択します（練習対象パートの設定とは別です）',
    computeButton: '運指提案',
    noNotesError: '{hand}の音符が見つかりません',
  },
  noteContextMenu: {
    title: '運指メモ: {noteId}',
    fingerNumberLabel: '指番号',
    removeFingerButton: '指番号を削除',
    commentLabel: 'コメント',
    saveCommentButton: 'コメントを保存',
    approveButton: 'AI提案を承認',
    closeButton: '閉じる',
  },
  scoreRenderer: {
    placeholder: '楽譜ファイルを開いてください',
  },
} as const satisfies Record<string, Record<string, string>>;
