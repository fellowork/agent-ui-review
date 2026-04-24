# UI Review MCP — Getting Started

## What is this?

A VS Code extension that adds a **human-in-the-loop review step** to AI-generated UI. When the agent proposes a UI change, it pauses and opens a review panel inside VS Code. You can inspect each element, leave comments, make small visual tweaks (colors, spacing, text, etc.), then either approve or ask the agent to revise. The agent only continues once you sign off.

---

## Installing the extension

You will need a `.vsix` file. Ask the person who shared this with you for the latest one, or build it yourself (see below).

**Install from the `.vsix`:**

1. Open VS Code.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **Extensions: Install from VSIX…**
4. Select the `.vsix` file.
5. Reload VS Code when prompted.

**Build the `.vsix` yourself** (requires Node.js 18+):

```bash
# from the repo root
cd vscode-extension
npm install
npm run build
npx vsce package
```

This produces `ui-review-mcp-x.x.x.vsix` in the `vscode-extension` folder.

---

## Setting up a workspace

Do this once per project where you want UI review enabled.

1. Open your project in VS Code.
2. Open the Command Palette and run:
   **UI Review MCP: Configure UI Review MCP For This Workspace**
3. Reload VS Code when prompted.

This writes a `.vscode/mcp.json` file that tells GitHub Copilot (or any MCP-compatible agent) how to reach the review server. No separate server process to start — the extension manages it.

---

## Using it with the agent

Once the workspace is configured, the agent has access to a tool called `review_generated_ui`. The recommended workflow is:

1. Ask the agent to design or update a UI component.
2. The agent generates an HTML prototype and calls `review_generated_ui`.
3. A review panel opens in VS Code showing the rendered prototype.
4. Click any element to inspect it and leave a comment or adjust its style.
5. Add general notes in the comment box if needed.
6. Click **Approve** (or **Approve with notes** / **Request changes**).
7. The agent receives your feedback and continues.

To get the full agent workflow (where the agent automatically prototypes before implementing), copy `.github/agents/website-creator.agent.md` from this repo into your project.

---

## Requirements

- VS Code 1.85 or later
- GitHub Copilot (or another MCP-compatible agent) enabled in the workspace
