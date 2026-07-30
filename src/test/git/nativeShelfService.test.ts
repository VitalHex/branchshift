import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { IndexTransaction } from "../../git/commit/indexTransaction";
import type { CommitPathSelection } from "../../git/commit/types";
import { GitExecutor, type GitRunOptions } from "../../git/core/gitExecutor";
import { GitService } from "../../git/gitService";
import { NativeShelfService } from "../../git/shelf/nativeShelfService";
import { WorkingTreeService } from "../../git/workingTree/workingTreeService";
import { GitTestRepo } from "./gitTestRepo";

describe("NativeShelfService", () => {
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
    files: Readonly<Record<string, Buffer | string>>,
  ): Promise<void> {
    for (const [filePath, content] of Object.entries(files)) {
      await repo.writeFile(filePath, content);
    }
    await repo.git("add", "-A");
    await repo.git("commit", "-m", "base");
  }

  function selectedWorkspace(path: string): CommitPathSelection {
    return {
      path,
      includeIndex: false,
      includeWorkingTree: true,
    };
  }

  function service(
    repo: GitTestRepo,
    executor: GitExecutor = repo.executor,
  ): NativeShelfService {
    return new NativeShelfService(
      executor,
      new WorkingTreeService(executor),
      new IndexTransaction(executor),
    );
  }

  async function rawIndex(repo: GitTestRepo): Promise<Buffer> {
    return repo.executor.buffer(["ls-files", "--stage", "-z"]);
  }

  it("preserves unrelated staged content byte-for-byte while shelving a selected workspace file", async () => {
    const repo = await createRepo();
    await commitFiles(repo, {
      "selected.txt": "selected base\n",
      "unrelated.bin": Buffer.from([1, 2, 3, 4]),
    });
    await repo.writeFile("selected.txt", "selected shelf\n");
    const stagedBlob = Buffer.from([0, 255, 7, 8, 9]);
    const workspaceBlob = Buffer.from([4, 3, 2, 1, 0]);
    await repo.writeFile("unrelated.bin", stagedBlob);
    await repo.git("add", "--", "unrelated.bin");
    const indexBefore = await rawIndex(repo);
    await repo.writeFile("unrelated.bin", workspaceBlob);

    const result = await service(repo).create({
      message: "selected",
      selections: [selectedWorkspace("selected.txt")],
    });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(await rawIndex(repo), indexBefore);
    assert.deepStrictEqual(
      await repo.executor.buffer(["show", ":unrelated.bin"]),
      stagedBlob,
    );
    assert.deepStrictEqual(
      await fs.readFile(path.join(repo.rootPath, "unrelated.bin")),
      workspaceBlob,
    );
    assert.strictEqual(
      await fs.readFile(path.join(repo.rootPath, "selected.txt"), "utf8"),
      "selected base\n",
    );
    assert.strictEqual(
      await repo.git("show", "refs/stash:selected.txt"),
      "selected shelf\n",
    );
  });

  it("keeps the existing selective shelf method while delegating its safety boundary", async () => {
    const repo = await createRepo();
    await commitFiles(repo, {
      "selected.txt": "selected base\n",
      "unrelated.txt": "unrelated base\n",
    });
    await repo.writeFile("selected.txt", "selected shelf\n");
    await repo.writeFile("unrelated.txt", "unrelated staged\n");
    await repo.git("add", "--", "unrelated.txt");
    const stagedEntry = await repo.executor.buffer([
      "ls-files",
      "--stage",
      "-z",
      "--",
      "unrelated.txt",
    ]);
    await repo.writeFile("unrelated.txt", "unrelated workspace\n");
    const gitDir = path.join(repo.rootPath, ".git");
    const gitService = new GitService({
      workTreeRoot: repo.rootPath,
      gitDir,
      commonDir: gitDir,
    });

    await gitService.shelveChanges("selected", ["selected.txt"]);

    assert.deepStrictEqual(
      await repo.executor.buffer([
        "ls-files",
        "--stage",
        "-z",
        "--",
        "unrelated.txt",
      ]),
      stagedEntry,
    );
    assert.strictEqual(
      await repo.git("show", ":unrelated.txt"),
      "unrelated staged\n",
    );
    assert.strictEqual(
      await fs.readFile(path.join(repo.rootPath, "unrelated.txt"), "utf8"),
      "unrelated workspace\n",
    );
  });

  it("restores the original index and workspace when the native command fails", async () => {
    const repo = await createRepo();
    await commitFiles(repo, {
      "selected.txt": "selected base\n",
      "unrelated.txt": "unrelated base\n",
    });
    await repo.writeFile("selected.txt", "selected shelf\n");
    await repo.writeFile("unrelated.txt", "unrelated staged\n");
    await repo.git("add", "--", "unrelated.txt");
    const indexBefore = await rawIndex(repo);
    const selectedBefore = await fs.readFile(
      path.join(repo.rootPath, "selected.txt"),
    );
    const unrelatedBefore = await fs.readFile(
      path.join(repo.rootPath, "unrelated.txt"),
    );

    class FailingStashExecutor extends GitExecutor {
      override buffer(
        args: readonly string[],
        options?: GitRunOptions,
      ): Promise<Buffer> {
        if (args[0] === "stash" && args[1] === "push") {
          return Promise.reject(new Error("injected stash failure"));
        }
        return super.buffer(args, options);
      }
    }
    const result = await service(
      repo,
      new FailingStashExecutor(repo.rootPath),
    ).create({
      message: "selected",
      selections: [selectedWorkspace("selected.txt")],
    });

    assert.strictEqual(result.ok, false);
    if (result.ok) assert.fail("expected a typed failure");
    assert.ok(result.recovery);
    assert.deepStrictEqual(await rawIndex(repo), indexBefore);
    assert.deepStrictEqual(
      await fs.readFile(path.join(repo.rootPath, "selected.txt")),
      selectedBefore,
    );
    assert.deepStrictEqual(
      await fs.readFile(path.join(repo.rootPath, "unrelated.txt")),
      unrelatedBefore,
    );
    await assert.rejects(repo.git("rev-parse", "--verify", "refs/stash"));
  });

  it("does not report success when the stash reference does not change", async () => {
    const repo = await createRepo();
    await commitFiles(repo, { "selected.txt": "selected base\n" });
    await repo.writeFile("selected.txt", "selected shelf\n");
    const indexBefore = await rawIndex(repo);
    const workspaceBefore = await fs.readFile(
      path.join(repo.rootPath, "selected.txt"),
    );

    class NoOpStashExecutor extends GitExecutor {
      override buffer(
        args: readonly string[],
        options?: GitRunOptions,
      ): Promise<Buffer> {
        if (args[0] === "stash" && args[1] === "push") {
          return Promise.resolve(Buffer.alloc(0));
        }
        return super.buffer(args, options);
      }
    }
    const result = await service(
      repo,
      new NoOpStashExecutor(repo.rootPath),
    ).create({
      message: "selected",
      selections: [selectedWorkspace("selected.txt")],
    });

    assert.strictEqual(result.ok, false);
    if (result.ok) assert.fail("expected a typed failure");
    assert.ok(result.recovery);
    assert.deepStrictEqual(await rawIndex(repo), indexBefore);
    assert.deepStrictEqual(
      await fs.readFile(path.join(repo.rootPath, "selected.txt")),
      workspaceBefore,
    );
  });
});
