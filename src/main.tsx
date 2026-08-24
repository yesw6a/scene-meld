import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";

import StudioApp from "./App";
import AppContextMenu from "./components/AppContextMenu";
import AppearanceProvider from "./theme/AppearanceProvider";

function reportFrontendError(message: string): void {
  console.error(`[SceneMeld][frontend] ${message}`);
  if (!("__TAURI_INTERNALS__" in window)) {
    return;
  }

  void import("@tauri-apps/api/core")
    .then(({ invoke }) => invoke("log_frontend_error", { message }))
    .catch(() => undefined);
}

console.info("[SceneMeld][frontend] boot");
window.addEventListener("error", (event) => {
  reportFrontendError(
    `uncaught error: ${event.message || "unknown error"} at ${event.filename || "unknown source"}:${event.lineno || 0}:${event.colno || 0}`,
  );
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  reportFrontendError(`unhandled rejection: ${reason}`);
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppearanceProvider>
      <AppContextMenu>
        <StudioApp />
      </AppContextMenu>
    </AppearanceProvider>
  </StrictMode>,
);
