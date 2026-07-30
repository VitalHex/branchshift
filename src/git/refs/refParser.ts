export interface GitRef {
  id: string;
  kind: "local" | "remote" | "tag";
  shortName: string;
  remote?: string;
}

export function parseGitRef(fullRef: string, shortName: string): GitRef {
  if (fullRef.startsWith("refs/heads/")) {
    return Object.freeze({ id: fullRef, kind: "local", shortName });
  }
  if (fullRef.startsWith("refs/remotes/")) {
    const remote = fullRef.slice("refs/remotes/".length).split("/", 1)[0];
    return Object.freeze({ id: fullRef, kind: "remote", shortName, remote });
  }
  if (fullRef.startsWith("refs/tags/")) {
    return Object.freeze({ id: fullRef, kind: "tag", shortName });
  }
  throw new Error(`Unsupported Git ref: ${fullRef}`);
}
