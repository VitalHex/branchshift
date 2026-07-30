import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { WorkingTreeService } from "../../git/workingTree/workingTreeService";
import { GitTestRepo } from "./gitTestRepo";

describe("WorkingTreeService", () => {
  it("preserves status paths and splits staged and unstaged changes", async () => {
    const repo = await GitTestRepo.create();
    const filePath = "staged\t -> and\nworkspace.txt";
    await repo.writeFile(filePath, "base\n");
    await repo.git("add", "--", filePath);
    await repo.git("commit", "-m", "base");
    await repo.writeFile(filePath, "index\n");
    await repo.git("add", "--", filePath);
    await repo.writeFile(filePath, "workspace\n");

    const service = new WorkingTreeService(repo.executor);
    assert.deepStrictEqual(await service.getStatus(), [
      {
        path: filePath,
        indexStatus: "M",
        workTreeStatus: "M",
      },
    ]);
    assert.deepStrictEqual(await service.getWorkingTreeChanges(), [
      { path: filePath, oldPath: undefined, status: "modified", staged: true },
      { path: filePath, oldPath: undefined, status: "modified", staged: false },
    ]);
    assert.deepStrictEqual(
      await service.getIndexFileContent(filePath),
      Buffer.from("index\n"),
    );
    assert.notDeepStrictEqual(
      await service.getIndexFileContent(filePath),
      await fs.readFile(path.join(repo.rootPath, filePath)),
    );
  });

  it("preserves renamed paths emitted by diff-tree NUL records", async () => {
    const repo = await GitTestRepo.create();
    const oldPath = "old\t -> path.txt";
    const newPath = "new\t -> path.txt";
    await repo.writeFile(oldPath, "content\n");
    await repo.git("add", "--", oldPath);
    await repo.git("commit", "-m", "base");
    await fs.rename(
      path.join(repo.rootPath, oldPath),
      path.join(repo.rootPath, newPath),
    );
    await repo.git("add", "-A");
    await repo.git("commit", "-m", "rename");
    const hash = (await repo.git("rev-parse", "HEAD")).trim();

    assert.deepStrictEqual(
      await new WorkingTreeService(repo.executor).getCommitFiles(hash),
      [
        {
          oldPath,
          newPath,
          status: "renamed",
          isBinary: false,
        },
      ],
    );
  });
});
