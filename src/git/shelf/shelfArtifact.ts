import type { GitExecutor } from "../core/gitExecutor";

export interface ShelfArtifact {
  temporaryPath: string;
  finalPath: string;
  paths: readonly string[];
}

export async function validateShelfArtifact(
  git: GitExecutor,
  artifact: ShelfArtifact,
): Promise<void> {
  const expected = [...new Set(artifact.paths)].sort();
  const summary = await git.buffer([
    "apply",
    "--numstat",
    "-z",
    artifact.temporaryPath,
  ]);
  const actual = parseArtifactPaths(summary);
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(
      `The materialized shelf covers [${actual.join(", ")}] instead of [${expected.join(", ")}].`,
    );
  }
  await git.buffer(["apply", "--check", "--reverse", artifact.temporaryPath]);
}

function parseArtifactPaths(summary: Buffer): string[] {
  const fields = summary.toString().split("\0");
  const paths = new Set<string>();
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (!field) continue;
    const parts = field.split("\t");
    if (parts.length < 3) {
      throw new Error("Git returned a malformed shelf summary.");
    }
    const inlinePath = parts.slice(2).join("\t");
    if (inlinePath) {
      paths.add(inlinePath);
      continue;
    }
    const oldPath = fields[++index];
    const newPath = fields[++index];
    if (!oldPath || !newPath) {
      throw new Error("Git returned an incomplete renamed shelf path.");
    }
    paths.add(newPath);
  }
  return [...paths].sort();
}
