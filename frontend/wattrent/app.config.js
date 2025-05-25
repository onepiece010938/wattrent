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
      // 在這裡設定您的 API URL
      // 使用 ngrok URL (記得更新為您的實際 URL)
      apiUrl: "https://calf-positive-urgently.ngrok-free.app/api/v1"
    }
  }
}; 