import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MidiControllerService } from './midi-controller';
import { BrowserWindow } from 'electron';

vi.mock('midi', () => {
  return {
    default: {
      Input: vi.fn().mockImplementation(() => {
        let messageCallback: ((deltaTime: number, message: number[]) => void) | null = null;
        return {
          getPortCount: vi.fn().mockReturnValue(2),
          getPortName: vi.fn().mockImplementation((idx) => `Device ${idx}`),
          openPort: vi.fn(),
          closePort: vi.fn(),
          isPortOpen: vi.fn().mockReturnValue(false),
          on: vi.fn().mockImplementation((event, cb) => {
            if (event === 'message') {
              messageCallback = cb;
            }
          }),
          // Helper for test to trigger events
          simulateMessage: (deltaTime: number, message: number[]) => {
            if (messageCallback) messageCallback(deltaTime, message);
          },
        };
      }),
    },
  };
});

describe('MidiControllerService', () => {
  let service: MidiControllerService;
  let mockWin: unknown;

  beforeEach(() => {
    mockWin = {
      webContents: {
        send: vi.fn(),
      },
    };
    service = new MidiControllerService(mockWin as unknown as BrowserWindow);
    service.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('listDevices returns connected devices', () => {
    const devices = service.listDevices();
    expect(devices.length).toBe(2);
    expect(devices[0].name).toBe('Device 0');
    expect(devices[1].name).toBe('Device 1');
  });

  it('listDevices does not crash when no devices are connected', () => {
    // override mock to return 0 ports
    // @ts-expect-error accessing private
    service.input.getPortCount.mockReturnValueOnce(0);
    const devices = service.listDevices();
    expect(devices.length).toBe(0);
  });

  it('NoteOn message sends midi:note-on event via IPC', () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    // @ts-expect-error accessing private and simulated
    service.input.simulateMessage(0, [0x90, 60, 100]);

    // @ts-expect-error mock structure
    expect(mockWin.webContents.send).toHaveBeenCalledWith('midi:note-on', {
      noteNumber: 60,
      velocity: 100,
      channel: 1,
      timestamp: now,
    });
    nowSpy.mockRestore();
  });

  it('NoteOff message (0x80) sends midi:note-off event via IPC', () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    // @ts-expect-error accessing private and simulated
    service.input.simulateMessage(0, [0x80, 60, 0]);

    // @ts-expect-error mock structure
    expect(mockWin.webContents.send).toHaveBeenCalledWith('midi:note-off', {
      noteNumber: 60,
      velocity: 0,
      channel: 1,
      timestamp: now,
    });
    nowSpy.mockRestore();
  });

  it('NoteOn message with 0 velocity sends midi:note-off event via IPC', () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    // @ts-expect-error accessing private and simulated
    service.input.simulateMessage(0, [0x90, 60, 0]);

    // @ts-expect-error mock structure
    expect(mockWin.webContents.send).toHaveBeenCalledWith('midi:note-off', {
      noteNumber: 60,
      velocity: 0,
      channel: 1,
      timestamp: now,
    });
    nowSpy.mockRestore();
  });

  it('dispose closes the port', () => {
    // @ts-expect-error accessing private
    service.input.isPortOpen.mockReturnValueOnce(true);
    service.dispose();
    // @ts-expect-error accessing private
    expect(service.input.closePort).toHaveBeenCalled();
  });
});
