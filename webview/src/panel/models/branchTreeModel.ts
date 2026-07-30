import type { BranchInfo } from "../../shared/types/git";

export interface BranchTreeNode {
  id: string;
  name: string;
  children: BranchTreeNode[];
  branch?: BranchInfo;
  isLeaf: boolean;
}

export interface BranchTreeSnapshot {
  roots: readonly BranchTreeNode[];
  nodeIds: ReadonlySet<string>;
}

export function buildBranchTreeSnapshot(
  branches: readonly BranchInfo[],
  options: { grouped: boolean; favoriteRefs: ReadonlySet<string> },
): BranchTreeSnapshot {
  const decorated = branches.map((branch) =>
    options.favoriteRefs.has(branch.fullRef) && !branch.isFavorite
      ? { ...branch, isFavorite: true }
      : branch,
  );
  const roots = options.grouped
    ? buildGroupedTree(decorated)
    : decorated
        .slice()
        .sort(compareBranches)
        .map((branch) => leaf(branch, branch.name));
  const nodeIds = new Set<string>();
  collectNodeIds(roots, nodeIds);
  return { roots, nodeIds };
}

function buildGroupedTree(branches: readonly BranchInfo[]): BranchTreeNode[] {
  const roots: BranchTreeNode[] = [];
  for (const branch of branches) {
    const scope = branch.isRemote ? "remote" : "local";
    const segments = branch.name.split("/");
    let siblings = roots;
    for (let index = 0; index < segments.length; index += 1) {
      const name = segments[index];
      const isLeaf = index === segments.length - 1;
      const path = segments.slice(0, index + 1).join("/");
      const id = isLeaf ? `ref:${branch.fullRef}` : `dir:${scope}:${path}`;
      let node = siblings.find((candidate) => candidate.id === id);
      if (!node) {
        node = isLeaf
          ? leaf(branch, name)
          : { id, name, children: [], isLeaf: false };
        siblings.push(node);
      }
      siblings = node.children;
    }
  }
  sortTree(roots);
  return roots;
}

function leaf(branch: BranchInfo, name: string): BranchTreeNode {
  return {
    id: `ref:${branch.fullRef}`,
    name,
    children: [],
    branch,
    isLeaf: true,
  };
}

function sortTree(nodes: BranchTreeNode[]): void {
  nodes.sort(compareNodes);
  for (const node of nodes) sortTree(node.children);
}

function compareNodes(a: BranchTreeNode, b: BranchTreeNode): number {
  const favorite = containsFavorite(b) - containsFavorite(a);
  if (favorite) return favorite;
  const current = containsCurrent(b) - containsCurrent(a);
  if (current) return current;
  if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function compareBranches(a: BranchInfo, b: BranchInfo): number {
  const favorite = Number(b.isFavorite) - Number(a.isFavorite);
  if (favorite) return favorite;
  const current = Number(b.isCurrent) - Number(a.isCurrent);
  if (current) return current;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function containsFavorite(node: BranchTreeNode): number {
  return Number(
    node.branch?.isFavorite || node.children.some(containsFavorite),
  );
}

function containsCurrent(node: BranchTreeNode): number {
  return Number(node.branch?.isCurrent || node.children.some(containsCurrent));
}

function collectNodeIds(
  nodes: readonly BranchTreeNode[],
  ids: Set<string>,
): void {
  for (const node of nodes) {
    ids.add(node.id);
    collectNodeIds(node.children, ids);
  }
}
