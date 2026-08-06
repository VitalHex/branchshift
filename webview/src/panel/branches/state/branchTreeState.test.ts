import { describe, expect, it } from "vitest";
import {
  createBranchTreeState,
  effectiveCollapsedIds,
  reconcileCollapsedIds,
  reduceBranchTreeState,
} from "./branchTreeState";

describe("branch tree state", () => {
  it("keeps collapsed directories independent for each display mode", () => {
    let state = createBranchTreeState("repo-a", "grouped");
    state = reduceBranchTreeState(state, {
      type: "toggle",
      id: "repo:repo-a:dir:local:feature",
    });
    state = reduceBranchTreeState(state, { type: "set-mode", mode: "flat" });
    state = reduceBranchTreeState(state, {
      type: "set-mode",
      mode: "grouped",
    });

    expect(
      state.collapsedByMode.grouped.has("repo:repo-a:dir:local:feature"),
    ).toBe(true);
    expect(state.collapsedByMode.flat.size).toBe(0);
  });

  it("temporarily expands all directories while searching without losing saved state", () => {
    let state = createBranchTreeState("repo-a", "grouped");
    state = reduceBranchTreeState(state, {
      type: "toggle",
      id: "repo:repo-a:dir:local:feature",
    });

    const filtered = effectiveCollapsedIds(state, true);

    expect(filtered.size).toBe(0);
    expect(state.collapsedByMode.grouped.size).toBe(1);
  });

  it("drops vanished directories from the reconciled mode but retains section collapses", () => {
    let state = createBranchTreeState("repo-a", "grouped");
    for (const id of [
      "repo:repo-a:dir:local:feature",
      "section:local",
      "section:remote",
      "section:tags",
    ]) {
      state = reduceBranchTreeState(state, { type: "toggle", id });
    }
    const reconciled = reconcileCollapsedIds(
      state,
      "grouped",
      new Set(["repo:repo-a:dir:remote:release"]),
    );

    expect(reconciled.collapsedByMode.grouped).toEqual(
      new Set(["section:local", "section:remote", "section:tags"]),
    );
  });

  it("resets search and collapse state when the repository changes", () => {
    let state = createBranchTreeState("repo-a", "grouped");
    state = reduceBranchTreeState(state, { type: "set-search", query: "feat" });
    state = reduceBranchTreeState(state, {
      type: "toggle",
      id: "repo:repo-a:dir:local:feature",
    });

    state = reduceBranchTreeState(state, {
      type: "set-repo",
      repoId: "repo-b",
    });

    expect(state).toMatchObject({ repoId: "repo-b", searchQuery: "" });
    expect(state.collapsedByMode.grouped.size).toBe(0);
    expect(state.collapsedByMode.flat.size).toBe(0);
  });
});
