// Public API - reexport everything for library usage
export { loadConfig, saveConfig, type GcConfig } from "./core/config.js";
export { getDb, closeDb } from "./core/db.js";
export { FsMonitor, type FsEvent } from "./core/monitor.js";
export {
  checkPathAllowed,
  checkCommandSafe,
  checkRateLimit,
  logBlockedAction,
  type GuardrailResult,
} from "./core/guardrails.js";
export {
  scanOrphans,
  scanSessionResiduals,
  executeCleanup,
  rollbackSession,
  type GcResult,
  type GcAction,
} from "./core/collector.js";
export {
  startSession,
  endSession,
  getSession,
  listSessions,
  getSessionEvents,
  getStats,
  type Session,
  type JournalEntry,
} from "./core/journal.js";
export { createServer, startServer } from "./api/server.js";
