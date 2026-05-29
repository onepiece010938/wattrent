export default {
  expo: {
    name: "WattRent",
    slug: "wattrent",
    owner: "onepiece010938",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: "wattrent",
    // For EAS Update: this version is bound to the native binary, with policy:"appVersion".
    // runtimeVersion is auto-aligned to expo.version; whenever you touch a native
    // module or bump the SDK you MUST bump expo.version, otherwise OTA updates
    // pushed to old binaries will crash.
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/dc9a5284-10b5-47da-bc1c-053c36d08564"
    },
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    plugins: [
      "expo-router",
      "expo-localization",
      [
        "expo-camera",
        {
          cameraPermission: "Allow WattRent to use the camera to take meter photos"
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Allow WattRent to access the photo library to pick meter photos"
        }
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      // Sentry React Native config plugin. Source maps + native crash reporting
      // require this plugin in the native build (managed workflow does the rest).
      "@sentry/react-native/expo"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.wattrent",
      buildNumber: "1",
      infoPlist: {
        NSCameraUsageDescription: "Allow WattRent to use the camera to take meter photos",
        NSPhotoLibraryUsageDescription: "Allow WattRent to access the photo library to pick meter photos",
        // Required so iOS will accept HTTPS-only network calls.
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: "app.wattrent",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/icon.png"
    },
    experiments: {
      typedRoutes: true
    },
    extra: {
      // API URL is no longer hard-coded. Set the env var when needed:
      //   $env:EXPO_PUBLIC_API_URL='https://wattrent-api-xxxx.a.run.app/api/v1'
      // If unset, lib/apiUrl.ts auto-selects the dev/staging fallback.
      apiUrl: process.env.EXPO_PUBLIC_API_URL || null,
      // Sentry DSN — only set in production / staging builds (via EAS secret or shell env).
      // When unset, lib/telemetry.ts falls back to a console-only adapter.
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || null,
      // Optional override of process.env.NODE_ENV-style env name used by Sentry tagging.
      env: process.env.EXPO_PUBLIC_ENV || null,
      // Production-build dev-mode opt-in. Set to "true" via EAS env when you need to
      // toggle skipOcr / forceMockHistory / apiUrlOverride against a deployed build.
      // In normal user-facing builds, leave this unset.
      devModeEnabled: process.env.EXPO_PUBLIC_DEV_MODE_ENABLED || null,
      // Firebase Web SDK config. EAS Build profiles inject these via the env
      // block in eas.json (which reads from EAS Secrets). Leaving them null
      // forces lib/firebase.ts into the local dev-bypass mode.
      firebase: {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || null,
        authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || null,
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || null,
        appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || null,
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || null,
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || null,
        measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || null
      },
      eas: {
        projectId: "dc9a5284-10b5-47da-bc1c-053c36d08564"
      }
    }
  }
};
