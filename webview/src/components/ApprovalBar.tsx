import type { ReviewStatus } from "../types";

interface ApprovalBarProps {
  selectedOptionLabel: string;
  generalComment: string;
  onGeneralCommentChange: (v: string) => void;
  onSubmit: (status: ReviewStatus) => void;
}

const BUTTONS: { label: string; status: ReviewStatus; color: string }[] = [
  { label: "Approve", status: "approved", color: "#16a34a" },
  { label: "Approve with Notes", status: "approved_with_notes", color: "#ca8a04" },
  { label: "Request Changes", status: "changes_requested", color: "#dc2626" },
];

export function ApprovalBar({
  selectedOptionLabel,
  generalComment,
  onGeneralCommentChange,
  onSubmit,
}: ApprovalBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 14,
        padding: "14px 18px",
        borderTop: "1px solid var(--chrome-border)",
        background: "rgba(10, 15, 24, 0.82)",
        backdropFilter: "blur(14px)",
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--app-muted)", fontWeight: 700, marginBottom: 8 }}>
          Review Summary
        </div>
        <div style={{ marginBottom: 8, fontSize: 12, color: "var(--app-muted)" }}>
          Selected option: <span style={{ color: "#f3f6fb", fontWeight: 700 }}>{selectedOptionLabel}</span>
        </div>
        <textarea
          value={generalComment}
          onChange={(e) => onGeneralCommentChange(e.target.value)}
          placeholder="Summarize the larger direction, blockers, or approval rationale"
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            background: "var(--field-bg)",
            border: "1px solid var(--field-border)",
            borderRadius: 14,
            color: "var(--app-text)",
            padding: "11px 12px",
            fontSize: 13,
            fontFamily: "inherit",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, alignSelf: "flex-end", flexShrink: 0 }}>
        {BUTTONS.map(({ label, status, color }) => (
          <button
            key={status}
            onClick={() => onSubmit(status)}
            style={{
              background: color,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
