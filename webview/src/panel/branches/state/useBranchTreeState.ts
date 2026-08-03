import { useCallback, useEffect, useMemo, useReducer } from "react";
import type {
  BranchTreeMode,
  BranchTreeSnapshot,
} from "../model/branchTreeTypes";
import {
  branchTreeSectionIds,
  createBranchTreeState,
  effectiveCollapsedIds,
  reduceBranchTreeState,
} from "./branchTreeState";

export function useBranchTreeState(
  repoId: string | null,
  mode: BranchTreeMode,
  snapshot: Pick<BranchTreeSnapshot, "directoryIds">,
) {
  const [state, dispatch] = useReducer(reduceBranchTreeState, undefined, () =>
    createBranchTreeState(repoId, mode),
  );

  useEffect(() => {
    dispatch({ type: "set-repo", repoId });
  }, [repoId]);

  useEffect(() => {
    dispatch({ type: "set-mode", mode });
  }, [mode]);

  useEffect(() => {
    dispatch({ type: "reconcile", directoryIds: snapshot.directoryIds });
  }, [snapshot.directoryIds]);

  const isSearching = state.searchQuery.trim().length > 0;
  const collapsedIds = state.collapsedByMode[state.mode];
  const visibleCollapsedIds = useMemo(
    () => effectiveCollapsedIds(state, isSearching),
    [isSearching, state],
  );
  const allCollapsibleIds = useMemo(
    () => new Set([...snapshot.directoryIds, ...branchTreeSectionIds]),
    [snapshot.directoryIds],
  );

  return {
    searchQuery: state.searchQuery,
    setSearchQuery: useCallback(
      (query: string) => dispatch({ type: "set-search", query }),
      [],
    ),
    collapsedIds,
    effectiveCollapsedIds: visibleCollapsedIds,
    toggle: useCallback((id: string) => dispatch({ type: "toggle", id }), []),
    expandAll: useCallback(() => dispatch({ type: "expand-all" }), []),
    collapseAll: useCallback(
      () => dispatch({ type: "collapse-all", ids: allCollapsibleIds }),
      [allCollapsibleIds],
    ),
  };
}
