import type { BranchShiftErrorCode } from "../errors";

export type GitOperationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: BranchShiftErrorCode;
      message: string;
      recovery?: string;
      cause?: unknown;
    };
