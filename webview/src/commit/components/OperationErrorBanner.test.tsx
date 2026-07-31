import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CommitOperationError } from "../../shared/store/commit/types";
import { OperationErrorBanner } from "./OperationErrorBanner";

afterEach(cleanup);

describe("OperationErrorBanner", () => {
  it("renders the operation message and recovery guidance", () => {
    const error: CommitOperationError = {
      code: "INDEX_RESTORE_FAILED",
      message: "The index could not be restored.",
      recovery: "Inspect the index and retry.",
    };

    const view = render(<OperationErrorBanner error={error} />);

    expect(view.getByRole("alert").textContent).toContain(
      "The index could not be restored.",
    );
    expect(view.getByRole("alert").textContent).toContain(
      "Inspect the index and retry.",
    );
  });

  it("does not render when there is no operation error", () => {
    const view = render(<OperationErrorBanner error={null} />);

    expect(view.queryByRole("alert")).toBeNull();
  });
});
