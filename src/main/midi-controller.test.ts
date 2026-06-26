import { describe, it, expect, vi, beforeEach, MockInstance } from 'vitest';
import { MidiControllerService } from './midi-controller';
import midi from '@julusian/midi';
import { BrowserWindow } from 'electron';
import { IpcChannels } from './ipc-channels';

vi.mock('@julusian/midi', () => {
  const Input = vi.fn().mockImplementation(() => ({
    getPortCount: vi.fn().mockReturnValue(2),
    getPortName: vi.fn().mockImplementation((index: number) => `Mock Device ${index}`),
    openPort: vi.fn(),
    closePort: vi.fn(),
    on: vi.fn(),
    ignoreTypes: vi.fn(),
  }));
  return { default: { Input } };
});

describe('MidiControllerService', () => {
  let mockWebContents: { send: MockInstance };
  let mockWindow: BrowserWindow;
  let service: MidiControllerService;
  let midiInputInstance: Record<string, MockInstance>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWebContents = {
      send: vi.fn(),
    };
    mockWindow = {
      webContents: mockWebContents,
      isDestroyed: vi.fn().mockReturnValue(false),
    } as unknown as BrowserWindow;

    service = new MidiControllerService(mockWindow);

    // Grab the mocked Input instance
    midiInputInstance = (
      midi.Input as unknown as { mock: { results: { value: Record<string, MockInstance> }[] } }
    ).mock.results[0]?.value;
    if (!midiInputInstance) {
      // If not yet instantiated, do initialize
      service.initialize();
      midiInputInstance = (
        midi.Input as unknown as { mock: { results: { value: Record<string, MockInstance> }[] } }
      ).mock.results[0].value;
    }
  });

  it('should return empty list before initialization, then list devices correctly after initialize', () => {
    const freshService = new MidiControllerService(mockWindow);
    // Before initialization
    expect(freshService.listDevices()).toEqual([]);

    freshService.initialize();

    const devices = freshService.listDevices();
    expect(devices).toHaveLength(2);
    expect(devices[0]).toEqual({ index: 0, name: 'Mock Device 0' });
    expect(devices[1]).toEqual({ index: 1, name: 'Mock Device 1' });
  });

  it('should list devices correctly', () => {
    const devices = service.listDevices();
    expect(devices).toHaveLength(2);
    expect(devices[0]).toEqual({ index: 0, name: 'Mock Device 0' });
    expect(devices[1]).toEqual({ index: 1, name: 'Mock Device 1' });
  });

  it('should handle device selection and open port', () => {
    service.selectDevice(1);
    expect(midiInputInstance.openPort).toHaveBeenCalledWith(1);
  });

  it('should handle device selection when port count is 0 without crashing', () => {
    midiInputInstance.getPortCount.mockReturnValue(0);
    expect(() => service.selectDevice(0)).not.toThrow();
  });

  it('should close input on dispose', () => {
    service.dispose();
    expect(midiInputInstance.closePort).toHaveBeenCalled();
  });

  it('should parse and send note-on event via IPC', () => {
    // We need to trigger the 'message' event handler manually
    const onCall = midiInputInstance.on.mock.calls.find((call: unknown[]) => call[0] === 'message');
    expect(onCall).toBeDefined();

    const messageHandler = onCall![1] as (
      deltaTime: number,
      message: [number, number, number]
    ) => void;

    // Note On channel 1, note 60, velocity 100
    // Status byte for Note On ch 1 is 0x90 (144)
    messageHandler(0.5, [144, 60, 100]);

    expect(mockWebContents.send).toHaveBeenCalledWith(
      IpcChannels.MIDI_NOTE_ON,
      expect.objectContaining({
        midiNumber: 60,
        velocity: 100,
        type: 'note-on',
      })
    );
  });

  it('should parse and send note-off event via IPC', () => {
    const onCall = midiInputInstance.on.mock.calls.find((call: unknown[]) => call[0] === 'message');
    const messageHandler = onCall![1] as (
      deltaTime: number,
      message: [number, number, number]
    ) => void;

    // Note Off channel 1, note 60, velocity 0
    // Status byte for Note Off ch 1 is 0x80 (128)
    messageHandler(0.5, [128, 60, 0]);

    expect(mockWebContents.send).toHaveBeenCalledWith(
      IpcChannels.MIDI_NOTE_OFF,
      expect.objectContaining({
        midiNumber: 60,
        velocity: 0,
        type: 'note-off',
      })
    );
  });

  it('should treat Note On with velocity 0 as Note Off', () => {
    const onCall = midiInputInstance.on.mock.calls.find((call: unknown[]) => call[0] === 'message');
    const messageHandler = onCall![1] as (
      deltaTime: number,
      message: [number, number, number]
    ) => void;

    // Note On channel 1, note 62, velocity 0 -> should be Note Off
    messageHandler(0.5, [144, 62, 0]);

    expect(mockWebContents.send).toHaveBeenCalledWith(
      IpcChannels.MIDI_NOTE_OFF,
      expect.objectContaining({
        midiNumber: 62,
        velocity: 0,
        type: 'note-off',
      })
    );
  });
});
