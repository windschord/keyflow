import type { Messages } from './types';

/**
 * 英語リソース（TASK-096/097）。`Messages`型（`ja`の構造から導出）への適合を
 * 型チェックで強制する。キーの欠落・タイポはコンパイルエラーになる（DEC-009）。
 */
export const en: Messages = {
  settings: {
    title: 'Settings',
    language: 'Language',
  },
  header: {
    openFileAriaLabel: 'Open file',
    openFileTitle: 'Open a MusicXML file',
    quickPanelAriaLabel: 'View & tools',
    quickPanelTitle: 'View & tools (volume, zoom, fingering, stats)',
    settingsAriaLabel: 'Settings',
    settingsTitle: 'Settings',
  },
  quickPanel: {
    displaySection: 'Display',
    fingeringSection: 'Fingering',
    statsSection: 'Stats',
    metronomeDetailSection: 'Metronome details',
  },
  metronome: {
    toggleLabel: 'Metronome',
    accentLabel: 'Accent 1st beat',
    accentTitle: 'Play the first beat of the metronome louder than the others',
  },
  playbackControls: {
    play: 'Play',
    playTitle: 'Play (Space)',
    pause: 'Pause',
    pauseTitle: 'Pause (Space)',
    stop: 'Stop',
    stopTitle: 'Stop',
    noScoreTooltip: 'Open a score to play',
    voiceLoadingTooltip: 'Loading voice...',
    voiceLoadingLabel: 'Loading...',
  },
  loopControl: {
    toggleTitle: 'Toggle loop playback (repeats the specified measure range)',
    toggleAriaLabel: 'Loop',
    startTitle: 'Loop start measure number',
    endTitle: 'Loop end measure number',
    errorInvalidValue: 'Invalid value',
    errorStartAfterEnd: 'Start < End',
  },
  tempoControl: {
    bpmIconTitle: 'Tempo (BPM: beats per minute)',
    inputTitle: 'Set the tempo directly in BPM (beats per minute)',
    sliderTitle: 'Tempo (percentage of the original tempo, 20%-200%)',
    resetTitle: 'Reset the tempo to the score original tempo',
    resetAriaLabel: 'Reset tempo',
  },
  practiceModeSelector: {
    groupTitle:
      'Switch the practice target (left/right/both hands). Separate from the fingering target selection',
    left: 'Left (L)',
    leftTitle: 'Practice the left hand only (shortcut: L)',
    right: 'Right (R)',
    rightTitle: 'Practice the right hand only (shortcut: R)',
    both: 'Both (B)',
    bothTitle: 'Practice both hands (shortcut: B)',
  },
  volumeControl: {
    label: 'Volume:',
    title: 'Adjust the master volume (0 mutes playback, metronome, and sound effects)',
  },
  zoomControl: {
    label: 'Zoom:',
    title: 'Change the score display zoom level',
  },
  fingeringToggle: {
    label: 'Fingering',
    titleShow: 'Show fingering numbers on the score and keyboard',
    titleHide: 'Hide fingering numbers on the score and keyboard',
    statusShown: 'Shown',
    statusHidden: 'Hidden',
  },
  statsDisplay: {
    accuracyLabel: 'Accuracy:',
    consecutiveLabel: 'Streak:',
  },
  fingeringPanel: {
    handSelectLabel: 'Fingering target:',
    handOptionRight: 'Right hand',
    handOptionLeft: 'Left hand',
    handSelectTitle:
      'Select the hand to compute fingering for (separate from the practice target setting)',
    computeButton: 'Suggest fingering',
    noNotesError: '{hand}: no notes found',
  },
  noteContextMenu: {
    title: 'Fingering note: {noteId}',
    fingerNumberLabel: 'Finger number',
    removeFingerButton: 'Remove finger number',
    commentLabel: 'Comment',
    saveCommentButton: 'Save comment',
    approveButton: 'Approve AI suggestion',
    closeButton: 'Close',
  },
  scoreRenderer: {
    placeholder: 'Open a score file to begin',
  },
};
