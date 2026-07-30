import { beforeEach, describe, expect, it, vi } from "vitest";
import { bridge } from "../bridge";
import {
  applyRepoSwitch,
  pruneRemovedDrafts,
  useCommitStore,
} from "./commit-store";
import { useRepoStore } from "./repo-store";

vi.mock("../bridge", () => ({
  bridge: {
    request: vi.fn(),
    onEvent: vi.fn(() => () => {}),
    setRepoContext: vi.fn(),
  },
}));

describe("commit-store per-repo isolation", () => {
  beforeEach(() => {
    useCommitStore.setState({
      commitMessage: "",
      selectedFiles: new Set(),
      highlightedFiles: new Set(),
      amend: false,
      changes: [],
      expandedGroups: new Set(["changes", "unversioned", "staged"]),
      collapsedDirs: new Set(),
      fetchChanges: vi.fn(),
    });
    vi.mocked(bridge.request).mockReset();
  });

  it("saves and restores a draft across a repo switch", async () => {
    useCommitStore.setState({
      commitMessage: "draft for A",
      selectedFiles: new Set(["a.ts:false"]),
    });
    await applyRepoSwitch("/a", "/b", false);
    expect(useCommitStore.getState().commitMessage).toBe(""); // B had no draft
    useCommitStore.setState({ commitMessage: "draft for B" });
    await applyRepoSwitch("/b", "/a", false);
    expect(useCommitStore.getState().commitMessage).toBe("draft for A"); // A restored
  });

  it("prunes drafts for removed repos", async () => {
    await applyRepoSwitch(null, "/gone", false);
    useCommitStore.setState({ commitMessage: "x" });
    await applyRepoSwitch("/gone", null, false);
    pruneRemovedDrafts([]); // /gone removed
    useRepoStore.setState({ activeRepoId: null, repos: [] });
    await applyRepoSwitch(null, "/gone", false);
    expect(useCommitStore.getState().commitMessage).toBe("");
  });
});

describe("commit-store selected commit payload", () => {
  beforeEach(() => {
    useCommitStore.setState({
      commitMessage: "",
      selectedFiles: new Set(),
      highlightedFiles: new Set(),
      amend: false,
      changes: [],
      loading: false,
      fetchChanges: vi.fn(),
    });
    vi.mocked(bridge.request).mockReset();
  });

  it("sends every checked staged and unstaged row as a full identity", async () => {
    vi.mocked(bridge.request).mockResolvedValue({ success: true });
    useCommitStore.setState({
      commitMessage: "selected changes",
      amend: true,
      changes: [
        {
          path: "partial.txt",
          status: "modified",
          staged: true,
        },
        {
          path: "partial.txt",
          status: "modified",
          staged: false,
        },
        {
          path: "new-name.txt",
          oldPath: "old-name.txt",
          status: "renamed",
          staged: true,
        },
        {
          path: "ignored.txt",
          status: "modified",
          staged: false,
        },
      ],
      selectedFiles: new Set([
        "partial.txt:true",
        "partial.txt:false",
        "new-name.txt:true",
      ]),
    });

    await expect(useCommitStore.getState().commit()).resolves.toBe(true);

    expect(bridge.request).toHaveBeenCalledWith("commitChanges", {
      message: "selected changes",
      amend: true,
      selections: [
        {
          path: "partial.txt",
          status: "modified",
          staged: true,
        },
        {
          path: "partial.txt",
          status: "modified",
          staged: false,
        },
        {
          path: "new-name.txt",
          oldPath: "old-name.txt",
          status: "renamed",
          staged: true,
        },
      ],
    });
    expect(useCommitStore.getState().commitMessage).toBe("");
    expect(useCommitStore.getState().amend).toBe(false);
  });

  it("keeps the draft and amend mode when the selected commit fails", async () => {
    vi.mocked(bridge.request).mockRejectedValue({
      code: "COMMIT_REJECTED",
      message: "hook rejected",
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    useCommitStore.setState({
      commitMessage: "keep this draft",
      amend: true,
      changes: [
        {
          path: "selected.txt",
          status: "modified",
          staged: false,
        },
      ],
      selectedFiles: new Set(["selected.txt:false"]),
    });

    await expect(useCommitStore.getState().commit()).resolves.toBe(false);

    expect(useCommitStore.getState().commitMessage).toBe("keep this draft");
    expect(useCommitStore.getState().amend).toBe(true);
    consoleError.mockRestore();
  });

  it("sends the same selected identities through commit and push", async () => {
    vi.mocked(bridge.request).mockResolvedValue({ success: true });
    useCommitStore.setState({
      commitMessage: "selected and push",
      changes: [
        {
          path: "selected.txt",
          status: "added",
          staged: true,
        },
      ],
      selectedFiles: new Set(["selected.txt:true"]),
    });

    await expect(useCommitStore.getState().commitAndPush()).resolves.toBe(true);

    expect(bridge.request).toHaveBeenCalledWith("commitAndPush", {
      message: "selected and push",
      amend: false,
      selections: [
        {
          path: "selected.txt",
          status: "added",
          staged: true,
        },
      ],
    });
  });
});
