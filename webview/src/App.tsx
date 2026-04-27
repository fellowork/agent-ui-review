import { useCallback, useEffect, useRef, useState } from "react";
import { Preview } from "./components/Preview";
import { Inspector } from "./components/Inspector";
import { ApprovalBar } from "./components/ApprovalBar";
import { postSubmit } from "./state";
import type {
  ComponentAnnotation,
  ReviewOption,
  ReviewState,
  ReviewStatus,
  SelectedComponentSnapshot,
} from "./types";

export function App() {
  const session = window.__REVIEW_SESSION__;
  const fallbackOption = session.options[0] ?? null;
  const layoutRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const [generalComment, setGeneralComment] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    session.selectedOptionId ?? fallbackOption?.id ?? null,
  );
  const [annotationsByOption, setAnnotationsByOption] = useState<
    Record<string, Record<string, ComponentAnnotation>>
  >({});
  const [selectedComponent, setSelectedComponent] = useState<SelectedComponentSnapshot | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [inspectorWidth, setInspectorWidth] = useState(360);
  const [isResizingInspector, setIsResizingInspector] = useState(false);

  const selectedOption =
    session.options.find((option) => option.id === selectedOptionId) ?? fallbackOption;
  const selectedAnnotations = selectedOption
    ? annotationsByOption[selectedOption.id] ?? {}
    : {};

  const clampInspectorWidth = (nextWidth: number) => {
    const layoutWidth = layoutRef.current?.clientWidth ?? 0;
    const minWidth = 280;
    const maxWidth = layoutWidth > 0 ? Math.max(minWidth, Math.min(640, layoutWidth - 320)) : 640;
    return Math.max(minWidth, Math.min(maxWidth, nextWidth));
  };

  const handleSelectComponent = useCallback((selection: SelectedComponentSnapshot) => {
    setSelectedComponent(selection);
  }, []);

  const handleSelectOption = useCallback((optionId: string) => {
    setSelectedOptionId(optionId);
    setSelectedComponent(null);
  }, []);

  const handleUpdateAnnotation = useCallback((annotation: ComponentAnnotation) => {
    if (!selectedOptionId) {
      return;
    }

    setAnnotationsByOption((prev) => ({
      ...prev,
      [selectedOptionId]: {
        ...(prev[selectedOptionId] ?? {}),
        [annotation.componentId]: annotation,
      },
    }));
  }, [selectedOptionId]);

  const handleSubmit = useCallback(
    (chosenStatus: ReviewStatus) => {
      if (!selectedOption) {
        return;
      }

      const state: ReviewState = {
        sessionId: session.sessionId,
        selectedOptionId: selectedOption.id,
        originalHtml: selectedOption.html,
        generalComment,
        annotations: selectedAnnotations,
        status: chosenStatus,
      };
      setStatus(chosenStatus);
      postSubmit(state);
      setSubmitted(true);
    },
    [session, generalComment, selectedAnnotations, selectedOption]
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

  useEffect(() => {
    if (!selectedOption && fallbackOption) {
      setSelectedOptionId(fallbackOption.id);
    }
  }, [fallbackOption, selectedOption]);

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

  if (!selectedOption) {
    return null;
  }

  const selectedAnnotation = selectedComponent
    ? selectedAnnotations[selectedComponent.componentId]
    : undefined;

  const selectedAnnotationCount = Object.keys(selectedAnnotations).length;
  const totalAnnotationCount = Object.values(annotationsByOption).reduce(
    (count, optionAnnotations) => count + Object.keys(optionAnnotations).length,
    0,
  );

  const optionInstructions = session.instructions.trim();

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
            {session.title || `UI Review Session ${session.sessionId}`}
          </div>
        </div>
        <div style={{ color: "var(--app-muted)", fontSize: 13, maxWidth: 420, textAlign: "right", lineHeight: 1.45 }}>
          {optionInstructions ||
            "Click an element to inspect its live styles, adjust copy, and attach focused notes before approving or requesting changes."}
        </div>
      </div>

      {session.options.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "14px 18px 0",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          {session.options.map((option) => {
            const isSelected = option.id === selectedOption.id;
            const annotationCount = Object.keys(annotationsByOption[option.id] ?? {}).length;

            return (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                style={{
                  minWidth: 220,
                  maxWidth: 320,
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 18,
                  border: isSelected
                    ? "1px solid rgba(126, 211, 196, 0.58)"
                    : "1px solid var(--chrome-border)",
                  background: isSelected
                    ? "linear-gradient(180deg, rgba(126, 211, 196, 0.16), rgba(126, 211, 196, 0.06))"
                    : "rgba(255, 255, 255, 0.03)",
                  color: "var(--app-text)",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 16px 40px rgba(0, 0, 0, 0.2)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f3f6fb" }}>{option.label}</div>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: isSelected ? "rgba(126, 211, 196, 0.18)" : "rgba(173, 201, 230, 0.1)",
                      color: isSelected ? "#d9fff5" : "var(--app-muted)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {isSelected ? "Active" : option.id}
                  </div>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--app-muted)" }}>
                  {option.description || "No rationale provided for this option."}
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: isSelected ? "#b9f4e7" : "var(--app-muted)" }}>
                  {annotationCount} annotation{annotationCount !== 1 ? "s" : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}

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
            html={selectedOption.html}
            onSelectComponent={handleSelectComponent}
            annotations={selectedAnnotations}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 12,
              padding: "0 4px",
              color: "var(--app-muted)",
              fontSize: 12,
            }}
          >
            <div>
              Reviewing <span style={{ color: "#f3f6fb", fontWeight: 700 }}>{selectedOption.label}</span>
            </div>
            <div>
              {selectedAnnotationCount} annotation{selectedAnnotationCount !== 1 ? "s" : ""} on this option
              {session.options.length > 1 ? `, ${totalAnnotationCount} total` : ""}
            </div>
          </div>
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
        selectedOptionLabel={selectedOption.label}
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
