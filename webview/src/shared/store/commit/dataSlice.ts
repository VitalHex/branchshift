import type {
  BranchList,
  CommitDataSlice,
  CommitSliceContext,
  IdeaShelfEntry,
  ShelveEntry,
  WorkingTreeFile,
} from "./types";

export function createDataSlice({
  set,
  get,
  coordinator,
  request,
}: CommitSliceContext): CommitDataSlice {
  const refreshWorkingTree = async () => {
    await coordinator.runLatest(
      "commit.working-tree",
      async () => (await request("getWorkingTreeChanges")) as unknown,
      (result) => {
        if (!Array.isArray(result)) return;
        const changes = result as WorkingTreeFile[];
        set({ changes });
        get().reconcileSelection(changes);
      },
    );
  };

  const refreshNativeShelves = async () => {
    await coordinator.runLatest(
      "commit.native-shelves",
      async () => (await request("getShelves")) as unknown,
      (result) => {
        if (Array.isArray(result)) set({ shelves: result as ShelveEntry[] });
      },
    );
  };

  const refreshPatchShelves = async () => {
    await coordinator.runLatest(
      "commit.patch-shelves",
      async () => (await request("getIdeaShelves")) as unknown,
      (result) => {
        if (Array.isArray(result)) {
          set({ ideaShelves: result as IdeaShelfEntry[] });
        }
      },
    );
  };

  const refreshRefs = async () => {
    await coordinator.runLatest(
      "commit.refs",
      async () => (await request("getBranches")) as unknown,
      (result) => {
        if (!Array.isArray(result)) return;
        const current = (result as BranchList).find(
          (branch) => branch.isCurrent,
        );
        set({
          currentBranch: current?.name ?? "",
          currentBranchHasUpstream: Boolean(current?.upstream),
        });
      },
    );
  };

  return {
    changes: [],
    shelves: [],
    ideaShelves: [],
    currentBranch: "",
    currentBranchHasUpstream: false,

    async fetchChanges() {
      await reportFailure("fetchChanges", refreshWorkingTree);
    },

    async fetchShelves() {
      await reportFailure("fetchShelves", refreshNativeShelves);
    },

    async fetchIdeaShelves() {
      await reportFailure("fetchIdeaShelves", refreshPatchShelves);
    },

    refreshWorkingTree,
    refreshRefs,

    async refreshShelves() {
      const results = await Promise.allSettled([
        refreshNativeShelves(),
        refreshPatchShelves(),
      ]);
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) {
        throw new AggregateError(failures, "Shelf refresh failed");
      }
    },
  };
}

async function reportFailure(
  operation: string,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`${operation} failed:`, error);
  }
}
