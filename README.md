# UI Review MCP

Human-in-the-loop UI review for agent-generated interfaces inside VS Code.

UI Review MCP adds a review checkpoint between AI-generated UI and implementation. An agent can submit a self-contained HTML document, or a self-contained TypeScript or TSX prototype that renders to HTML, and a human reviewer can inspect it in a VS Code panel, adjust safe visual properties, leave targeted comments, and approve or request changes before the agent continues.

The goal is simple: make UI generation collaborative instead of one-shot.

## Why this exists

AI can generate UI quickly, but fast does not mean reviewable. Most agent workflows still jump from prompt to code with no structured approval step for layout, copy, spacing, or visual direction.

This project adds that missing loop:

- the agent proposes a UI
- the human reviews it in-context
- the agent gets back reviewed HTML plus approval status
- implementation can continue with clearer direction

This is not a design tool or a Figma replacement. It is a lightweight approval surface for AI-generated UI work.

## What it does

- Exposes one MCP tool: `review_generated_ui`
- Accepts either:
	- self-contained HTML
	- self-contained TypeScript or TSX that resolves to final HTML
	- a structured `options` array so the reviewer can choose between multiple UI directions in one session
- Opens a VS Code review panel for the submitted UI
- Lets the reviewer:
	- switch between named options when multiple directions are provided
	- click tagged elements in the preview
	- inspect live styles
	- override text content when safe
	- adjust colors, font size, font weight, spacing, radius, and alignment
	- leave per-element comments
	- leave a general review summary
	- approve, approve with notes, or request changes
- Returns reviewed HTML, the selected option id, and review status back to the caller

## How the workflow works

1. An agent generates a UI prototype.
2. The agent calls `review_generated_ui`.
3. UI Review MCP opens a review panel in VS Code.
4. The reviewer inspects the UI, tweaks safe properties, and leaves comments.
5. The tool returns structured review feedback and the reviewed HTML.
6. The agent uses that output to revise or implement the UI.

## Tool contract

The main tool exposed by this project is:

```ts
review_generated_ui({
	html?: string,
	source?: string,
	sourceType?: "html" | "typescript" | "tsx",
	options?: Array<{
		id: string,
		label: string,
		description?: string,
		html?: string,
		source?: string,
		sourceType?: "html" | "typescript" | "tsx",
	}>,
	instructions?: string,
	title?: string,
})
```

Behavior notes:

- `html` is the simplest and preferred input.
- `source` with `sourceType` is supported for self-contained TypeScript and TSX prototypes.
- `options` is the preferred path when the agent needs the reviewer to choose between multiple UI alternatives in one pass.
- TypeScript and TSX prototypes must not import external modules.
- Returned output includes the final status, `selectedOptionId`, and reviewed HTML.

## Who this is for

- developers using GitHub Copilot or another MCP-compatible agent for UI work
- teams that want a human approval gate before agent-written frontend code lands
- people experimenting with agent workflows for website and component generation
- anyone who wants a concrete example of a VS Code-hosted MCP tool with a human-in-the-loop interaction model

## Architecture

The repo has three main parts:

- `mcp-server/`: MCP server, session flow, input preparation, sanitization, and review result formatting
- `vscode-extension/`: VS Code extension host, workspace setup command, panel wiring, and packaged standalone server
- `webview/`: React-based review UI rendered inside the VS Code webview

## Reuse in another repo

If you want to use this in another project:

1. Install the extension from a `.vsix` built from `vscode-extension/`.
2. In the target workspace, run `UI Review MCP: Configure UI Review MCP For This Workspace` from the Command Palette.
3. Reload VS Code when prompted.

That command writes a workspace-local `.vscode/mcp.json` and points it to a stable copy of the bundled standalone MCP server managed by the extension.

If you also want the agent workflow that prototypes UI before implementation, copy `.github/agents/website-creator.agent.md` into the target repository.

## Local setup

### Requirements

- Node.js 18+
- VS Code 1.85+
- GitHub Copilot or another MCP-compatible client for end-to-end usage

### Build the extension

```bash
cd vscode-extension
npm install
npm run build
npx vsce package
```

That build:

- builds `mcp-server`
- builds the React webview bundle
- builds the extension bundle
- copies the standalone MCP server into `vscode-extension/dist/mcp-server/standalone.js`

The resulting `.vsix` can then be installed into VS Code.

### Smoke test

From the repo root:

```bash
node smoke-test.mjs
```

The smoke test verifies core sanitization and build outputs. Full human review flow still requires the VS Code host.

## Review artifact expectations

Meaningful elements should include stable identifiers through either `data-component-id` or `id`.

Example:

```html
<section data-component-id="hero">
	<h1 data-component-id="hero-title">Ship faster</h1>
	<p data-component-id="hero-subtitle">Review AI-generated UI before it becomes code.</p>
	<button data-component-id="hero-cta">Try it</button>
</section>
```

If identifiers are missing, the input preparation step can inject them during sanitization, but explicit identifiers make review much more reliable.

## Current scope

This repo is an MVP with a clear opinionated workflow.

Included today:

- one review tool
- single-review session flow inside VS Code
- safe HTML sanitization and preprocessing
- focused visual edits in the review UI
- review summary plus reviewed HTML returned to the agent

Not included today:

- full design tooling
- multi-screen product review flows
- freeform CSS editing
- realtime collaboration
- automatic codebase patching from approved HTML

## Why it may be interesting publicly

Most MCP examples are tool wrappers around APIs, files, or terminals. This one is different: it shows how an MCP tool can pause for a human decision, collect structured feedback, and resume the agent flow with a better artifact.

If you are exploring agent UX, MCP tool design, or human-in-the-loop coding workflows, that is the core idea here.

## Repo status

This project is being prepared for public release. The current package metadata is still local-development oriented in places, but the core workflow is already implemented and usable.

## Related docs

- `INSTALL.md` for install and workspace setup details
- `implementation-plan.md` for the original product and architecture plan
- `SOCIAL_POSTS.md` for launch messaging you can reuse when sharing the repo