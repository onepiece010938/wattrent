export default {
  expo: {
    name: "WattRent",
    slug: "wattrent",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: "wattrent",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    plugins: [
      "expo-router",
      [
        "expo-camera",
        {
          cameraPermission: "允許 WattRent 使用相機來拍攝電表照片"
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "允許 WattRent 存取相簿來選擇電表照片"
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
        NSCameraUsageDescription: "允許 WattRent 使用相機來拍攝電表照片",
        NSPhotoLibraryUsageDescription: "允許 WattRent 存取相簿來選擇電表照片"
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
      // API URL 不再寫死。請需要時設環境變數：
      //   $env:EXPO_PUBLIC_API_URL='https://wattrent-api-xxxx.a.run.app/api/v1'
      // 沒設的話 lib/apiUrl.ts 會自動選 dev/staging fallback。
      apiUrl: process.env.EXPO_PUBLIC_API_URL || null
    }
  }
};
