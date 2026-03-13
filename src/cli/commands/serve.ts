import { Command } from "commander";
import chalk from "chalk";
import { startServer } from "../../api/server.js";

export function serveCommand(): Command {
  return new Command("serve")
    .description("Start the API server (for dashboard/UI integration)")
    .option("-p, --port <number>", "Port to listen on")
    .action(async (opts) => {
      try {
        const { port } = await startServer();
        console.log(chalk.bold(`\n  OpenClaw GC API running on ${chalk.cyan(`http://127.0.0.1:${port}`)}\n`));
        console.log(chalk.dim("  Endpoints:"));
        console.log(chalk.dim("    GET  /health        - Health check"));
        console.log(chalk.dim("    GET  /stats         - GC statistics"));
        console.log(chalk.dim("    GET  /sessions      - List sessions"));
        console.log(chalk.dim("    GET  /sessions/:id  - Session details"));
        console.log(chalk.dim("    GET  /gc/scan       - Scan for orphans"));
        console.log(chalk.dim("    POST /gc/run        - Execute cleanup"));
        console.log(chalk.dim("    GET  /blocked       - Blocked actions log"));
        console.log(chalk.dim("    GET  /gc/history    - GC run history\n"));
        console.log(chalk.dim("  Press Ctrl+C to stop\n"));
      } catch (err) {
        console.error(chalk.red(`  Failed to start server: ${err}`));
        process.exit(1);
      }
    });
}
