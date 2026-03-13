import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_PATH = join(homedir(), ".openclaw-gc", "config.json");

export interface GcConfig {
  /** Directories the agent is allowed to write to */
  allowedPaths: string[];

  /** Paths that should never be touched (dotfiles, ssh, etc) */
  protectedPaths: string[];

  /** Max files an agent can create per minute before rate limiting kicks in */
  maxFilesPerMinute: number;

  /** Max directory depth an agent can create */
  maxDirDepth: number;

  /** Patterns to auto-clean (globs) */
  autoCleanPatterns: string[];

  /** How many days to keep journal entries */
  journalRetentionDays: number;

  /** Enable dry-run mode globally */
  dryRun: boolean;

  /** Port for the API server */
  apiPort: number;
}

const DEFAULT_CONFIG: GcConfig = {
  allowedPaths: [
    "~/Documents",
    "~/Desktop",
    "~/Downloads",
    "~/Code",
    "~/Projects",
    "/tmp",
  ],
  protectedPaths: [
    "~/.ssh",
    "~/.gnupg",
    "~/.aws",
    "~/.config",
    "~/.zshrc",
    "~/.bashrc",
    "~/.bash_profile",
    "~/.gitconfig",
    "~/.npmrc",
    "~/.env",
    "~/.openclaw/openclaw.json",
  ],
  maxFilesPerMinute: 30,
  maxDirDepth: 10,
  autoCleanPatterns: [
    "**/node_modules/.cache/**",
    "**/.tmp-*",
    "**/tmp-openclaw-*",
  ],
  journalRetentionDays: 30,
  dryRun: false,
  apiPort: 18790,
};

export function loadConfig(): GcConfig {
  if (!existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const userConfig = JSON.parse(raw) as Partial<GcConfig>;

  return { ...DEFAULT_CONFIG, ...userConfig };
}

export function saveConfig(config: GcConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/** Expand ~ to home directory */
export function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return join(homedir(), p.slice(2));
  }
  return p;
}
