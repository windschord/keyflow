import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebMidiService } from './web-midi';

interface MockMIDIInput {
  id: string;
  name: string;
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

interface MockMIDIAccess {
  inputs: Map<string, MockMIDIInput>;
  onstatechange: ((event: Event) => void) | null;
}

describe('WebMidiService', () => {
  let service: WebMidiService;
  let mockInputs: Map<string, MockMIDIInput>;
  let mockAccess: MockMIDIAccess;

  beforeEach(() => {
    mockInputs = new Map();
    const mockInput: MockMIDIInput = {
      id: 'device-1',
      name: 'Test MIDI Keyboard',
      onmidimessage: null,
    };
    mockInputs.set('device-1', mockInput);

    mockAccess = {
      inputs: mockInputs,
      onstatechange: null,
    };

    // Mock navigator.requestMIDIAccess
    // @ts-expect-error - Mocking browser Web MIDI API for testing
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
    // @ts-expect-error - Minimal mock of MIDIMessageEvent for testing
    mockInput.onmidimessage({
      data: new Uint8Array([0x90, 60, 100]),
    });

    expect(noteOnCb).toHaveBeenCalledWith(60, 100, 1);
  });

  it('handles NoteOff message (0x80) correctly', async () => {
    await service.initialize();

    const noteOffCb = vi.fn();
    service.onNoteOff(noteOffCb);

    const mockInput = mockInputs.get('device-1');
    // trigger Note Off (command 0x80, note 60, velocity 0) -> channel 1
    // @ts-expect-error - Minimal mock of MIDIMessageEvent for testing
    mockInput.onmidimessage({
      data: new Uint8Array([0x80, 60, 0]),
    });

    expect(noteOffCb).toHaveBeenCalledWith(60, 0, 1);
  });

  it('handles NoteOff via NoteOn with velocity 0 correctly', async () => {
    await service.initialize();

    const noteOffCb = vi.fn();
    service.onNoteOff(noteOffCb);

    const mockInput = mockInputs.get('device-1');
    // trigger Note Off via NoteOn (command 0x90, note 64, velocity 0) -> channel 1
    // @ts-expect-error - Minimal mock of MIDIMessageEvent for testing
    mockInput.onmidimessage({
      data: new Uint8Array([0x90, 64, 0]),
    });

    expect(noteOffCb).toHaveBeenCalledWith(64, 0, 1);
  });
});
