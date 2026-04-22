import type { ReviewResult, ReviewStatus } from "../types.js";

/** Written by the standalone server when a new review session arrives. */
export interface PendingSessionFile {
  sessionId: string;
  title: string;
  instructions?: string;
  html: string;
  createdAt: string;
}

/** Written by the VS Code extension when the user submits a review. */
export interface CompletedSessionFile {
  sessionId: string;
  status: ReviewStatus;
  reviewedHtml: string;
  completedAt: string;
}
