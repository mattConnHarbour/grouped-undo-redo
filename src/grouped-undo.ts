import type { BrowserDocumentApi } from 'superdoc/ui';

export type HistoryDirection = 'undo' | 'redo';

interface CompoundHistoryBoundary {
  depth: number;
  count: number;
}

export interface HistoryApplicationResult {
  appliedCount: number;
  wasCompoundOperation: boolean;
}

export class CompoundHistoryCoordinator {
  private doc: BrowserDocumentApi | null = null;
  private history: CompoundHistoryBoundary | null = null;
  private isApplyingHistory = false;

  constructor(private readonly direction: HistoryDirection) {}

  attach(doc: BrowserDocumentApi) {
    this.doc = doc;
  }

  detach() {
    this.doc = null;
    this.history = null;
  }

  arm(depth: number, count: number) {
    this.history = { depth, count };
  }

  disarm() {
    this.history = null;
  }

  async apply(): Promise<HistoryApplicationResult | null> {
    // Capture the active document and reject overlapping requests on this coordinator.
    const doc = this.doc;
    if (!doc || this.isApplyingHistory) return null;
    this.isApplyingHistory = true;

    try {
      const state = await doc.history.get();
      const currentDepth = this.direction === 'undo' ? state.undoDepth : state.redoDepth;
      const history = this.history;
      const wasCompoundOperation = history !== null && currentDepth === history.depth;
      const historyCountToApply = wasCompoundOperation ? history.count : 1;

      // Consume a matched operation or discard one whose boundary has passed.
      if (history && currentDepth <= history.depth) this.history = null;

      // Apply one native history step or every step belonging to the compound operation.
      let appliedCount = 0;
      for (; appliedCount < historyCountToApply; appliedCount += 1) {
        const result = await doc.history[this.direction]();
        if (result.noop) break;
      }
      return { appliedCount, wasCompoundOperation };
    } finally {
      this.isApplyingHistory = false;
    }
  }
}
