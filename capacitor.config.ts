import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.spiritfly.app',
  appName: 'SpiritFly',
  webDir: 'www',
  server: {
    // La app carga desde el servidor de producción
    url: 'https://spiritfly.org',
    cleartext: false
  }
};

export default config;
