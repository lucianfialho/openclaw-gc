import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { startSession, endSession, getSession, listSessions, getStats } from "../src/core/journal.js";
import { getDb, closeDb } from "../src/core/db.js";

describe("journal", () => {
  beforeEach(() => {
    // Clear sessions between tests to avoid leaking state
    const db = getDb();
    db.exec("DELETE FROM sessions");
    db.exec("DELETE FROM fs_events");
    db.exec("DELETE FROM blocked_actions");
    db.exec("DELETE FROM gc_runs");
  });

  afterEach(() => {
    closeDb();
  });

  it("creates a new session", () => {
    const session = startSession("test-agent");
    expect(session.id).toBeDefined();
    expect(session.agentId).toBe("test-agent");
    expect(session.status).toBe("active");
    expect(session.startedAt).toBeDefined();
    expect(session.endedAt).toBeNull();
  });

  it("creates a session without agent id", () => {
    const session = startSession();
    expect(session.id).toBeDefined();
    expect(session.agentId).toBeNull();
  });

  it("retrieves a session by id", () => {
    const created = startSession("my-agent");
    const found = getSession(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.agentId).toBe("my-agent");
  });

  it("returns null for non-existent session", () => {
    const found = getSession("non-existent-id");
    expect(found).toBeNull();
  });

  it("ends a session", () => {
    const session = startSession("agent-1");
    endSession(session.id);
    const ended = getSession(session.id);
    expect(ended!.status).toBe("ended");
    expect(ended!.endedAt).not.toBeNull();
  });

  it("lists sessions ordered by most recent", () => {
    startSession("agent-a");
    startSession("agent-b");
    startSession("agent-c");

    const sessions = listSessions(10);
    expect(sessions.length).toBeGreaterThanOrEqual(3);
    // Most recent first
    expect(sessions[0].agentId).toBe("agent-c");
  });

  it("returns stats", () => {
    const stats = getStats();
    expect(stats).toHaveProperty("totalSessions");
    expect(stats).toHaveProperty("activeSessions");
    expect(stats).toHaveProperty("totalEvents");
    expect(stats).toHaveProperty("totalBlocked");
    expect(stats).toHaveProperty("totalGcRuns");
    expect(stats).toHaveProperty("totalBytesFreed");
    expect(typeof stats.totalSessions).toBe("number");
  });
});
