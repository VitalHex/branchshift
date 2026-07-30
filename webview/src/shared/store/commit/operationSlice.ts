import type { CommandType } from "../../bridge/types";
import type {
  CommitOperationSlice,
  CommitSliceContext,
  WorkingTreeFile,
} from "./types";
import { workingTreeKey } from "./types";

export function createOperationSlice({
  set,
  get,
  coordinator,
  request,
}: CommitSliceContext): CommitOperationSlice {
  let operationSequence = 0;

  const runOperation = async <T>(
    name: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    let result!: T;
    const status = await coordinator.runLatest(
      `commit.operation.${name}.${++operationSequence}`,
      operation,
      (value) => {
        result = value;
      },
    );
    if (status === "stale") {
      throw new Error("Repository changed before operation completed");
    }
    return result;
  };

  const mutateAndRefresh = async (
    label: string,
    command: CommandType,
    params?: Record<string, unknown>,
  ) => {
    try {
      await runOperation(label, async () => {
        await request(command, params);
        await get().fetchChanges();
      });
    } catch (error) {
      console.error(`${label} failed:`, error);
    }
  };

  const selectedChanges = (): WorkingTreeFile[] => {
    const { changes, selectedFiles } = get();
    return changes.filter((file) => selectedFiles.has(workingTreeKey(file)));
  };

  const commitWith = async (command: "commitChanges" | "commitAndPush") => {
    const { commitMessage, amend } = get();
    if (!commitMessage.trim()) return false;
    const selections = selectedChanges().map((file) => ({
      path: file.path,
      ...(file.oldPath ? { oldPath: file.oldPath } : {}),
      status: file.status,
      staged: file.staged,
    }));

    try {
      await runOperation(command, async () => {
        await request(command, { message: commitMessage, amend, selections });
        await get().fetchChanges();
      });
      set({ commitMessage: "", amend: false });
      return true;
    } catch (error) {
      console.error(
        `${command === "commitChanges" ? "commit" : "commitAndPush"} failed:`,
        error,
      );
      return false;
    }
  };

  return {
    loading: false,
    pendingOperations: 0,

    async stageFile(filePath) {
      await mutateAndRefresh("stageFile", "stageFile", { filePath });
    },

    async unstageFile(filePath) {
      await mutateAndRefresh("unstageFile", "unstageFile", { filePath });
    },

    async stageAll() {
      await mutateAndRefresh("stageAll", "stageAll");
    },

    async unstageAll() {
      await mutateAndRefresh("unstageAll", "unstageAll");
    },

    async commit() {
      return commitWith("commitChanges");
    },

    async commitAndPush() {
      return commitWith("commitAndPush");
    },

    async rollbackFile(filePath) {
      await mutateAndRefresh("rollbackFile", "rollbackFile", { filePath });
    },

    async showDiff(filePath, staged) {
      try {
        await runOperation("showDiff", () =>
          request("showDiffForWorkingFile", { filePath, staged }),
        );
      } catch (error) {
        console.error("showDiff failed:", error);
      }
    },

    async shelveChanges(message, filePaths) {
      try {
        await runOperation("shelveChanges", async () => {
          await request("shelveChanges", { message, filePaths });
          await Promise.all([get().fetchChanges(), get().fetchShelves()]);
        });
      } catch (error) {
        console.error("shelveChanges failed:", error);
      }
    },

    async unshelveChanges(stashId, drop = true) {
      try {
        await runOperation("unshelveChanges", async () => {
          await request("unshelveChanges", { stashId, drop });
          await Promise.all([get().fetchChanges(), get().fetchShelves()]);
        });
      } catch (error) {
        console.error("unshelveChanges failed:", error);
      }
    },

    async deleteShelve(stashId) {
      try {
        await runOperation("deleteShelve", async () => {
          await request("deleteShelve", { stashId });
          await get().fetchShelves();
        });
      } catch (error) {
        console.error("deleteShelve failed:", error);
      }
    },

    async ideaShelveChanges(message, filePaths) {
      try {
        await runOperation("ideaShelveChanges", async () => {
          await request("ideaShelveChanges", { message, filePaths });
          await Promise.all([get().fetchChanges(), get().fetchIdeaShelves()]);
        });
      } catch (error) {
        console.error("ideaShelveChanges failed:", error);
      }
    },

    async ideaUnshelveChanges(shelfName, drop = true) {
      try {
        await runOperation("ideaUnshelveChanges", async () => {
          await request("ideaUnshelveChanges", { shelfName, drop });
          await Promise.all([get().fetchChanges(), get().fetchIdeaShelves()]);
        });
      } catch (error) {
        console.error("ideaUnshelveChanges failed:", error);
      }
    },

    async deleteIdeaShelf(shelfName) {
      try {
        await runOperation("deleteIdeaShelf", async () => {
          await request("deleteIdeaShelf", { shelfName });
          await get().fetchIdeaShelves();
        });
      } catch (error) {
        console.error("deleteIdeaShelf failed:", error);
      }
    },

    async refresh() {
      await Promise.all([
        get().fetchChanges(),
        get().fetchShelves(),
        get().fetchIdeaShelves(),
        get()
          .refreshRefs()
          .catch((error) => console.error("refreshRefs failed:", error)),
      ]);
    },
  };
}
