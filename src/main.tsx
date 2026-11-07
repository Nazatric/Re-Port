import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { applySettings, settingsStore } from "./lib/store";

// Apply the saved theme before the first paint to avoid a flash of the default theme.
applySettings(settingsStore.get());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Offline support: caches the app shell and streams artwork into a size-limited cache.
if ("serviceWorker" in navigator && import.meta.env.PROD && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline caching is a bonus; the app works without it */
    });
  });
}
