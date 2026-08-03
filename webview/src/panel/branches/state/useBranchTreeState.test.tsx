import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildBranchTreeSnapshot,
  normalizeBranchEntries,
} from "../model/branchTreeModel";
import { useBranchTreeState } from "./useBranchTreeState";

const groupedDirectoryId = "repo:repo-a:dir:local:feature";
const groupedSnapshot = buildBranchTreeSnapshot(
  normalizeBranchEntries([
    {
      name: "feature/login",
      fullRef: "refs/heads/feature/login",
      isRemote: false,
      isCurrent: false,
      isFavorite: false,
      ahead: 0,
      behind: 0,
      lastCommitHash: "tip",
    },
  ]),
  { repoId: "repo-a", grouped: true },
);
const flatSnapshot = buildBranchTreeSnapshot(
  normalizeBranchEntries([
    {
      name: "feature/login",
      fullRef: "refs/heads/feature/login",
      isRemote: false,
      isCurrent: false,
      isFavorite: false,
      ahead: 0,
      behind: 0,
      lastCommitHash: "tip",
    },
  ]),
  { repoId: "repo-a", grouped: false },
);

describe("useBranchTreeState", () => {
  it("preserves grouped collapse state through a real flat Task 1 snapshot", () => {
    const { result, rerender } = renderHook(
      ({ mode, snapshot }) => useBranchTreeState("repo-a", mode, snapshot),
      { initialProps: { mode: "grouped" as const, snapshot: groupedSnapshot } },
    );

    act(() => {
      result.current.toggle(groupedDirectoryId);
    });
    rerender({ mode: "flat", snapshot: flatSnapshot });
    rerender({ mode: "grouped", snapshot: groupedSnapshot });

    expect(result.current.collapsedIds).toEqual(new Set([groupedDirectoryId]));
  });

  it("returns reset state immediately when the repository input changes", () => {
    const { result, rerender } = renderHook(
      ({ repoId }) => useBranchTreeState(repoId, "grouped", groupedSnapshot),
      { initialProps: { repoId: "repo-a" } },
    );

    act(() => {
      result.current.setSearchQuery("feature");
      result.current.toggle(groupedDirectoryId);
    });
    rerender({ repoId: "repo-b" });

    expect(result.current.searchQuery).toBe("");
    expect(result.current.collapsedIds).toEqual(new Set());
  });
});
