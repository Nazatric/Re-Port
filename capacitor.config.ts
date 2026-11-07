import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android app is the same web build wrapped in a native WebView.
 * Artwork is streamed from CDNs and cached on demand, so the APK only contains the app shell and the catalog text.
 */
const config: CapacitorConfig = {
  appId: "app.report.port",
  appName: "Re:Port",
  webDir: "dist",
  backgroundColor: "#04060a",
  server: {
    // Serve from https://localhost so the service worker, clipboard and share APIs behave like
    // they do on the web, and the catalog can be refreshed over the network inside the WebView.
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Re:Port owns back navigation: it pops its own history and closes only at the first screen,
    // so the plugin must not apply its default back-button handling on top of ours.
    App: {
      disableBackButtonHandler: true,
    },
  },
};

export default config;
