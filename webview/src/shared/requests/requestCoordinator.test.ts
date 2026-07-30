import { describe, expect, it, vi } from "vitest";
import { RequestCoordinator } from "./requestCoordinator";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("RequestCoordinator", () => {
  it("rejects a result captured before the repository changes", async () => {
    const coordinator = new RequestCoordinator();
    coordinator.setRepository("repo-a");
    const response = deferred<string>();
    const apply = vi.fn();

    const request = coordinator.runLatest(
      "working-tree",
      () => response.promise,
      apply,
    );
    const firstGeneration = coordinator.setRepository("repo-b");
    response.resolve("old");

    await expect(request).resolves.toBe("stale");
    expect(apply).not.toHaveBeenCalled();
    expect(coordinator.setRepository("repo-b")).toBe(firstGeneration);
  });

  it("applies only the newest result within a latest-wins channel", async () => {
    const coordinator = new RequestCoordinator();
    coordinator.setRepository("repo");
    const older = deferred<string>();
    const newer = deferred<string>();
    const applied: string[] = [];

    const olderRequest = coordinator.runLatest(
      "selection",
      () => older.promise,
      (value) => applied.push(value),
    );
    const newerRequest = coordinator.runLatest(
      "selection",
      () => newer.promise,
      (value) => applied.push(value),
    );

    newer.resolve("newer");
    older.resolve("older");

    await expect(newerRequest).resolves.toBe("applied");
    await expect(olderRequest).resolves.toBe("stale");
    expect(applied).toEqual(["newer"]);
  });

  it("allows independent latest-wins channels to apply", async () => {
    const coordinator = new RequestCoordinator();
    coordinator.setRepository("repo");
    const first = deferred<string>();
    const second = deferred<string>();
    const applied: string[] = [];

    const firstRequest = coordinator.runLatest(
      "refs",
      () => first.promise,
      (value) => applied.push(value),
    );
    const secondRequest = coordinator.runLatest(
      "history",
      () => second.promise,
      (value) => applied.push(value),
    );

    second.resolve("history");
    first.resolve("refs");

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      "applied",
      "applied",
    ]);
    expect(applied).toEqual(["history", "refs"]);
  });

  it("balances pending counts for overlapping and stale requests", async () => {
    const coordinator = new RequestCoordinator();
    coordinator.setRepository("repo-a");
    const first = deferred<string>();
    const second = deferred<string>();
    const pending: number[] = [];
    coordinator.subscribePending((count) => pending.push(count));

    const firstRequest = coordinator.runLatest(
      "first",
      () => first.promise,
      vi.fn(),
    );
    const secondRequest = coordinator.runLatest(
      "second",
      () => second.promise,
      vi.fn(),
    );
    coordinator.setRepository("repo-b");

    second.resolve("second");
    await secondRequest;
    first.resolve("first");
    await firstRequest;

    expect(pending).toEqual([1, 2, 1, 0]);
  });

  it("balances pending counts and preserves operation failures", async () => {
    const coordinator = new RequestCoordinator();
    const pending: number[] = [];
    const failure = new Error("cancelled");
    coordinator.subscribePending((count) => pending.push(count));

    const request = coordinator.runLatest(
      "operation",
      () => Promise.reject(failure),
      vi.fn(),
    );

    await expect(request).rejects.toBe(failure);
    expect(pending).toEqual([1, 0]);
  });

  it("coalesces refresh invalidations and runs one follow-up after an in-flight invalidation", async () => {
    const coordinator = new RequestCoordinator();
    const firstRun = deferred<void>();
    const secondRun = deferred<void>();
    const pending: number[] = [];
    coordinator.subscribePending((count) => pending.push(count));
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => firstRun.promise)
      .mockImplementationOnce(() => secondRun.promise);

    coordinator.scheduleRefresh("working-tree", refresh);
    coordinator.scheduleRefresh("working-tree", refresh);
    await flushMicrotasks();
    expect(refresh).toHaveBeenCalledTimes(1);

    coordinator.scheduleRefresh("working-tree", refresh);
    coordinator.scheduleRefresh("working-tree", refresh);
    firstRun.resolve();
    await flushMicrotasks();
    expect(refresh).toHaveBeenCalledTimes(2);

    secondRun.resolve();
    await flushMicrotasks();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(pending).toEqual([1, 2, 1, 0]);
  });
});
