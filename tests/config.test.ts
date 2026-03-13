import { describe, it, expect } from "vitest";
import { expandPath } from "../src/core/config.js";
import { homedir } from "node:os";

describe("expandPath", () => {
  it("expands ~ to home directory", () => {
    const result = expandPath("~/Documents");
    expect(result).toBe(`${homedir()}/Documents`);
  });

  it("expands ~/nested/path correctly", () => {
    const result = expandPath("~/a/b/c");
    expect(result).toBe(`${homedir()}/a/b/c`);
  });

  it("leaves absolute paths unchanged", () => {
    expect(expandPath("/tmp/foo")).toBe("/tmp/foo");
    expect(expandPath("/etc/hosts")).toBe("/etc/hosts");
  });

  it("leaves relative paths unchanged", () => {
    expect(expandPath("foo/bar")).toBe("foo/bar");
  });
});
