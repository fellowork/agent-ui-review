export const reviewGeneratedUiToolDefinition = {
  name: "review_generated_ui",
  description:
    "Sends agent-generated HTML or self-contained TypeScript/TSX prototypes to a human reviewer. " +
    "Waits for the human to approve or request changes, then returns the reviewed HTML and status.",
  inputSchema: {
    type: "object" as const,
    properties: {
      html: {
        type: "string",
        description:
          "Optional self-contained HTML document to review. This remains the simplest and preferred review artifact.",
      },
      source: {
        type: "string",
        description:
          "Optional review source. Use with sourceType=`typescript` or `tsx` for self-contained prototypes that export a full HTML document string, JSX tree, or synchronous render() result.",
      },
      sourceType: {
        type: "string",
        enum: ["html", "typescript", "tsx"],
        description:
          "How to interpret source input. Defaults to `html` when only html is provided. TypeScript and TSX sources must be self-contained and cannot import other modules.",
      },
      instructions: {
        type: "string",
        description:
          "Optional instructions or context to show the reviewer alongside the UI.",
      },
      title: {
        type: "string",
        description: "Optional display title for this review session.",
      },
    },
    anyOf: [{ required: ["html"] }, { required: ["source", "sourceType"] }],
  },
};