import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ReviewSession } from "../../mcp-server/src/types";
import type { PendingSessionFile, CompletedSessionFile } from "../../mcp-server/src/bridge/types";

const BRIDGE_DIR = path.join(os.tmpdir(), "ui-review-mcp");
const PENDING_DIR = path.join(BRIDGE_DIR, "pending");
const COMPLETED_DIR = path.join(BRIDGE_DIR, "completed");
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

function pendingPath(sessionId: string): string {
  return path.join(PENDING_DIR, `${sessionId}.json`);
}

function completedPath(sessionId: string): string {
  return path.join(COMPLETED_DIR, `${sessionId}.json`);
}

function removeIfExists(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

function shouldDiscardPendingSession(data: PendingSessionFile): boolean {
  const createdAt = Date.parse(data.createdAt);
  const hasCompletion = fs.existsSync(completedPath(data.sessionId));
  const isExpired = Number.isFinite(createdAt) && Date.now() - createdAt > SESSION_TIMEOUT_MS;

  return hasCompletion || isExpired;
}

/**
 * Watches the OS temp bridge directory for new pending session files.
 * When a file appears, calls onNewSession with the session data.
 * Returns a disposable that stops the watcher.
 */
export function watchPendingSessions(
  onNewSession: (session: ReviewSession) => void,
): { dispose: () => void } {
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  fs.mkdirSync(COMPLETED_DIR, { recursive: true });

  const seen = new Set<string>();

  function checkForNew() {
    let entries: string[];
    try {
      entries = fs.readdirSync(PENDING_DIR);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.endsWith(".json") || seen.has(entry)) continue;
      seen.add(entry);

      const filePath = path.join(PENDING_DIR, entry);
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw) as PendingSessionFile;

        if (shouldDiscardPendingSession(data)) {
          removeIfExists(filePath);
          continue;
        }

        const session: ReviewSession = {
          sessionId: data.sessionId,
          title: data.title,
          instructions: data.instructions,
          originalHtml: data.html,
          reviewedHtml: null,
          status: null,
          createdAt: new Date(data.createdAt),
          completedAt: null,
          resolve: null,
        };

        onNewSession(session);
      } catch {
        // File may still be mid-write — will retry on next poll
        seen.delete(entry);
      }
    }
  }

  // Initial check for sessions already waiting.
  checkForNew();

  let watcher: fs.FSWatcher | undefined;
  try {
    watcher = fs.watch(PENDING_DIR, () => checkForNew());
  } catch {
    // fs.watch may not be available in all environments; fall back to polling.
  }

  // Fallback poll every 1s to handle environments where fs.watch is unreliable.
  const interval = setInterval(checkForNew, 1000);

  return {
    dispose() {
      watcher?.close();
      clearInterval(interval);
    },
  };
}

/**
 * Writes the completed review result to the bridge directory so the standalone
 * MCP server can pick it up and return it to the agent.
 */
export function writeCompletedSession(
  sessionId: string,
  status: "approved" | "approved_with_notes" | "changes_requested",
  reviewedHtml: string,
): void {
  fs.mkdirSync(COMPLETED_DIR, { recursive: true });

  const payload: CompletedSessionFile = {
    sessionId,
    status,
    reviewedHtml,
    completedAt: new Date().toISOString(),
  };

  const tmpPath = path.join(COMPLETED_DIR, `${sessionId}.tmp`);
  const finalPath = path.join(COMPLETED_DIR, `${sessionId}.json`);

  // Write to .tmp first, then rename atomically so the server doesn't read a partial file.
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
  fs.renameSync(tmpPath, finalPath);
  removeIfExists(pendingPath(sessionId));
}

/**
 * Removes a pending review session without writing a completion result.
 * Used when the user closes a review panel so stale sessions do not reopen
 * on the next VS Code startup.
 */
export function discardPendingSession(sessionId: string): void {
  removeIfExists(pendingPath(sessionId));
}
