import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb, closeDb } from "../src/core/db.js";

describe("database", () => {
  afterEach(() => {
    closeDb();
  });

  it("creates and returns a database connection", () => {
    const db = getDb();
    expect(db).toBeDefined();
  });

  it("returns the same connection on subsequent calls", () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it("creates all required tables", () => {
    const db = getDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("fs_events");
    expect(tableNames).toContain("blocked_actions");
    expect(tableNames).toContain("gc_runs");
  });

  it("creates indexes", () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
      )
      .all() as { name: string }[];

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_fs_events_session");
    expect(indexNames).toContain("idx_fs_events_path");
    expect(indexNames).toContain("idx_fs_events_type");
  });
});
