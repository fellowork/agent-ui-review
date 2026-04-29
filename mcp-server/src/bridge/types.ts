import type { ReviewSessionOption, ReviewStatus } from "../types.js";

/** Written by the standalone server when a new review session arrives. */
export interface PendingSessionFile {
  sessionId: string;
  title: string;
  instructions?: string;
  options: ReviewSessionOption[];
  createdAt: string;
}

/** Written by the VS Code extension when the user submits a review. */
export interface CompletedSessionFile {
  sessionId: string;
  status: ReviewStatus;
  selectedOptionId: string;
  reviewedHtml: string;
  reviewedOptions: Array<{
    optionId: string;
    reviewedHtml: string;
  }>;
  completedAt: string;
}
