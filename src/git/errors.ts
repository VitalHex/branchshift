export const BranchShiftErrorCode = {
  REPO_NOT_FOUND: "REPO_NOT_FOUND",
  INVALID_REF: "INVALID_REF",
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  BRANCH_NO_UPSTREAM: "BRANCH_NO_UPSTREAM",
  BRANCH_CHECKED_OUT_IN_WORKTREE: "BRANCH_CHECKED_OUT_IN_WORKTREE",
  BRANCH_NON_FAST_FORWARD: "BRANCH_NON_FAST_FORWARD",
} as const;

export type BranchShiftErrorCode =
  (typeof BranchShiftErrorCode)[keyof typeof BranchShiftErrorCode];

export class BranchShiftError extends Error {
  constructor(
    readonly code: BranchShiftErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BranchShiftError";
  }
}
