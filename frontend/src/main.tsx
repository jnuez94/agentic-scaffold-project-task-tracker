import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { AppProvider } from "./state/AppContext.tsx";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/table.css";
import "./styles/inspector.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from the document");

createRoot(container).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
