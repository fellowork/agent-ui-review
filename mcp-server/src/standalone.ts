/**
 * Standalone MCP server entry point.
 *
 * Run with:  node dist/standalone.js
 *
 * This process owns the stdio transport that MCP clients (e.g. VS Code Copilot
 * agent mode) connect to.  When review_generated_ui is called it writes a
 * pending session file to the OS temp directory and polls for the result,
 * which the VS Code extension writes back once the user submits the review.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { handleReviewRequest, ensureBridgeDirs } from "./bridge/fileBridge.js";
import type { ReviewGeneratedUiInput } from "./types.js";
import { prepareReviewInput } from "./html/prepareReviewInput.js";
import { formatReviewSummary, summarizeReviewResult } from "./html/reviewSummary.js";
import { reviewGeneratedUiToolDefinition } from "./toolDefinition.js";

ensureBridgeDirs();

const server = new Server(
  { name: "review-generated-ui", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const toolDefinition = reviewGeneratedUiToolDefinition;

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [toolDefinition],
}));

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
    const { name, arguments: args } = request.params;

    if (name !== "review_generated_ui") {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const input = (args ?? {}) as unknown as ReviewGeneratedUiInput;
      const prepared = prepareReviewInput(input);
      const result = await handleReviewRequest(prepared);
      const selectedOption = prepared.options.find((option) => option.id === result.selectedOptionId);
      const reviewSummary = summarizeReviewResult(
        selectedOption?.html ?? prepared.options[0].html,
        result,
        selectedOption?.label,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: formatReviewSummary(reviewSummary),
          },
          {
            type: "text" as const,
            text: JSON.stringify({
              status: result.status,
              selectedOptionId: result.selectedOptionId,
              reviewedHtml: result.reviewedHtml,
              reviewerNote: reviewSummary.generalComment,
              reviewSummary,
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Review cancelled: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  process.stderr.write(`Failed to start MCP server: ${err}\n`);
  process.exit(1);
});
