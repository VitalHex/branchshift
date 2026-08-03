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
      sourceRefKey: string;
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
) {
  const [overlay, setOverlay] = useState<BranchOverlay>(null);

  useEffect(() => {
    setOverlay((current) =>
      isOverlayValid(current, repoId, validRefKeys) ? current : null,
    );
  }, [repoId, validRefKeys]);

  const openMenu = useCallback(
    (kind: "branch-menu" | "tag-menu", input: MenuInput) => {
      const sourceRefKey = branchOverlayRefKey(input.context);
      if (
        repoId === null ||
        input.context.repoId !== repoId ||
        !validRefKeys.has(sourceRefKey)
      ) {
        setOverlay(null);
        return;
      }
      setOverlay({ kind, repoId, ...input });
    },
    [repoId, validRefKeys],
  );

  return {
    overlay,
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
        if (repoId === null || !validRefKeys.has(input.sourceRefKey)) {
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
): boolean {
  if (overlay === null) return true;
  if (overlay.repoId !== repoId) return false;
  const sourceRefKey =
    "context" in overlay
      ? branchOverlayRefKey(overlay.context)
      : overlay.sourceRefKey;
  return validRefKeys.has(sourceRefKey);
}
