import React, { useState, useEffect } from 'react';
import { AppSettings, ErrorMode } from '../../types';
import { usePracticeStore } from '../../store';
import type { WebMidiService } from '../../lib/midi/web-midi';
import { PLAYBACK_VOICES } from '../../lib/audio-engine/voices';
import { METRONOME_VOICES } from '../../lib/audio-engine/metronome-voices';

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
    language: 'ja',
    zoom: 1.0,
    pianoHeight: 120,
    volume: 80,
    showFingerings: true,
    keyboardSize: 88,
  },
  practice: { defaultErrorMode: 'wait', metronomeEnabled: false, metronomeAccentEnabled: true },
  midi: { selectedDeviceId: null, selectedDeviceIndex: 0 },
  audio: { playbackVoice: 'grand-piano', metronomeVoice: 'click' },
};

// 鍵盤数プリセットの選択肢（TASK-056）。key-layout.tsのKEYBOARD_PRESETSと
// 一致させる（プリセット範囲は一般的な電子キーボード製品を参考に採用した値であり、
// ユーザーの実機に合わせた調整が必要な場合はKEYBOARD_PRESETS側を調整する）。
const KEYBOARD_SIZE_OPTIONS: ReadonlyArray<{
  value: AppSettings['ui']['keyboardSize'];
  label: string;
}> = [
  { value: 88, label: '88鍵（フルサイズピアノ）' },
  { value: 76, label: '76鍵' },
  { value: 61, label: '61鍵' },
  { value: 49, label: '49鍵' },
];

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
  const [settings, setSettings] = useState<SettingsModalState>(DEFAULT_SETTINGS);
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; openedAt: string }>>([]);
  const [midiDevices, setMidiDevices] = useState<Array<{ id: string; name: string }>>([]);
  const requestIdRef = React.useRef<number>(0);

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
          showSettingsError('設定の読み込みに失敗しました。既定値で表示します。');
        }
      };
      loadSettings();

      // MIDI入力デバイス一覧（REQ-004-008）。webMidiServiceが未指定の場合は
      // 「すべてのデバイス」のみを表示する（クラッシュしない）。
      setMidiDevices(webMidiService?.getDevices() ?? []);
    }
  }, [isOpen, webMidiService]);

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
        showSettingsError('設定の保存に失敗しました。変更を元に戻しました。');
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
        showSettingsError('設定の保存に失敗しました。変更を元に戻しました。');
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
        showSettingsError('設定の保存に失敗しました。変更を元に戻しました。');
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
        showSettingsError('設定の保存に失敗しました。変更を元に戻しました。');
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#fff',
          color: '#111827',
          borderRadius: '8px',
          minWidth: '400px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>設定</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6b7280',
            }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Practice Settings */}
          <section style={{ marginBottom: '24px' }}>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              練習
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor="errorMode"
                  style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px' }}
                >
                  既定のエラーモード
                </label>
                <select
                  id="errorMode"
                  value={settings.practice.defaultErrorMode}
                  onChange={(e) =>
                    updatePracticeSetting(
                      'defaultErrorMode',
                      e.target.value as AppSettings['practice']['defaultErrorMode']
                    )
                  }
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                  }}
                >
                  <option value="wait">正しい音を待つ</option>
                  <option value="pass">誤りがあっても先へ進む</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  id="metronomeEnabled"
                  type="checkbox"
                  checked={settings.practice.metronomeEnabled}
                  onChange={(e) => updatePracticeSetting('metronomeEnabled', e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <label
                  htmlFor="metronomeEnabled"
                  style={{ marginLeft: '8px', fontSize: '0.875rem' }}
                >
                  既定でメトロノームを有効にする
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  id="metronomeAccentEnabled"
                  type="checkbox"
                  checked={settings.practice.metronomeAccentEnabled}
                  onChange={(e) =>
                    updatePracticeSetting('metronomeAccentEnabled', e.target.checked)
                  }
                  style={{ width: '16px', height: '16px' }}
                />
                <label
                  htmlFor="metronomeAccentEnabled"
                  style={{ marginLeft: '8px', fontSize: '0.875rem' }}
                >
                  既定で1拍目を強調する
                </label>
              </div>
            </div>
          </section>

          {/* Display Settings (TASK-045) */}
          <section style={{ marginBottom: '24px' }}>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              表示
            </h3>

            <div>
              <label
                htmlFor="pianoHeight"
                style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px' }}
              >
                鍵盤の高さ
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="pianoHeight"
                  type="range"
                  min={PIANO_HEIGHT_MIN}
                  max={PIANO_HEIGHT_MAX}
                  value={settings.ui.pianoHeight}
                  onChange={(e) => updateUiSetting('pianoHeight', Number(e.target.value))}
                  title="ピアノ鍵盤の表示の高さを変更します（80〜300px）"
                  style={{ flex: 1, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem', color: '#6b7280', minWidth: '48px' }}>
                  {settings.ui.pianoHeight}px
                </span>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label
                htmlFor="keyboardSize"
                style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px' }}
              >
                鍵盤数
              </label>
              <select
                id="keyboardSize"
                value={settings.ui.keyboardSize}
                onChange={(e) =>
                  updateUiSetting(
                    'keyboardSize',
                    Number(e.target.value) as AppSettings['ui']['keyboardSize']
                  )
                }
                title="画面下部の鍵盤の表示範囲（鍵盤数）を手元の機種に合わせて変更します"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                }}
              >
                {KEYBOARD_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* MIDI Settings (TASK-045, REQ-004-008) */}
          <section style={{ marginBottom: '24px' }}>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              MIDI
            </h3>

            <div>
              <label
                htmlFor="midiDevice"
                style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px' }}
              >
                MIDI入力デバイス
              </label>
              <select
                id="midiDevice"
                value={settings.midi.selectedDeviceId ?? ''}
                onChange={(e) => updateMidiDevice(e.target.value === '' ? null : e.target.value)}
                title="使用するMIDI入力デバイスを選択します（複数接続時）"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                }}
              >
                <option value="">すべてのデバイス</option>
                {midiDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Voice Settings (TASK-073, US-013) */}
          <section style={{ marginBottom: '24px' }}>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              音色
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor="playbackVoice"
                  style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px' }}
                >
                  再生音色
                </label>
                <select
                  id="playbackVoice"
                  value={settings.audio.playbackVoice}
                  onChange={(e) =>
                    updateAudioSetting(
                      'playbackVoice',
                      e.target.value as AppSettings['audio']['playbackVoice']
                    )
                  }
                  title="曲の再生・手動プレビューで使う音色を選択します"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                  }}
                >
                  {Object.values(PLAYBACK_VOICES).map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="metronomeVoice"
                  style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px' }}
                >
                  メトロノーム音色
                </label>
                <select
                  id="metronomeVoice"
                  value={settings.audio.metronomeVoice}
                  onChange={(e) =>
                    updateAudioSetting(
                      'metronomeVoice',
                      e.target.value as AppSettings['audio']['metronomeVoice']
                    )
                  }
                  title="メトロノームのクリック音を選択します"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                  }}
                >
                  {Object.values(METRONOME_VOICES).map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Recent Files */}
          <section>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              最近使ったファイル
            </h3>
            {recentFiles.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                最近使ったファイルはありません
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                {recentFiles.map((file, idx) => {
                  const parts = file.path.split(/[\\/]/);
                  const filename = parts[parts.length - 1];
                  const date = new Date(file.openedAt).toLocaleDateString();
                  return (
                    <li
                      key={idx}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          paddingRight: '16px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 500,
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
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {file.path}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
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
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
