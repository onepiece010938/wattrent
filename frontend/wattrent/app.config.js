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
    // EAS Update 用：跟 native binary 綁定的版本，policy:"appVersion"
    // 表示 runtimeVersion 自動跟 expo.version 對齊；改 native 模組或升 SDK 時
    // 一定要 bump expo.version，否則 OTA 推下去舊 binary 會 crash。
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
      apiUrl: process.env.EXPO_PUBLIC_API_URL || null,
      eas: {
        projectId: "dc9a5284-10b5-47da-bc1c-053c36d08564"
      }
    }
  }
};
