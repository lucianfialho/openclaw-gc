import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, saveConfig, expandPath } from "../../core/config.js";

export function configCommand(): Command {
  const cmd = new Command("config")
    .description("View and edit GC configuration");

  cmd
    .command("show")
    .description("Show current configuration")
    .action(() => {
      const config = loadConfig();
      console.log(chalk.bold("\n  OpenClaw GC Configuration\n"));
      console.log(JSON.stringify(config, null, 2));
      console.log();
    });

  cmd
    .command("allow <path>")
    .description("Add a path to the allowed list")
    .action((path) => {
      const config = loadConfig();
      if (config.allowedPaths.includes(path)) {
        console.log(chalk.yellow(`  Path already allowed: ${path}`));
        return;
      }
      config.allowedPaths.push(path);
      saveConfig(config);
      console.log(chalk.green(`  Added to allowed paths: ${path}`));
    });

  cmd
    .command("protect <path>")
    .description("Add a path to the protected list")
    .action((path) => {
      const config = loadConfig();
      if (config.protectedPaths.includes(path)) {
        console.log(chalk.yellow(`  Path already protected: ${path}`));
        return;
      }
      config.protectedPaths.push(path);
      saveConfig(config);
      console.log(chalk.green(`  Added to protected paths: ${path}`));
    });

  cmd
    .command("set <key> <value>")
    .description("Set a config value (maxFilesPerMinute, maxDirDepth, dryRun, apiPort)")
    .action((key, value) => {
      const config = loadConfig();
      const numericKeys = ["maxFilesPerMinute", "maxDirDepth", "journalRetentionDays", "apiPort"];
      const boolKeys = ["dryRun"];

      if (numericKeys.includes(key)) {
        (config as any)[key] = parseInt(value, 10);
      } else if (boolKeys.includes(key)) {
        (config as any)[key] = value === "true";
      } else {
        console.log(chalk.red(`  Unknown config key: ${key}`));
        return;
      }

      saveConfig(config);
      console.log(chalk.green(`  Set ${key} = ${value}`));
    });

  return cmd;
}
