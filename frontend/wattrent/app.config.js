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
      ]
    ],
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: "Allow WattRent to use the camera to take meter photos",
        NSPhotoLibraryUsageDescription: "Allow WattRent to access the photo library to pick meter photos"
      }
    },
    android: {
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
      eas: {
        projectId: "dc9a5284-10b5-47da-bc1c-053c36d08564"
      }
    }
  }
};
