import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { rollbackSession } from "../../core/collector.js";

export function rollbackCommand(): Command {
  return new Command("rollback")
    .description("Rollback all filesystem changes from a session")
    .argument("<sessionId>", "Session ID to rollback")
    .option("--dry-run", "Preview what would be rolled back", false)
    .action(async (sessionId, opts) => {
      const spinner = ora("Analyzing session...").start();
      const result = rollbackSession(sessionId, opts.dryRun);
      spinner.stop();

      if (result.details.length === 0) {
        console.log(chalk.dim(`\n  Nothing to rollback for session ${sessionId.slice(0, 8)}\n`));
        return;
      }

      const prefix = opts.dryRun ? "[DRY RUN] " : "";

      console.log(chalk.bold(`\n  ${prefix}Rollback for session ${chalk.cyan(sessionId.slice(0, 8))}\n`));

      for (const d of result.details) {
        const status = d.executed ? chalk.green("removed") : chalk.dim("skipped");
        console.log(`  ${status} ${d.path}`);
      }

      console.log(`\n  Files: ${result.filesRemoved} | Dirs: ${result.dirsRemoved} | Freed: ${formatBytes(result.bytesFreed)}\n`);
    });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
