/**
 * OpenClaw Plugin - Hooks into the agent lifecycle
 *
 * Install: copy to ~/.openclaw/plugins/ or register via openclaw.json
 *
 * This integrates the GC guardrails directly into OpenClaw's
 * before_tool_call / after_tool_call hooks.
 */

import { loadConfig } from "../core/config.js";
import {
  checkPathAllowed,
  checkCommandSafe,
  checkRateLimit,
  logBlockedAction,
} from "../core/guardrails.js";
import { startSession, endSession } from "../core/journal.js";
import { FsMonitor } from "../core/monitor.js";

interface OpenClawPluginApi {
  registerTool(tool: unknown): void;
  on(event: string, handler: (...args: any[]) => any, opts?: { priority?: number }): void;
}

interface ToolCallEvent {
  toolName: string;
  toolCallId: string;
  params: Record<string, any>;
}

interface SessionEvent {
  sessionId: string;
  agentId?: string;
}

export default function register(api: OpenClawPluginApi): void {
  const config = loadConfig();
  let monitor: FsMonitor | null = null;
  let currentSessionId: string | null = null;

  // --- Session lifecycle ---

  api.on("session_start", (event: SessionEvent) => {
    const session = startSession(event.agentId);
    currentSessionId = session.id;

    monitor = new FsMonitor(config);
    monitor.start(session.id);
  }, { priority: 1 });

  api.on("session_end", () => {
    if (currentSessionId) {
      endSession(currentSessionId);
    }
    if (monitor) {
      monitor.stop();
      monitor = null;
    }
    currentSessionId = null;
  }, { priority: 99 });

  // --- Guardrail hooks ---

  api.on("before_tool_call", (event: ToolCallEvent) => {
    const { toolName, params } = event;

    // Check filesystem operations
    if (toolName === "write_file" || toolName === "create_file" || toolName === "save_file") {
      const targetPath = params.path || params.file_path || params.filename;
      if (targetPath) {
        const result = checkPathAllowed(targetPath, config);
        if (!result.allowed) {
          logBlockedAction(currentSessionId, toolName, result.reason!, params);
          return { block: true, reason: `[openclaw-gc] ${result.reason}` };
        }
      }
    }

    // Check shell commands
    if (toolName === "run_terminal_cmd" || toolName === "execute" || toolName === "shell") {
      const command = params.command || params.cmd;
      if (command) {
        const result = checkCommandSafe(command);
        if (!result.allowed) {
          logBlockedAction(currentSessionId, toolName, result.reason!, params);
          return { block: true, reason: `[openclaw-gc] ${result.reason}` };
        }
      }
    }

    // Rate limiting
    if (currentSessionId) {
      const rateResult = checkRateLimit(currentSessionId, config);
      if (!rateResult.allowed) {
        logBlockedAction(currentSessionId, toolName, rateResult.reason!, params);
        return { block: true, reason: `[openclaw-gc] ${rateResult.reason}` };
      }
    }

    return undefined; // Allow
  }, { priority: 5 });

  // --- Register GC tools for the agent to use ---

  api.registerTool({
    name: "ocgc_status",
    description: "Show the current status of the OpenClaw Garbage Collector (active sessions, blocked actions, stats)",
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
      const { getStats } = await import("../core/journal.js");
      return { result: getStats() };
    },
  });

  api.registerTool({
    name: "ocgc_scan",
    description: "Scan for orphaned files and residuals that can be cleaned up",
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
      const { scanOrphans } = await import("../core/collector.js");
      const orphans = scanOrphans(config);
      return {
        result: {
          count: orphans.length,
          totalSize: orphans.reduce((sum, a) => sum + a.size, 0),
          items: orphans.slice(0, 50),
        },
      };
    },
  });
}
