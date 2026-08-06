import { useCallback, useEffect, useState } from "react";
import type { BranchActionContext } from "../actions/branchActionTypes";

export type BranchOverlay =
  | {
      kind: "branch-menu";
      repoId: string;
      x: number;
      y: number;
      context: BranchActionContext;
    }
  | {
      kind: "tag-menu";
      repoId: string;
      x: number;
      y: number;
      context: BranchActionContext;
    }
  | {
      kind: "create";
      repoId: string;
      sourceRefKey?: string;
      startPoint: string;
      defaultName: string;
    }
  | { kind: "push"; repoId: string; sourceRefKey: string; branchName: string }
  | null;

type MenuInput = { x: number; y: number; context: BranchActionContext };
type CreateInput = Omit<
  Extract<BranchOverlay, { kind: "create" }>,
  "kind" | "repoId"
>;
type PushInput = Omit<
  Extract<BranchOverlay, { kind: "push" }>,
  "kind" | "repoId"
>;

export function branchOverlayRefKey(context: BranchActionContext): string {
  return `${context.ref.type}:${context.ref.fullRef}`;
}

export function useBranchOverlay(
  repoId: string | null,
  validRefKeys: ReadonlySet<string>,
  currentBranch: string,
) {
  const [overlay, setOverlay] = useState<BranchOverlay>(null);

  useEffect(() => {
    setOverlay((current) =>
      isOverlayValid(current, repoId, validRefKeys, currentBranch)
        ? current
        : null,
    );
  }, [currentBranch, repoId, validRefKeys]);

  const openMenu = useCallback(
    (kind: "branch-menu" | "tag-menu", input: MenuInput) => {
      const sourceRefKey = branchOverlayRefKey(input.context);
      if (
        repoId === null ||
        input.context.repoId !== repoId ||
        input.context.currentBranch !== currentBranch ||
        !validRefKeys.has(sourceRefKey)
      ) {
        setOverlay(null);
        return;
      }
      setOverlay({ kind, repoId, ...input });
    },
    [currentBranch, repoId, validRefKeys],
  );

  return {
    overlay: isOverlayValid(overlay, repoId, validRefKeys, currentBranch)
      ? overlay
      : null,
    closeOverlay: useCallback(() => setOverlay(null), []),
    openBranchMenu: useCallback(
      (input: MenuInput) => openMenu("branch-menu", input),
      [openMenu],
    ),
    openTagMenu: useCallback(
      (input: MenuInput) => openMenu("tag-menu", input),
      [openMenu],
    ),
    openCreate: useCallback(
      (input: CreateInput) => {
        if (
          repoId === null ||
          (input.sourceRefKey !== undefined &&
            !validRefKeys.has(input.sourceRefKey))
        ) {
          setOverlay(null);
          return;
        }
        setOverlay({ kind: "create", repoId, ...input });
      },
      [repoId, validRefKeys],
    ),
    openPush: useCallback(
      (input: PushInput) => {
        if (repoId === null || !validRefKeys.has(input.sourceRefKey)) {
          setOverlay(null);
          return;
        }
        setOverlay({ kind: "push", repoId, ...input });
      },
      [repoId, validRefKeys],
    ),
  };
}

function isOverlayValid(
  overlay: BranchOverlay,
  repoId: string | null,
  validRefKeys: ReadonlySet<string>,
  currentBranch: string,
): boolean {
  if (overlay === null) return true;
  if (overlay.repoId !== repoId) return false;
  if ("context" in overlay) {
    return (
      overlay.context.currentBranch === currentBranch &&
      validRefKeys.has(branchOverlayRefKey(overlay.context))
    );
  }
  return (
    overlay.sourceRefKey === undefined || validRefKeys.has(overlay.sourceRefKey)
  );
}
