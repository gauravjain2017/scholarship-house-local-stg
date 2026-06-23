import { ExpoConfig, ConfigContext } from 'expo/config';

type AppEnv = 'development' | 'staging' | 'production';

const APP_ENV: AppEnv = (process.env.APP_ENV as AppEnv) || 'development';

const envConfig: Record<AppEnv, {
  name: string;
  bundleId: string;
  apiUrl: string;
  /** Public web app origin — used to build shareable property links (Copy Link). */
  webUrl: string;
  scheme: string;
}> = {
  development: {
    name: 'Scholarship Houses (Dev)',
    bundleId: 'com.dealpipeline.propertysubmitter.dev',
    // Use your machine's LAN IP for device testing, e.g. http://192.168.1.10:3000
    apiUrl: process.env.API_URL_DEV || 'http://localhost:3000',
    webUrl: process.env.WEB_URL_DEV || 'http://localhost:4020',
    scheme: 'propsub-dev',
  },
  staging: {
    name: 'Scholarship Houses (Staging)',
    bundleId: 'com.dealpipeline.propertysubmitter.staging',
    apiUrl: process.env.API_URL_STAGING || 'https://staging.api.your-domain.com',
    webUrl: process.env.WEB_URL_STAGING || 'https://staging.your-domain.com',
    scheme: 'propsub-staging',
  },
  production: {
    name: 'Scholarship Houses',
    bundleId: 'com.dealpipeline.propertysubmitter',
    apiUrl: process.env.API_URL_PROD || 'https://api.your-domain.com',
    webUrl: process.env.WEB_URL_PROD || 'https://your-domain.com',
    scheme: 'propsub',
  },
};

const cfg = envConfig[APP_ENV];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: cfg.name,
  slug: 'property-submitter-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  // Launcher icon shown after install on the device home screen.
  icon: './assets/icon.png',
  scheme: cfg.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: cfg.bundleId,
    infoPlist: {
      NSCameraUsageDescription:
        'We use the camera so you can photograph properties you submit.',
      NSPhotoLibraryUsageDescription:
        'We access your photo library so you can attach images to property listings.',
      NSLocationWhenInUseUsageDescription:
        'We use your location to set the property address from where you are standing.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: cfg.bundleId,
    versionCode: 1,
    // Resize the layout when the soft keyboard appears so scroll views can
    // bring the focused input into view (instead of the keyboard covering it).
    softwareKeyboardLayoutMode: 'resize',
    // Adaptive icon: foreground PNG (transparent, house centered in safe zone)
    // gets composited onto the solid background color by the OS — Android then
    // applies its current mask (circle, squircle, rounded square, …).
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1E3A8A',
    },
    // Permissions for camera, photos, and location are added automatically
    // by the expo-image-picker and expo-location plugins below — no need
    // to list them here.
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-video',
    '@react-native-community/datetimepicker',
    [
      'expo-image-picker',
      {
        photosPermission:
          'The app accesses your photos to let you upload property images.',
        cameraPermission:
          'The app accesses your camera to let you take property photos.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow $(PRODUCT_NAME) to use your location.',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: { deploymentTarget: '15.1' },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
extra: {
  appEnv: APP_ENV,
  apiUrl: cfg.apiUrl,
  webUrl: cfg.webUrl,
  eas: {
    projectId: '9b6870fb-82ec-41cd-9005-91f4096fbc5e',
  },
},
});
