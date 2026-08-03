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
  it("closes a menu when the captured current branch changes", () => {
    const { result, rerender } = renderHook(
      ({ currentBranch }) =>
        useBranchOverlay("repo-a", new Set([sourceRefKey]), currentBranch),
      { initialProps: { currentBranch: "main" } },
    );

    act(() => {
      result.current.openBranchMenu({
        x: 20,
        y: 30,
        context: branchActionContext,
      });
    });
    rerender({ currentBranch: "release" });

    expect(result.current.overlay).toBeNull();
  });

  it("opens a repository-bound create overlay without a source ref", () => {
    const { result } = renderHook(() =>
      useBranchOverlay("repo-a", new Set<string>(), ""),
    );

    act(() => {
      result.current.openCreate({ startPoint: "HEAD", defaultName: "" });
    });

    expect(result.current.overlay).toMatchObject({
      kind: "create",
      repoId: "repo-a",
      startPoint: "HEAD",
    });
  });

  it("closes a branch menu when its repository changes", () => {
    const { result, rerender } = renderHook(
      ({ repoId, validRefKeys }) =>
        useBranchOverlay(repoId, validRefKeys, "main"),
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
      ({ validRefKeys }) => useBranchOverlay("repo-a", validRefKeys, "main"),
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

  it("returns no stale overlay immediately after a repository rerender", () => {
    const { result, rerender } = renderHook(
      ({ repoId, validRefKeys }) =>
        useBranchOverlay(repoId, validRefKeys, "main"),
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
    rerender({ repoId: "repo-b", validRefKeys: new Set([sourceRefKey]) });

    expect(result.current.overlay).toBeNull();
  });

  it("closes a tag menu when its captured ref disappears", () => {
    const { result, rerender } = renderHook(
      ({ validRefKeys }) => useBranchOverlay("repo-a", validRefKeys, "main"),
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
      ({ validRefKeys }) => useBranchOverlay("repo-a", validRefKeys, "main"),
      { initialProps: { validRefKeys: new Set([sourceRefKey]) } },
    );

    act(() => {
      open(result.current);
    });
    rerender({ validRefKeys: new Set<string>() });

    expect(result.current.overlay).toBeNull();
  });
});
