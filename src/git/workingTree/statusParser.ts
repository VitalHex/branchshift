export interface GitStatusRecord {
  path: string;
  oldPath?: string;
  indexStatus: string;
  workTreeStatus: string;
}

const STATUS_LETTERS = new Set([
  " ",
  "M",
  "T",
  "A",
  "D",
  "R",
  "C",
  "U",
  "?",
  "!",
]);

function splitNulRecords(output: Buffer): string[] {
  if (output.length === 0) return [];
  if (output[output.length - 1] !== 0)
    throw new Error("Truncated NUL-delimited git status output");
  const records: string[] = [];
  let start = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== 0) continue;
    records.push(output.subarray(start, index).toString("utf8"));
    start = index + 1;
  }
  return records;
}

export function parseStatusPorcelainZ(output: Buffer): GitStatusRecord[] {
  const fields = splitNulRecords(output);
  const records: GitStatusRecord[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index] ?? "";
    if (field.length < 4 || field[2] !== " ")
      throw new Error("Malformed git status record");
    const indexStatus = field[0] ?? "";
    const workTreeStatus = field[1] ?? "";
    if (!STATUS_LETTERS.has(indexStatus) || !STATUS_LETTERS.has(workTreeStatus))
      throw new Error("Unknown git status letter");
    const path = field.slice(3);
    if (!path) throw new Error("Git status record has no path");
    const needsOldPath =
      indexStatus === "R" ||
      indexStatus === "C" ||
      workTreeStatus === "R" ||
      workTreeStatus === "C";
    if (!needsOldPath) {
      records.push({ path, indexStatus, workTreeStatus });
      continue;
    }
    const oldPath = fields[index + 1];
    if (!oldPath)
      throw new Error("Git status rename or copy record has no original path");
    records.push({ path, oldPath, indexStatus, workTreeStatus });
    index += 1;
  }
  return records;
}
