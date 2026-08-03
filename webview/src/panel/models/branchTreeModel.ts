import type { BranchInfo } from "../../shared/types/git";
import {
  buildBranchTreeSnapshot as buildSnapshot,
  normalizeBranchEntries,
} from "../branches/model/branchTreeModel";
import type {
  BranchTreeNode as DomainBranchTreeNode,
  BranchTreeSnapshot as DomainBranchTreeSnapshot,
} from "../branches/model/branchTreeTypes";

export interface BranchTreeNode extends Omit<DomainBranchTreeNode, "children"> {
  children: readonly BranchTreeNode[];
  branch?: BranchInfo;
}

export interface BranchTreeSnapshot
  extends Omit<DomainBranchTreeSnapshot, "roots"> {
  roots: readonly BranchTreeNode[];
}

export function buildBranchTreeSnapshot(
  branches: readonly BranchInfo[],
  options: { grouped: boolean; favoriteRefs: ReadonlySet<string> },
): BranchTreeSnapshot {
  const snapshot = buildSnapshot(
    normalizeBranchEntries(branches, options.favoriteRefs),
    {
      repoId: "legacy",
      grouped: options.grouped,
    },
  );
  return {
    ...snapshot,
    roots: snapshot.roots.map(toLegacyNode),
  };
}

function toLegacyNode(node: DomainBranchTreeNode): BranchTreeNode {
  const sourceBranch = node.entry?.branch;
  const branch =
    sourceBranch && node.entry?.isFavorite && !sourceBranch.isFavorite
      ? { ...sourceBranch, isFavorite: true }
      : sourceBranch;
  return {
    ...node,
    children: node.children.map(toLegacyNode),
    branch,
  };
}
