import { existsSync, statSync, unlinkSync, rmdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./db.js";
import { type GcConfig, expandPath } from "./config.js";
import { minimatch } from "minimatch";

export interface GcResult {
  filesRemoved: number;
  dirsRemoved: number;
  bytesFreed: number;
  details: GcAction[];
}

export interface GcAction {
  path: string;
  type: "file" | "directory";
  size: number;
  reason: string;
  executed: boolean;
}

/**
 * Scan for orphaned files created by agents that match auto-clean patterns
 */
export function scanOrphans(config: GcConfig): GcAction[] {
  const actions: GcAction[] = [];
  const db = getDb();

  // Find files created by agents that no longer exist
  const orphanRows = db.prepare(`
    SELECT DISTINCT fe.path, fe.metadata
    FROM fs_events fe
    WHERE fe.event_type = 'create'
      AND fe.rolled_back = 0
      AND NOT EXISTS (
        SELECT 1 FROM fs_events fe2
        WHERE fe2.path = fe.path
          AND fe2.event_type = 'delete'
          AND fe2.timestamp > fe.timestamp
      )
    ORDER BY fe.timestamp DESC
  `).all() as Array<{ path: string; metadata: string | null }>;

  for (const row of orphanRows) {
    if (!existsSync(row.path)) continue;

    const matchesPattern = config.autoCleanPatterns.some((pattern) =>
      minimatch(row.path, pattern),
    );

    if (matchesPattern) {
      const stat = statSync(row.path);
      actions.push({
        path: row.path,
        type: stat.isDirectory() ? "directory" : "file",
        size: stat.size,
        reason: "Matches auto-clean pattern",
        executed: false,
      });
    }
  }

  return actions;
}

/**
 * Find files from sessions that have ended
 */
export function scanSessionResiduals(sessionId: string): GcAction[] {
  const actions: GcAction[] = [];
  const db = getDb();

  const rows = db.prepare(`
    SELECT path, event_type, metadata
    FROM fs_events
    WHERE session_id = ? AND event_type = 'create' AND rolled_back = 0
    ORDER BY timestamp ASC
  `).all(sessionId) as Array<{ path: string; event_type: string; metadata: string | null }>;

  for (const row of rows) {
    if (!existsSync(row.path)) continue;

    const stat = statSync(row.path);
    actions.push({
      path: row.path,
      type: stat.isDirectory() ? "directory" : "file",
      size: stat.size,
      reason: `Created by session ${sessionId}`,
      executed: false,
    });
  }

  return actions;
}

/**
 * Execute cleanup actions
 */
export function executeCleanup(actions: GcAction[], dryRun: boolean): GcResult {
  const result: GcResult = {
    filesRemoved: 0,
    dirsRemoved: 0,
    bytesFreed: 0,
    details: [],
  };

  // Sort: files first, then directories (deepest first)
  const sorted = [...actions].sort((a, b) => {
    if (a.type !== b.type) return a.type === "file" ? -1 : 1;
    return b.path.length - a.path.length; // deeper paths first for dirs
  });

  const db = getDb();

  for (const action of sorted) {
    if (!existsSync(action.path)) {
      action.executed = false;
      result.details.push(action);
      continue;
    }

    if (dryRun) {
      action.executed = false;
      result.details.push(action);
      continue;
    }

    try {
      if (action.type === "file") {
        unlinkSync(action.path);
        result.filesRemoved++;
      } else {
        // Only remove empty directories
        const contents = readdirSync(action.path);
        if (contents.length === 0) {
          rmdirSync(action.path);
          result.dirsRemoved++;
        } else {
          action.executed = false;
          result.details.push({ ...action, reason: `${action.reason} (skipped: not empty)` });
          continue;
        }
      }

      result.bytesFreed += action.size;
      action.executed = true;

      // Mark as rolled back in journal
      db.prepare(`
        UPDATE fs_events SET rolled_back = 1 WHERE path = ?
      `).run(action.path);
    } catch (err) {
      action.executed = false;
    }

    result.details.push(action);
  }

  // Log the GC run
  db.prepare(`
    INSERT INTO gc_runs (files_removed, dirs_removed, bytes_freed, dry_run, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(result.filesRemoved, result.dirsRemoved, result.bytesFreed, dryRun ? 1 : 0, JSON.stringify(result.details));

  return result;
}

/**
 * Rollback all changes from a specific session
 */
export function rollbackSession(sessionId: string, dryRun: boolean): GcResult {
  const actions = scanSessionResiduals(sessionId);
  return executeCleanup(actions, dryRun);
}
