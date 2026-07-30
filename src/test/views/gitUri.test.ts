import * as assert from "node:assert";
import type { GitService } from "../../git/gitService";
import type { DiscoveredRepo } from "../../git/repoRegistry";
import { RepoRegistry } from "../../git/repoRegistry";
import { GitContentProvider } from "../../views/gitContentProvider";
import { buildGitContentUri } from "../../views/gitUri";

/**
 * Content URIs retain repository identity so the provider resolves revisions
 * from the repository that created the diff.
 */

/** Minimal GitService stub that returns a marker string per repo. */
function fakeGitService(marker: string): GitService {
  return {
    getFileContent: async () => `content-from-${marker}`,
  } as unknown as GitService;
}

function makeRepo(id: string, rootPath: string): DiscoveredRepo {
  return {
    descriptor: { id, name: id, rootPath },
    paths: {
      workTreeRoot: rootPath,
      gitDir: `${rootPath}/.git`,
      commonDir: `${rootPath}/.git`,
    },
  };
}

describe("buildGitContentUri — ref + repo encode/decode", () => {
  it("round-trips ref and repo through the URI query", () => {
    const uri = buildGitContentUri("abc123", "src/path/to/f.ts", "RID");

    const params = new URLSearchParams(uri.query);
    assert.strictEqual(params.get("ref"), "abc123");
    assert.strictEqual(params.get("repo"), "RID");
    // path preserves the relative file path (leading slash from scheme://)
    assert.strictEqual(uri.path, "/src/path/to/f.ts");
  });

  it("percent-encodes spaces in repo paths (the realistic round-trip hazard)", () => {
    // repoId is a fs.realpath-normalized filesystem path; spaces are the
    // adversarial char that actually occurs. (`&` would be ambiguous with the
    // query separator on re-parse via URLSearchParams, but is not a realistic
    // path character, so it is out of scope for this contract.)
    const repoId = "/Users/x/repos/with spaces and more";
    const uri = buildGitContentUri("abc", "a/b.ts", repoId);

    const params = new URLSearchParams(uri.query);
    assert.strictEqual(params.get("repo"), repoId);
    assert.strictEqual(params.get("ref"), "abc");
  });

  for (const [label, filePath] of [
    ["question marks", "dir/query?name.txt"],
    ["hash signs", "dir/fragment#name.txt"],
    ["percent signs", "dir/percent%name.txt"],
  ] as const) {
    it(`preserves ${label} in file paths`, () => {
      const uri = buildGitContentUri("abc", filePath, "repoA");
      const params = new URLSearchParams(uri.query);

      assert.strictEqual(uri.path, `/${filePath}`);
      assert.strictEqual(params.get("ref"), "abc");
      assert.strictEqual(params.get("repo"), "repoA");
      assert.strictEqual(uri.fragment, "");
    });
  }
});

describe("GitContentProvider — resolves repo from ?repo= even when another repo is active", () => {
  it("uses the ?repo= repo's git service, not the active repo", async () => {
    const registry = new RepoRegistry();
    registry.add(makeRepo("repoA", "/repos/A"), fakeGitService("A"));
    registry.add(makeRepo("repoB", "/repos/B"), fakeGitService("B"));

    // Sanity: A is the first-registered (active) repo, but the URI targets B.
    assert.strictEqual(registry.getActiveId(), "repoA");

    const provider = new GitContentProvider(registry);
    provider.setExternalContentMap(new Map());

    // URI carries ?repo=repoB — must resolve B even though A is active.
    const uri = buildGitContentUri("abc", "file.ts", "repoB");
    const content = await provider.provideTextDocumentContent(uri);

    assert.strictEqual(
      content,
      "content-from-B",
      "provider must read content from the repo named in ?repo=, not the active repo",
    );
  });

  it("falls back to the active repo for legacy URIs without ?repo=", async () => {
    const registry = new RepoRegistry();
    registry.add(makeRepo("repoA", "/repos/A"), fakeGitService("A"));
    assert.strictEqual(registry.getActiveId(), "repoA");

    const provider = new GitContentProvider(registry);
    provider.setExternalContentMap(new Map());

    // Legacy URI shape (no repo=) — must fall back to the active repo.
    const uri = buildGitContentUri("abc", "file.ts", "repoA").with({
      query: "ref=abc",
    });
    const content = await provider.provideTextDocumentContent(uri);

    assert.strictEqual(content, "content-from-A");
  });

  it("passes a special-character file path to the selected repository unchanged", async () => {
    const registry = new RepoRegistry();
    const filePath = "dir/query?fragment#percent%file.txt";
    let requestedPath = "";
    registry.add(makeRepo("repoA", "/repos/A"), {
      getFileContent: async (_ref: string, path: string) => {
        requestedPath = path;
        return "content";
      },
    } as unknown as GitService);

    const provider = new GitContentProvider(registry);
    await provider.provideTextDocumentContent(
      buildGitContentUri("abc", filePath, "repoA"),
    );

    assert.strictEqual(requestedPath, filePath);
  });
});

describe("editSource repo resolution primitive — registry.get(repoId) ignores active repo", () => {
  it("returns the repo named by repoId while a different repo is active", () => {
    // editSource now does: repoIdFromUri ? registry.get(repoIdFromUri)
    //                                            : registry.getActive()
    // This asserts the load-bearing primitive: get(B) returns B while A is active.
    const registry = new RepoRegistry();
    registry.add(makeRepo("repoA", "/repos/A"), fakeGitService("A"));
    registry.add(makeRepo("repoB", "/repos/B"), fakeGitService("B"));
    assert.strictEqual(registry.getActiveId(), "repoA");

    const resolved = registry.get("repoB");
    assert.ok(resolved, "registry.get must return repoB");
    assert.strictEqual(resolved?.descriptor.rootPath, "/repos/B");
  });
});
