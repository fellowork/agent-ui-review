import { createRoot } from "react-dom/client";
import { App } from "./App";

const style = document.createElement("style");
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: #1e1e1e; color: #d4d4d4; }
  textarea, input, select, button { font-family: inherit; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
`;
document.head.appendChild(style);

const container = document.getElementById("root");
if (!container) throw new Error("No #root element found in the document.");

createRoot(container).render(<App />);
