export type ReviewStatus = "approved" | "approved_with_notes" | "changes_requested";

export interface ComponentAnnotation {
  componentId: string;
  comment: string;
  styleOverrides: Record<string, string>;
}

export interface ReviewState {
  sessionId: string;
  originalHtml: string;
  generalComment: string;
  annotations: Record<string, ComponentAnnotation>;
  status: ReviewStatus | null;
}

declare global {
  interface Window {
    __REVIEW_SESSION__: { sessionId: string; html: string };
    acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
  }
}
