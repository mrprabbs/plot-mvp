import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Plot',
  slug: 'plot-driver',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0B0B0B',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.plotparking.driver',
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'Plot uses your location to center the map and show nearby parking lots.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0B0B0B',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID,
      },
    },
  },
  plugins: ['expo-font', 'expo-secure-store'],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.plot-parking.com',
  },
};

export default config;
