import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BranchActionContext } from "../actions/branchActionTypes";
import { useBranchOverlay } from "./useBranchOverlay";

const branchActionContext: BranchActionContext = {
  repoId: "repo-a",
  ref: {
    type: "local",
    name: "feature",
    fullRef: "refs/heads/feature",
  },
  branch: {
    name: "feature",
    fullRef: "refs/heads/feature",
    isRemote: false,
    isCurrent: false,
    isFavorite: false,
    ahead: 0,
    behind: 0,
    lastCommitHash: "tip",
  },
  currentBranch: "main",
};

const sourceRefKey = "local:refs/heads/feature";

describe("useBranchOverlay", () => {
  it("closes a branch menu when its repository changes", () => {
    const { result, rerender } = renderHook(
      ({ repoId, validRefKeys }) => useBranchOverlay(repoId, validRefKeys),
      {
        initialProps: {
          repoId: "repo-a",
          validRefKeys: new Set([sourceRefKey]),
        },
      },
    );

    act(() => {
      result.current.openBranchMenu({
        x: 20,
        y: 30,
        context: branchActionContext,
      });
    });
    rerender({ repoId: "repo-b", validRefKeys: new Set<string>() });

    expect(result.current.overlay).toBeNull();
  });

  it("closes a branch menu when its captured ref disappears", () => {
    const { result, rerender } = renderHook(
      ({ validRefKeys }) => useBranchOverlay("repo-a", validRefKeys),
      { initialProps: { validRefKeys: new Set([sourceRefKey]) } },
    );

    act(() => {
      result.current.openBranchMenu({
        x: 20,
        y: 30,
        context: branchActionContext,
      });
    });
    rerender({ validRefKeys: new Set<string>() });

    expect(result.current.overlay).toBeNull();
  });

  it("closes a tag menu when its captured ref disappears", () => {
    const { result, rerender } = renderHook(
      ({ validRefKeys }) => useBranchOverlay("repo-a", validRefKeys),
      { initialProps: { validRefKeys: new Set([sourceRefKey]) } },
    );

    act(() => {
      result.current.openTagMenu({
        x: 20,
        y: 30,
        context: branchActionContext,
      });
    });
    rerender({ validRefKeys: new Set<string>() });

    expect(result.current.overlay).toBeNull();
  });

  it.each([
    [
      "create",
      (open: ReturnType<typeof useBranchOverlay>) =>
        open.openCreate({
          sourceRefKey,
          startPoint: "feature",
          defaultName: "copy",
        }),
    ],
    [
      "push",
      (open: ReturnType<typeof useBranchOverlay>) =>
        open.openPush({ sourceRefKey, branchName: "feature" }),
    ],
  ])("closes a %s overlay when its source ref disappears", (_kind, open) => {
    const { result, rerender } = renderHook(
      ({ validRefKeys }) => useBranchOverlay("repo-a", validRefKeys),
      { initialProps: { validRefKeys: new Set([sourceRefKey]) } },
    );

    act(() => {
      open(result.current);
    });
    rerender({ validRefKeys: new Set<string>() });

    expect(result.current.overlay).toBeNull();
  });
});
