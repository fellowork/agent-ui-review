import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ReviewSession } from "./types";
import { createReviewGeneratedUiTool } from "./tools/reviewGeneratedUi";

/**
 * Creates and configures the MCP server with all tools registered.
 * The server is returned without a transport attached — the VS Code extension
 * is responsible for connecting a transport (e.g. InMemoryTransport) so the
 * server runs in-process rather than as a separate child process.
 */
export function createMcpServer(
  onNewSession: (session: ReviewSession) => void,
): Server {
  const server = new Server(
    { name: "review-generated-ui", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const reviewTool = createReviewGeneratedUiTool(onNewSession);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [reviewTool.definition],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
    const { name, arguments: args } = request.params;

    if (name === reviewTool.definition.name) {
      return reviewTool.handler(args ?? {});
    }

    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  });

  return server;
}
