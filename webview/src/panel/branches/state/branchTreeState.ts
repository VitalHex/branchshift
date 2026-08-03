import type { BranchTreeMode } from "../model/branchTreeTypes";

export interface BranchTreeState {
  repoId: string | null;
  mode: BranchTreeMode;
  searchQuery: string;
  collapsedByMode: Record<BranchTreeMode, ReadonlySet<string>>;
}

export type BranchTreeStateAction =
  | { type: "toggle"; id: string }
  | { type: "set-mode"; mode: BranchTreeMode }
  | { type: "set-search"; query: string }
  | { type: "set-repo"; repoId: string | null }
  | { type: "collapse-all"; ids: ReadonlySet<string> }
  | { type: "expand-all" }
  | { type: "reconcile"; directoryIds: ReadonlySet<string> };

export const branchTreeSectionIds = new Set([
  "section:local",
  "section:remote",
  "section:tags",
]);

export function createBranchTreeState(
  repoId: string | null,
  mode: BranchTreeMode,
): BranchTreeState {
  return {
    repoId,
    mode,
    searchQuery: "",
    collapsedByMode: { grouped: new Set(), flat: new Set() },
  };
}

export function reduceBranchTreeState(
  state: BranchTreeState,
  action: BranchTreeStateAction,
): BranchTreeState {
  switch (action.type) {
    case "toggle": {
      const collapsedIds = new Set(state.collapsedByMode[state.mode]);
      if (collapsedIds.has(action.id)) collapsedIds.delete(action.id);
      else collapsedIds.add(action.id);
      return withCollapsedIds(state, state.mode, collapsedIds);
    }
    case "set-mode":
      return { ...state, mode: action.mode };
    case "set-search":
      return { ...state, searchQuery: action.query };
    case "set-repo":
      return action.repoId === state.repoId
        ? state
        : createBranchTreeState(action.repoId, state.mode);
    case "collapse-all":
      return withCollapsedIds(state, state.mode, new Set(action.ids));
    case "expand-all":
      return withCollapsedIds(state, state.mode, new Set());
    case "reconcile":
      return reconcileCollapsedIds(state, action.directoryIds);
  }
}

export function effectiveCollapsedIds(
  state: BranchTreeState,
  isSearching: boolean,
): ReadonlySet<string> {
  return isSearching ? new Set() : state.collapsedByMode[state.mode];
}

export function reconcileCollapsedIds(
  state: BranchTreeState,
  directoryIds: ReadonlySet<string>,
): BranchTreeState {
  const reconcile = (collapsedIds: ReadonlySet<string>) =>
    new Set(
      [...collapsedIds].filter(
        (id) => branchTreeSectionIds.has(id) || directoryIds.has(id),
      ),
    );
  return {
    ...state,
    collapsedByMode: {
      grouped: reconcile(state.collapsedByMode.grouped),
      flat: reconcile(state.collapsedByMode.flat),
    },
  };
}

function withCollapsedIds(
  state: BranchTreeState,
  mode: BranchTreeMode,
  collapsedIds: ReadonlySet<string>,
): BranchTreeState {
  return {
    ...state,
    collapsedByMode: { ...state.collapsedByMode, [mode]: collapsedIds },
  };
}
