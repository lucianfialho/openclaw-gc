import { watch, type FSWatcher } from "chokidar";
import { statSync } from "node:fs";
import { getDb } from "./db.js";
import { type GcConfig, expandPath } from "./config.js";
import { EventEmitter } from "node:events";

export type FsEventType = "create" | "modify" | "delete" | "rename";

export interface FsEvent {
  type: FsEventType;
  path: string;
  oldPath?: string;
  timestamp: Date;
  size?: number;
}

export class FsMonitor extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private sessionId: string | null = null;

  constructor(private config: GcConfig) {
    super();
  }

  start(sessionId: string): void {
    this.sessionId = sessionId;

    const watchPaths = this.config.allowedPaths.map(expandPath);

    this.watcher = watch(watchPaths, {
      ignoreInitial: true,
      persistent: true,
      depth: this.config.maxDirDepth,
      ignored: [
        "**/node_modules/**",
        "**/.git/objects/**",
        "**/.DS_Store",
      ],
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher
      .on("add", (path) => this.recordEvent("create", path))
      .on("change", (path) => this.recordEvent("modify", path))
      .on("unlink", (path) => this.recordEvent("delete", path))
      .on("addDir", (path) => this.recordEvent("create", path))
      .on("unlinkDir", (path) => this.recordEvent("delete", path));
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.sessionId = null;
  }

  private recordEvent(type: FsEventType, path: string): void {
    let size: number | undefined;
    if (type !== "delete") {
      try {
        size = statSync(path).size;
      } catch {
        // File may have been deleted between event and stat
      }
    }

    const event: FsEvent = {
      type,
      path,
      timestamp: new Date(),
      size,
    };

    // Persist to journal
    const db = getDb();
    db.prepare(`
      INSERT INTO fs_events (session_id, event_type, path, metadata)
      VALUES (?, ?, ?, ?)
    `).run(
      this.sessionId,
      type,
      path,
      JSON.stringify({ size }),
    );

    this.emit("fs-event", event);
  }
}
