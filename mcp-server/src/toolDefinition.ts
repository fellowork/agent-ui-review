export const reviewGeneratedUiToolDefinition = {
  name: "review_generated_ui",
  description:
    "Sends one or more agent-generated UI options to a human reviewer. " +
    "Waits for the human to choose an option, approve or request changes, then returns the reviewed HTML, selected option id, and status.",
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
      options: {
        type: "array",
        minItems: 1,
        description:
          "Optional structured alternatives for the reviewer. Use this instead of repeated tool calls when the agent needs the human to choose between multiple directions.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Stable identifier for this option, returned as selectedOptionId.",
            },
            label: {
              type: "string",
              description: "Short reviewer-facing label for this option.",
            },
            description: {
              type: "string",
              description: "Optional one-line rationale or explanation for this option.",
            },
            html: {
              type: "string",
              description: "Optional self-contained HTML document for this option.",
            },
            source: {
              type: "string",
              description:
                "Optional self-contained source for this option. Use with sourceType=`typescript` or `tsx`.",
            },
            sourceType: {
              type: "string",
              enum: ["html", "typescript", "tsx"],
              description: "How to interpret this option's source.",
            },
          },
          required: ["id", "label"],
          anyOf: [{ required: ["html"] }, { required: ["source", "sourceType"] }],
        },
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
    anyOf: [
      { required: ["html"] },
      { required: ["source", "sourceType"] },
      { required: ["options"] },
    ],
  },
};