import type { BranchInfo, TagInfo } from "../../../shared/types/git";
import type {
  BranchTreeEntry,
  BranchTreeNode,
  BranchTreeScope,
  BranchTreeSnapshot,
} from "./branchTreeTypes";

interface MutableBranchTreeNode {
  id: string;
  name: string;
  children: MutableBranchTreeNode[];
  entry?: BranchTreeEntry;
  isLeaf: boolean;
}

export function normalizeBranchEntries(
  branches: readonly BranchInfo[],
  favoriteRefs: ReadonlySet<string> = new Set(),
): BranchTreeEntry[] {
  return branches.map((branch) => {
    const scope = branch.isRemote ? "remote" : "local";
    return {
      ref: {
        type: scope,
        name: branch.name,
        fullRef: branch.fullRef,
      },
      scope,
      name: branch.name,
      isCurrent: branch.isCurrent,
      isFavorite: branch.isFavorite || favoriteRefs.has(branch.fullRef),
      branch,
    };
  });
}

export function normalizeTagEntries(
  tags: readonly TagInfo[],
  favoriteRefs: ReadonlySet<string> = new Set(),
): BranchTreeEntry[] {
  return tags.map((tag) => ({
    ref: {
      type: "tag",
      name: tag.name,
      fullRef: tag.fullRef,
    },
    scope: "tag",
    name: tag.name,
    isCurrent: false,
    isFavorite: tag.isFavorite || favoriteRefs.has(tag.fullRef),
    tag,
  }));
}

export function buildBranchTreeSnapshot(
  entries: readonly BranchTreeEntry[],
  options: { repoId: string; grouped: boolean },
): BranchTreeSnapshot {
  const roots = options.grouped
    ? buildGroupedTree(entries, options.repoId)
    : entries
        .slice()
        .sort(compareEntries)
        .map((entry) => leaf(options.repoId, entry, entry.name));
  const nodeIds = new Set<string>();
  const directoryIds = new Set<string>();
  collectNodeIds(roots, nodeIds, directoryIds);
  return { roots, nodeIds, directoryIds };
}

function buildGroupedTree(
  entries: readonly BranchTreeEntry[],
  repoId: string,
): BranchTreeNode[] {
  const roots: MutableBranchTreeNode[] = [];
  for (const entry of entries) {
    const segments = entry.name.split("/");
    let siblings = roots;
    for (let index = 0; index < segments.length; index += 1) {
      const name = segments[index];
      const isLeaf = index === segments.length - 1;
      const path = segments.slice(0, index + 1).join("/");
      const id = isLeaf
        ? refNodeId(repoId, entry)
        : directoryNodeId(repoId, entry.scope, path);
      let node = siblings.find((candidate) => candidate.id === id);
      if (!node) {
        node = isLeaf
          ? leaf(repoId, entry, name)
          : { id, name, children: [], isLeaf: false };
        siblings.push(node);
      }
      siblings = node.children;
    }
  }
  sortTree(roots);
  return roots;
}

function refNodeId(repoId: string, entry: BranchTreeEntry): string {
  return `repo:${repoId}:ref:${entry.ref.fullRef}`;
}

function directoryNodeId(
  repoId: string,
  scope: BranchTreeScope,
  path: string,
): string {
  return `repo:${repoId}:dir:${scope}:${path}`;
}

function leaf(
  repoId: string,
  entry: BranchTreeEntry,
  name: string,
): MutableBranchTreeNode {
  return {
    id: refNodeId(repoId, entry),
    name,
    children: [],
    entry,
    isLeaf: true,
  };
}

function sortTree(nodes: MutableBranchTreeNode[]): void {
  nodes.sort(compareNodes);
  for (const node of nodes) sortTree(node.children);
}

function compareNodes(
  a: MutableBranchTreeNode,
  b: MutableBranchTreeNode,
): number {
  const favorite = containsFavorite(b) - containsFavorite(a);
  if (favorite) return favorite;
  const current = containsCurrent(b) - containsCurrent(a);
  if (current) return current;
  if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
  return compareNames(a.name, b.name);
}

function compareEntries(a: BranchTreeEntry, b: BranchTreeEntry): number {
  const favorite = Number(b.isFavorite) - Number(a.isFavorite);
  if (favorite) return favorite;
  const current = Number(b.isCurrent) - Number(a.isCurrent);
  if (current) return current;
  return compareNames(a.name, b.name);
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function containsFavorite(node: MutableBranchTreeNode): number {
  return Number(node.entry?.isFavorite || node.children.some(containsFavorite));
}

function containsCurrent(node: MutableBranchTreeNode): number {
  return Number(node.entry?.isCurrent || node.children.some(containsCurrent));
}

function collectNodeIds(
  nodes: readonly BranchTreeNode[],
  nodeIds: Set<string>,
  directoryIds: Set<string>,
): void {
  for (const node of nodes) {
    nodeIds.add(node.id);
    if (!node.isLeaf) directoryIds.add(node.id);
    collectNodeIds(node.children, nodeIds, directoryIds);
  }
}
