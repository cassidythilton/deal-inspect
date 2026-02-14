import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Prevent Domo from reloading the app when datasets update ─────────────────
// By default Domo refreshes the iframe on any dataset change. We suppress this
// so the user's in-progress TDR session and intelligence panel state are preserved.
const domo = (window as unknown as { domo?: { onDataUpdate?: (cb: (alias: string) => void) => void } }).domo;
if (domo?.onDataUpdate) {
  domo.onDataUpdate(function (_alias: string) {
    // no-op: suppress automatic refresh
  });
}

createRoot(document.getElementById("root")!).render(<App />);
