import { useState, useCallback } from "react";
import { Preview } from "./components/Preview";
import { Inspector } from "./components/Inspector";
import { ApprovalBar } from "./components/ApprovalBar";
import { postSubmit } from "./state";
import type { ComponentAnnotation, ReviewState, ReviewStatus } from "./types";

export function App() {
  const session = window.__REVIEW_SESSION__;

  const [generalComment, setGeneralComment] = useState("");
  const [annotations, setAnnotations] = useState<Record<string, ComponentAnnotation>>({});
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<ReviewStatus | null>(null);

  const handleSelectComponent = useCallback((id: string) => {
    setSelectedComponentId(id);
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

  const selectedAnnotation = selectedComponentId
    ? annotations[selectedComponentId]
    : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#1e1e1e",
        color: "#d4d4d4",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #333",
          fontSize: 13,
          fontWeight: 600,
          color: "#9cdcfe",
          flexShrink: 0,
        }}
      >
        UI Review — Session {session.sessionId}
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Preview area */}
        <div
          style={{
            flex: 1,
            padding: 16,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Preview
            html={session.html}
            onSelectComponent={handleSelectComponent}
            annotations={annotations}
          />
        </div>

        {/* Inspector sidebar */}
        <div
          style={{
            width: 240,
            borderLeft: "1px solid #333",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <Inspector
            componentId={selectedComponentId}
            annotation={selectedAnnotation}
            onUpdate={handleUpdateAnnotation}
          />
        </div>
      </div>

      {/* Approval bar */}
      <ApprovalBar
        generalComment={generalComment}
        onGeneralCommentChange={setGeneralComment}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
