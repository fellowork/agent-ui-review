import { useCallback, useEffect, useRef, useState } from "react";
import { Preview } from "./components/Preview";
import { Inspector } from "./components/Inspector";
import { ApprovalBar } from "./components/ApprovalBar";
import { postSubmit } from "./state";
import type {
  ComponentAnnotation,
  ReviewState,
  ReviewStatus,
  SelectedComponentSnapshot,
} from "./types";

export function App() {
  const session = window.__REVIEW_SESSION__;
  const layoutRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const [generalComment, setGeneralComment] = useState("");
  const [annotations, setAnnotations] = useState<Record<string, ComponentAnnotation>>({});
  const [selectedComponent, setSelectedComponent] = useState<SelectedComponentSnapshot | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [inspectorWidth, setInspectorWidth] = useState(360);
  const [isResizingInspector, setIsResizingInspector] = useState(false);

  const clampInspectorWidth = (nextWidth: number) => {
    const layoutWidth = layoutRef.current?.clientWidth ?? 0;
    const minWidth = 280;
    const maxWidth = layoutWidth > 0 ? Math.max(minWidth, Math.min(640, layoutWidth - 320)) : 640;
    return Math.max(minWidth, Math.min(maxWidth, nextWidth));
  };

  const handleSelectComponent = useCallback((selection: SelectedComponentSnapshot) => {
    setSelectedComponent(selection);
  }, []);

  const handleUpdateAnnotation = useCallback((annotation: ComponentAnnotation) => {
    setAnnotations((prev) => ({ ...prev, [annotation.componentId]: annotation }));
  }, []);

  const handleSubmit = useCallback(
    (chosenStatus: ReviewStatus) => {
      const state: ReviewState = {
        sessionId: session.sessionId,
        originalHtml: session.html,
        generalComment,
        annotations,
        status: chosenStatus,
      };
      setStatus(chosenStatus);
      postSubmit(state);
      setSubmitted(true);
    },
    [session, generalComment, annotations]
  );

  const handleInspectorResizeStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeStateRef.current = {
        startX: event.clientX,
        startWidth: inspectorWidth,
      };
      setIsResizingInspector(true);
    },
    [inspectorWidth]
  );

  useEffect(() => {
    if (!isResizingInspector) {
      return undefined;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) {
        return;
      }

      const delta = state.startX - event.clientX;
      setInspectorWidth(clampInspectorWidth(state.startWidth + delta));
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      setIsResizingInspector(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingInspector]);

  useEffect(() => {
    const handleWindowResize = () => {
      setInspectorWidth((currentWidth) => clampInspectorWidth(currentWidth));
    };

    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  if (submitted) {
    const labels: Record<ReviewStatus, string> = {
      approved: "Approved",
      approved_with_notes: "Approved with Notes",
      changes_requested: "Changes Requested",
    };
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#1e1e1e",
          color: "#d4d4d4",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 32 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Review Submitted</div>
        <div style={{ fontSize: 13, color: "#888" }}>
          Status: {status ? labels[status] : ""}
        </div>
      </div>
    );
  }

  const selectedAnnotation = selectedComponent
    ? annotations[selectedComponent.componentId]
    : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(126, 211, 196, 0.1), transparent 35%), radial-gradient(circle at top right, rgba(255, 181, 107, 0.12), transparent 30%), var(--app-bg)",
        color: "var(--app-text)",
        fontFamily: "'Segoe UI', 'Aptos', sans-serif",
        overflow: "hidden",
        userSelect: isResizingInspector ? "none" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 18px",
          borderBottom: "1px solid var(--chrome-border)",
          background: "rgba(10, 15, 24, 0.72)",
          backdropFilter: "blur(14px)",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--app-muted)", fontWeight: 700 }}>
            Review Mode
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f3f6fb" }}>
            UI Review Session {session.sessionId}
          </div>
        </div>
        <div style={{ color: "var(--app-muted)", fontSize: 13, maxWidth: 420, textAlign: "right", lineHeight: 1.45 }}>
          Click an element to inspect its live styles, adjust copy, and attach focused notes
          before approving or requesting changes.
        </div>
      </div>

      <div ref={layoutRef} style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            padding: 18,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Preview
            html={session.html}
            onSelectComponent={handleSelectComponent}
            annotations={annotations}
          />
        </div>

        <div
          role="separator"
          aria-label="Resize inspector"
          aria-orientation="vertical"
          onMouseDown={handleInspectorResizeStart}
          style={{
            width: 12,
            flexShrink: 0,
            cursor: "col-resize",
            position: "relative",
            background: isResizingInspector ? "rgba(126, 211, 196, 0.08)" : "transparent",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 18,
              bottom: 18,
              left: "50%",
              width: 2,
              transform: "translateX(-50%)",
              borderRadius: 999,
              background: isResizingInspector
                ? "rgba(126, 211, 196, 0.9)"
                : "rgba(173, 201, 230, 0.24)",
            }}
          />
        </div>

        <div
          style={{
            width: inspectorWidth,
            borderLeft: "1px solid var(--chrome-border)",
            overflowY: "auto",
            flexShrink: 0,
            minHeight: 0,
            background: "rgba(7, 10, 17, 0.72)",
            backdropFilter: "blur(18px)",
          }}
        >
          <Inspector
            selection={selectedComponent}
            annotation={selectedAnnotation}
            onUpdate={handleUpdateAnnotation}
          />
        </div>
      </div>

      <ApprovalBar
        generalComment={generalComment}
        onGeneralCommentChange={setGeneralComment}
        onSubmit={handleSubmit}
      />

      {isResizingInspector && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            cursor: "col-resize",
            zIndex: 20,
          }}
        />
      )}
    </div>
  );
}
