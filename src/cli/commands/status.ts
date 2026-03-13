import { Command } from "commander";
import chalk from "chalk";
import { getStats } from "../../core/journal.js";
import { getDb } from "../../core/db.js";

export function statusCommand(): Command {
  return new Command("status")
    .description("Show GC status and stats")
    .action(() => {
      const stats = getStats();

      console.log(chalk.bold("\n  OpenClaw GC Status\n"));
      console.log(`  Sessions total:    ${chalk.cyan(stats.totalSessions)}`);
      console.log(`  Sessions active:   ${stats.activeSessions > 0 ? chalk.yellow(stats.activeSessions) : chalk.green(stats.activeSessions)}`);
      console.log(`  FS events tracked: ${chalk.cyan(stats.totalEvents)}`);
      console.log(`  Actions blocked:   ${stats.totalBlocked > 0 ? chalk.red(stats.totalBlocked) : chalk.green(stats.totalBlocked)}`);
      console.log(`  GC runs:           ${chalk.cyan(stats.totalGcRuns)}`);
      console.log(`  Bytes freed:       ${chalk.green(formatBytes(stats.totalBytesFreed))}`);

      // Recent blocked actions
      const db = getDb();
      const recentBlocked = db.prepare(`
        SELECT * FROM blocked_actions ORDER BY timestamp DESC LIMIT 5
      `).all() as any[];

      if (recentBlocked.length > 0) {
        console.log(chalk.bold("\n  Recent Blocked Actions:\n"));
        for (const action of recentBlocked) {
          console.log(`  ${chalk.gray(action.timestamp)} ${chalk.red("BLOCKED")} ${action.tool_name}: ${action.reason}`);
        }
      }

      console.log();
    });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
