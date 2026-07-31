import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bridge } from "../../shared/bridge";
import { useCommitStore } from "../../shared/store/commit-store";
import { CommitMessageArea } from "./CommitMessageArea";

vi.mock("../../shared/bridge", () => ({
  bridge: {
    request: vi.fn(),
    onEvent: vi.fn(() => () => {}),
  },
}));

describe("Commit and Push", () => {
  beforeEach(() => {
    vi.mocked(bridge.request).mockReset();
    useCommitStore.setState({
      commitMessage: "keep this draft",
      selectedFiles: new Set(["file.txt:false"]),
      loading: false,
    });
  });

  afterEach(cleanup);

  it("keeps Push closed when the commit is rejected", async () => {
    useCommitStore.setState({ commit: vi.fn().mockResolvedValue(false) });
    const view = render(<CommitMessageArea />);

    fireEvent.click(view.getByRole("button", { name: "Commit and Push..." }));

    await waitFor(() => {
      expect(useCommitStore.getState().commit).toHaveBeenCalled();
    });
    expect(bridge.request).not.toHaveBeenCalledWith("openPushPanel");
    expect((view.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "keep this draft",
    );
  });

  it("opens Push only after a successful commit", async () => {
    useCommitStore.setState({ commit: vi.fn().mockResolvedValue(true) });
    const view = render(<CommitMessageArea />);

    fireEvent.click(view.getByRole("button", { name: "Commit and Push..." }));

    await waitFor(() => {
      expect(bridge.request).toHaveBeenCalledWith("openPushPanel");
    });
  });
});
