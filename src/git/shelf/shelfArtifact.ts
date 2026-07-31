import * as fs from "node:fs/promises";
import type { GitExecutor } from "../core/gitExecutor";

export interface ShelfArtifact {
  temporaryPath: string;
  finalPath: string;
  paths: readonly string[];
  pathIdentities?: readonly ShelfArtifactPathIdentity[];
}

export interface ShelfArtifactPathIdentity {
  path: string;
  oldPath?: string;
}

export async function validateShelfArtifact(
  git: GitExecutor,
  artifact: ShelfArtifact,
): Promise<void> {
  const expected = normalizeIdentities(
    artifact.pathIdentities ??
      artifact.paths.map((artifactPath) => ({ path: artifactPath })),
  );
  const summary = await git.buffer([
    "apply",
    "--numstat",
    "-z",
    artifact.temporaryPath,
  ]);
  const patch = await fs.readFile(artifact.temporaryPath, "utf8");
  const actual = parseArtifactPaths(summary, patch);
  if (
    actual.length !== expected.length ||
    actual.some(
      (value, index) =>
        value.path !== expected[index]?.path ||
        value.oldPath !== expected[index]?.oldPath,
    )
  ) {
    throw new Error(
      `The materialized shelf covers ${JSON.stringify(actual)} instead of ${JSON.stringify(expected)}.`,
    );
  }
  await git.buffer(["apply", "--check", "--reverse", artifact.temporaryPath]);
}

function parseArtifactPaths(
  summary: Buffer,
  patch: string,
): ShelfArtifactPathIdentity[] {
  const fields = summary.toString().split("\0");
  const paths: ShelfArtifactPathIdentity[] = [];
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (!field) continue;
    const parts = field.split("\t");
    if (parts.length < 3) {
      throw new Error("Git returned a malformed shelf summary.");
    }
    const inlinePath = parts.slice(2).join("\t");
    if (inlinePath) {
      paths.push({ path: inlinePath });
      continue;
    }
    const oldPath = fields[++index];
    const newPath = fields[++index];
    if (!oldPath || !newPath) {
      throw new Error("Git returned an incomplete renamed shelf path.");
    }
    paths.push({ oldPath, path: newPath });
  }
  const renames = parseRenameIdentities(patch);
  const identified = paths.map((identity) => {
    const oldPath = renames.get(identity.path);
    if (oldPath === undefined) return identity;
    renames.delete(identity.path);
    return { oldPath, path: identity.path };
  });
  if (renames.size > 0) {
    throw new Error("The patch contains a rename missing from its summary.");
  }
  return normalizeIdentities(identified);
}

function normalizeIdentities(
  identities: readonly ShelfArtifactPathIdentity[],
): ShelfArtifactPathIdentity[] {
  return [...identities].sort((left, right) => {
    const pathOrder = left.path.localeCompare(right.path);
    if (pathOrder !== 0) return pathOrder;
    return (left.oldPath ?? "").localeCompare(right.oldPath ?? "");
  });
}

function parseRenameIdentities(patch: string): Map<string, string> {
  const renames = new Map<string, string>();
  let pendingOldPath: string | undefined;
  for (const line of patch.split("\n")) {
    if (line.startsWith("rename from ")) {
      if (pendingOldPath !== undefined) {
        throw new Error("The patch contains an incomplete rename identity.");
      }
      pendingOldPath = decodePatchPath(line.slice("rename from ".length));
      continue;
    }
    if (!line.startsWith("rename to ")) continue;
    if (pendingOldPath === undefined) {
      throw new Error("The patch contains a rename without an old path.");
    }
    const newPath = decodePatchPath(line.slice("rename to ".length));
    if (renames.has(newPath)) {
      throw new Error("The patch contains duplicate rename identities.");
    }
    renames.set(newPath, pendingOldPath);
    pendingOldPath = undefined;
  }
  if (pendingOldPath !== undefined) {
    throw new Error("The patch contains an incomplete rename identity.");
  }
  return renames;
}

function decodePatchPath(value: string): string {
  if (!value.startsWith('"')) return value;
  if (!value.endsWith('"')) {
    throw new Error("The patch contains an unterminated quoted path.");
  }
  const bytes: number[] = [];
  const escaped = value.slice(1, -1);
  for (let index = 0; index < escaped.length; index++) {
    const character = escaped[index];
    if (character !== "\\") {
      const codePoint = escaped.codePointAt(index);
      if (codePoint === undefined) continue;
      bytes.push(...Buffer.from(String.fromCodePoint(codePoint)));
      if (codePoint > 0xffff) index++;
      continue;
    }
    const next = escaped[++index];
    if (next === undefined) {
      throw new Error("The patch contains an incomplete path escape.");
    }
    const simpleEscapes: Readonly<Record<string, number>> = {
      a: 0x07,
      b: 0x08,
      t: 0x09,
      n: 0x0a,
      v: 0x0b,
      f: 0x0c,
      r: 0x0d,
      '"': 0x22,
      "\\": 0x5c,
    };
    const simple = simpleEscapes[next];
    if (simple !== undefined) {
      bytes.push(simple);
      continue;
    }
    if (/[0-7]/.test(next)) {
      let octal = next;
      while (
        octal.length < 3 &&
        index + 1 < escaped.length &&
        /[0-7]/.test(escaped[index + 1])
      ) {
        octal += escaped[++index];
      }
      bytes.push(Number.parseInt(octal, 8));
      continue;
    }
    throw new Error(`The patch contains an unsupported path escape: \\${next}`);
  }
  return Buffer.from(bytes).toString("utf8");
}
