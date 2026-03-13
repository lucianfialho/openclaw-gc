import { resolve, relative, isAbsolute } from "node:path";
import { type GcConfig, expandPath } from "./config.js";
import { getDb } from "./db.js";

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
}

/** Dangerous command patterns that should be blocked or flagged */
const DANGEROUS_PATTERNS = [
  { pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*-rf\b|.*--force\b)/, reason: "Forced recursive delete detected" },
  { pattern: /\bchmod\s+777\b/, reason: "Insecure permission change (777)" },
  { pattern: /\bchown\s+-R\b/, reason: "Recursive ownership change" },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: "Direct disk write attempt" },
  { pattern: /\bcurl\b.*\|\s*(ba)?sh/, reason: "Pipe from network to shell" },
  { pattern: /\beval\b/, reason: "Dynamic code evaluation" },
  { pattern: /\bmkfs\b/, reason: "Filesystem format attempt" },
  { pattern: /\bdd\s+if=/, reason: "Raw disk copy" },
];

/** Files that should never be modified */
const CRITICAL_DOTFILES = [
  ".ssh/authorized_keys",
  ".ssh/id_rsa",
  ".ssh/id_ed25519",
  ".gnupg/",
  ".aws/credentials",
];

export function checkPathAllowed(targetPath: string, config: GcConfig): GuardrailResult {
  const resolved = resolve(targetPath);

  // Check protected paths first
  for (const protectedPath of config.protectedPaths) {
    const expanded = expandPath(protectedPath);
    if (resolved.startsWith(expanded) || resolved === expanded) {
      return { allowed: false, reason: `Path is protected: ${protectedPath}` };
    }
  }

  // Check critical dotfiles
  for (const critical of CRITICAL_DOTFILES) {
    const expanded = expandPath(`~/${critical}`);
    if (resolved.startsWith(expanded)) {
      return { allowed: false, reason: `Critical file protected: ~/${critical}` };
    }
  }

  // Check if path is within allowed directories
  const isAllowed = config.allowedPaths.some((allowedPath) => {
    const expanded = resolve(expandPath(allowedPath));
    const rel = relative(expanded, resolved);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  });

  if (!isAllowed) {
    return { allowed: false, reason: `Path outside allowed directories: ${resolved}` };
  }

  // Check directory depth
  const parts = resolved.split("/").filter(Boolean);
  if (parts.length > config.maxDirDepth) {
    return { allowed: false, reason: `Directory depth (${parts.length}) exceeds max (${config.maxDirDepth})` };
  }

  return { allowed: true };
}

export function checkCommandSafe(command: string): GuardrailResult {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { allowed: false, reason };
    }
  }
  return { allowed: true };
}

/** Rate limiter - checks if agent is creating too many files */
export function checkRateLimit(sessionId: string, config: GcConfig): GuardrailResult {
  const db = getDb();
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

  const row = db.prepare(`
    SELECT COUNT(*) as count FROM fs_events
    WHERE session_id = ? AND timestamp > ? AND event_type IN ('create', 'write')
  `).get(sessionId, oneMinuteAgo) as { count: number } | undefined;

  const count = row?.count ?? 0;

  if (count >= config.maxFilesPerMinute) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${count} file ops in last minute (max: ${config.maxFilesPerMinute})`,
    };
  }

  return { allowed: true };
}

export function logBlockedAction(
  sessionId: string | null,
  toolName: string,
  reason: string,
  params?: Record<string, unknown>,
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO blocked_actions (session_id, tool_name, reason, params)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, toolName, reason, params ? JSON.stringify(params) : null);
}
