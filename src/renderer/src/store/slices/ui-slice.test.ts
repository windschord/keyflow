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
