import type * as JsdomModule from "jsdom";
import type { PreparedReviewOption, ReviewResult } from "../types.js";

const { JSDOM } = require("jsdom/lib/api.js") as typeof JsdomModule;

interface ComponentReviewSummary {
  componentId: string;
  comment: string | null;
  changedText: boolean;
  changedStyles: string[];
}

export interface OptionReviewSummary {
  optionId: string;
  optionLabel: string | null;
  generalComment: string | null;
  componentSummaries: ComponentReviewSummary[];
}

export interface ReviewSummary {
  status: ReviewResult["status"];
  selectedOptionId: string;
  selectedOptionLabel: string | null;
  optionSummaries: OptionReviewSummary[];
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

export function summarizeOptionReview(
  originalHtml: string,
  reviewedHtml: string,
  optionId: string,
  optionLabel?: string,
): OptionReviewSummary {
  const originalDom = new JSDOM(originalHtml);
  const reviewedDom = new JSDOM(reviewedHtml);
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
    optionId,
    optionLabel: optionLabel ?? null,
    generalComment: getDirectGeneralComment(reviewedDocument),
    componentSummaries,
  };
}

export function summarizeReviewResult(
  preparedOptions: PreparedReviewOption[],
  result: ReviewResult,
): ReviewSummary {
  const optionSummaries = result.reviewedOptions.map((reviewedOption) => {
    const originalOption = preparedOptions.find((option) => option.id === reviewedOption.optionId);
    return summarizeOptionReview(
      originalOption?.html ?? reviewedOption.reviewedHtml,
      reviewedOption.reviewedHtml,
      reviewedOption.optionId,
      originalOption?.label,
    );
  });

  const selectedSummary = optionSummaries.find((option) => option.optionId === result.selectedOptionId);

  return {
    status: result.status,
    selectedOptionId: result.selectedOptionId,
    selectedOptionLabel: selectedSummary?.optionLabel ?? null,
    optionSummaries,
  };
}

export function formatReviewSummary(summary: ReviewSummary): string {
  const lines: string[] = [];
  lines.push(`Review status: ${summary.status}`);
  if (summary.selectedOptionLabel) {
    lines.push(`Selected option: ${summary.selectedOptionLabel} (${summary.selectedOptionId})`);
  }
  lines.push("Treat reviewedOptions as the authoritative updated prototypes for the next iteration. reviewedHtml remains the selected option's artifact for backward compatibility.");

  if (summary.optionSummaries.length === 0) {
    lines.push("No option-level feedback was returned.");
    return lines.join("\n");
  }

  lines.push("Option feedback:");
  for (const option of summary.optionSummaries) {
    const header = option.optionLabel ? `${option.optionLabel} (${option.optionId})` : option.optionId;
    const details: string[] = [];
    if (option.generalComment) {
      details.push(`note: ${option.generalComment}`);
    }
    if (option.componentSummaries.length > 0) {
      details.push(`${option.componentSummaries.length} component edit${option.componentSummaries.length === 1 ? "" : "s"}`);
    }
    lines.push(`- ${header}: ${details.length > 0 ? details.join("; ") : "no inline edits or notes detected"}`);
  }

  return lines.join("\n");
}