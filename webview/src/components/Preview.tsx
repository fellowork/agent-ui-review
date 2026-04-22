import { useEffect, useRef, useState } from "react";
import type { ComponentAnnotation, SelectedComponentSnapshot } from "../types";

interface PreviewProps {
  html: string;
  onSelectComponent: (selection: SelectedComponentSnapshot) => void;
  annotations: Record<string, ComponentAnnotation>;
}

const HIGHLIGHT_STYLE = `
  [data-component-id] {
    cursor: pointer !important;
    outline: 2px solid transparent;
    outline-offset: 2px;
    transition: outline-color 0.12s;
  }
  [data-component-id]:hover {
    outline-color: rgba(100, 160, 255, 0.7);
  }
  [data-review-selected] {
    outline-color: rgba(100, 160, 255, 1) !important;
  }
  [data-review-comment] {
    outline-color: #3b82f6 !important;
  }
`;

function makeBlobUrl(html: string): string {
  const blob = new Blob([html], { type: "text/html" });
  return URL.createObjectURL(blob);
}

function captureSelection(el: HTMLElement): SelectedComponentSnapshot {
  const computed = el.ownerDocument.defaultView?.getComputedStyle(el) ?? window.getComputedStyle(el);
  const directText = Array.from(el.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    componentId: el.getAttribute("data-component-id") ?? "",
    tagName: el.tagName.toLowerCase(),
    textContent: directText || el.textContent?.replace(/\s+/g, " ").trim() || "",
    isTextEditable: el.children.length === 0,
    styles: {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      borderRadius: computed.borderRadius,
      textAlign: computed.textAlign,
    },
  };
}

/** Apply (or re-apply) style overrides from annotations directly into the iframe DOM. */
function applyAnnotations(
  doc: Document,
  annotations: Record<string, ComponentAnnotation>,
  originalStyles: Map<string, string>,
  originalTexts: Map<string, string>,
  selectedId: string | null
) {
  doc.querySelectorAll<HTMLElement>("[data-component-id]").forEach((el) => {
    const id = el.getAttribute("data-component-id")!;

    // Restore the element's original inline style, then layer overrides on top.
    el.setAttribute("style", originalStyles.get(id) ?? "");
    const ann = annotations[id];
    if (ann?.styleOverrides) {
      for (const [prop, value] of Object.entries(ann.styleOverrides)) {
        el.style.setProperty(prop, value);
      }
    }

    if (originalTexts.has(id)) {
      el.textContent = ann?.textOverride ?? originalTexts.get(id) ?? "";
    }

    // Visual markers
    if (ann?.comment) {
      el.setAttribute("data-review-comment", "1");
    } else {
      el.removeAttribute("data-review-comment");
    }
    if (id === selectedId) {
      el.setAttribute("data-review-selected", "1");
    } else {
      el.removeAttribute("data-review-selected");
    }
  });
}

export function Preview({ html, onSelectComponent, annotations }: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl, setBlobUrl] = useState<string>(() => makeBlobUrl(html));
  const prevUrlRef = useRef<string>(blobUrl);
  const onSelectRef = useRef(onSelectComponent);
  onSelectRef.current = onSelectComponent;

  // contentDocument ref so style updates don't require an iframe reload.
  const contentDocRef = useRef<Document | null>(null);
  // Per-element original inline styles, captured on load.
  const originalStylesRef = useRef<Map<string, string>>(new Map());
  // Original leaf-node text so text overrides can be applied and restored live.
  const originalTextsRef = useRef<Map<string, string>>(new Map());
  // Track selected id so applyAnnotations can highlight it.
  const selectedIdRef = useRef<string | null>(null);
  // Keep annotations accessible inside imperative callbacks.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const annotationCount = Object.keys(annotations).length;

  // Rebuild blob URL whenever HTML changes; revoke old one.
  useEffect(() => {
    const url = makeBlobUrl(html);
    URL.revokeObjectURL(prevUrlRef.current);
    prevUrlRef.current = url;
    setBlobUrl(url);
  }, [html]);

  // Revoke on unmount.
  useEffect(() => () => URL.revokeObjectURL(prevUrlRef.current), []);

  // After each load: inject styles, snapshot original inline styles, attach click listener.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function onLoad() {
      const doc = iframe?.contentDocument;
      if (!doc) return;
      contentDocRef.current = doc;

      // Snapshot original inline styles before we touch anything.
      const origMap = new Map<string, string>();
      const origTextMap = new Map<string, string>();
      doc.querySelectorAll<HTMLElement>("[data-component-id]").forEach((el) => {
        const id = el.getAttribute("data-component-id")!;
        origMap.set(id, el.getAttribute("style") ?? "");
        if (el.children.length === 0) {
          origTextMap.set(id, el.textContent ?? "");
        }
      });
      originalStylesRef.current = origMap;
      originalTextsRef.current = origTextMap;

      // Inject highlight stylesheet.
      if (!doc.getElementById("__review-styles__")) {
        const style = doc.createElement("style");
        style.id = "__review-styles__";
        style.textContent = HIGHLIGHT_STYLE;
        (doc.head ?? doc.documentElement).appendChild(style);
      }

      // Use CAPTURE phase so our handler fires before any element-level handlers
      // (e.g. buttons, links, form submissions). stopPropagation prevents the
      // element's own handler from running afterwards.
      function handleClick(e: Event) {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const el = target.closest<HTMLElement>("[data-component-id]");
        if (el) {
          e.preventDefault();
          e.stopPropagation();
          const id = el.getAttribute("data-component-id");
          if (id) {
            selectedIdRef.current = id;
            applyAnnotations(
              doc,
              annotationsRef.current,
              originalStylesRef.current,
              originalTextsRef.current,
              id
            );
            onSelectRef.current(captureSelection(el));
          }
        }
      }

      doc.addEventListener("click", handleClick, true /* capture */);

      // Apply any annotations that already exist (e.g. after html rebuild).
      applyAnnotations(doc, annotationsRef.current, origMap, origTextMap, selectedIdRef.current);
    }

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [blobUrl]);

  // Whenever annotations change, push style overrides into the live iframe DOM.
  useEffect(() => {
    const doc = contentDocRef.current;
    if (!doc) return;
    applyAnnotations(
      doc,
      annotations,
      originalStylesRef.current,
      originalTextsRef.current,
      selectedIdRef.current
    );
  }, [annotations]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        borderRadius: 20,
        padding: 12,
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid var(--chrome-border)",
        boxShadow: "0 22px 60px rgba(0, 0, 0, 0.18)",
      }}
    >
      {annotationCount > 0 && (
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            zIndex: 10,
            background: "rgba(126, 211, 196, 0.14)",
            color: "#d9fff5",
            border: "1px solid rgba(126, 211, 196, 0.22)",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          {annotationCount} annotation{annotationCount !== 1 ? "s" : ""}
        </div>
      )}
      <iframe
        ref={iframeRef}
        key={blobUrl}
        src={blobUrl}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          border: "1px solid rgba(173, 201, 230, 0.18)",
          borderRadius: 14,
          background: "#fff",
          display: "block",
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.16)",
        }}
        title="UI Preview"
      />
    </div>
  );
}
