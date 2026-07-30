import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { CommitService } from "../../git/commit/commitService";
import { IndexTransaction } from "../../git/commit/indexTransaction";
import type { CommitRequest, CommitSelection } from "../../git/types";
import { WorkingTreeService } from "../../git/workingTree/workingTreeService";
import { GitTestRepo } from "./gitTestRepo";

describe("CommitService", () => {
  const repositories: GitTestRepo[] = [];

  afterEach(async () => {
    await Promise.all(
      repositories
        .splice(0)
        .map((repo) => fs.rm(repo.rootPath, { recursive: true, force: true })),
    );
  });

  async function createRepo(): Promise<GitTestRepo> {
    const repo = await GitTestRepo.create();
    repositories.push(repo);
    return repo;
  }

  async function commitFiles(
    repo: GitTestRepo,
    files: Readonly<Record<string, string>>,
    message = "base",
  ): Promise<void> {
    for (const [filePath, content] of Object.entries(files)) {
      await repo.writeFile(filePath, content);
    }
    await repo.git("add", "-A");
    await repo.git("commit", "-m", message);
  }

  function service(repo: GitTestRepo): CommitService {
    return new CommitService(
      repo.executor,
      new WorkingTreeService(repo.executor),
      new IndexTransaction(repo.executor),
    );
  }

  function selection(
    path: string,
    staged: boolean,
    options: Partial<CommitSelection> = {},
  ): CommitSelection {
    return {
      path,
      staged,
      status: "modified",
      ...options,
    };
  }

  function request(
    message: string,
    selections: readonly CommitSelection[],
    amend = false,
  ): CommitRequest {
    return { message, amend, selections };
  }

  async function rawIndex(repo: GitTestRepo): Promise<Buffer> {
    return repo.executor.buffer(["ls-files", "--stage", "-z"]);
  }

  async function rawIndexFor(
    repo: GitTestRepo,
    ...paths: string[]
  ): Promise<Buffer> {
    return repo.executor.buffer(["ls-files", "--stage", "-z", "--", ...paths]);
  }

  it("keeps unrelated staged content byte-for-byte while committing a selected workspace file", async () => {
    const repo = await createRepo();
    await commitFiles(repo, {
      "selected.txt": "selected base\n",
      "unrelated.txt": "unrelated base\n",
    });
    await repo.writeFile("selected.txt", "selected workspace\n");
    await repo.writeFile("unrelated.txt", "unrelated staged\n");
    await repo.git("add", "--", "unrelated.txt");
    const stagedEntry = await rawIndexFor(repo, "unrelated.txt");
    await repo.writeFile("unrelated.txt", "unrelated workspace\n");

    const result = await service(repo).commitSelected(
      request("selected", [selection("selected.txt", false)]),
    );

    assert.strictEqual(result.ok, true);
    assert.strictEqual(
      await repo.git("show", "HEAD:selected.txt"),
      "selected workspace\n",
    );
    assert.strictEqual(
      await repo.git("show", "HEAD:unrelated.txt"),
      "unrelated base\n",
    );
    assert.strictEqual(
      await repo.git("show", ":unrelated.txt"),
      "unrelated staged\n",
    );
    assert.deepStrictEqual(
      await rawIndexFor(repo, "unrelated.txt"),
      stagedEntry,
    );
    assert.strictEqual(
      await fs.readFile(path.join(repo.rootPath, "unrelated.txt"), "utf8"),
      "unrelated workspace\n",
    );
  });

  it("commits the index version for a staged-only selection", async () => {
    const repo = await createRepo();
    await commitFiles(repo, { "partial.txt": "base\n" });
    await repo.writeFile("partial.txt", "staged\n");
    await repo.git("add", "--", "partial.txt");
    await repo.writeFile("partial.txt", "workspace\n");

    const result = await service(repo).commitSelected(
      request("index only", [selection("partial.txt", true)]),
    );

    assert.strictEqual(result.ok, true);
    assert.strictEqual(await repo.git("show", "HEAD:partial.txt"), "staged\n");
    assert.strictEqual(
      await fs.readFile(path.join(repo.rootPath, "partial.txt"), "utf8"),
      "workspace\n",
    );
  });

  it("commits the workspace version when both staged and unstaged rows are selected", async () => {
    const repo = await createRepo();
    await commitFiles(repo, { "partial.txt": "base\n" });
    await repo.writeFile("partial.txt", "staged\n");
    await repo.git("add", "--", "partial.txt");
    await repo.writeFile("partial.txt", "workspace\n");

    const result = await service(repo).commitSelected(
      request("both", [
        selection("partial.txt", true),
        selection("partial.txt", false),
      ]),
    );

    assert.strictEqual(result.ok, true);
    assert.strictEqual(
      await repo.git("show", "HEAD:partial.txt"),
      "workspace\n",
    );
  });

  it("commits an unstaged-only path when it has no staged counterpart", async () => {
    const repo = await createRepo();
    await commitFiles(repo, { "workspace.txt": "base\n" });
    await repo.writeFile("workspace.txt", "workspace\n");

    const result = await service(repo).commitSelected(
      request("workspace only", [selection("workspace.txt", false)]),
    );

    assert.strictEqual(result.ok, true);
    assert.strictEqual(
      await repo.git("show", "HEAD:workspace.txt"),
      "workspace\n",
    );
  });

  it("rejects an unstaged-only row with a staged counterpart before mutation", async () => {
    const repo = await createRepo();
    await commitFiles(repo, { "partial.txt": "base\n" });
    await repo.writeFile("partial.txt", "staged\n");
    await repo.git("add", "--", "partial.txt");
    await repo.writeFile("partial.txt", "workspace\n");
    const head = await repo.git("rev-parse", "HEAD");
    const index = await rawIndex(repo);

    const result = await service(repo).commitSelected(
      request("unsupported", [selection("partial.txt", false)]),
    );

    assert.strictEqual(result.ok, false);
    if (result.ok) assert.fail("expected a typed failure");
    assert.strictEqual(result.code, "PARTIAL_FILE_SELECTION_UNSUPPORTED");
    assert.strictEqual(await repo.git("rev-parse", "HEAD"), head);
    assert.deepStrictEqual(await rawIndex(repo), index);
    assert.strictEqual(
      await fs.readFile(path.join(repo.rootPath, "partial.txt"), "utf8"),
      "workspace\n",
    );
  });

  it("uses exact endpoints for selected additions, deletions, and renames", async () => {
    const repo = await createRepo();
    await commitFiles(repo, {
      "delete.txt": "delete\n",
      "old-name.txt": "rename\n",
      "unselected.txt": "keep\n",
    });
    await fs.rm(path.join(repo.rootPath, "delete.txt"));
    await fs.rename(
      path.join(repo.rootPath, "old-name.txt"),
      path.join(repo.rootPath, "new-name.txt"),
    );
    await repo.writeFile("added.txt", "added\n");
    await repo.writeFile("unselected.txt", "not committed\n");

    const result = await service(repo).commitSelected(
      request("path kinds", [
        selection("added.txt", false, { status: "untracked" }),
        selection("delete.txt", false, { status: "deleted" }),
        selection("new-name.txt", false, {
          oldPath: "old-name.txt",
          status: "renamed",
        }),
      ]),
    );

    assert.strictEqual(result.ok, true);
    assert.strictEqual(await repo.git("show", "HEAD:added.txt"), "added\n");
    await assert.rejects(repo.git("show", "HEAD:delete.txt"));
    await assert.rejects(repo.git("show", "HEAD:old-name.txt"));
    assert.strictEqual(await repo.git("show", "HEAD:new-name.txt"), "rename\n");
    assert.strictEqual(await repo.git("show", "HEAD:unselected.txt"), "keep\n");
  });

  it("restores the index and working tree when a commit hook rejects", async () => {
    const repo = await createRepo();
    await commitFiles(repo, {
      "selected.txt": "selected base\n",
      "unrelated.txt": "unrelated base\n",
    });
    await repo.writeFile("selected.txt", "selected workspace\n");
    await repo.writeFile("unrelated.txt", "unrelated staged\n");
    await repo.git("add", "--", "unrelated.txt");
    await repo.writeFile("unrelated.txt", "unrelated workspace\n");
    const head = await repo.git("rev-parse", "HEAD");
    const index = await rawIndex(repo);
    const hook = path.join(repo.rootPath, ".git", "hooks", "pre-commit");
    await fs.writeFile(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });

    const result = await service(repo).commitSelected(
      request("rejected", [selection("selected.txt", false)]),
    );

    assert.strictEqual(result.ok, false);
    if (result.ok) assert.fail("expected a typed failure");
    assert.strictEqual(result.code, "COMMIT_REJECTED");
    assert.strictEqual(await repo.git("rev-parse", "HEAD"), head);
    assert.deepStrictEqual(await rawIndex(repo), index);
    assert.strictEqual(
      await fs.readFile(path.join(repo.rootPath, "selected.txt"), "utf8"),
      "selected workspace\n",
    );
    assert.strictEqual(
      await fs.readFile(path.join(repo.rootPath, "unrelated.txt"), "utf8"),
      "unrelated workspace\n",
    );
  });

  it("amends only the selected boundary", async () => {
    const repo = await createRepo();
    await commitFiles(repo, {
      "tracked.txt": "base\n",
      "unrelated.txt": "unrelated base\n",
    });
    await repo.writeFile("tracked.txt", "selected amend\n");
    await repo.writeFile("unrelated.txt", "unrelated staged\n");
    await repo.git("add", "--", "unrelated.txt");
    const unrelatedEntry = await rawIndexFor(repo, "unrelated.txt");

    const result = await service(repo).commitSelected(
      request("amended", [selection("tracked.txt", false)], true),
    );

    assert.strictEqual(result.ok, true);
    assert.strictEqual(
      await repo.git("show", "HEAD:tracked.txt"),
      "selected amend\n",
    );
    assert.strictEqual(
      await repo.git("show", "HEAD:unrelated.txt"),
      "unrelated base\n",
    );
    assert.deepStrictEqual(
      await rawIndexFor(repo, "unrelated.txt"),
      unrelatedEntry,
    );
    assert.strictEqual(
      (await repo.git("log", "-1", "--format=%s")).trim(),
      "amended",
    );
  });

  it("returns typed validation failures for empty messages and selections", async () => {
    const repo = await createRepo();
    await commitFiles(repo, { "tracked.txt": "base\n" });
    await repo.writeFile("tracked.txt", "workspace\n");
    const head = await repo.git("rev-parse", "HEAD");
    const index = await rawIndex(repo);

    const emptyMessage = await service(repo).commitSelected(
      request("   ", [selection("tracked.txt", false)]),
    );
    const emptySelections = await service(repo).commitSelected(
      request("message", []),
    );

    assert.strictEqual(emptyMessage.ok, false);
    assert.strictEqual(emptySelections.ok, false);
    if (emptyMessage.ok || emptySelections.ok)
      assert.fail("expected typed validation failures");
    assert.strictEqual(emptyMessage.code, "COMMIT_REJECTED");
    assert.strictEqual(emptySelections.code, "COMMIT_REJECTED");
    assert.strictEqual(await repo.git("rev-parse", "HEAD"), head);
    assert.deepStrictEqual(await rawIndex(repo), index);
  });
});
