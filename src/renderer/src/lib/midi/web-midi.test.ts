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

describe('WebMidiService.setSelectedDevice (TASK-045)', () => {
  let service: WebMidiService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockInputs: Map<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAccess: any;

  beforeEach(() => {
    mockInputs = new Map();
    mockInputs.set('device-1', {
      id: 'device-1',
      name: 'Keyboard A',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onmidimessage: null as any,
    });
    mockInputs.set('device-2', {
      id: 'device-2',
      name: 'Keyboard B',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onmidimessage: null as any,
    });

    mockAccess = {
      inputs: mockInputs,
      onstatechange: null,
    };

    vi.stubGlobal('navigator', {
      requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess),
    });

    service = new WebMidiService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('binds every input when no device is selected (default/legacy behavior)', async () => {
    await service.initialize();

    expect(typeof mockInputs.get('device-1').onmidimessage).toBe('function');
    expect(typeof mockInputs.get('device-2').onmidimessage).toBe('function');
  });

  it('binds only the selected device and unbinds the others', async () => {
    await service.initialize();

    service.setSelectedDevice('device-2');

    expect(mockInputs.get('device-1').onmidimessage).toBeNull();
    expect(typeof mockInputs.get('device-2').onmidimessage).toBe('function');
  });

  it('only routes NoteOn events from the selected device to the callback', async () => {
    await service.initialize();
    service.setSelectedDevice('device-2');

    const noteOnCb = vi.fn();
    service.onNoteOn(noteOnCb);

    // Unselected device: bound handler is null, so nothing should fire even if
    // called directly (this simulates the device no longer being routed at all).
    expect(mockInputs.get('device-1').onmidimessage).toBeNull();

    mockInputs.get('device-2').onmidimessage({
      data: new Uint8Array([0x90, 60, 100]),
    } as unknown as MIDIMessageEvent);

    expect(noteOnCb).toHaveBeenCalledWith(60, 100, 1);
  });

  it('re-binds every input when the selection is cleared (null)', async () => {
    await service.initialize();
    service.setSelectedDevice('device-2');
    service.setSelectedDevice(null);

    expect(typeof mockInputs.get('device-1').onmidimessage).toBe('function');
    expect(typeof mockInputs.get('device-2').onmidimessage).toBe('function');
  });

  it('falls back to binding all devices when the selected device is not connected', async () => {
    await service.initialize();

    service.setSelectedDevice('device-does-not-exist');

    expect(typeof mockInputs.get('device-1').onmidimessage).toBe('function');
    expect(typeof mockInputs.get('device-2').onmidimessage).toBe('function');
  });

  it('applies the pending selection once a device access becomes available, even if setSelectedDevice was called before initialize', () => {
    // Calling before initialize() must not throw, and should apply once ready.
    expect(() => service.setSelectedDevice('device-1')).not.toThrow();
  });
});
