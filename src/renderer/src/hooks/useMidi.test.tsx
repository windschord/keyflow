import { renderHook, act } from '@testing-library/react';
import { useMidi } from './useMidi';
import { WebMidiService } from '../lib/midi/web-midi';
import { usePracticeStore } from '../store';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('useMidi', () => {
  let webMidiServiceMock: WebMidiService;

  beforeEach(() => {
    webMidiServiceMock = new WebMidiService();
    vi.spyOn(webMidiServiceMock, 'initialize').mockResolvedValue();
    vi.spyOn(webMidiServiceMock, 'onNoteOn');
    vi.spyOn(webMidiServiceMock, 'onNoteOff');
    vi.spyOn(webMidiServiceMock, 'setSelectedDevice');
  });

  afterEach(() => {
    usePracticeStore.setState({ midiDeviceId: null });
  });

  it('should initialize webMidiService on mount', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();

    renderHook(() => useMidi(webMidiServiceMock, onNoteOn, onNoteOff));

    expect(webMidiServiceMock.initialize).toHaveBeenCalledTimes(1);

    // Instead of checking exact equality, we check if a function was passed
    expect(webMidiServiceMock.onNoteOn).toHaveBeenCalledWith(expect.any(Function));
    expect(webMidiServiceMock.onNoteOff).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should unregister callbacks on unmount', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();

    const { unmount } = renderHook(() => useMidi(webMidiServiceMock, onNoteOn, onNoteOff));

    // Clear initial call history
    vi.mocked(webMidiServiceMock.onNoteOn).mockClear();
    vi.mocked(webMidiServiceMock.onNoteOff).mockClear();

    unmount();

    expect(webMidiServiceMock.onNoteOn).toHaveBeenCalledTimes(1);
    expect(webMidiServiceMock.onNoteOff).toHaveBeenCalledTimes(1);

    // Validate that it replaces it with a no-op function
    const onNoteOnArg = vi.mocked(webMidiServiceMock.onNoteOn).mock.calls[0][0];
    const onNoteOffArg = vi.mocked(webMidiServiceMock.onNoteOff).mock.calls[0][0];
    expect(typeof onNoteOnArg).toBe('function');
    expect(typeof onNoteOffArg).toBe('function');
  });

  // TASK-045: MIDIデバイス選択（REQ-004-008）。usePracticeStoreのmidiDeviceIdを
  // 単一の真実源とし、useMidiはその値をWebMidiService.setSelectedDeviceへ
  // 適用する。これにより「起動時ロード」と「SettingsModalでの変更」の両方を
  // 同じ結線で処理できる。
  describe('midiDeviceId wiring (TASK-045)', () => {
    it('applies the persisted selected device (from the store) to webMidiService on mount', () => {
      usePracticeStore.setState({ midiDeviceId: 'device-2' });

      renderHook(() => useMidi(webMidiServiceMock, vi.fn(), vi.fn()));

      expect(webMidiServiceMock.setSelectedDevice).toHaveBeenCalledWith('device-2');
    });

    it('applies null (accept all devices) when the store has no selected device', () => {
      usePracticeStore.setState({ midiDeviceId: null });

      renderHook(() => useMidi(webMidiServiceMock, vi.fn(), vi.fn()));

      expect(webMidiServiceMock.setSelectedDevice).toHaveBeenCalledWith(null);
    });

    it('re-applies the selection to webMidiService when the store value changes later (SettingsModal change)', () => {
      usePracticeStore.setState({ midiDeviceId: null });

      renderHook(() => useMidi(webMidiServiceMock, vi.fn(), vi.fn()));
      vi.mocked(webMidiServiceMock.setSelectedDevice).mockClear();

      act(() => {
        usePracticeStore.getState().setMidiDeviceId('device-1');
      });

      expect(webMidiServiceMock.setSelectedDevice).toHaveBeenCalledWith('device-1');
    });
  });
});
