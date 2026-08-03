import type { GitRefIdentity } from "../../../shared/types/git";
import type { BranchTreeEntry, BranchTreeNode } from "./branchTreeTypes";

export function filterBranchTreeEntries(
  entries: readonly BranchTreeEntry[],
  query: string,
): BranchTreeEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return entries.slice();
  return entries.filter((entry) =>
    entry.name.toLocaleLowerCase().includes(normalizedQuery),
  );
}

export function collectVisibleRefs(
  nodes: readonly BranchTreeNode[],
  collapsedDirectoryIds: ReadonlySet<string>,
): GitRefIdentity[] {
  const refs: GitRefIdentity[] = [];
  for (const node of nodes) {
    if (node.entry) {
      refs.push(node.entry.ref);
    } else if (!collapsedDirectoryIds.has(node.id)) {
      refs.push(...collectVisibleRefs(node.children, collapsedDirectoryIds));
    }
  }
  return refs;
}
