/**
 * 指定時間内に決着しないPromiseを打ち切るためのユーティリティ（TASK-106）。
 *
 * 再生開始経路のPlaybackControls.handlePlayは、Tone.startの完了を待ってから
 * 再生状態へ遷移する。ChromiumのAudioContext.resumeは、音声出力デバイスを
 * 開けない環境では決着しないまま留まることがある。
 * その場合、クリックしても画面上は一切変化しない。
 * 待ち時間に上限を設けてTimeoutErrorとして顕在化させ、利用者へエラーを提示する。
 * 分析: docs/sdd/troubleshooting/2026-08-11-portable-play-no-response/analysis.md
 */

/** `withTimeout` が制限時間の超過を通知するために送出するエラー。 */
export class TimeoutError extends Error {
  /**
   * @param label タイムアウトした処理名（エラーメッセージに含める）
   * @param timeoutMs 超過した制限時間（ミリ秒）
   */
  constructor(label: string, timeoutMs: number) {
    super(`${label} did not settle within ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * `promise` が `timeoutMs` 以内に決着しなければ `TimeoutError` で拒否する。
 *
 * 元のPromiseはキャンセルできないため、後から決着しても結果は無視される。
 * タイマーは決着時に必ず解除するため、呼び出し元でタイマーが残り続けることはない。
 *
 * @param promise 監視対象のPromise
 * @param timeoutMs 制限時間（ミリ秒）
 * @param label タイムアウト時のエラーメッセージに含める処理名
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}
