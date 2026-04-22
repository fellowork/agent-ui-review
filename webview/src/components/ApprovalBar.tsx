import type { ReviewStatus } from "../types";

interface ApprovalBarProps {
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
  generalComment,
  onGeneralCommentChange,
  onSubmit,
}: ApprovalBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 16px",
        borderTop: "1px solid #333",
        background: "#1e1e1e",
        flexShrink: 0,
      }}
    >
      <textarea
        value={generalComment}
        onChange={(e) => onGeneralCommentChange(e.target.value)}
        placeholder="General comment (optional)…"
        rows={2}
        style={{
          flex: 1,
          resize: "vertical",
          background: "#252526",
          border: "1px solid #444",
          borderRadius: 3,
          color: "#d4d4d4",
          padding: "6px 8px",
          fontSize: 13,
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        {BUTTONS.map(({ label, status, color }) => (
          <button
            key={status}
            onClick={() => onSubmit(status)}
            style={{
              background: color,
              color: "#fff",
              border: "none",
              borderRadius: 3,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
