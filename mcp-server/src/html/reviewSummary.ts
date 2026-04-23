import type * as JsdomModule from "jsdom";
import type { ReviewResult } from "../types.js";

const { JSDOM } = require("jsdom/lib/api.js") as typeof JsdomModule;

interface ComponentReviewSummary {
  componentId: string;
  comment: string | null;
  changedText: boolean;
  changedStyles: string[];
}

export interface ReviewSummary {
  status: ReviewResult["status"];
  generalComment: string | null;
  componentSummaries: ComponentReviewSummary[];
}

function buildElementMap(document: Document): Map<string, HTMLElement> {
  const elements = new Map<string, HTMLElement>();
  document.querySelectorAll<HTMLElement>("[data-component-id]").forEach((element) => {
    const componentId = element.getAttribute("data-component-id");
    if (componentId) {
      elements.set(componentId, element);
    }
  });
  return elements;
}

function parseStyleMap(styleText: string | null): Map<string, string> {
  const styles = new Map<string, string>();
  if (!styleText) {
    return styles;
  }

  for (const declaration of styleText.split(";")) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();
    if (property && value) {
      styles.set(property, value);
    }
  }

  return styles;
}

function diffStyleProperties(original: HTMLElement | undefined, reviewed: HTMLElement): string[] {
  const originalStyles = parseStyleMap(original?.getAttribute("style") ?? null);
  const reviewedStyles = parseStyleMap(reviewed.getAttribute("style"));
  const changed = new Set<string>();

  for (const [property, value] of reviewedStyles) {
    if (originalStyles.get(property) !== value) {
      changed.add(property);
    }
  }

  for (const property of originalStyles.keys()) {
    if (!reviewedStyles.has(property)) {
      changed.add(property);
    }
  }

  return [...changed];
}

function getDirectGeneralComment(document: Document): string | null {
  const generalComment = document.querySelector<HTMLElement>(
    "#agent-review-feedback [data-review-scope='general']",
  )?.textContent;

  const normalized = generalComment?.trim();
  return normalized ? normalized : null;
}

export function summarizeReviewResult(originalHtml: string, result: ReviewResult): ReviewSummary {
  const originalDom = new JSDOM(originalHtml);
  const reviewedDom = new JSDOM(result.reviewedHtml);
  const originalElements = buildElementMap(originalDom.window.document);
  const reviewedDocument = reviewedDom.window.document;

  const componentSummaries: ComponentReviewSummary[] = [];

  reviewedDocument.querySelectorAll<HTMLElement>("[data-component-id]").forEach((reviewedElement) => {
    const componentId = reviewedElement.getAttribute("data-component-id");
    if (!componentId) {
      return;
    }

    const originalElement = originalElements.get(componentId);
    const comment = reviewedElement.getAttribute("data-review-comment")?.trim() || null;
    const changedText = (originalElement?.textContent ?? "") !== (reviewedElement.textContent ?? "");
    const changedStyles = diffStyleProperties(originalElement, reviewedElement);

    if (!comment && !changedText && changedStyles.length === 0) {
      return;
    }

    componentSummaries.push({
      componentId,
      comment,
      changedText,
      changedStyles,
    });
  });

  return {
    status: result.status,
    generalComment: getDirectGeneralComment(reviewedDocument),
    componentSummaries,
  };
}

export function formatReviewSummary(summary: ReviewSummary): string {
  const lines: string[] = [];
  lines.push(`Review status: ${summary.status}`);
  lines.push("Treat reviewedHtml as the authoritative updated prototype for the next iteration.");

  if (summary.generalComment) {
    lines.push(`General feedback: ${summary.generalComment}`);
  }

  if (summary.componentSummaries.length > 0) {
    lines.push("Component-level feedback:");
    for (const component of summary.componentSummaries.slice(0, 12)) {
      const details: string[] = [];
      if (component.comment) {
        details.push(`comment: ${component.comment}`);
      }
      if (component.changedText) {
        details.push("text changed");
      }
      if (component.changedStyles.length > 0) {
        details.push(`style changes: ${component.changedStyles.join(", ")}`);
      }
      lines.push(`- ${component.componentId}: ${details.join("; ")}`);
    }

    if (summary.componentSummaries.length > 12) {
      lines.push(`- ...and ${summary.componentSummaries.length - 12} more edited components.`);
    }
  } else {
    lines.push("No per-component comments or inline edits were detected in reviewedHtml.");
  }

  return lines.join("\n");
}