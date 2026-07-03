import type { Note, FingerAssignment } from '../../types';
import type {
  HandSettings,
  FingeringResult,
  FingeringRequest,
  FingeringResponse,
  FingeringHand,
} from '../../workers/fingering/types';
import FingeringWorker from '../../workers/fingering/fingering.worker?worker';

export class FingeringEngineService {
  private worker: Worker;
  private pendingRequests = new Map<
    string,
    {
      resolve: (result: FingeringResult) => void;
      reject: (err: Error) => void;
      onProgress?: (progress: number) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  constructor() {
    this.worker = new FingeringWorker();
    this.worker.onmessage = (e: MessageEvent<FingeringResponse>) => {
      const { type, requestId, result, progress, error } = e.data;
      const pending = this.pendingRequests.get(requestId);
      if (!pending) return;

      if (type === 'PROGRESS' && progress !== undefined) {
        pending.onProgress?.(progress);
      } else if (type === 'RESULT' && result) {
        clearTimeout(pending.timeoutId);
        this.pendingRequests.delete(requestId);
        pending.resolve(result);
      } else if (type === 'ERROR') {
        clearTimeout(pending.timeoutId);
        this.pendingRequests.delete(requestId);
        pending.reject(new Error(error ?? 'Unknown error'));
      }
    };
  }

  async computeFingering(
    notes: Note[],
    hand: FingeringHand,
    settings: HandSettings,
    onProgress?: (progress: number) => void
  ): Promise<FingeringResult> {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Fingering computation timed out after 60 seconds'));
      }, 60000);

      this.pendingRequests.set(requestId, { resolve, reject, onProgress, timeoutId });
      const request: FingeringRequest = { type: 'COMPUTE', requestId, notes, hand, settings };
      this.worker.postMessage(request);
    });
  }

  cancel(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingRequests.delete(requestId);
    }
  }

  dispose(): void {
    // Reject all pending requests before terminating
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('FingeringEngine disposed'));
    });
    this.pendingRequests.clear();
    this.worker.terminate();
  }
}

export const DEFAULT_HAND_SETTINGS: HandSettings = {
  maxSpanSemitones: 14,
  scaleFactorLeft: 1.0,
};
