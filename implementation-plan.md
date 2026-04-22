# HTML UI Review MCP: Implementation Plan

## Goal

Build a human-in-the-loop review tool for agent-generated UI.

The agent sends HTML to a single MCP tool. The user sees that HTML in a small review UI, can comment on components or make limited visual edits, and then sends approval or feedback back to the agent through the same logical tool flow.

This is not a design tool and not a Figma replacement. It is a review surface for refining AI-generated UI so it matches the developer's intent before the agent continues.

## Product Decision

The MVP will use:

- One logical MCP tool for the agent: `review_generated_ui`
- HTML as the review artifact
- A host-side review UI, implemented as a VS Code webview panel or popup
- Reviewed HTML returned back to the agent, with embedded comments and approval status

## Core Assumptions

- The initial host environment is VS Code.
- The agent can generate HTML and CSS.
- The host can open a webview or popup for human review.
- The returned artifact should remain HTML, not JSON.
- Per-component feedback must be anchored to stable HTML elements.

## MVP Scope

### In scope

- Render agent-provided HTML safely in a review UI
- Let the user click elements to inspect and annotate them
- Let the user add general comments
- Let the user make limited visual edits:
  - text content
  - text color
  - background color
  - font size
  - font weight
  - spacing
  - border radius
  - alignment
- Let the user approve or request changes
- Return the updated HTML to the agent, including annotations

### Out of scope

- Freeform design canvas
- Multi-screen flows
- Full CSS editor
- Real-time collaborative review
- Pixel-perfect design tooling
- Automatic codebase patching in the first release

## Why One Tool Is Enough

The agent should see one tool only:

- `review_generated_ui(html, instructions?) -> approval status + reviewed html`

Internally, the host may need session management or async state to handle the human review step, but that should remain an implementation detail. The agent contract stays simple.

## Proposed User Flow

1. The agent generates HTML for a UI proposal.
2. The agent calls `review_generated_ui` with that HTML and optional review instructions.
3. The host opens a review panel and renders the HTML in a sandboxed surface.
4. The user clicks components, adds comments, and optionally changes safe visual properties.
5. The user submits one of:
   - approve
   - approve with notes
   - request changes
6. The tool returns reviewed HTML back to the agent.
7. The agent uses that HTML and the embedded comments to refine its next step.

## HTML Contract

The tool should require stable element identifiers. The minimum contract is that meaningful elements include one of:

- `data-component-id`
- `id`

Preferred convention:

```html
<section data-component-id="hero">
  <h1 data-component-id="hero-title">Ship faster</h1>
  <p data-component-id="hero-subtitle">A better workflow for modern teams.</p>
  <button data-component-id="hero-cta">Start free</button>
</section>
```

If the incoming HTML does not include stable identifiers, the host may auto-inject them during preprocessing, but the first version should strongly prefer that the agent provides them.

## Feedback Encoding Strategy

The returned artifact remains HTML. Feedback is embedded in the HTML itself.

### General feedback

Store global comments and status in a hidden review block:

```html
<body data-review-status="changes_requested">
  <aside id="agent-review-feedback" hidden>
    <p data-review-scope="general">Reduce visual density in the hero.</p>
  </aside>
</body>
```

### Per-component feedback

Store comments on the reviewed element using `data-review-comment` and apply the edited styles inline or through a generated review stylesheet.

```html
<h1
  data-component-id="hero-title"
  data-review-comment="Reduce font size and use a lighter weight"
  style="font-size: 48px; font-weight: 600;"
>
  Ship faster
</h1>
```

### Recommendation

Use both:

- inline style updates for user-edited properties
- `data-review-comment` for component-level notes
- hidden block for general comments and approval status

This keeps the output inspectable and easy for the agent to parse without introducing a separate schema.

## High-Level Architecture

### 1. MCP Server

Responsibilities:

- expose the `review_generated_ui` tool
- validate and preprocess incoming HTML
- create and track review sessions
- block or await review completion
- return reviewed HTML and final status

### 2. VS Code Extension

Responsibilities:

- receive review session events from the MCP server or shared local state
- open a webview panel for the review experience
- render the HTML preview safely
- capture user comments, selections, and property edits
- submit final reviewed HTML back to the session store

### 3. Review Webview UI

Responsibilities:

- display rendered HTML in an isolated frame
- show selectable overlay on hover and click
- open an inspector panel for editable properties
- support comment pins or element-attached comments
- show approval actions

### 4. Session Store

Responsibilities:

- persist pending reviews and completed reviews
- store:
  - original HTML
  - reviewed HTML
  - review status
  - timestamps
  - session id

For MVP, this can be a local file-based store or in-memory process store.

## Single Tool Contract

The external contract should remain small.

### Tool name

`review_generated_ui`

### Suggested input

```ts
type ReviewGeneratedUiInput = {
  html: string;
  instructions?: string;
  title?: string;
};
```

### Suggested output

```ts
type ReviewGeneratedUiOutput = {
  status: "approved" | "approved_with_notes" | "changes_requested";
  reviewedHtml: string;
};
```

### Notes

- Keep the public contract minimal.
- If internal implementation needs `sessionId`, use it privately.
- Only expose session metadata to the agent if the MCP runtime requires async polling.

## Security Model

This part matters because the agent is sending HTML.

### Rules

- Render in a sandboxed iframe or restricted webview
- Strip or block script execution
- Strip dangerous event handlers such as `onclick`
- Block external network requests by default in the review surface
- Allow only safe HTML and CSS for MVP

### Recommendation

Sanitize the incoming HTML before rendering, then keep a reviewed internal copy that the editor modifies.

## Implementation Phases

## Phase 0: Technical Spike

Objective: prove the end-to-end flow with minimum engineering investment.

Tasks:

- Create a minimal MCP server stub with `review_generated_ui`
- Create a minimal VS Code extension command that opens a webview
- Pass sample HTML into the webview and render it safely
- Return a hard-coded approval response back to the MCP caller

Exit criteria:

- One sample HTML input can round-trip through the system

## Phase 1: Session Plumbing

Objective: connect the MCP tool to a real human review session.

Tasks:

- Add session creation and state tracking inside the MCP server
- Add extension-side session listener or polling bridge
- Open a review panel when a new session is created
- Add submit action to mark session complete
- Return completion result to the tool caller

Exit criteria:

- A real user can approve or reject a review and unblock the tool response

## Phase 2: Safe HTML Rendering

Objective: render agent HTML in a way that is usable and safe.

Tasks:

- Sanitize incoming HTML
- Render preview in a sandboxed frame
- Inject selection overlays without mutating the visible layout excessively
- Detect selectable components using `data-component-id` or `id`
- Add fallback warning when identifiers are missing

Exit criteria:

- The user can reliably select meaningful elements in the preview

## Phase 3: Annotation and Editing UX

Objective: collect useful human feedback with minimal UI complexity.

Tasks:

- Add general comment box
- Add per-component comment box
- Add side inspector for limited property edits
- Support text edits for text-bearing elements
- Apply style changes to the live preview
- Track changed elements visually

Exit criteria:

- The user can review a screen without leaving the webview

## Phase 4: HTML Output Generation

Objective: generate a clean reviewed HTML artifact for the agent.

Tasks:

- Apply user edits to the HTML DOM representation
- Write component comments as `data-review-comment`
- Write global status to `data-review-status`
- Add hidden general feedback block
- Serialize the updated DOM back to HTML

Exit criteria:

- The output contains both the visual edits and the human feedback in HTML form

## Phase 5: Reliability and Usability

Objective: make the tool practical for real iteration.

Tasks:

- Add unsaved changes warning
- Add session timeout and cancellation behavior
- Add basic version history for each review session
- Improve selection fidelity for nested elements
- Add better empty-state and error messages

Exit criteria:

- The tool is stable enough for daily use in agent-assisted UI work

## Suggested Repository Structure

```text
/mcp-server
  /src
    server.ts
    tools/reviewGeneratedUi.ts
    sessions/store.ts
    sessions/types.ts
    html/sanitize.ts
    html/serialize.ts

/vscode-extension
  /src
    extension.ts
    reviewPanel.ts
    sessionBridge.ts

/webview
  /src
    app.ts
    preview.ts
    inspector.ts
    comments.ts
    state.ts
```

## Recommended Tech Choices

### MCP server

- TypeScript
- official MCP SDK for the target runtime
- simple in-memory session store first, then file-backed persistence if needed

### VS Code extension

- TypeScript
- Webview panel API

### Webview UI

- Plain TypeScript or a small React app
- Keep dependencies light in the first release

## Engineering Decisions To Lock Early

These should be decided before implementation starts:

1. Will the MCP host allow the tool call to wait for a human response?
2. If not, do we expose the same logical tool with internal async handling, or split the transport while keeping the agent abstraction unchanged?
3. Will user edits be written as inline styles only, or can the output also include a generated `<style>` block?
4. How strict should sanitization be for agent-supplied HTML?
5. Is the first release VS Code only, or should the review UI be host-agnostic?

## Key Risks And Mitigations

### Risk: HTML without stable identifiers

Impact:

- comments cannot be attached reliably

Mitigation:

- require `data-component-id` in the agent prompt contract
- add fallback auto-generated ids during preprocessing

### Risk: unsafe HTML execution

Impact:

- security issues in the host environment

Mitigation:

- sanitize HTML aggressively
- disable scripts and external requests
- render in a sandboxed surface

### Risk: user edits become too broad

Impact:

- review UI turns into a weak design editor

Mitigation:

- keep property editing intentionally narrow in the MVP
- optimize for feedback, not creation

### Risk: output HTML becomes noisy

Impact:

- harder for the agent to reason over the returned result

Mitigation:

- keep annotation conventions small and predictable
- avoid serializing large editor-specific metadata

## Acceptance Criteria For MVP

The MVP is complete when all of the following are true:

1. An agent can call one tool with HTML input.
2. The user sees the rendered HTML in a review panel.
3. The user can select components and leave comments.
4. The user can make a limited set of visual edits.
5. The user can approve or request changes.
6. The tool returns reviewed HTML with embedded approval state and comments.
7. Unsafe scripts are not executed.

## Recommended Delivery Sequence

1. Build the round-trip spike first.
2. Prove the human review handoff inside VS Code.
3. Add element selection and comments.
4. Add limited property editing.
5. Finalize the HTML feedback format.
6. Harden security and session reliability.

## What To Defer Until After MVP

- multiple screens per session
- threaded comments
- side-by-side diff view
- component lock/unlock states
- design token integration
- export back into framework-specific source code
- review analytics and design preference memory

## First Build Target

Target the first usable release around this exact experience:

1. The agent generates one HTML screen.
2. The tool opens a VS Code review panel.
3. The user clicks the title, button, or card and leaves comments.
4. The user changes a few visual properties.
5. The user presses `Approve` or `Request changes`.
6. The tool returns the updated HTML to the agent.

If that experience works cleanly, the product direction is validated.