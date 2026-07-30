import type { DiffFile } from "../types";

function splitNulRecords(output: Buffer): string[] {
  if (output.length === 0) return [];
  if (output[output.length - 1] !== 0)
    throw new Error("Truncated NUL-delimited git name-status output");
  const records: string[] = [];
  let start = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== 0) continue;
    records.push(output.subarray(start, index).toString("utf8"));
    start = index + 1;
  }
  return records;
}

export function parseNameStatusZ(output: Buffer): DiffFile[] {
  const fields = splitNulRecords(output);
  const files: DiffFile[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const statusCode = fields[index] ?? "";
    const kind = statusCode[0] ?? "";
    if (!/^[AMDRCT][0-9]*$/.test(statusCode))
      throw new Error("Malformed git name-status record");
    const firstPath = fields[index + 1];
    if (!firstPath) throw new Error("Git name-status record has no path");
    index += 1;
    if (kind === "R" || kind === "C") {
      const secondPath = fields[index + 1];
      if (!secondPath)
        throw new Error(
          "Git name-status rename or copy record has no destination path",
        );
      files.push({
        oldPath: firstPath,
        newPath: secondPath,
        status: kind === "R" ? "renamed" : "copied",
        isBinary: false,
      });
      index += 1;
      continue;
    }
    files.push({
      oldPath: firstPath,
      newPath: firstPath,
      status: kind === "A" ? "added" : kind === "D" ? "deleted" : "modified",
      isBinary: false,
    });
  }
  return files;
}
