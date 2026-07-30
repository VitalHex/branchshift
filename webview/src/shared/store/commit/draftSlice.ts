import type { CommitDraftSlice, CommitSliceContext } from "./types";

export function createDraftSlice({
  set,
  coordinator,
  request,
}: CommitSliceContext): CommitDraftSlice {
  return {
    commitMessage: "",
    amend: false,

    setCommitMessage(message) {
      set({ commitMessage: message });
    },

    setAmend(amend) {
      set({ amend });
      if (!amend) return;

      void coordinator
        .runLatest(
          "commit.amend-message",
          async () =>
            (await request("getAmendMessage")) as { message?: string } | null,
          (result) => {
            if (result?.message) set({ commitMessage: result.message });
          },
        )
        .catch(() => {});
    },
  };
}
