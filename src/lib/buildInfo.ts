/**
 * Build identity baked in at compile time.
 *
 * The Android workflow sets VITE_APP_BUILD_ID to the exact Git commit and
 * VITE_REMOTE_CATALOG_URL to the catalogue published from that same repository.
 * That makes a stale APK visible in Settings instead of silently looking current.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const APP_BUILD_ID = env.VITE_APP_BUILD_ID || 'local';
export const APP_BUILD_LABEL = APP_BUILD_ID === 'local' ? 'Local build' : APP_BUILD_ID.slice(0, 7);
export const APP_VERSION = env.VITE_APP_VERSION || '';
export const REMOTE_CATALOG_URL = env.VITE_REMOTE_CATALOG_URL || '';
