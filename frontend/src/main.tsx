import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./App";
import { LangProvider } from "./lib/i18n";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* "user": follow the operating system's reduce-motion setting for every animation */}
    <MotionConfig reducedMotion="user">
      <LangProvider>
        <App />
      </LangProvider>
    </MotionConfig>
  </StrictMode>,
);
