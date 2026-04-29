import { randomUUID } from "crypto";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ReviewGeneratedUiInput, ReviewResult, ReviewSession } from "../types";
import { sessionStore } from "../sessions/store";
import { prepareReviewInput } from "../html/prepareReviewInput";
import { formatReviewSummary, summarizeReviewResult } from "../html/reviewSummary";
import { reviewGeneratedUiToolDefinition } from "../toolDefinition";

export interface McpToolHandler {
  definition: Tool;
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
}

export function createReviewGeneratedUiTool(
  onNewSession: (session: ReviewSession) => void,
): McpToolHandler {
  const definition: Tool = reviewGeneratedUiToolDefinition;

  const handler = async (
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
    const input = args as unknown as ReviewGeneratedUiInput;
    const prepared = prepareReviewInput(input);
    const sessionId = randomUUID();
    const title = prepared.title ?? "Untitled Review";

    const session = sessionStore.create(
      sessionId,
      title,
      prepared.options.map(({ id, label, description, html }) => ({ id, label, description, html })),
    );
    if (prepared.instructions) session.instructions = prepared.instructions;

    // Default timeout: 10 minutes. The reviewer must submit before then.
    const TIMEOUT_MS = 10 * 60 * 1000;

    const result = await new Promise<ReviewResult>((resolve, reject) => {
      sessionStore.setReject(sessionId, reject);
      session.resolve = (r: ReviewResult) => resolve(r);
      onNewSession(session);

      setTimeout(() => {
        sessionStore.cancel(sessionId, 'Review timed out – no response within 10 minutes');
      }, TIMEOUT_MS);
    });

    const reviewSummary = summarizeReviewResult(prepared.options, result);

    return {
      content: [
        {
          type: "text",
          text: formatReviewSummary(reviewSummary),
        },
        {
          type: "text",
          text: JSON.stringify({
            status: result.status,
            selectedOptionId: result.selectedOptionId,
            reviewedHtml: result.reviewedHtml,
            reviewedOptions: result.reviewedOptions,
            reviewerNote:
              reviewSummary.optionSummaries.find((option) => option.optionId === result.selectedOptionId)?.generalComment ?? null,
            reviewSummary,
            optionSummaries: reviewSummary.optionSummaries,
          }),
        },
      ],
    };
  };

  const safeHandler = async (
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> => {
    try {
      return await handler(args);
    } catch (err) {
      return {
        content: [{ type: "text", text: `Review cancelled: ${String(err instanceof Error ? err.message : err)}` }],
        isError: true,
      };
    }
  };

  return { definition, handler: safeHandler };
}
