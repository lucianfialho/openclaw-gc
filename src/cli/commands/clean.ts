import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { scanOrphans, executeCleanup } from "../../core/collector.js";
import { loadConfig } from "../../core/config.js";

export function cleanCommand(): Command {
  return new Command("clean")
    .description("Run the garbage collector")
    .option("--dry-run", "Preview what would be cleaned without deleting", false)
    .option("--force", "Skip confirmation", false)
    .action(async (opts) => {
      const config = loadConfig();
      const dryRun = opts.dryRun || config.dryRun;

      const spinner = ora("Scanning for orphans...").start();
      const orphans = scanOrphans(config);
      spinner.stop();

      if (orphans.length === 0) {
        console.log(chalk.green("\n  Nothing to clean!\n"));
        return;
      }

      const totalSize = orphans.reduce((sum, a) => sum + a.size, 0);

      if (dryRun) {
        console.log(chalk.bold(`\n  [DRY RUN] Would clean ${chalk.yellow(orphans.length)} items (${formatBytes(totalSize)})\n`));
        for (const item of orphans) {
          console.log(`  ${chalk.gray(item.type === "directory" ? "dir " : "file")} ${item.path}`);
        }
        console.log();
        return;
      }

      console.log(chalk.bold(`\n  Cleaning ${chalk.yellow(orphans.length)} items (${formatBytes(totalSize)})...\n`));

      const result = executeCleanup(orphans, false);

      console.log(chalk.green(`  Done!`));
      console.log(`  Files removed: ${chalk.cyan(result.filesRemoved)}`);
      console.log(`  Dirs removed:  ${chalk.cyan(result.dirsRemoved)}`);
      console.log(`  Space freed:   ${chalk.green(formatBytes(result.bytesFreed))}\n`);
    });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
