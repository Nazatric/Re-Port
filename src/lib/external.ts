import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

/** Open project and download links outside the app, never in its WebView. */
export async function openExternal(url: string): Promise<void> {
  const target = new URL(url);
  if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("Unsupported link");
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url: target.href });
  } else {
    window.open(target.href, "_blank", "noopener,noreferrer");
  }
}
