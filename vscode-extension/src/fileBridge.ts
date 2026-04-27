import * as fs from "fs";
import * as path from "path";
import type { ReviewSession } from "../../mcp-server/src/types";
import type { PendingSessionFile, CompletedSessionFile } from "../../mcp-server/src/bridge/types";
import { getBridgeDirectories } from "../../mcp-server/src/bridge/paths";

const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

function pendingPath(baseDir: string, sessionId: string): string {
  return path.join(baseDir, `${sessionId}.json`);
}

function completedPath(baseDir: string, sessionId: string): string {
  return path.join(baseDir, `${sessionId}.json`);
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

function shouldDiscardPendingSession(data: PendingSessionFile, completedDir: string): boolean {
  const createdAt = Date.parse(data.createdAt);
  const hasCompletion = fs.existsSync(completedPath(completedDir, data.sessionId));
  const isExpired = Number.isFinite(createdAt) && Date.now() - createdAt > SESSION_TIMEOUT_MS;

  return hasCompletion || isExpired;
}

function getWorkspaceBridgeDirs(workspacePaths: readonly string[]): Array<{
  scope?: string;
  bridgeDir: string;
  pendingDir: string;
  completedDir: string;
}> {
  const uniqueWorkspacePaths = Array.from(new Set(workspacePaths.filter((value) => value.trim())));
  if (uniqueWorkspacePaths.length === 0) {
    return [{ scope: undefined, ...getBridgeDirectories() }];
  }

  return uniqueWorkspacePaths.map((workspacePath) => ({
    scope: workspacePath,
    ...getBridgeDirectories(workspacePath),
  }));
}

/**
 * Watches the OS temp bridge directory for new pending session files.
 * When a file appears, calls onNewSession with the session data.
 * Returns a disposable that stops the watcher.
 */
export function watchPendingSessions(
  workspacePaths: readonly string[],
  onNewSession: (session: ReviewSession) => void,
): { dispose: () => void } {
  const bridgeDirs = getWorkspaceBridgeDirs(workspacePaths);
  for (const dirs of bridgeDirs) {
    fs.mkdirSync(dirs.pendingDir, { recursive: true });
    fs.mkdirSync(dirs.completedDir, { recursive: true });
  }

  const seen = new Set<string>();

  function checkForNew() {
    for (const dirs of bridgeDirs) {
      let entries: string[];
      try {
        entries = fs.readdirSync(dirs.pendingDir);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.endsWith(".json")) continue;

        const seenKey = `${dirs.pendingDir}:${entry}`;
        if (seen.has(seenKey)) continue;
        seen.add(seenKey);

        const filePath = path.join(dirs.pendingDir, entry);
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          const data = JSON.parse(raw) as PendingSessionFile;

          if (shouldDiscardPendingSession(data, dirs.completedDir)) {
            removeIfExists(filePath);
            continue;
          }

          const session: ReviewSession = {
            sessionId: data.sessionId,
            title: data.title,
            instructions: data.instructions,
            bridgeScope: dirs.scope ?? 'global',
            options: data.options,
            selectedOptionId: data.options[0]?.id ?? null,
            originalHtml: data.options[0]?.html ?? '',
            reviewedHtml: null,
            status: null,
            createdAt: new Date(data.createdAt),
            completedAt: null,
            resolve: null,
          };

          onNewSession(session);
        } catch {
          // File may still be mid-write — will retry on next poll
          seen.delete(seenKey);
        }
      }
    }
  }

  // Initial check for sessions already waiting.
  checkForNew();

  const watchers: fs.FSWatcher[] = [];
  for (const dirs of bridgeDirs) {
    try {
      watchers.push(fs.watch(dirs.pendingDir, () => checkForNew()));
    } catch {
      // fs.watch may not be available in all environments; fall back to polling.
    }
  }

  // Fallback poll every 1s to handle environments where fs.watch is unreliable.
  const interval = setInterval(checkForNew, 1000);

  return {
    dispose() {
      for (const watcher of watchers) {
        watcher.close();
      }
      clearInterval(interval);
    },
  };
}

/**
 * Writes the completed review result to the bridge directory so the standalone
 * MCP server can pick it up and return it to the agent.
 */
export function writeCompletedSession(
  bridgeScope: string,
  sessionId: string,
  status: "approved" | "approved_with_notes" | "changes_requested",
  selectedOptionId: string,
  reviewedHtml: string,
): void {
  const dirs = getBridgeDirectories(bridgeScope === 'global' ? undefined : bridgeScope);
  fs.mkdirSync(dirs.completedDir, { recursive: true });

  const payload: CompletedSessionFile = {
    sessionId,
    status,
    selectedOptionId,
    reviewedHtml,
    completedAt: new Date().toISOString(),
  };

  const tmpPath = path.join(dirs.completedDir, `${sessionId}.tmp`);
  const finalPath = path.join(dirs.completedDir, `${sessionId}.json`);

  // Write to .tmp first, then rename atomically so the server doesn't read a partial file.
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
  fs.renameSync(tmpPath, finalPath);
  removeIfExists(pendingPath(dirs.pendingDir, sessionId));
}

/**
 * Removes a pending review session without writing a completion result.
 * Used when the user closes a review panel so stale sessions do not reopen
 * on the next VS Code startup.
 */
export function discardPendingSession(sessionId: string): void {
  removeIfExists(pendingPath(getBridgeDirectories().pendingDir, sessionId));
}

export function discardPendingSessionInScope(bridgeScope: string, sessionId: string): void {
  const dirs = getBridgeDirectories(bridgeScope === 'global' ? undefined : bridgeScope);
  removeIfExists(pendingPath(dirs.pendingDir, sessionId));
}
