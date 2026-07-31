import * as assert from "node:assert";
import { parseNameStatusZ } from "../../git/workingTree/nameStatusParser";

describe("parseNameStatusZ", () => {
  it("preserves every special path character in single-path records", () => {
    const paths = [
      "spaces in name.txt",
      "tab\tname.txt",
      "line\nbreak.txt",
      '"quoted".txt',
      "back\\slash.txt",
      "-leading-dash.txt",
      "café-文件.txt",
      "literal -> arrow.txt",
    ];
    const output = Buffer.from(paths.map((value) => `M\0${value}\0`).join(""));

    assert.deepStrictEqual(
      parseNameStatusZ(output),
      paths.map((value) => ({
        oldPath: value,
        newPath: value,
        status: "modified",
        isBinary: false,
      })),
    );
  });

  it("reads rename and copy pairs without interpreting arrows or tabs", () => {
    const output = Buffer.from(
      "R100\0old\t -> one.txt\0new\t -> one.txt\0C075\0copy old.txt\0copy new.txt\0",
    );

    assert.deepStrictEqual(parseNameStatusZ(output), [
      {
        oldPath: "old\t -> one.txt",
        newPath: "new\t -> one.txt",
        status: "renamed",
        isBinary: false,
      },
      {
        oldPath: "copy old.txt",
        newPath: "copy new.txt",
        status: "copied",
        isBinary: false,
      },
    ]);
  });

  it("handles additions, deletions, and type changes", () => {
    const output = Buffer.from("A\0new\0D\0old\0T\0typechanged\0");

    assert.deepStrictEqual(parseNameStatusZ(output), [
      { oldPath: "new", newPath: "new", status: "added", isBinary: false },
      { oldPath: "old", newPath: "old", status: "deleted", isBinary: false },
      {
        oldPath: "typechanged",
        newPath: "typechanged",
        status: "modified",
        isBinary: false,
      },
    ]);
  });

  it("rejects malformed and truncated records", () => {
    assert.throws(() => parseNameStatusZ(Buffer.from("Q\0file\0")));
    assert.throws(() => parseNameStatusZ(Buffer.from("M100\0file\0")));
    assert.throws(() => parseNameStatusZ(Buffer.from("A2\0file\0")));
    assert.throws(() => parseNameStatusZ(Buffer.from("T7\0file\0")));
    assert.throws(() => parseNameStatusZ(Buffer.from("R100\0old\0")));
    assert.throws(() => parseNameStatusZ(Buffer.from("M\0\0")));
  });
});
