import * as assert from "node:assert";
import { parseStatusPorcelainZ } from "../../git/workingTree/statusParser";

describe("parseStatusPorcelainZ", () => {
  it("preserves every byte-bearing special path character", () => {
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
    const output = Buffer.from(paths.map((value) => ` M ${value}\0`).join(""));

    assert.deepStrictEqual(
      parseStatusPorcelainZ(output).map((record) => record.path),
      paths,
    );
  });

  it("reads rename records from their following NUL path", () => {
    const output = Buffer.from("R  new\t -> name.txt\0old\t -> name.txt\0");

    assert.deepStrictEqual(parseStatusPorcelainZ(output), [
      {
        path: "new\t -> name.txt",
        oldPath: "old\t -> name.txt",
        indexStatus: "R",
        workTreeStatus: " ",
      },
    ]);
  });

  it("returns no records for empty output", () => {
    assert.deepStrictEqual(parseStatusPorcelainZ(Buffer.alloc(0)), []);
  });

  it("rejects truncated and invalid status records", () => {
    assert.throws(() => parseStatusPorcelainZ(Buffer.from(" M\0")));
    assert.throws(() => parseStatusPorcelainZ(Buffer.from("Z  file\0")));
    assert.throws(() => parseStatusPorcelainZ(Buffer.from("R  new\0")));
  });
});
