export type ReviewStatus = "approved" | "approved_with_notes" | "changes_requested";

export interface ReviewSessionOption {
  id: string;
  label: string;
  description?: string;
  html: string;
}

export interface ReviewSession {
  sessionId: string;
  title: string;
  instructions?: string;
  bridgeScope?: string;
  options: ReviewSessionOption[];
  selectedOptionId: string | null;
  originalHtml: string;
  reviewedHtml: string | null;
  status: ReviewStatus | null;
  createdAt: Date;
  completedAt: Date | null;
  resolve: ((result: ReviewResult) => void) | null;
}

export interface ReviewResult {
  status: ReviewStatus;
  selectedOptionId: string;
  reviewedHtml: string;
}

export type ReviewSourceType = "html" | "typescript" | "tsx";

export interface ReviewOptionInput {
  id: string;
  label: string;
  description?: string;
  html?: string;
  source?: string;
  sourceType?: ReviewSourceType;
}

export interface PreparedReviewOption extends ReviewSessionOption {
  sourceType: ReviewSourceType;
}

export interface ReviewGeneratedUiInput {
  html?: string;
  source?: string;
  sourceType?: ReviewSourceType;
  options?: ReviewOptionInput[];
  instructions?: string;
  title?: string;
}

export interface PreparedReviewInput {
  options: PreparedReviewOption[];
  defaultOptionId: string;
  instructions?: string;
  title?: string;
}
