import type { ComponentAnnotation, SelectedComponentSnapshot } from "../types";

interface InspectorProps {
  selection: SelectedComponentSnapshot | null;
  annotation: ComponentAnnotation | undefined;
  onUpdate: (annotation: ComponentAnnotation) => void;
}

const panelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 18,
  fontSize: 13,
  color: "var(--panel-text)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%), var(--panel-bg)",
  minHeight: "100%",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid var(--panel-border)",
  borderRadius: 16,
  padding: 14,
  background: "var(--panel-elevated)",
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--panel-muted)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--field-bg)",
  border: "1px solid var(--field-border)",
  borderRadius: 12,
  color: "var(--panel-text)",
  padding: "9px 11px",
  fontSize: 13,
  boxSizing: "border-box",
};

const helpTextStyle: React.CSSProperties = {
  marginTop: 6,
  color: "var(--panel-muted)",
  fontSize: 12,
  lineHeight: 1.45,
};

function normalizeColor(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "transparent") {
    return "transparent";
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    if (hexMatch[1].length === 3) {
      return `#${hexMatch[1]
        .split("")
        .map((char) => `${char}${char}`)
        .join("")}`;
    }
    return normalized;
  }

  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (!rgbMatch) {
    return normalized;
  }

  const parts = rgbMatch[1].split(",").map((part) => part.trim());
  if (parts.length < 3) {
    return normalized;
  }

  const alpha = parts[3] ? Number.parseFloat(parts[3]) : 1;
  if (!Number.isNaN(alpha) && alpha === 0) {
    return "transparent";
  }

  const [red, green, blue] = parts.slice(0, 3).map((part) => {
    const parsed = Number.parseInt(part, 10);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(255, parsed));
  });

  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function formatCssValue(value: string): string {
  return value && value.trim() ? value : "inherit";
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const normalized = normalizeColor(value);
  const pickerValue = normalized === "transparent" ? "#ffffff" : normalized;

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "42px 1fr",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...inputStyle,
            padding: 3,
            height: 40,
            cursor: "pointer",
          }}
        />
        <div
          style={{
            ...inputStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span>{normalized}</span>
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              border: "1px solid var(--field-border)",
              background:
                normalized === "transparent"
                  ? "linear-gradient(135deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.12) 75%, transparent 75%, transparent)"
                  : normalized,
              backgroundSize: "8px 8px",
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function Inspector({ selection, annotation, onUpdate }: InspectorProps) {
  if (!selection) {
    return (
      <div
        style={{
          ...panelStyle,
          justifyContent: "center",
          color: "var(--panel-muted)",
          fontSize: 13,
        }}
      >
        <div style={sectionStyle}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#f3f6fb" }}>
            Select an element
          </div>
          <div style={{ lineHeight: 1.5 }}>
            Click any tagged layer in the preview to inspect its live styles, tweak its text,
            and leave targeted feedback.
          </div>
        </div>
      </div>
    );
  }

  const { componentId } = selection;

  const ann: ComponentAnnotation = annotation ?? {
    componentId,
    comment: "",
    textOverride: undefined,
    styleOverrides: {},
  };

  function update(patch: Partial<ComponentAnnotation>) {
    onUpdate({ ...ann, ...patch });
  }

  function updateStyle(prop: string, value: string) {
    const styleOverrides = { ...ann.styleOverrides };
    if (value === "") {
      delete styleOverrides[prop];
    } else {
      styleOverrides[prop] = value;
    }
    onUpdate({ ...ann, styleOverrides });
  }

  const s = ann.styleOverrides;
  const resolvedText = ann.textOverride ?? selection.textContent;
  const styleValues = {
    color: s["color"] ?? selection.styles.color,
    backgroundColor: s["background-color"] ?? selection.styles.backgroundColor,
    fontSize: s["font-size"] ?? selection.styles.fontSize,
    fontWeight: s["font-weight"] ?? selection.styles.fontWeight,
    borderRadius: s["border-radius"] ?? selection.styles.borderRadius,
    textAlign: s["text-align"] ?? selection.styles.textAlign,
  };

  return (
    <div style={panelStyle}>
      <div style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f3f6fb" }}>
              {selection.tagName}
            </div>
            <div style={{ marginTop: 4, color: "var(--panel-muted)", lineHeight: 1.4 }}>
              Inspecting live styles from the preview selection.
            </div>
          </div>
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(126, 211, 196, 0.12)",
              border: "1px solid rgba(126, 211, 196, 0.2)",
              color: "#b9f4e7",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            #{componentId}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <div style={{ ...inputStyle, background: "rgba(255,255,255,0.03)" }}>
            <div style={labelStyle}>Current Color</div>
            <div>{normalizeColor(styleValues.color)}</div>
          </div>
          <div style={{ ...inputStyle, background: "rgba(255,255,255,0.03)" }}>
            <div style={labelStyle}>Background</div>
            <div>{normalizeColor(styleValues.backgroundColor)}</div>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Text Content</label>
        <textarea
          value={resolvedText}
          onChange={(e) => update({ textOverride: e.target.value })}
          rows={4}
          disabled={!selection.isTextEditable}
          style={{
            ...inputStyle,
            resize: "vertical",
            opacity: selection.isTextEditable ? 1 : 0.6,
          }}
          placeholder="Selected text will appear here"
        />
        <div style={helpTextStyle}>
          {selection.isTextEditable
            ? "Edits here will replace the selected element text in the submitted HTML."
            : "This element contains nested children, so freeform text editing is disabled to avoid flattening its structure."}
        </div>

        <label style={{ ...labelStyle, marginTop: 14 }}>Comment</label>
        <textarea
          value={ann.comment}
          onChange={(e) => update({ comment: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Leave targeted feedback for this element"
        />
      </div>

      <div style={sectionStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#f3f6fb" }}>
          Style Overrides
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <ColorField
            label="Text Color"
            value={styleValues.color}
            onChange={(next) => updateStyle("color", next)}
          />

          <ColorField
            label="Background Color"
            value={styleValues.backgroundColor}
            onChange={(next) => updateStyle("background-color", next)}
          />

          <div>
            <label style={labelStyle}>Font Size</label>
            <input
              type="number"
              min={1}
              max={200}
              value={parseInt(styleValues.fontSize, 10) || ""}
              onChange={(e) =>
                updateStyle("font-size", e.target.value ? `${e.target.value}px` : "")
              }
              placeholder="inherit"
              style={inputStyle}
            />
            <div style={helpTextStyle}>Current: {formatCssValue(styleValues.fontSize)}</div>
          </div>

          <div>
            <label style={labelStyle}>Font Weight</label>
            <select
              value={s["font-weight"] ?? ""}
              onChange={(e) => updateStyle("font-weight", e.target.value)}
              style={inputStyle}
            >
              <option value="">Keep current ({formatCssValue(selection.styles.fontWeight)})</option>
              <option value="400">400 - Normal</option>
              <option value="500">500 - Medium</option>
              <option value="600">600 - Semi-bold</option>
              <option value="700">700 - Bold</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Border Radius</label>
            <input
              type="number"
              min={0}
              max={999}
              value={parseInt(styleValues.borderRadius, 10) || ""}
              onChange={(e) =>
                updateStyle("border-radius", e.target.value ? `${e.target.value}px` : "")
              }
              placeholder="inherit"
              style={inputStyle}
            />
            <div style={helpTextStyle}>Current: {formatCssValue(styleValues.borderRadius)}</div>
          </div>

          <div>
            <label style={labelStyle}>Text Align</label>
            <select
              value={s["text-align"] ?? ""}
              onChange={(e) => updateStyle("text-align", e.target.value)}
              style={inputStyle}
            >
              <option value="">Keep current ({formatCssValue(selection.styles.textAlign)})</option>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
