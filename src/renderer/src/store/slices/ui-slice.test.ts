import { describe, it, expect, vi } from 'vitest';
import { createUiSlice } from './ui-slice';

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
