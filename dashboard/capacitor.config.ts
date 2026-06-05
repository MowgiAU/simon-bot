import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.fujistud.app',
  appName: 'Fuji Studio',
  webDir: 'dist',
  server: {
    // Always loads the live site — updates ship instantly without a new app release
    url: 'https://fujistud.io',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    backgroundColor: '#161925',
  },
};

export default config;
