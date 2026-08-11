import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTimeout, TimeoutError } from './with-timeout';

describe('withTimeout (TASK-106)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('制限時間内に解決したら元の値をそのまま返す', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'test')).resolves.toBe(42);
  });

  it('制限時間内に拒否したら元のエラーをそのまま伝える', async () => {
    const error = new Error('original');
    await expect(withTimeout(Promise.reject(error), 1000, 'test')).rejects.toBe(error);
  });

  it('制限時間を超えても決着しない場合はTimeoutErrorで拒否する', async () => {
    vi.useFakeTimers();
    // 決着しないPromise（AudioContext.resume()が返らない状況の再現）。
    const pending = new Promise<void>(() => {});
    const raced = withTimeout(pending, 5000, 'Tone.start()');
    const assertion = expect(raced).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(5001);

    await assertion;
  });

  it('TimeoutErrorのメッセージに処理名と制限時間を含む', async () => {
    vi.useFakeTimers();
    const raced = withTimeout(new Promise<void>(() => {}), 250, 'Tone.start()');
    const assertion = expect(raced).rejects.toThrow('Tone.start() did not settle within 250ms');

    await vi.advanceTimersByTimeAsync(251);

    await assertion;
  });

  it('先に解決した場合はタイマーを解除する（保留タイマーを残さない）', async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    await withTimeout(Promise.resolve('done'), 1000, 'test');

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
