import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./index.css";
import App from "./App";
import { APP_BUILD_ID } from "./lib/buildInfo";
import { applySettings, settingsStore } from "./lib/store";

// Apply the saved theme before the first paint to avoid a flash of the default theme.
applySettings(settingsStore.get());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Native Android must always boot from the assets inside the installed APK. A service worker
// registered by an earlier APK can otherwise keep serving an old shell (and an old cover flow)
// after the app itself has been updated.
if ("serviceWorker" in navigator) {
  if (Capacitor.isNativePlatform()) {
    let previousBuild: string | null = null;
    try {
      previousBuild = localStorage.getItem("portdeck.app.build");
      localStorage.setItem("portdeck.app.build", APP_BUILD_ID);
    } catch {
      /* storage can be unavailable in a fresh WebView */
    }
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => {
        // If an earlier APK's worker controlled this first launch, reload once so the newly
        // installed assets (including the cover flow) take over immediately.
        const reloadKey = `portdeck.sw-reloaded.${APP_BUILD_ID}`;
        if (previousBuild && previousBuild !== APP_BUILD_ID && navigator.serviceWorker.controller && !sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
        }
      })
      .catch(() => {
        /* the APK assets still load without service-worker cleanup */
      });
    if ("caches" in window) {
      void caches.delete("portdeck-shell-v1").catch(() => false);
      void caches.delete("portdeck-shell-v2").catch(() => false);
    }
  } else if (import.meta.env.PROD && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        /* offline caching is a bonus; the app works without it */
      });
    });
  }
}
