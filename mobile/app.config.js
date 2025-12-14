import 'dotenv/config';

const bundleIdentifier = process.env.IOS_BUNDLE_ID || 'com.petgrooming.app';
const buildNumber = process.env.IOS_BUILD_NUMBER || '1';

export default {
  name: 'Pet Grooming',
  slug: 'pet-grooming-mobile',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
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
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-secure-store'],
  extra: {
    apiBaseUrl: process.env.API_BASE_URL,
    googlePlacesKey: process.env.GOOGLE_PLACES_KEY,
    eas: {
      projectId: 'a6b7307b-0759-4b16-a535-4a3b45619adf',
    },
  },
};
