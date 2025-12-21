import 'dotenv/config';

const bundleIdentifier = process.env.IOS_BUNDLE_ID || 'com.pawmi.app';
const buildNumber = process.env.IOS_BUILD_NUMBER || '1';

export default {
  name: 'Pawmi',
  slug: 'pawmi-mobile',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'cover',
    backgroundColor: '#ffffff',
  },
  ios: {
    bundleIdentifier,
    buildNumber,
    supportsTablet: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'Precisamos de acesso às fotos para anexar imagens do pet.',
      NSCameraUsageDescription: 'Precisamos de acesso à câmara para tirar fotos do pet.',
      ITSAppUsesNonExemptEncryption: false
    },
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY,
    },
  },
  android: {
    package: 'com.pawmi.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY,
      },
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-secure-store'
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    googlePlacesKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY,
    eas: {
      projectId: '2d2a4865-75c5-47ab-9d03-c79206e7c1dc',
    },
  },
};
