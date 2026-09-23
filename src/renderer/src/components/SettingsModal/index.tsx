import React, { useState, useEffect } from 'react';
import { AppSettings, ErrorMode } from '../../types';
import { usePracticeStore } from '../../store';
import type { WebMidiService } from '../../lib/midi/web-midi';
import { PLAYBACK_VOICES, type PlaybackVoiceId } from '../../lib/audio-engine/voices';
import { METRONOME_VOICES, type MetronomeVoiceId } from '../../lib/audio-engine/metronome-voices';
import { useTranslation } from '../../lib/i18n/useTranslation';
import type { Language, Messages } from '../../lib/i18n/types';
import { KfSelect } from '../KfSelect';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * MIDI入力デバイス一覧の取得元（REQ-004-008）。App.tsxのusePractice()が
   * 生成した実際のWebMidiServiceインスタンスを渡すことで、SettingsModalは
   * useMidi/practice-engineが受け取るのと同一のデバイス集合を表示できる。
   * 未指定時（テスト等）は「すべてのデバイス」のみを表示し、クラッシュしない。
   */
  webMidiService?: Pick<WebMidiService, 'getDevices'>;
}

type SettingsModalState = Pick<AppSettings, 'ui' | 'practice' | 'midi' | 'audio'>;

const DEFAULT_SETTINGS: SettingsModalState = {
  ui: {
    theme: 'light',
    language: 'auto',
    zoom: 1.0,
    pianoHeight: 120,
    volume: 80,
    showFingerings: true,
    keyboardSize: 88,
    scoreLayout: 'horizontal',
  },
  practice: { defaultErrorMode: 'wait', metronomeEnabled: false, metronomeAccentEnabled: true },
  midi: { selectedDeviceId: null, selectedDeviceIndex: 0 },
  audio: { playbackVoice: 'grand-piano', metronomeVoice: 'click' },
};

// 鍵盤数プリセットの選択肢（TASK-056）。key-layout.tsのKEYBOARD_PRESETSと
// 一致させる（プリセット範囲は一般的な電子キーボード製品を参考に採用した値であり、
// ユーザーの実機に合わせた調整が必要な場合はKEYBOARD_PRESETS側を調整する）。
// TASK-098: ラベルは文言外部化のため、翻訳リソースから都度組み立てる関数へ変更した。
function buildKeyboardSizeOptions(
  t: Messages
): ReadonlyArray<{ value: AppSettings['ui']['keyboardSize']; label: string }> {
  return [
    { value: 88, label: t.settings.keyboardSizeOption88 },
    { value: 76, label: t.settings.keyboardSizeOption76 },
    { value: 61, label: t.settings.keyboardSizeOption61 },
    { value: 49, label: t.settings.keyboardSizeOption49 },
  ];
}

// 音色ID（voices.ts/metronome-voices.ts側のドメイン定義）から表示層の翻訳キーへの
// マッピング（TASK-098）。ドメインのIDは変更せず、表示名のみ翻訳リソースの参照へ切り替える。
const PLAYBACK_VOICE_NAME_KEYS: Record<PlaybackVoiceId, keyof Messages['voiceNames']> = {
  'grand-piano': 'grandPiano',
  'electric-piano': 'electricPiano',
  organ: 'organ',
  synth: 'synth',
};
const METRONOME_VOICE_NAME_KEYS: Record<MetronomeVoiceId, keyof Messages['voiceNames']> = {
  click: 'click',
  woodblock: 'woodblock',
  beep: 'beep',
  cowbell: 'cowbell',
};

// 鍵盤の高さ（px）の妥当な範囲。ui-slice.setPianoHeightのクランプと一致させる
// （注意事項: 範囲を外れるとPianoKeyboardのレイアウトが崩れるため）。
const PIANO_HEIGHT_MIN = 80;
const PIANO_HEIGHT_MAX = 300;

function showSettingsError(message: string): void {
  window.alert(message);
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  webMidiService,
}) => {
  const t = useTranslation();
  const [settings, setSettings] = useState<SettingsModalState>(DEFAULT_SETTINGS);
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; openedAt: string }>>([]);
  const [midiDevices, setMidiDevices] = useState<Array<{ id: string; name: string }>>([]);
  const requestIdRef = React.useRef<number>(0);
  const keyboardSizeOptions = buildKeyboardSizeOptions(t);
  // TASK-098, REQ-016-003: 保存値が'auto'の間はセレクタに現在の解決結果（ja/en）を
  // 表示するが、ユーザーが明示選択するまでsettings.ui.language自体（'auto'）は
  // 上書きしない。表示専用の値であり、保存はupdateUiSetting呼び出し時のみ行う。
  const currentLanguage = usePracticeStore((s) => s.language);
  const languageSelectValue: Language =
    settings.ui.language === 'ja' || settings.ui.language === 'en' || settings.ui.language === 'zh'
      ? settings.ui.language
      : currentLanguage;

  useEffect(() => {
    if (isOpen) {
      const loadSettings = async (): Promise<void> => {
        try {
          const ui = await window.electronAPI.settings.get('ui');
          const practice = await window.electronAPI.settings.get('practice');
          const midi = await window.electronAPI.settings.get('midi');
          const audio = await window.electronAPI.settings.get('audio');
          const files = await window.electronAPI.settings.getRecentFiles();

          // PR #27 CodeRabbit指摘: electron-storeはネストオブジェクトを深くマージしない。
          // そのため`practice || DEFAULT_SETTINGS.practice`という全置換の
          // フォールバックでは、キー追加前に保存された既存オブジェクトの
          // 欠落キーを補完できない。例えばmetronomeAccentEnabled導入前の
          // practiceオブジェクトにはこのキーが存在しない。
          // ui/practice/midiのすべてをDEFAULT_SETTINGSとの浅いマージへ
          // 統一し、欠落キーを既定値で補う。
          setSettings({
            ui: { ...DEFAULT_SETTINGS.ui, ...(ui || {}) },
            practice: { ...DEFAULT_SETTINGS.practice, ...(practice || {}) },
            midi: { ...DEFAULT_SETTINGS.midi, ...(midi || {}) },
            audio: { ...DEFAULT_SETTINGS.audio, ...(audio || {}) },
          });
          setRecentFiles(files || []);
        } catch {
          setSettings(DEFAULT_SETTINGS);
          setRecentFiles([]);
          showSettingsError(t.settings.loadError);
        }
      };
      loadSettings();

      // MIDI入力デバイス一覧（REQ-004-008）。webMidiServiceが未指定の場合は
      // 「すべてのデバイス」のみを表示する（クラッシュしない）。
      setMidiDevices(webMidiService?.getDevices() ?? []);
    }
  }, [isOpen, webMidiService, t]);

  if (!isOpen) return null;

  const updateUiSetting = async <K extends keyof AppSettings['ui']>(
    key: K,
    value: AppSettings['ui'][K]
  ): Promise<void> => {
    const requestId = ++requestIdRef.current;

    // Save the previous state to revert to if the API call fails
    const previousValue = settings.ui[key];
    const previousPianoHeight = usePracticeStore.getState().pianoHeight;
    const previousKeyboardSize = usePracticeStore.getState().keyboardSize;
    const previousLanguage = usePracticeStore.getState().language;

    const updatedUi = { ...settings.ui, [key]: value };
    setSettings({ ...settings, ui: updatedUi });

    // 「鍵盤の高さ」の変更は、単一の真実源である ui-slice の pianoHeight へ
    // 即座に反映し、PianoKeyboardへ反映する（TASK-045。metronomeEnabledの
    // 既存パターン踏襲）。
    if (key === 'pianoHeight') {
      usePracticeStore.getState().setPianoHeight(value as number);
    }

    // 「鍵盤数」の変更は、単一の真実源である ui-slice の keyboardSize へ
    // 即座に反映し、PianoKeyboardの表示範囲（canvas幅・クリック座標→MIDI変換・
    // 範囲外インジケータ）へ反映する（TASK-056。pianoHeightと同一パターン）。
    if (key === 'keyboardSize') {
      usePracticeStore.getState().setKeyboardSize(value as AppSettings['ui']['keyboardSize']);
    }

    // 「言語」の変更は、単一の真実源である ui-slice の language へ即座に反映する
    // （TASK-098、REQ-016-003。pianoHeight/keyboardSizeと同一パターン）。
    // セレクタの選択肢は'ja'/'en'のみのため、渡される値は常にLanguageに収まる。
    if (key === 'language') {
      usePracticeStore.getState().setLanguage(value as Language);
    }

    try {
      await window.electronAPI.settings.set('ui', updatedUi);
    } catch {
      // Only rollback if this is still the latest request
      if (requestId === requestIdRef.current) {
        setSettings((currentSettings) => ({
          ...currentSettings,
          ui: { ...currentSettings.ui, [key]: previousValue },
        }));
        if (key === 'pianoHeight') {
          usePracticeStore.getState().setPianoHeight(previousPianoHeight);
        }
        if (key === 'keyboardSize') {
          usePracticeStore.getState().setKeyboardSize(previousKeyboardSize);
        }
        if (key === 'language') {
          usePracticeStore.getState().setLanguage(previousLanguage);
        }
        showSettingsError(t.settings.saveError);
      }
    }
  };

  const updatePracticeSetting = async <K extends keyof AppSettings['practice']>(
    key: K,
    value: AppSettings['practice'][K]
  ): Promise<void> => {
    const requestId = ++requestIdRef.current;

    // Save the previous state to revert to if the API call fails
    const previousValue = settings.practice[key];
    const previousMetronomeEnabled = usePracticeStore.getState().metronomeEnabled;
    const previousMetronomeAccentEnabled = usePracticeStore.getState().metronomeAccentEnabled;
    const previousErrorMode = usePracticeStore.getState().errorMode;

    const updatedPractice = { ...settings.practice, [key]: value };
    setSettings({ ...settings, practice: updatedPractice });

    // 「既定でメトロノームを有効にする」の変更は、単一の真実源である ui-slice の
    // metronomeEnabled へ即座に反映し、ツールバーのチェックボックスへ反映する。
    if (key === 'metronomeEnabled') {
      usePracticeStore.getState().setMetronomeEnabled(value as boolean);
    }

    // 「既定で1拍目を強調する」の変更は、単一の真実源である ui-slice の
    // metronomeAccentEnabled へ即座に反映する（TASK-063、metronomeEnabledの
    // 既存パターン踏襲）。
    if (key === 'metronomeAccentEnabled') {
      usePracticeStore.getState().setMetronomeAccentEnabled(value as boolean);
    }

    // 「既定のエラーモード」の変更は、practice-slice の errorMode へ即座に反映する
    // （TASK-040: 設定UI→storeの結線がないと practice-engine の 'pass' 分岐が
    // 本番経路で到達不能になる）。
    if (key === 'defaultErrorMode') {
      usePracticeStore.getState().setErrorMode(value as ErrorMode);
    }

    try {
      await window.electronAPI.settings.set('practice', updatedPractice);
    } catch {
      // Only rollback if this is still the latest request
      if (requestId === requestIdRef.current) {
        setSettings((currentSettings) => ({
          ...currentSettings,
          practice: { ...currentSettings.practice, [key]: previousValue },
        }));
        if (key === 'metronomeEnabled') {
          usePracticeStore.getState().setMetronomeEnabled(previousMetronomeEnabled);
        }
        if (key === 'metronomeAccentEnabled') {
          usePracticeStore.getState().setMetronomeAccentEnabled(previousMetronomeAccentEnabled);
        }
        if (key === 'defaultErrorMode') {
          usePracticeStore.getState().setErrorMode(previousErrorMode);
        }
        showSettingsError(t.settings.saveError);
      }
    }
  };

  // MIDI入力デバイスの選択（REQ-004-008）。`deviceId` が null の場合は
  // 「すべてのデバイス」を意味する。metronomeEnabled/defaultErrorModeと同じ
  // 即時反映＋保存失敗時ロールバックのパターンに揃える（TASK-040踏襲）。
  const updateMidiDevice = async (deviceId: string | null): Promise<void> => {
    const requestId = ++requestIdRef.current;

    const previousDeviceId = settings.midi.selectedDeviceId;
    const previousStoreDeviceId = usePracticeStore.getState().midiDeviceId;

    const updatedMidi = { ...settings.midi, selectedDeviceId: deviceId };
    setSettings({ ...settings, midi: updatedMidi });
    usePracticeStore.getState().setMidiDeviceId(deviceId);

    try {
      await window.electronAPI.settings.set('midi', updatedMidi);
    } catch {
      if (requestId === requestIdRef.current) {
        setSettings((currentSettings) => ({
          ...currentSettings,
          midi: { ...currentSettings.midi, selectedDeviceId: previousDeviceId },
        }));
        usePracticeStore.getState().setMidiDeviceId(previousStoreDeviceId);
        showSettingsError(t.settings.saveError);
      }
    }
  };

  // 音色設定（再生音色・メトロノーム音色）の変更（TASK-073、US-013）。
  // metronomeEnabled/defaultErrorModeと同じ即時反映＋保存失敗時ロールバックの
  // パターンに揃える。ui-slice側の値変更はusePractice.tsのuseEffectが
  // AudioEngineService.setPlaybackVoice/setMetronomeVoiceへ反映する。
  // store→AudioEngineの同期経路は単一であり、bpm/metronomeEnabled等と同じ設計。
  const updateAudioSetting = async <K extends keyof AppSettings['audio']>(
    key: K,
    value: AppSettings['audio'][K]
  ): Promise<void> => {
    const requestId = ++requestIdRef.current;

    const previousValue = settings.audio[key];
    const previousPlaybackVoice = usePracticeStore.getState().playbackVoice;
    const previousMetronomeVoice = usePracticeStore.getState().metronomeVoice;

    const updatedAudio = { ...settings.audio, [key]: value };
    setSettings({ ...settings, audio: updatedAudio });

    if (key === 'playbackVoice') {
      usePracticeStore.getState().setPlaybackVoice(value as AppSettings['audio']['playbackVoice']);
    }
    if (key === 'metronomeVoice') {
      usePracticeStore
        .getState()
        .setMetronomeVoice(value as AppSettings['audio']['metronomeVoice']);
    }

    try {
      await window.electronAPI.settings.set('audio', updatedAudio);
    } catch {
      if (requestId === requestIdRef.current) {
        setSettings((currentSettings) => ({
          ...currentSettings,
          audio: { ...currentSettings.audio, [key]: previousValue },
        }));
        if (key === 'playbackVoice') {
          usePracticeStore.getState().setPlaybackVoice(previousPlaybackVoice);
        }
        if (key === 'metronomeVoice') {
          usePracticeStore.getState().setMetronomeVoice(previousMetronomeVoice);
        }
        showSettingsError(t.settings.saveError);
      }
    }
  };

  return (
    <div className="kf-settings-overlay">
      <div className="kf-settings-card">
        {/* Header */}
        <header className="kf-settings-header">
          <h2 className="kf-settings-header__brand">
            <span className="kf-settings-header__icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            {t.settings.title}
          </h2>
          <div className="kf-settings-header__spacer" />
          <button
            onClick={onClose}
            aria-label={t.settings.closeButtonAriaLabel}
            className="kf-icon-btn"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* Content */}
        <div className="kf-settings-body">
          {/* Practice Settings */}
          <section className="kf-settings-section kf-settings-card-panel">
            <h3 className="kf-settings-label">{t.settings.practiceSectionTitle}</h3>

            <div className="kf-settings-field">
              <label htmlFor="errorMode" className="kf-settings-field__label">
                {t.settings.errorModeLabel}
              </label>
              <KfSelect
                id="errorMode"
                value={settings.practice.defaultErrorMode}
                onChange={(value) =>
                  updatePracticeSetting(
                    'defaultErrorMode',
                    value as AppSettings['practice']['defaultErrorMode']
                  )
                }
                options={[
                  { value: 'wait', label: t.settings.errorModeWait },
                  { value: 'pass', label: t.settings.errorModePass },
                ]}
                style={{ width: '100%' }}
              />
            </div>

            <div className="kf-settings-checks">
              <label htmlFor="metronomeEnabled" className="kf-settings-check kf-settings-check--card">
                <input
                  id="metronomeEnabled"
                  type="checkbox"
                  checked={settings.practice.metronomeEnabled}
                  onChange={(e) => updatePracticeSetting('metronomeEnabled', e.target.checked)}
                  className="kf-check"
                />
                {t.settings.metronomeEnabledLabel}
              </label>

              <label
                htmlFor="metronomeAccentEnabled"
                className="kf-settings-check kf-settings-check--card"
              >
                <input
                  id="metronomeAccentEnabled"
                  type="checkbox"
                  checked={settings.practice.metronomeAccentEnabled}
                  onChange={(e) =>
                    updatePracticeSetting('metronomeAccentEnabled', e.target.checked)
                  }
                  className="kf-check"
                />
                {t.settings.metronomeAccentEnabledLabel}
              </label>
            </div>
          </section>

          {/* Display Settings (TASK-045) */}
          <section className="kf-settings-section kf-settings-card-panel">
            <h3 className="kf-settings-label">{t.settings.displaySectionTitle}</h3>

            <div className="kf-settings-field">
              <label htmlFor="pianoHeight" className="kf-settings-field__label">
                {t.settings.pianoHeightLabel}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  id="pianoHeight"
                  type="range"
                  min={PIANO_HEIGHT_MIN}
                  max={PIANO_HEIGHT_MAX}
                  value={settings.ui.pianoHeight}
                  onChange={(e) => updateUiSetting('pianoHeight', Number(e.target.value))}
                  title={t.settings.pianoHeightTitle}
                  className="kf-range"
                  style={{ flex: 1, width: 'auto' }}
                />
                <span className="kf-settings-field__value">
                  {settings.ui.pianoHeight}px
                </span>
              </div>
            </div>

            <div className="kf-settings-grid">
              <div className="kf-settings-field">
                <label htmlFor="keyboardSize" className="kf-settings-field__label">
                  {t.settings.keyboardSizeLabel}
                </label>
                <KfSelect
                  id="keyboardSize"
                  value={String(settings.ui.keyboardSize)}
                  onChange={(value) =>
                    updateUiSetting(
                      'keyboardSize',
                      Number(value) as AppSettings['ui']['keyboardSize']
                    )
                  }
                  title={t.settings.keyboardSizeTitle}
                  options={keyboardSizeOptions.map((option) => ({
                    value: String(option.value),
                    label: option.label,
                  }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="kf-settings-field">
                <label htmlFor="language" className="kf-settings-field__label">
                  {t.settings.language}
                </label>
                <KfSelect
                  id="language"
                  value={languageSelectValue}
                  onChange={(value) =>
                    updateUiSetting('language', value as AppSettings['ui']['language'])
                  }
                  title={t.settings.languageTitle}
                  options={[
                    { value: 'ja', label: t.settings.languageOptionJapanese },
                    { value: 'en', label: t.settings.languageOptionEnglish },
                    { value: 'zh', label: t.settings.languageOptionChinese },
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </section>

          {/* MIDI Settings (TASK-045, REQ-004-008) */}
          <section className="kf-settings-section kf-settings-card-panel">
            <h3 className="kf-settings-label">{t.settings.midiSectionTitle}</h3>

            <div className="kf-settings-field">
              <label htmlFor="midiDevice" className="kf-settings-field__label">
                {t.settings.midiDeviceLabel}
              </label>
              <KfSelect
                id="midiDevice"
                value={settings.midi.selectedDeviceId ?? ''}
                onChange={(value) => updateMidiDevice(value === '' ? null : value)}
                title={t.settings.midiDeviceTitle}
                options={[
                  { value: '', label: t.settings.midiAllDevices },
                  ...midiDevices.map((device) => ({ value: device.id, label: device.name })),
                ]}
                style={{ width: '100%' }}
              />
            </div>
          </section>

          {/* Voice Settings (TASK-073, US-013) */}
          <section className="kf-settings-section kf-settings-card-panel">
            <h3 className="kf-settings-label">{t.settings.voiceSectionTitle}</h3>

            <div className="kf-settings-grid">
              <div className="kf-settings-field">
                <label htmlFor="playbackVoice" className="kf-settings-field__label">
                  {t.settings.playbackVoiceLabel}
                </label>
                <KfSelect
                  id="playbackVoice"
                  value={settings.audio.playbackVoice}
                  onChange={(value) =>
                    updateAudioSetting(
                      'playbackVoice',
                      value as AppSettings['audio']['playbackVoice']
                    )
                  }
                  title={t.settings.playbackVoiceTitle}
                  options={Object.values(PLAYBACK_VOICES).map((voice) => ({
                    value: voice.id,
                    label: t.voiceNames[PLAYBACK_VOICE_NAME_KEYS[voice.id]],
                  }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="kf-settings-field">
                <label htmlFor="metronomeVoice" className="kf-settings-field__label">
                  {t.settings.metronomeVoiceLabel}
                </label>
                <KfSelect
                  id="metronomeVoice"
                  value={settings.audio.metronomeVoice}
                  onChange={(value) =>
                    updateAudioSetting(
                      'metronomeVoice',
                      value as AppSettings['audio']['metronomeVoice']
                    )
                  }
                  title={t.settings.metronomeVoiceTitle}
                  options={Object.values(METRONOME_VOICES).map((voice) => ({
                    value: voice.id,
                    label: t.voiceNames[METRONOME_VOICE_NAME_KEYS[voice.id]],
                  }))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </section>

          {/* Recent Files */}
          <section className="kf-settings-section kf-settings-card-panel">
            <h3 className="kf-settings-label">{t.settings.recentFilesSectionTitle}</h3>
            {recentFiles.length === 0 ? (
              <p style={{ fontSize: '13.5px', color: 'var(--kf-text-3)', fontStyle: 'italic' }}>
                {t.settings.recentFilesEmpty}
              </p>
            ) : (
              <ul className="kf-settings-list">
                {recentFiles.map((file, idx) => {
                  const parts = file.path.split(/[\\/]/);
                  const filename = parts[parts.length - 1];
                  const date = new Date(file.openedAt).toLocaleDateString();
                  return (
                    <li key={idx}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          overflow: 'hidden',
                          paddingRight: '16px',
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ color: 'var(--kf-text-4)', flexShrink: 0 }}
                          aria-hidden="true"
                        >
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 550,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={file.path}
                          >
                            {filename}
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--kf-text-3)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {file.path}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--kf-text-4)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {date}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="kf-settings-footer">
          <button type="button" onClick={onClose} className="kf-btn">
            {t.settings.cancelButton}
          </button>
          <button type="button" onClick={onClose} className="kf-btn kf-btn--primary">
            {t.settings.saveButton}
          </button>
        </footer>
      </div>
    </div>
  );
};
