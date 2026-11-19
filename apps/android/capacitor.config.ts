import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mrq.estudomusical',
  appName: 'MRQ Estudo Musical',
  webDir: '../studio/dist',
  android: {
    backgroundColor: '#090D16',
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
