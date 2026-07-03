import type { FingeringRequest, FingeringResponse } from './types';
import { computeFingering } from './dp-solver';

self.onmessage = (e: MessageEvent<FingeringRequest>) => {
  if (e.data.type === 'COMPUTE') {
    try {
      const result = computeFingering(e.data.notes, e.data.hand, e.data.settings, (progress) => {
        const progressMsg: FingeringResponse = {
          type: 'PROGRESS',
          requestId: e.data.requestId,
          progress,
        };
        self.postMessage(progressMsg);
      });
      const resultMsg: FingeringResponse = {
        type: 'RESULT',
        requestId: e.data.requestId,
        result,
      };
      self.postMessage(resultMsg);
    } catch (err) {
      const errorMsg: FingeringResponse = {
        type: 'ERROR',
        requestId: e.data.requestId,
        error: String(err),
      };
      self.postMessage(errorMsg);
    }
  }
};
