import * as assert from "node:assert";
import { GitCommandError } from "../../git/core/gitExecutor";
import { GitTestRepo } from "./gitTestRepo";

describe("GitExecutor", () => {
  it("runs argument-array commands in an isolated repository with a test identity", async () => {
    const repo = await GitTestRepo.create();
    await repo.writeFile("note.txt", "hello\n");
    await repo.git("add", "note.txt");
    await repo.git("commit", "-m", "initial");

    assert.strictEqual(
      (await repo.git("log", "-1", "--format=%an")).trim(),
      "BranchShift Test",
    );
  });

  it("preserves text and binary output bytes", async () => {
    const repo = await GitTestRepo.create();
    const bytes = Buffer.from([0, 255, 65, 10]);
    await repo.writeFile("binary.bin", bytes);
    await repo.git("add", "binary.bin");
    await repo.git("commit", "-m", "binary");

    assert.strictEqual(
      await repo.executor.text(["show", "HEAD:binary.bin"]),
      bytes.toString(),
    );
    assert.deepStrictEqual(
      await repo.executor.buffer(["show", "HEAD:binary.bin"]),
      bytes,
    );
  });

  it("passes standard input to Git", async () => {
    const repo = await GitTestRepo.create();

    const result = await repo.executor.withInput(
      ["hash-object", "--stdin"],
      "hello\n",
    );

    assert.match(result.toString(), /^[0-9a-f]{40}\n$/);
  });

  it("returns output from an approved non-zero exit code", async () => {
    const repo = await GitTestRepo.create();
    await repo.writeFile("changed.txt", "before\n");
    await repo.git("add", "changed.txt");
    await repo.git("commit", "-m", "before change");
    await repo.writeFile("changed.txt", "after\n");

    const result = await repo.executor.text(["diff", "--exit-code"], {
      allowedExitCodes: [1],
    });

    assert.match(result, /\+after/);
  });

  it("rejects an unapproved exit code with stderr and argv", async () => {
    const repo = await GitTestRepo.create();

    await assert.rejects(
      () => repo.executor.text(["rev-parse", "definitely-not-a-revision"]),
      (error: unknown) =>
        error instanceof GitCommandError &&
        error.exitCode === 128 &&
        error.args[0] === "rev-parse" &&
        error.stderr.includes("definitely-not-a-revision"),
    );
  });

  it("passes special-character paths as literal arguments", async () => {
    const repo = await GitTestRepo.create();
    const filePath = "$(touch should-not-exist); [] space.txt";
    await repo.writeFile(filePath, "literal\n");
    await repo.git("add", "--", filePath);
    await repo.git("commit", "-m", "literal path");

    assert.strictEqual(
      await repo.executor.text(["show", `HEAD:${filePath}`]),
      "literal\n",
    );
  });

  it("rejects output larger than the configured buffer", async () => {
    const repo = await GitTestRepo.create();
    await repo.writeFile("large.txt", "x".repeat(64));
    await repo.git("add", "large.txt");
    await repo.git("commit", "-m", "large output");

    await assert.rejects(() =>
      repo.executor.buffer(["show", "HEAD:large.txt"], { maxBuffer: 8 }),
    );
  });
});
