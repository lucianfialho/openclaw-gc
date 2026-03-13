import { Command } from "commander";
import chalk from "chalk";
import { scanOrphans } from "../../core/collector.js";
import { loadConfig } from "../../core/config.js";

export function scanCommand(): Command {
  return new Command("scan")
    .description("Scan for orphaned files and residuals to clean up")
    .action(() => {
      const config = loadConfig();
      const orphans = scanOrphans(config);

      if (orphans.length === 0) {
        console.log(chalk.green("\n  No orphaned files found. All clean!\n"));
        return;
      }

      const totalSize = orphans.reduce((sum, a) => sum + a.size, 0);

      console.log(chalk.bold(`\n  Found ${chalk.yellow(orphans.length)} items to clean (${formatBytes(totalSize)})\n`));

      for (const item of orphans) {
        const icon = item.type === "directory" ? "dir " : "file";
        console.log(`  ${chalk.gray(icon)} ${item.path}`);
        console.log(`       ${chalk.dim(item.reason)} (${formatBytes(item.size)})`);
      }

      console.log(chalk.dim(`\n  Run ${chalk.white("ocgc clean")} to remove these items`));
      console.log(chalk.dim(`  Run ${chalk.white("ocgc clean --dry-run")} to preview first\n`));
    });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
