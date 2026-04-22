export type ReviewStatus = "approved" | "approved_with_notes" | "changes_requested";

export interface ComponentAnnotation {
  componentId: string;
  comment: string;
  textOverride?: string;
  styleOverrides: Record<string, string>;
}

export interface SelectedComponentSnapshot {
  componentId: string;
  tagName: string;
  textContent: string;
  isTextEditable: boolean;
  styles: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontWeight: string;
    borderRadius: string;
    textAlign: string;
  };
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
