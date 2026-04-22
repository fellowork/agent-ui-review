import { createRoot } from "react-dom/client";
import { App } from "./App";

const style = document.createElement("style");
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --app-bg: #08111c;
    --app-text: #dbe6f2;
    --app-muted: #8fa5bd;
    --chrome-border: rgba(173, 201, 230, 0.14);
    --panel-bg: rgba(9, 14, 22, 0.72);
    --panel-elevated: rgba(255, 255, 255, 0.03);
    --panel-border: rgba(173, 201, 230, 0.14);
    --panel-text: #dbe6f2;
    --panel-muted: #90a4ba;
    --field-bg: rgba(255, 255, 255, 0.04);
    --field-border: rgba(173, 201, 230, 0.16);
  }
  html, body { height: 100%; background: var(--app-bg); color: var(--app-text); }
  body {
    font-family: 'Segoe UI', 'Aptos', sans-serif;
    background-image:
      radial-gradient(circle at top left, rgba(126, 211, 196, 0.15), transparent 28%),
      radial-gradient(circle at bottom right, rgba(255, 181, 107, 0.12), transparent 30%);
  }
  textarea, input, select, button { font-family: inherit; }
  textarea, input, select, button { outline: none; }
  textarea:focus, input:focus, select:focus, button:focus {
    border-color: rgba(126, 211, 196, 0.65) !important;
    box-shadow: 0 0 0 3px rgba(126, 211, 196, 0.14);
  }
  button { transition: transform 120ms ease, filter 120ms ease; }
  button:hover { filter: brightness(1.04); transform: translateY(-1px); }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
`;
document.head.appendChild(style);

const container = document.getElementById("root");
if (!container) throw new Error("No #root element found in the document.");

createRoot(container).render(<App />);
