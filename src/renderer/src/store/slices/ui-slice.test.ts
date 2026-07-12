import { describe, it, expect, vi } from 'vitest';
import { createUiSlice } from './ui-slice';
import type { KeyboardSize } from '../../types';

describe('createUiSlice initial state', () => {
  it('initializes pianoHeight to 120, matching the electron-store default (settings.ts) to avoid a startup mismatch (TASK-045)', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    expect(slice.pianoHeight).toBe(120);
  });

  it('initializes midiDeviceId to null (no device selected = accept input from all devices)', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    expect(slice.midiDeviceId).toBeNull();
  });
});

describe('createUiSlice setPianoHeight', () => {
  it('updates pianoHeight when called with a value inside the valid range', () => {
    let state = { pianoHeight: 120 };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setPianoHeight(200);

    expect(state.pianoHeight).toBe(200);
  });

  it('clamps values below the minimum (80px)', () => {
    let state = { pianoHeight: 120 };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setPianoHeight(10);

    expect(state.pianoHeight).toBe(80);
  });

  it('clamps values above the maximum (300px)', () => {
    let state = { pianoHeight: 120 };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setPianoHeight(999);

    expect(state.pianoHeight).toBe(300);
  });
});

// REQ-006-003: システムは元のテンポの20%〜200%の範囲でテンポ変更をサポートしなければ
// ならない。setBpmは絶対値ではなく originalBpm（元テンポ）に対する比率でクランプする。
describe('createUiSlice setBpm (REQ-006-003)', () => {
  const makeSlice = (initial: { bpm: number; originalBpm: number }) => {
    let state = initial;
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);
    return { slice, getState: () => state };
  };

  it('originalBpm=100のとき、範囲内の値(150)はそのまま設定される', () => {
    const { slice, getState } = makeSlice({ bpm: 100, originalBpm: 100 });
    slice.setBpm(150);
    expect(getState().bpm).toBe(150);
  });

  it('originalBpm=100のとき、200%超（201）は200（=originalBpm*2.0）にクランプされる', () => {
    const { slice, getState } = makeSlice({ bpm: 100, originalBpm: 100 });
    slice.setBpm(500);
    expect(getState().bpm).toBe(200);
  });

  it('originalBpm=100のとき、20%未満（19）は20（=originalBpm*0.2）にクランプされる', () => {
    const { slice, getState } = makeSlice({ bpm: 100, originalBpm: 100 });
    slice.setBpm(1);
    expect(getState().bpm).toBe(20);
  });

  it('originalBpm=60のとき、範囲は12〜120にクランプされる（境界値含む）', () => {
    const { slice, getState } = makeSlice({ bpm: 60, originalBpm: 60 });

    slice.setBpm(200);
    expect(getState().bpm).toBe(120);

    slice.setBpm(1);
    expect(getState().bpm).toBe(12);

    slice.setBpm(12);
    expect(getState().bpm).toBe(12);

    slice.setBpm(120);
    expect(getState().bpm).toBe(120);
  });

  it('originalBpm未設定（初期値120）のとき、範囲は24〜240にクランプされる', () => {
    const { slice, getState } = makeSlice({ bpm: 120, originalBpm: 120 });

    slice.setBpm(500);
    expect(getState().bpm).toBe(240);

    slice.setBpm(1);
    expect(getState().bpm).toBe(24);
  });

  it('originalBpmが0以下（未初期化）の場合は120を基準にクランプする', () => {
    const { slice, getState } = makeSlice({ bpm: 120, originalBpm: 0 });

    slice.setBpm(500);
    expect(getState().bpm).toBe(240);
  });
});

// TASK-052: マスターボリューム（0〜100のUI線形値）。ui-slice側では範囲クランプの
// みを担い、dB変換・ミュートはAudioEngineService.setMasterVolumeの責務とする。
describe('createUiSlice volume/setVolume (TASK-052)', () => {
  it('initializes volume to 80 (a sensible default, matching electron-store default settings.ts)', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    expect(slice.volume).toBe(80);
  });

  it('updates volume when called with a value inside the valid range (0-100)', () => {
    let state = { volume: 80 };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setVolume(50);

    expect(state.volume).toBe(50);
  });

  it('clamps values below the minimum (0)', () => {
    let state = { volume: 80 };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setVolume(-10);

    expect(state.volume).toBe(0);
  });

  it('clamps values above the maximum (100)', () => {
    let state = { volume: 80 };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setVolume(999);

    expect(state.volume).toBe(100);
  });

  it('accepts the boundary value 0 as-is (mute, REQ: スライダー0でミュート)', () => {
    let state = { volume: 80 };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setVolume(0);

    expect(state.volume).toBe(0);
  });
});

// TASK-055: 運指の一括表示/非表示トグル。表示レイヤの制御のみを担い、
// annotation-storeのデータ自体には影響しない。
describe('createUiSlice showFingerings/setShowFingerings (TASK-055)', () => {
  it('initializes showFingerings to true (matching electron-store default settings.ts)', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    expect(slice.showFingerings).toBe(true);
  });

  it('updates showFingerings to false when setShowFingerings(false) is called', () => {
    let state = { showFingerings: true };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setShowFingerings(false);

    expect(state.showFingerings).toBe(false);
  });

  it('updates showFingerings back to true when setShowFingerings(true) is called', () => {
    let state = { showFingerings: false };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setShowFingerings(true);

    expect(state.showFingerings).toBe(true);
  });
});

// TASK-056: 画面下キーボードの鍵盤数プリセット（88/76/61/49）。表示だけの制約であり
// practice-engineの判定ロジックには影響しない。
describe('createUiSlice keyboardSize/setKeyboardSize (TASK-056)', () => {
  it('initializes keyboardSize to 88 (matching electron-store default settings.ts)', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    expect(slice.keyboardSize).toBe(88);
  });

  it.each([88, 76, 61, 49] as KeyboardSize[])(
    'updates keyboardSize to %i when setKeyboardSize is called with a valid preset',
    (size) => {
      let state: { keyboardSize: KeyboardSize } = { keyboardSize: 88 };
      const set = vi.fn((updater) => {
        const partial = typeof updater === 'function' ? updater(state) : updater;
        state = { ...state, ...partial };
      });
      const get = vi.fn(() => state);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = {} as any;
      const slice = createUiSlice(set, get, api);

      slice.setKeyboardSize(size);

      expect(state.keyboardSize).toBe(size);
    }
  );

  it('falls back to 88 when setKeyboardSize is called with a value outside the known presets (defensive against corrupted electron-store data)', () => {
    let state: { keyboardSize: KeyboardSize } = { keyboardSize: 61 };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    // @ts-expect-error 実行時に不正値（electron-storeの破損データ等）が来た場合の
    // 防御的な挙動を検証するため、型システムでは許容されない値を意図的に渡す
    slice.setKeyboardSize(999);

    expect(state.keyboardSize).toBe(88);
  });
});

// TASK-063: メトロノームの一拍目アクセント有効/無効（REQ-006-008）。既定でON。
describe('createUiSlice metronomeAccentEnabled/setMetronomeAccentEnabled (TASK-063)', () => {
  it('initializes metronomeAccentEnabled to true (matching electron-store default settings.ts)', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    expect(slice.metronomeAccentEnabled).toBe(true);
  });

  it('updates metronomeAccentEnabled to false when setMetronomeAccentEnabled(false) is called', () => {
    let state = { metronomeAccentEnabled: true };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setMetronomeAccentEnabled(false);

    expect(state.metronomeAccentEnabled).toBe(false);
  });

  it('updates metronomeAccentEnabled back to true when setMetronomeAccentEnabled(true) is called', () => {
    let state = { metronomeAccentEnabled: false };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setMetronomeAccentEnabled(true);

    expect(state.metronomeAccentEnabled).toBe(true);
  });
});

// TASK-073: 再生音色・メトロノーム音色・ロード状態（US-013）。
describe('createUiSlice playbackVoice/metronomeVoice/voiceLoading (TASK-073)', () => {
  it('initializes playbackVoice to "grand-piano" and metronomeVoice to "click" (matching electron-store defaults settings.ts)', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    expect(slice.playbackVoice).toBe('grand-piano');
    expect(slice.metronomeVoice).toBe('click');
  });

  it('initializes voiceLoading to false', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    expect(slice.voiceLoading).toBe(false);
  });

  it('updates playbackVoice when setPlaybackVoice is called', () => {
    let state = { playbackVoice: 'grand-piano' };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setPlaybackVoice('organ');

    expect(state.playbackVoice).toBe('organ');
  });

  it('updates metronomeVoice when setMetronomeVoice is called', () => {
    let state = { metronomeVoice: 'click' };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setMetronomeVoice('cowbell');

    expect(state.metronomeVoice).toBe('cowbell');
  });

  it('updates voiceLoading when setVoiceLoading is called', () => {
    let state = { voiceLoading: false };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setVoiceLoading(true);
    expect(state.voiceLoading).toBe(true);

    slice.setVoiceLoading(false);
    expect(state.voiceLoading).toBe(false);
  });
});

// TASK-096: UI表示言語（US-016）。初期値'ja'はApp.tsx起動時のresolveLanguageで
// 直ちに上書きされる想定（設計: docs/sdd/design/components/i18n.md）。
describe('createUiSlice language/setLanguage (TASK-096)', () => {
  it('initializes language to "ja" (immediately overwritten by resolveLanguage at App.tsx startup)', () => {
    const set = vi.fn();
    const get = vi.fn();
    // apiはcreateUiSliceの実装で未使用のため、シグネチャ上の型へキャストしたダミーを渡す
    const api = {} as unknown as Parameters<typeof createUiSlice>[2];
    const slice = createUiSlice(set, get, api);

    expect(slice.language).toBe('ja');
  });

  it('updates language when setLanguage is called', () => {
    let state = { language: 'ja' };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // apiはcreateUiSliceの実装で未使用のため、シグネチャ上の型へキャストしたダミーを渡す
    const api = {} as unknown as Parameters<typeof createUiSlice>[2];
    const slice = createUiSlice(set, get, api);

    slice.setLanguage('en');
    expect(state.language).toBe('en');

    slice.setLanguage('ja');
    expect(state.language).toBe('ja');
  });
});

// TASK-102: 現在表示中の画面（US-017）。初期値'library'で、楽譜未読み込みでも
// ライブラリ画面から開始できる。
describe('createUiSlice activeView/setActiveView (TASK-102)', () => {
  it('initializes activeView to "library"', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    expect(slice.activeView).toBe('library');
  });

  it('updates activeView when setActiveView is called', () => {
    let state: { activeView: 'score' | 'library' } = { activeView: 'library' };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setActiveView('score');
    expect(state.activeView).toBe('score');

    slice.setActiveView('library');
    expect(state.activeView).toBe('library');
  });
});

describe('createUiSlice setMidiDeviceId', () => {
  it('updates midiDeviceId when called with a device id', () => {
    let state: { midiDeviceId: string | null } = { midiDeviceId: null };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setMidiDeviceId('device-1');

    expect(state.midiDeviceId).toBe('device-1');
  });

  it('resets midiDeviceId to null (all devices) when called with null', () => {
    let state: { midiDeviceId: string | null } = { midiDeviceId: 'device-1' };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createUiSlice(set, get, api);

    slice.setMidiDeviceId(null);

    expect(state.midiDeviceId).toBeNull();
  });
});
