import { describe, expect, it } from "vitest";
import type { BranchInfo } from "../../shared/types/git";
import { buildBranchTreeSnapshot } from "./branchTreeModel";

function branch(
  name: string,
  fullRef: string,
  overrides: Partial<BranchInfo> = {},
): BranchInfo {
  return {
    name,
    fullRef,
    isRemote: fullRef.startsWith("refs/remotes/"),
    isCurrent: false,
    isFavorite: false,
    ahead: 0,
    behind: 0,
    lastCommitHash: "tip",
    ...overrides,
  };
}

function leafIds(
  snapshot: ReturnType<typeof buildBranchTreeSnapshot>,
): string[] {
  const ids: string[] = [];
  const visit = (nodes: typeof snapshot.roots) => {
    for (const node of nodes) {
      if (node.branch) ids.push(node.id);
      visit(node.children);
    }
  };
  visit(snapshot.roots);
  return ids;
}

describe("buildBranchTreeSnapshot", () => {
  it("keeps local and remote branches with the same leaf name distinct", () => {
    const snapshot = buildBranchTreeSnapshot(
      [
        branch("feature", "refs/heads/feature"),
        branch("origin/feature", "refs/remotes/origin/feature"),
      ],
      { grouped: false, favoriteRefs: new Set() },
    );

    expect(leafIds(snapshot)).toEqual([
      "ref:refs/heads/feature",
      "ref:refs/remotes/origin/feature",
    ]);
  });

  it("assigns unique identities when a branch leaf and directory share a display name", () => {
    const snapshot = buildBranchTreeSnapshot(
      [
        branch("feature", "refs/heads/feature"),
        branch("feature/login", "refs/heads/feature/login"),
      ],
      { grouped: true, favoriteRefs: new Set() },
    );

    expect(snapshot.nodeIds).toEqual(
      new Set([
        "dir:local:feature",
        "ref:refs/heads/feature",
        "ref:refs/heads/feature/login",
      ]),
    );
  });

  it("orders favorites ahead of equivalent non-favorites without changing source order", () => {
    const branches = [
      branch("zebra", "refs/heads/zebra"),
      branch("alpha", "refs/heads/alpha"),
    ];
    const snapshot = buildBranchTreeSnapshot(branches, {
      grouped: false,
      favoriteRefs: new Set(["refs/heads/zebra"]),
    });

    expect(snapshot.roots.map((node) => node.branch?.name)).toEqual([
      "zebra",
      "alpha",
    ]);
    expect(branches.map((item) => item.name)).toEqual(["zebra", "alpha"]);
  });

  it("rebuilds grouped and flat views from the same snapshot without duplicate leaves", () => {
    const branches = [
      branch("feature/login", "refs/heads/feature/login"),
      branch("feature/logout", "refs/heads/feature/logout"),
    ];

    const grouped = buildBranchTreeSnapshot(branches, {
      grouped: true,
      favoriteRefs: new Set(),
    });
    const flat = buildBranchTreeSnapshot(branches, {
      grouped: false,
      favoriteRefs: new Set(),
    });
    const groupedAgain = buildBranchTreeSnapshot(branches, {
      grouped: true,
      favoriteRefs: new Set(),
    });

    expect(leafIds(grouped)).toEqual(leafIds(groupedAgain));
    expect(leafIds(flat)).toHaveLength(2);
    expect(new Set(leafIds(groupedAgain)).size).toBe(2);
  });
});
