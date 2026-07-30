export type RequestApplyResult = "applied" | "stale";

interface RequestToken {
  repoId: string | null;
  generation: number;
  channel: string;
  sequence: number;
}

interface RefreshState {
  running: boolean;
  dirty: boolean;
  refresh: () => Promise<void>;
}

export class RequestCoordinator {
  private repositoryId: string | null = null;
  private generation = 0;
  private readonly channelSequences = new Map<string, number>();
  private pending = 0;
  private readonly pendingListeners = new Set<(pending: number) => void>();
  private readonly refreshStates = new Map<string, RefreshState>();

  setRepository(repoId: string | null): number {
    if (repoId === this.repositoryId) return this.generation;

    this.repositoryId = repoId;
    this.generation += 1;
    this.channelSequences.clear();
    return this.generation;
  }

  async runLatest<T>(
    channel: string,
    operation: () => Promise<T>,
    apply: (value: T) => void,
  ): Promise<RequestApplyResult> {
    const token = this.nextToken(channel);
    this.changePending(1);

    try {
      const value = await operation();
      if (!this.isCurrent(token)) return "stale";

      apply(value);
      return "applied";
    } finally {
      this.changePending(-1);
    }
  }

  scheduleRefresh(domain: string, refresh: () => Promise<void>): void {
    const existing = this.refreshStates.get(domain);
    if (existing) {
      existing.refresh = refresh;
      if (existing.running && !existing.dirty) {
        existing.dirty = true;
        this.changePending(1);
      }
      return;
    }

    const state: RefreshState = {
      running: false,
      dirty: false,
      refresh,
    };
    this.refreshStates.set(domain, state);
    this.changePending(1);
    queueMicrotask(() => void this.runRefresh(domain, state));
  }

  subscribePending(listener: (pending: number) => void): () => void {
    this.pendingListeners.add(listener);
    return () => this.pendingListeners.delete(listener);
  }

  private nextToken(channel: string): RequestToken {
    const sequence = (this.channelSequences.get(channel) ?? 0) + 1;
    this.channelSequences.set(channel, sequence);
    return {
      repoId: this.repositoryId,
      generation: this.generation,
      channel,
      sequence,
    };
  }

  private isCurrent(token: RequestToken): boolean {
    return (
      token.repoId === this.repositoryId &&
      token.generation === this.generation &&
      token.sequence === this.channelSequences.get(token.channel)
    );
  }

  private changePending(change: 1 | -1): void {
    this.pending += change;
    for (const listener of this.pendingListeners) listener(this.pending);
  }

  private async runRefresh(domain: string, state: RefreshState): Promise<void> {
    state.running = true;
    try {
      await state.refresh();
    } finally {
      state.running = false;
      if (state.dirty) {
        state.dirty = false;
        queueMicrotask(() => void this.runRefresh(domain, state));
      } else {
        this.refreshStates.delete(domain);
      }
      this.changePending(-1);
    }
  }
}
