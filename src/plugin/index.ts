/**
 * OpenClaw Plugin - Hooks into the agent lifecycle
 *
 * Install: openclaw plugins install <path>
 *
 * This integrates the GC guardrails directly into OpenClaw's
 * agent lifecycle hooks and filesystem monitoring.
 */

import { loadConfig } from "../core/config.js";
import {
  checkPathAllowed,
  checkCommandSafe,
  checkRateLimit,
  logBlockedAction,
} from "../core/guardrails.js";
import { startSession, endSession, getStats } from "../core/journal.js";
import { FsMonitor } from "../core/monitor.js";
import { scanOrphans } from "../core/collector.js";

interface OpenClawPluginApi {
  registerTool(tool: unknown, opts?: { optional?: boolean }): void;
  registerHook(name: string, handler: (...args: any[]) => any, meta?: { name?: string; description?: string }): void;
  on(event: string, handler: (...args: any[]) => any, opts?: { priority?: number }): void;
  logger: {
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
  };
  pluginConfig?: Record<string, any>;
  config?: Record<string, any>;
}

interface AgentStartEvent {
  prompt?: string;
  success?: boolean;
}

interface AgentEndEvent {
  success?: boolean;
  messages?: any[];
}

interface AgentContext {
  sessionKey?: string;
  agentId?: string;
  sessionId?: string;
}

const config = loadConfig();
let monitor: FsMonitor | null = null;
let currentSessionId: string | null = null;

export default {
  id: "openclaw-gc",
  name: "OpenClaw GC",
  description: "Garbage collector and guardrails for AI agents - blocks dangerous operations, tracks filesystem changes, enables session rollback",
  kind: "lifecycle",

  register(api: OpenClawPluginApi): void {
    api.logger.info("[openclaw-gc] Plugin loading...");

    // --- Agent lifecycle hooks ---

    api.on("before_agent_start", async (event: AgentStartEvent, ctx: AgentContext) => {
      const session = startSession(ctx.agentId || "unknown");
      currentSessionId = session.id;

      // Start filesystem monitoring
      monitor = new FsMonitor(config);
      monitor.start(session.id);

      monitor.on("fs-event", (fsEvent) => {
        // Check guardrails on every file create
        if (fsEvent.type === "create") {
          const result = checkPathAllowed(fsEvent.path, config);
          if (!result.allowed) {
            api.logger.warn(`[openclaw-gc] BLOCKED path: ${fsEvent.path} - ${result.reason}`);
            logBlockedAction(currentSessionId, "fs_create", result.reason!, { path: fsEvent.path });
          }
        }
      });

      api.logger.info(`[openclaw-gc] Session started: ${session.id.slice(0, 8)} | Monitoring filesystem...`);
    }, { priority: 1 });

    api.on("agent_end", async (event: AgentEndEvent, ctx: AgentContext) => {
      if (currentSessionId) {
        endSession(currentSessionId);
        api.logger.info(`[openclaw-gc] Session ended: ${currentSessionId.slice(0, 8)}`);
      }
      if (monitor) {
        monitor.stop();
        monitor = null;
      }

      // Report stats
      const stats = getStats();
      if (stats.totalEvents > 0 || stats.totalBlocked > 0) {
        api.logger.info(`[openclaw-gc] Events: ${stats.totalEvents} | Blocked: ${stats.totalBlocked}`);
      }

      currentSessionId = null;
    }, { priority: 99 });

    // --- Register command hooks ---

    api.registerHook(
      "command:new",
      () => {
        // When user starts a new conversation, end current GC session
        if (currentSessionId) {
          endSession(currentSessionId);
          currentSessionId = null;
        }
        if (monitor) {
          monitor.stop();
          monitor = null;
        }
      },
      {
        name: "openclaw-gc.command-new",
        description: "End GC session when /new is invoked",
      },
    );

    // --- Register GC tools for the agent ---

    api.registerTool({
      name: "ocgc_status",
      description: "Show the current status of the OpenClaw Garbage Collector (active sessions, blocked actions, stats)",
      parameters: { type: "object", properties: {}, required: [] },
      async execute() {
        const stats = getStats();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(stats, null, 2),
          }],
        };
      },
    });

    api.registerTool({
      name: "ocgc_scan",
      description: "Scan for orphaned files and residuals that can be cleaned up",
      parameters: { type: "object", properties: {}, required: [] },
      async execute() {
        const orphans = scanOrphans(config);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: orphans.length,
              totalSize: orphans.reduce((sum, a) => sum + a.size, 0),
              items: orphans.slice(0, 50),
            }, null, 2),
          }],
        };
      },
    });

    api.logger.info("[openclaw-gc] Plugin loaded. Guardrails active.");
  },
};
