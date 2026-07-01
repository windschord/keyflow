import { renderHook } from '@testing-library/react';
import { useMidi } from './useMidi';
import { WebMidiService } from '../lib/midi/web-midi';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('useMidi', () => {
  let webMidiServiceMock: WebMidiService;

  beforeEach(() => {
    webMidiServiceMock = new WebMidiService();
    vi.spyOn(webMidiServiceMock, 'initialize').mockResolvedValue();
    vi.spyOn(webMidiServiceMock, 'onNoteOn');
    vi.spyOn(webMidiServiceMock, 'onNoteOff');
  });

  it('should initialize webMidiService on mount', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();

    renderHook(() => useMidi(webMidiServiceMock, onNoteOn, onNoteOff));

    expect(webMidiServiceMock.initialize).toHaveBeenCalledTimes(1);
    expect(webMidiServiceMock.onNoteOn).toHaveBeenCalledWith(onNoteOn);
    expect(webMidiServiceMock.onNoteOff).toHaveBeenCalledWith(onNoteOff);
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
});
