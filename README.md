# UI Review MCP

This repo contains a VS Code-hosted review flow for agent-generated HTML. It can also accept self-contained TypeScript or TSX prototypes that resolve to HTML before review. The packaged extension now carries its own standalone MCP server so other projects do not need to copy the `mcp-server` folder into each workspace.

## Reuse in another repo

1. Install the VS Code extension from `vscode-extension/ui-review-mcp-0.0.7.vsix`.
2. In the target workspace, run the command `UI Review MCP: Configure UI Review MCP For This Workspace` from the Command Palette.
3. Reload VS Code when prompted.

That command writes `.vscode/mcp.json` for the selected workspace folder, points it at a stable copy of the bundled standalone server under the extension's global storage area, and scopes the temp-file bridge to that workspace so review panels do not appear in unrelated VS Code windows.

## Agent workflow

If you also want the same UI-generation workflow, copy `.github/agents/website-creator.agent.md` into the target repository. That agent file is what instructs the coding agent to prototype in HTML or self-contained TS/TSX that renders to HTML, then call `review_generated_ui` before implementing UI changes.

The review artifact is still HTML. When using TypeScript or TSX input, submit it through `source` and `sourceType`, and make the module self-contained: no imports, no network fetches, and export either a full HTML string, a JSX tree, or a synchronous `render()` result that produces the final HTML document.

## Local development

Run `npm run build` in `vscode-extension`. That build now does all of the following:

- builds `mcp-server`
- builds the React webview bundle
- builds the extension host bundle
- copies the standalone MCP server into `vscode-extension/dist/mcp-server/standalone.js`

The checked-in `.vscode/mcp.json` in this repo still targets the workspace-local `mcp-server/dist/standalone.js` and includes the same workspace bridge scope so local development remains straightforward.