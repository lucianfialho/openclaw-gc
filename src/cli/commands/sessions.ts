import { Command } from "commander";
import chalk from "chalk";
import { listSessions, getSessionEvents } from "../../core/journal.js";

export function sessionsCommand(): Command {
  const cmd = new Command("sessions")
    .description("List and inspect agent sessions");

  cmd
    .command("list")
    .description("List recent sessions")
    .option("-n, --limit <number>", "Number of sessions to show", "20")
    .action((opts) => {
      const sessions = listSessions(parseInt(opts.limit, 10));

      if (sessions.length === 0) {
        console.log(chalk.dim("\n  No sessions recorded yet.\n"));
        return;
      }

      console.log(chalk.bold("\n  Recent Sessions\n"));

      for (const s of sessions) {
        const statusColor = s.status === "active" ? chalk.yellow : s.status === "rolled_back" ? chalk.red : chalk.green;
        console.log(`  ${chalk.gray(s.id.slice(0, 8))} ${statusColor(s.status.padEnd(12))} ${chalk.dim(s.startedAt)} ${s.agentId ? chalk.cyan(s.agentId) : ""}`);
      }
      console.log();
    });

  cmd
    .command("inspect <sessionId>")
    .description("Show events from a specific session")
    .action((sessionId) => {
      const events = getSessionEvents(sessionId);

      if (events.length === 0) {
        console.log(chalk.dim(`\n  No events for session ${sessionId}\n`));
        return;
      }

      console.log(chalk.bold(`\n  Events for session ${chalk.cyan(sessionId.slice(0, 8))}\n`));

      for (const e of events) {
        const typeColor =
          e.eventType === "create" ? chalk.green :
          e.eventType === "delete" ? chalk.red :
          chalk.yellow;

        const rb = e.rolledBack ? chalk.dim(" [rolled back]") : "";
        console.log(`  ${chalk.gray(e.timestamp)} ${typeColor(e.eventType.padEnd(8))} ${e.path}${rb}`);
      }
      console.log();
    });

  return cmd;
}
