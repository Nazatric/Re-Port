import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.dandelion.store',
  appName: 'Re:Port',
  webDir: 'dist',
  android: { allowMixedContent: false },
};
export default config;
