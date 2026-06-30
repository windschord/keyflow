import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebMidiService } from './web-midi';

describe('WebMidiService', () => {
  let service: WebMidiService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockInputs: Map<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAccess: any;

  beforeEach(() => {
    mockInputs = new Map();
    const mockInput = {
      id: 'device-1',
      name: 'Test MIDI Keyboard',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onmidimessage: null as any,
    };
    mockInputs.set('device-1', mockInput);

    mockAccess = {
      inputs: mockInputs,
      onstatechange: null,
    };

    // Mock navigator.requestMIDIAccess
    vi.stubGlobal('navigator', {
      requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess),
    });

    service = new WebMidiService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('initializes and returns devices', async () => {
    await service.initialize();
    const devices = service.getDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].id).toBe('device-1');
    expect(devices[0].name).toBe('Test MIDI Keyboard');
  });

  it('binds inputs and handles NoteOn message correctly', async () => {
    await service.initialize();

    const noteOnCb = vi.fn();
    service.onNoteOn(noteOnCb);

    const mockInput = mockInputs.get('device-1');
    // trigger Note On (command 0x90, note 60, velocity 100) -> channel 1
    mockInput.onmidimessage({
      data: new Uint8Array([0x90, 60, 100]),
    } as unknown as MIDIMessageEvent);

    expect(noteOnCb).toHaveBeenCalledWith(60, 100, 1);
  });

  it('handles NoteOff message (0x80) correctly', async () => {
    await service.initialize();

    const noteOffCb = vi.fn();
    service.onNoteOff(noteOffCb);

    const mockInput = mockInputs.get('device-1');
    // trigger Note Off (command 0x80, note 60, velocity 0) -> channel 1
    mockInput.onmidimessage({
      data: new Uint8Array([0x80, 60, 0]),
    } as unknown as MIDIMessageEvent);

    expect(noteOffCb).toHaveBeenCalledWith(60, 0, 1);
  });

  it('handles NoteOff via NoteOn with velocity 0 correctly', async () => {
    await service.initialize();

    const noteOffCb = vi.fn();
    service.onNoteOff(noteOffCb);

    const mockInput = mockInputs.get('device-1');
    // trigger Note Off via NoteOn (command 0x90, note 64, velocity 0) -> channel 1
    mockInput.onmidimessage({
      data: new Uint8Array([0x90, 64, 0]),
    } as unknown as MIDIMessageEvent);

    expect(noteOffCb).toHaveBeenCalledWith(64, 0, 1);
  });
});
