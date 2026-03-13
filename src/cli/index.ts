#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { statusCommand } from "./commands/status.js";
import { scanCommand } from "./commands/scan.js";
import { cleanCommand } from "./commands/clean.js";
import { sessionsCommand } from "./commands/sessions.js";
import { rollbackCommand } from "./commands/rollback.js";
import { serveCommand } from "./commands/serve.js";
import { configCommand } from "./commands/config.js";

const program = new Command();

program
  .name("ocgc")
  .description("OpenClaw Garbage Collector - Clean up agent messes, protect your filesystem")
  .version("0.1.0");

program.addCommand(statusCommand());
program.addCommand(scanCommand());
program.addCommand(cleanCommand());
program.addCommand(sessionsCommand());
program.addCommand(rollbackCommand());
program.addCommand(serveCommand());
program.addCommand(configCommand());

program.parse();
