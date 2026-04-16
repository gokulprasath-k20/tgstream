import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tgstream.app',
  appName: 'TGStream',
  // In production, build your Next.js app statically (if possible) or point to your deployed URL.
  // For Next.js with API routes, you typically deploy the Next.js app to a server (e.g., Vercel/VPS),
  // and point the Capacitor app directly to that hosted URL.
  webDir: 'public', // Placeholder if not using export.
  bundledWebRuntime: false,
  server: {
    // Uncomment and replace with your production URL when building the APK
    // url: 'https://your-tgstream-production-url.com',
    cleartext: true
  },
  android: {
    buildOptions: {
      keystorePath: 'release-key.keystore',
      keystoreAlias: 'auth',
    }
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
