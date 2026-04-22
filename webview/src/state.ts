import type { ReviewState } from "./types";

export const vscode = window.acquireVsCodeApi();

export function buildReviewedHtml(state: ReviewState): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(state.originalHtml, "text/html");

  for (const annotation of Object.values(state.annotations)) {
    const el = doc.querySelector<HTMLElement>(
      `[data-component-id="${CSS.escape(annotation.componentId)}"]`
    );
    if (!el) continue;

    if (annotation.textOverride !== undefined) {
      el.textContent = annotation.textOverride;
    }

    for (const [prop, value] of Object.entries(annotation.styleOverrides)) {
      el.style.setProperty(prop, value);
    }

    if (annotation.comment.trim()) {
      el.setAttribute("data-review-comment", annotation.comment.trim());
    }
  }

  if (state.status) {
    doc.body.setAttribute("data-review-status", state.status);
  }

  if (state.generalComment.trim()) {
    let aside = doc.getElementById("agent-review-feedback");
    if (!aside) {
      aside = doc.createElement("aside");
      aside.id = "agent-review-feedback";
      aside.setAttribute("hidden", "");
      doc.body.appendChild(aside);
    }

    let p = aside.querySelector<HTMLElement>("[data-review-scope='general']");
    if (!p) {
      p = doc.createElement("p");
      p.setAttribute("data-review-scope", "general");
      aside.appendChild(p);
    }

    p.textContent = state.generalComment.trim();
  }

  return new XMLSerializer().serializeToString(doc);
}

export function postSubmit(state: ReviewState): void {
  vscode.postMessage({
    type: "submitReview",
    sessionId: state.sessionId,
    status: state.status,
    reviewedHtml: buildReviewedHtml(state),
  });
}
