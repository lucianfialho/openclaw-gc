/**
 * API Server - JSON REST API for the GC
 *
 * This is the layer between core and any UI (CLI, dashboard, mobile app).
 * All state changes go through here.
 */

import Fastify from "fastify";
import { loadConfig } from "../core/config.js";
import { listSessions, getSession, getSessionEvents, getStats } from "../core/journal.js";
import { scanOrphans, scanSessionResiduals, executeCleanup, rollbackSession } from "../core/collector.js";
import { getDb } from "../core/db.js";

export async function createServer() {
  const config = loadConfig();
  const app = Fastify({ logger: false });

  // --- Health ---
  app.get("/health", async () => ({ status: "ok", version: "0.1.0" }));

  // --- Stats ---
  app.get("/stats", async () => getStats());

  // --- Sessions ---
  app.get("/sessions", async (req) => {
    const query = req.query as { limit?: string };
    const limit = parseInt(query.limit ?? "20", 10);
    return listSessions(limit);
  });

  app.get<{ Params: { id: string } }>("/sessions/:id", async (req) => {
    const session = getSession(req.params.id);
    if (!session) return { error: "Session not found" };
    return session;
  });

  app.get<{ Params: { id: string } }>("/sessions/:id/events", async (req) => {
    return getSessionEvents(req.params.id);
  });

  app.post<{ Params: { id: string }; Body: { dryRun?: boolean } }>("/sessions/:id/rollback", async (req) => {
    const dryRun = req.body?.dryRun ?? true;
    return rollbackSession(req.params.id, dryRun);
  });

  // --- GC ---
  app.get("/gc/scan", async () => {
    const orphans = scanOrphans(config);
    return {
      count: orphans.length,
      totalSize: orphans.reduce((sum, a) => sum + a.size, 0),
      items: orphans,
    };
  });

  app.post<{ Body: { dryRun?: boolean } }>("/gc/run", async (req) => {
    const dryRun = req.body?.dryRun ?? true;
    const orphans = scanOrphans(config);
    return executeCleanup(orphans, dryRun);
  });

  // --- Blocked actions log ---
  app.get("/blocked", async (req) => {
    const query = req.query as { limit?: string };
    const limit = parseInt(query.limit ?? "50", 10);
    const db = getDb();
    return db.prepare(`
      SELECT * FROM blocked_actions ORDER BY timestamp DESC LIMIT ?
    `).all(limit);
  });

  // --- GC history ---
  app.get("/gc/history", async (req) => {
    const query = req.query as { limit?: string };
    const limit = parseInt(query.limit ?? "20", 10);
    const db = getDb();
    return db.prepare(`
      SELECT * FROM gc_runs ORDER BY ran_at DESC LIMIT ?
    `).all(limit);
  });

  return { app, port: config.apiPort };
}

export async function startServer() {
  const { app, port } = await createServer();
  await app.listen({ port, host: "127.0.0.1" });
  return { app, port };
}
