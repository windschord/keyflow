import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FingeringEngineService } from './index';

// Worker をモック
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null as ((e: MessageEvent) => void) | null,
};

vi.stubGlobal(
  'Worker',
  vi.fn().mockImplementation(function () {
    return new Proxy(mockWorker, {
      set(target, prop, value) {
        (target as Record<string, unknown>)[prop] = value;
        return true;
      },
    });
  })
);

describe('FingeringEngineService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorker.onmessage = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computeFingering が RESULT メッセージで resolve する', async () => {
    const service = new FingeringEngineService();
    const promise = service.computeFingering([], 'right', {
      maxSpanSemitones: 14,
      scaleFactorLeft: 1,
    });

    // Ensure mockWorker.postMessage was called with right data
    expect(mockWorker.postMessage).toHaveBeenCalled();
    const req = mockWorker.postMessage.mock.calls[0][0];

    // Simulate worker sending result back
    const fakeResult = { assignments: [], totalCost: 0 };
    mockWorker.onmessage?.({
      data: { type: 'RESULT', requestId: req.requestId, result: fakeResult },
    } as MessageEvent);

    const result = await promise;
    expect(result).toEqual(fakeResult);

    service.dispose();
  });

  it('PROGRESS メッセージで onProgress が呼ばれる', async () => {
    const service = new FingeringEngineService();
    const onProgress = vi.fn();
    const promise = service.computeFingering(
      [],
      'right',
      { maxSpanSemitones: 14, scaleFactorLeft: 1 },
      onProgress
    );

    const req = mockWorker.postMessage.mock.calls[0][0];

    // Simulate progress
    mockWorker.onmessage?.({
      data: { type: 'PROGRESS', requestId: req.requestId, progress: 0.5 },
    } as MessageEvent);

    expect(onProgress).toHaveBeenCalledWith(0.5);

    // Resolve promise to prevent memory leak warning
    mockWorker.onmessage?.({
      data: { type: 'RESULT', requestId: req.requestId, result: { assignments: [], totalCost: 0 } },
    } as MessageEvent);

    await promise;
    service.dispose();
  });

  it('60秒タイムアウトで reject する', async () => {
    vi.useFakeTimers();
    const service = new FingeringEngineService();
    const promise = service.computeFingering([], 'right', {
      maxSpanSemitones: 14,
      scaleFactorLeft: 1,
    });

    vi.advanceTimersByTime(60001);

    await expect(promise).rejects.toThrow('Fingering computation timed out after 60 seconds');
    service.dispose();
  });

  it('ERROR メッセージで reject する', async () => {
    const service = new FingeringEngineService();
    const promise = service.computeFingering([], 'right', {
      maxSpanSemitones: 14,
      scaleFactorLeft: 1,
    });

    const req = mockWorker.postMessage.mock.calls[0][0];

    mockWorker.onmessage?.({
      data: { type: 'ERROR', requestId: req.requestId, error: 'Worker error' },
    } as MessageEvent);

    await expect(promise).rejects.toThrow('Worker error');
    service.dispose();
  });
});
