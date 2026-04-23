import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { PendingSessionFile, CompletedSessionFile } from "./types.js";
import type { PreparedReviewInput, ReviewResult, ReviewSession } from "../types.js";
import { sessionStore } from "../sessions/store.js";
import { randomUUID } from "crypto";

const BRIDGE_DIR = join(tmpdir(), "ui-review-mcp");
const PENDING_DIR = join(BRIDGE_DIR, "pending");
const COMPLETED_DIR = join(BRIDGE_DIR, "completed");
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 10 * 60 * 1000;

export function ensureBridgeDirs(): void {
  mkdirSync(PENDING_DIR, { recursive: true });
  mkdirSync(COMPLETED_DIR, { recursive: true });
}

export function writePendingSession(session: ReviewSession): void {
  const payload: PendingSessionFile = {
    sessionId: session.sessionId,
    title: session.title,
    instructions: session.instructions,
    html: session.originalHtml,
    createdAt: session.createdAt.toISOString(),
  };
  writeFileSync(
    join(PENDING_DIR, `${session.sessionId}.json`),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
}

export function completedPath(sessionId: string): string {
  return join(COMPLETED_DIR, `${sessionId}.json`);
}

export function cleanupSession(sessionId: string): void {
  const pending = join(PENDING_DIR, `${sessionId}.json`);
  const completed = completedPath(sessionId);
  if (existsSync(pending)) unlinkSync(pending);
  if (existsSync(completed)) unlinkSync(completed);
}

/**
 * Polls for a completed session file, resolving when found or rejecting on timeout.
 */
export function waitForCompletion(sessionId: string): Promise<ReviewResult> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + TIMEOUT_MS;

    const interval = setInterval(() => {
      const path = completedPath(sessionId);
      if (existsSync(path)) {
        try {
          const raw = readFileSync(path, "utf-8");
          const data = JSON.parse(raw) as CompletedSessionFile;
          clearInterval(interval);
          cleanupSession(sessionId);
          resolve({ status: data.status, reviewedHtml: data.reviewedHtml });
        } catch {
          // File may still be mid-write — retry next tick
        }
        return;
      }

      if (Date.now() > deadline) {
        clearInterval(interval);
        cleanupSession(sessionId);
        reject(new Error("Review timed out – no response within 10 minutes"));
      }
    }, POLL_INTERVAL_MS);
  });
}

/**
 * High-level handler used by the standalone server tool.
 * Creates a session, writes the pending file, and waits for completion.
 */
export async function handleReviewRequest(input: PreparedReviewInput): Promise<ReviewResult> {
  ensureBridgeDirs();

  const sessionId = randomUUID();
  const title = input.title ?? "Untitled Review";

  const session = sessionStore.create(sessionId, title, input.html);
  if (input.instructions) session.instructions = input.instructions;

  writePendingSession(session);

  return waitForCompletion(sessionId);
}
