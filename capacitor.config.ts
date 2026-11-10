import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.dandelion.store',
  appName: 'Re:Port',
  webDir: 'dist',
  android: { allowMixedContent: false },
  // Route fetch() through native HTTP on Android: Steam and other store APIs send no CORS
  // headers for the app origin, so browser fetches for artwork were silently blocked.
  plugins: { CapacitorHttp: { enabled: true } },
};
export default config;
