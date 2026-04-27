export type ReviewStatus = "approved" | "approved_with_notes" | "changes_requested";

export interface ReviewOption {
  id: string;
  label: string;
  description?: string;
  html: string;
}

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
  selectedOptionId: string;
  originalHtml: string;
  generalComment: string;
  annotations: Record<string, ComponentAnnotation>;
  status: ReviewStatus | null;
}

export interface ReviewSessionPayload {
  sessionId: string;
  title: string;
  instructions: string;
  options: ReviewOption[];
  selectedOptionId: string | null;
}

declare global {
  interface Window {
    __REVIEW_SESSION__: ReviewSessionPayload;
    acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
  }
}
