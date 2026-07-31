import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginRepoOperation,
  subscribeRepoEvents,
  useRepoStore,
} from "./repo-store";

// The bridge is fully mocked: `request` is a typed vi.fn so each test pins the
// response/throw for a given command, and `setRepoContext` is observed to
// assert the store converges onto the host-authoritative active id.
const requestMock = vi.fn();
const setRepoContextMock = vi.fn();
let repoEventListener:
  | ((event: string, data: Record<string, unknown>) => void)
  | undefined;
vi.mock("../bridge", () => ({
  bridge: {
    request: (...args: unknown[]) => requestMock(...args),
    onEvent: vi.fn(
      (listener: (event: string, data: Record<string, unknown>) => void) => {
        repoEventListener = listener;
        return () => {};
      },
    ),
    setRepoContext: (...args: unknown[]) => setRepoContextMock(...args),
  },
}));

function resetStore() {
  useRepoStore.setState({ repos: [], activeRepoId: null });
}

describe("repo-store.select (Fix-5 F5: response activeId is authoritative)", () => {
  beforeEach(() => {
    requestMock.mockReset();
    setRepoContextMock.mockReset();
    resetStore();
    subscribeRepoEvents();
  });

  it("sets activeRepoId from the RESPONSE activeId, not the requested repoId", async () => {
    // The host re-reads the registry after persist; its response is the truth.
    // Here the requested id differs from the authoritative one to prove the
    // store does not blindly trust the requested id.
    requestMock.mockResolvedValue({ activeId: "/authoritative" });

    await useRepoStore.getState().select("/requested");

    expect(useRepoStore.getState().activeRepoId).toBe("/authoritative");
    expect(setRepoContextMock).toHaveBeenCalledWith("/authoritative");
    // And the requested id was never used as the active context.
    expect(setRepoContextMock).not.toHaveBeenCalledWith("/requested");
  });

  it("on rejection (repo removed → REPO_NOT_FOUND) re-syncs from the host via load()", async () => {
    // select throws (host raised REPO_NOT_FOUND because the repo was removed by
    // a concurrent reconciliation). The store must re-sync to the registry's
    // fallback rather than be left on the stale requested id.
    // The mock is command-aware: selectRepo rejects; getRepos (the load() path)
    // returns the host's fallback repo set; showErrorNotification resolves.
    requestMock.mockImplementation((cmd: string) => {
      if (cmd === "selectRepo") {
        return Promise.reject(new Error("REPO_NOT_FOUND"));
      }
      if (cmd === "getRepos") {
        return Promise.resolve({
          repos: [{ id: "/fallback", name: "fallback", rootPath: "/fallback" }],
          activeId: "/fallback",
        });
      }
      return Promise.resolve(undefined);
    });

    await useRepoStore.getState().select("/gone");

    // The store converged onto the host's fallback active repo, not "/gone".
    expect(useRepoStore.getState().activeRepoId).toBe("/fallback");
    expect(useRepoStore.getState().repos).toEqual([
      { id: "/fallback", name: "fallback", rootPath: "/fallback" },
    ]);
    expect(setRepoContextMock).toHaveBeenCalledWith("/fallback");
    // The stale requested id was never installed as the repo context.
    expect(setRepoContextMock).not.toHaveBeenCalledWith("/gone");
    // selectRepo was attempted, then a showErrorNotification, then getRepos.
    const cmds = requestMock.mock.calls.map((c) => c[0]);
    expect(cmds).toContain("selectRepo");
    expect(cmds).toContain("showErrorNotification");
    expect(cmds).toContain("getRepos");
    // And getRepos (the re-sync) ran AFTER selectRepo.
    expect(cmds.indexOf("selectRepo")).toBeLessThan(cmds.indexOf("getRepos"));
  });

  it("uses null when the response omits activeId", async () => {
    requestMock.mockResolvedValue({}); // no activeId field
    await useRepoStore.getState().select("/x");
    expect(useRepoStore.getState().activeRepoId).toBeNull();
    expect(setRepoContextMock).toHaveBeenCalledWith(null);
  });

  it("defers an external active-repository switch until the Commit mutation releases its binding", () => {
    useRepoStore.setState({
      activeRepoId: "/a",
      repos: [{ id: "/a", name: "a", rootPath: "/a" }],
    });
    const release = beginRepoOperation();

    repoEventListener?.("activeRepoChanged", {
      repo: { id: "/b", name: "b", rootPath: "/b" },
    });

    expect(useRepoStore.getState().activeRepoId).toBe("/a");
    expect(setRepoContextMock).not.toHaveBeenCalledWith("/b");

    release();

    expect(useRepoStore.getState().activeRepoId).toBe("/b");
    expect(setRepoContextMock).toHaveBeenCalledWith("/b");
  });

  it("keeps only the latest active repository while a Commit mutation is bound", () => {
    useRepoStore.setState({ activeRepoId: "/a" });
    const release = beginRepoOperation();

    repoEventListener?.("activeRepoChanged", {
      repo: { id: "/b", name: "b", rootPath: "/b" },
    });
    repoEventListener?.("activeRepoChanged", {
      repo: { id: "/c", name: "c", rootPath: "/c" },
    });

    release();

    expect(useRepoStore.getState().activeRepoId).toBe("/c");
    expect(setRepoContextMock).not.toHaveBeenCalledWith("/b");
    expect(setRepoContextMock).toHaveBeenCalledWith("/c");
  });
});
