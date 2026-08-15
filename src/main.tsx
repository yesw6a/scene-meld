import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";

import StudioApp from "./App";
import AppContextMenu from "./components/AppContextMenu";
import AppearanceProvider from "./theme/AppearanceProvider";

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
