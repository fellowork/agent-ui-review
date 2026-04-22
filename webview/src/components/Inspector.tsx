import type { ComponentAnnotation } from "../types";

interface InspectorProps {
  componentId: string | null;
  annotation: ComponentAnnotation | undefined;
  onUpdate: (annotation: ComponentAnnotation) => void;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#aaa",
  marginBottom: 2,
  marginTop: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#1e1e1e",
  border: "1px solid #444",
  borderRadius: 3,
  color: "#d4d4d4",
  padding: "4px 6px",
  fontSize: 13,
  boxSizing: "border-box",
};

export function Inspector({ componentId, annotation, onUpdate }: InspectorProps) {
  if (!componentId) {
    return (
      <div
        style={{
          padding: 16,
          color: "#888",
          fontSize: 13,
          fontStyle: "italic",
        }}
      >
        Select a component to inspect
      </div>
    );
  }

  const ann: ComponentAnnotation = annotation ?? {
    componentId,
    comment: "",
    styleOverrides: {},
  };

  function update(patch: Partial<ComponentAnnotation>) {
    onUpdate({ ...ann, ...patch });
  }

  function updateStyle(prop: string, value: string) {
    const styleOverrides = { ...ann.styleOverrides };
    if (value === "" || value === "0" || value === "#000000" && prop !== "color") {
      delete styleOverrides[prop];
    } else {
      styleOverrides[prop] = value;
    }
    onUpdate({ ...ann, styleOverrides });
  }

  const s = ann.styleOverrides;

  return (
    <div style={{ padding: 12, fontSize: 13, color: "#d4d4d4" }}>
      <div
        style={{
          fontWeight: 600,
          fontSize: 12,
          color: "#9cdcfe",
          marginBottom: 8,
          wordBreak: "break-all",
        }}
      >
        #{componentId}
      </div>

      <label style={labelStyle}>Comment</label>
      <textarea
        value={ann.comment}
        onChange={(e) => update({ comment: e.target.value })}
        rows={3}
        style={{ ...inputStyle, resize: "vertical" }}
        placeholder="Leave a comment…"
      />

      <label style={labelStyle}>Text Color</label>
      <input
        type="color"
        value={s["color"] ?? "#000000"}
        onChange={(e) => updateStyle("color", e.target.value)}
        style={{ ...inputStyle, padding: 2, height: 28, cursor: "pointer" }}
      />

      <label style={labelStyle}>Background Color</label>
      <input
        type="color"
        value={s["background-color"] ?? "#ffffff"}
        onChange={(e) => updateStyle("background-color", e.target.value)}
        style={{ ...inputStyle, padding: 2, height: 28, cursor: "pointer" }}
      />

      <label style={labelStyle}>Font Size (px)</label>
      <input
        type="number"
        min={1}
        max={200}
        value={s["font-size"] ? parseInt(s["font-size"]) : ""}
        onChange={(e) =>
          updateStyle("font-size", e.target.value ? `${e.target.value}px` : "")
        }
        placeholder="inherit"
        style={inputStyle}
      />

      <label style={labelStyle}>Font Weight</label>
      <select
        value={s["font-weight"] ?? ""}
        onChange={(e) => updateStyle("font-weight", e.target.value)}
        style={inputStyle}
      >
        <option value="">inherit</option>
        <option value="400">400 – Normal</option>
        <option value="500">500 – Medium</option>
        <option value="600">600 – Semi-bold</option>
        <option value="700">700 – Bold</option>
      </select>

      <label style={labelStyle}>Border Radius (px)</label>
      <input
        type="number"
        min={0}
        max={999}
        value={s["border-radius"] ? parseInt(s["border-radius"]) : ""}
        onChange={(e) =>
          updateStyle("border-radius", e.target.value ? `${e.target.value}px` : "")
        }
        placeholder="inherit"
        style={inputStyle}
      />

      <label style={labelStyle}>Text Align</label>
      <select
        value={s["text-align"] ?? ""}
        onChange={(e) => updateStyle("text-align", e.target.value)}
        style={inputStyle}
      >
        <option value="">inherit</option>
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
      </select>
    </div>
  );
}
