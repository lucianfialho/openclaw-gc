import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export interface Session {
  id: string;
  agentId: string | null;
  startedAt: string;
  endedAt: string | null;
  status: "active" | "ended" | "rolled_back";
}

export interface JournalEntry {
  id: number;
  sessionId: string | null;
  timestamp: string;
  eventType: string;
  path: string;
  oldPath: string | null;
  metadata: string | null;
  rolledBack: boolean;
}

export function startSession(agentId?: string): Session {
  const id = randomUUID();
  const db = getDb();

  db.prepare(`
    INSERT INTO sessions (id, agent_id) VALUES (?, ?)
  `).run(id, agentId ?? null);

  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;

  return {
    id: row.id,
    agentId: row.agent_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
  };
}

export function endSession(sessionId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE sessions SET ended_at = datetime('now'), status = 'ended'
    WHERE id = ?
  `).run(sessionId);
}

export function getSession(sessionId: string): Session | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as any;
  if (!row) return null;

  return {
    id: row.id,
    agentId: row.agent_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
  };
}

export function listSessions(limit = 20): Session[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM sessions ORDER BY started_at DESC, rowid DESC LIMIT ?
  `).all(limit) as any[];

  return rows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
  }));
}

export function getSessionEvents(sessionId: string): JournalEntry[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM fs_events WHERE session_id = ? ORDER BY timestamp ASC
  `).all(sessionId) as any[];

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    eventType: row.event_type,
    path: row.path,
    oldPath: row.old_path,
    metadata: row.metadata,
    rolledBack: row.rolled_back === 1,
  }));
}

export function getStats(): {
  totalSessions: number;
  activeSessions: number;
  totalEvents: number;
  totalBlocked: number;
  totalGcRuns: number;
  totalBytesFreed: number;
} {
  const db = getDb();

  const sessions = db.prepare(`SELECT COUNT(*) as c FROM sessions`).get() as any;
  const active = db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE status = 'active'`).get() as any;
  const events = db.prepare(`SELECT COUNT(*) as c FROM fs_events`).get() as any;
  const blocked = db.prepare(`SELECT COUNT(*) as c FROM blocked_actions`).get() as any;
  const gcRuns = db.prepare(`SELECT COUNT(*) as c FROM gc_runs`).get() as any;
  const bytesFreed = db.prepare(`SELECT COALESCE(SUM(bytes_freed), 0) as total FROM gc_runs WHERE dry_run = 0`).get() as any;

  return {
    totalSessions: sessions.c,
    activeSessions: active.c,
    totalEvents: events.c,
    totalBlocked: blocked.c,
    totalGcRuns: gcRuns.c,
    totalBytesFreed: bytesFreed.total,
  };
}
