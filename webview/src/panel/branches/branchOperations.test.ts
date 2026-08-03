import { describe, expect, it, vi } from "vitest";
import type { BranchInfo, GitRefIdentity } from "../../shared/types/git";
import { createBranchOperations } from "./branchOperations";

const localFeatureBranch: BranchInfo = {
  name: "feature",
  fullRef: "refs/heads/feature",
  isRemote: false,
  isCurrent: false,
  isFavorite: false,
  upstream: "origin/feature",
  ahead: 1,
  behind: 2,
  lastCommitHash: "feature-tip",
};

const localFeatureRef: GitRefIdentity = {
  type: "local",
  name: "feature",
  fullRef: "refs/heads/feature",
};

describe("createBranchOperations", () => {
  it("forwards every operation to its captured repository", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const requestWithProgress = vi.fn().mockResolvedValue(undefined);
    const setFavorite = vi.fn().mockResolvedValue(undefined);
    const operations = createBranchOperations({
      request,
      requestWithProgress,
      setFavorite,
    });

    await operations.checkout("repo-a", localFeatureBranch);
    await operations.create("repo-a", {
      newBranchName: "topic",
      startPoint: "feature",
      checkout: true,
      force: false,
    });
    await operations.delete("repo-a", localFeatureBranch, true);
    await operations.rename("repo-a", "feature", "renamed");
    await operations.update("repo-a", "feature");
    await operations.push("repo-a", "feature", true);
    await operations.merge("repo-a", "feature");
    await operations.rebase("repo-a", "feature");
    await operations.checkoutAndRebase("repo-a", "feature", "main");
    await operations.setFavorite("repo-a", localFeatureRef, true);
    await operations.compare("repo-a", localFeatureRef);
    await operations.fetch("repo-a");
    await operations.createPrompt("repo-a");
    await operations.deletePrompt("repo-a", "feature");

    expect(requestWithProgress).toHaveBeenCalledWith(
      "checkoutBranch",
      { branchName: "feature" },
      { repoId: "repo-a" },
    );
    expect(requestWithProgress).toHaveBeenCalledWith(
      "createBranch",
      {
        newBranchName: "topic",
        startPoint: "feature",
        checkout: true,
        force: false,
      },
      { repoId: "repo-a" },
    );
    expect(requestWithProgress).toHaveBeenCalledWith(
      "deleteBranch",
      { branchName: "feature", isRemote: false, force: true },
      { repoId: "repo-a" },
    );
    expect(request).toHaveBeenCalledWith(
      "renameBranch",
      { oldName: "feature", newName: "renamed" },
      { repoId: "repo-a" },
    );
    expect(requestWithProgress).toHaveBeenCalledWith(
      "updateBranch",
      { branchName: "feature" },
      { repoId: "repo-a" },
    );
    expect(requestWithProgress).toHaveBeenCalledWith(
      "pushBranch",
      { branchName: "feature", force: true },
      { repoId: "repo-a" },
    );
    expect(requestWithProgress).toHaveBeenCalledWith(
      "mergeBranch",
      { branchName: "feature" },
      { repoId: "repo-a" },
    );
    expect(requestWithProgress).toHaveBeenCalledWith(
      "rebaseBranch",
      { onto: "feature" },
      { repoId: "repo-a" },
    );
    expect(requestWithProgress).toHaveBeenCalledWith(
      "checkoutAndRebase",
      { branchToCheckout: "feature", rebaseOnto: "main" },
      { repoId: "repo-a" },
    );
    expect(setFavorite).toHaveBeenCalledWith(localFeatureRef, true, "repo-a");
    expect(request).toHaveBeenCalledWith(
      "openCompareWithCurrent",
      { ref: localFeatureRef },
      { repoId: "repo-a" },
    );
    expect(request).toHaveBeenCalledWith("fetchAll", undefined, {
      repoId: "repo-a",
    });
    expect(request).toHaveBeenCalledWith(
      "createBranchPrompt",
      {},
      { repoId: "repo-a" },
    );
    expect(request).toHaveBeenCalledWith(
      "deleteBranchPrompt",
      { branchName: "feature" },
      { repoId: "repo-a" },
    );
  });

  it("checks out a remote branch by creating its local tracking branch", async () => {
    const requestWithProgress = vi.fn().mockResolvedValue(undefined);
    const operations = createBranchOperations({
      request: vi.fn().mockResolvedValue(undefined),
      requestWithProgress,
      setFavorite: vi.fn().mockResolvedValue(undefined),
    });
    const remoteBranch: BranchInfo = {
      ...localFeatureBranch,
      name: "origin/team/feature",
      fullRef: "refs/remotes/origin/team/feature",
      isRemote: true,
      upstream: undefined,
    };

    await operations.checkout("repo-b", remoteBranch);

    expect(requestWithProgress).toHaveBeenCalledWith(
      "createBranch",
      {
        newBranchName: "team/feature",
        startPoint: "origin/team/feature",
        checkout: true,
      },
      { repoId: "repo-b" },
    );
  });
});
