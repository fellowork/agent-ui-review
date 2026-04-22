import type * as JsdomModule from "jsdom";

const { JSDOM } = require("jsdom/lib/api.js") as typeof JsdomModule;

// dompurify is a factory function in Node.js — it must be called with a window
// object to produce a DOMPurify instance bound to that window's DOM.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const createDOMPurify = require("dompurify") as (window: unknown) => {
  sanitize(dirty: string, config?: Record<string, unknown>): string;
};

export function validateReviewHtml(html: string): void {
  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes("cdn.tailwindcss.com")) {
    throw new Error(
      "review_generated_ui cannot safely execute the Tailwind CDN script. Inline the compiled CSS in a <style> tag before submitting the prototype.",
    );
  }

  const { window } = new JSDOM(html);
  const { document } = window;
  const stylesheetCount = document.querySelectorAll("style, link[rel~='stylesheet']").length;
  const classCount = document.querySelectorAll("[class]").length;
  const inlineStyleCount = document.querySelectorAll("[style]").length;
  const usesCssVariables = html.includes("var(--");

  if (stylesheetCount === 0 && usesCssVariables) {
    throw new Error(
      "review_generated_ui received HTML that uses CSS custom properties but does not include the stylesheet that defines them. Submit the full self-contained HTML document, including its <style> block.",
    );
  }

  if (stylesheetCount === 0 && classCount >= 3 && inlineStyleCount < classCount) {
    throw new Error(
      "review_generated_ui received class-based HTML without its stylesheet. Submit the exact self-contained prototype HTML, including the <head> and inline CSS, rather than a body-only fragment.",
    );
  }
}

export function sanitizeHtml(html: string): string {
  // Step 1 — sanitize: strip scripts, dangerous tags, and all event handlers.
  const { window } = new JSDOM("<!DOCTYPE html>");
  const DOMPurify = createDOMPurify(window);

  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ["link"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "base", "form"],
    // DOMPurify strips all event-handler attributes (on*) by default.
    // FORBID_ATTR adds extra non-event attributes we also want to block.
    FORBID_ATTR: ["action", "formaction", "srcdoc"],
  });

  // Step 2 — inject stable identifiers so the review UI can anchor comments
  // to specific elements.  Elements that already carry an `id` or a
  // `data-component-id` are left untouched.
  const { window: cleanWindow } = new JSDOM(clean);
  const { document } = cleanWindow;

  // Keep only safe head nodes required to preserve page styling and metadata.
  document.head.querySelectorAll(":scope > *").forEach((el) => {
    const tagName = el.tagName.toLowerCase();
    if (tagName === "style" || tagName === "title") {
      return;
    }

    if (tagName === "link") {
      const rel = (el.getAttribute("rel") ?? "").trim().toLowerCase();
      if (rel === "stylesheet") {
        return;
      }
    }

    if (tagName === "meta") {
      const httpEquiv = (el.getAttribute("http-equiv") ?? "").trim().toLowerCase();
      if (httpEquiv !== "refresh") {
        return;
      }
    }

    el.remove();
  });

  let counter = 0;
  document.querySelectorAll("body *").forEach((el) => {
    if (!el.id && !el.getAttribute("data-component-id")) {
      el.setAttribute("data-component-id", `comp-${++counter}`);
    }
  });

  return `<!DOCTYPE html>${document.documentElement.outerHTML}`;
}
