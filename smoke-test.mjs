/**
 * Smoke test: verifies the sanitizer module in isolation and confirms the
 * extension .vsix was produced. Full round-trip requires the VS Code host.
 *
 * Run with: node smoke-test.mjs
 */
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. Sanitizer check (no SDK dependency)
// ---------------------------------------------------------------------------
console.log("\n[1] Sanitizer");

const { sanitizeHtml, validateReviewHtml } = await import(
  pathToFileURL(join(__dirname, "mcp-server/dist/html/sanitize.js")).href
);

const clean1 = sanitizeHtml(`<h1 data-component-id="t1" onclick="alert(1)">Hello</h1><script>evil()<\/script>`);
assert("strips <script>", !clean1.includes("<script"));
assert("strips onclick handler", !clean1.includes("onclick"));
assert("keeps data-component-id", clean1.includes('data-component-id="t1"'));
assert("keeps text content", clean1.includes("Hello"));

const clean2 = sanitizeHtml(`<section><h1>Title</h1><p>Body text</p></section>`);
assert("auto-injects data-component-id on unlabelled elements", clean2.includes("data-component-id"));

const clean3 = sanitizeHtml(`<div id="hero"><button id="cta">Buy</button></div>`);
assert("preserves existing id attributes", clean3.includes('id="hero"'));
assert("does not duplicate ids as data-component-id", !clean3.includes('data-component-id="hero"'));

const clean4 = sanitizeHtml(`<!DOCTYPE html><html><head><style>body{background:#123;color:#fff}</style><link rel="stylesheet" href="https://example.com/app.css"><meta http-equiv="refresh" content="0;url=https://malicious.example"><script>evil()<\/script></head><body><main>Styled</main></body></html>`);
assert("keeps head style tags", clean4.includes("<style>body{background:#123;color:#fff}</style>"));
assert("keeps stylesheet links", clean4.includes('rel="stylesheet"'));
assert("removes meta refresh", !clean4.toLowerCase().includes('http-equiv="refresh"'));
assert("still strips scripts from styled documents", !clean4.includes("<script"));

let missingStylesRejected = false;
try {
  validateReviewHtml(`<main><section class="pricing-container"><div class="pricing-tier featured">Plan</div></section><p style="color:var(--muted)">Muted</p></main>`);
} catch (error) {
  missingStylesRejected = String(error).includes("self-contained") || String(error).includes("stylesheet");
}
assert("rejects class-based fragments without styles", missingStylesRejected);

let tailwindCdnRejected = false;
try {
  validateReviewHtml(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body><div class="mx-auto">Hello</div></body></html>`);
} catch (error) {
  tailwindCdnRejected = String(error).includes("Tailwind CDN");
}
assert("rejects Tailwind CDN prototypes", tailwindCdnRejected);

// ---------------------------------------------------------------------------
// 2. Build outputs exist
// ---------------------------------------------------------------------------
console.log("\n[2] Build outputs");

assert("mcp-server/dist/server.js exists",   existsSync(join(__dirname, "mcp-server/dist/server.js")));
assert("mcp-server/dist/types.js exists",    existsSync(join(__dirname, "mcp-server/dist/types.js")));
assert("mcp-server/dist/html/sanitize.js exists", existsSync(join(__dirname, "mcp-server/dist/html/sanitize.js")));
assert("mcp-server/dist/sessions/store.js exists", existsSync(join(__dirname, "mcp-server/dist/sessions/store.js")));
assert("vscode-extension/dist/extension.js exists", existsSync(join(__dirname, "vscode-extension/dist/extension.js")));
assert("vscode-extension/dist/webview.js exists",   existsSync(join(__dirname, "vscode-extension/dist/webview.js")));
assert("vscode-extension .vsix exists",      existsSync(join(__dirname, "vscode-extension/ui-review-mcp-0.0.1.vsix")));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
