export type ReviewStatus = "approved" | "approved_with_notes" | "changes_requested";

export interface ReviewSession {
  sessionId: string;
  title: string;
  instructions?: string;
  originalHtml: string;
  reviewedHtml: string | null;
  status: ReviewStatus | null;
  createdAt: Date;
  completedAt: Date | null;
  resolve: ((result: ReviewResult) => void) | null;
}

export interface ReviewResult {
  status: ReviewStatus;
  reviewedHtml: string;
}

export interface ReviewGeneratedUiInput {
  html: string;
  instructions?: string;
  title?: string;
}
