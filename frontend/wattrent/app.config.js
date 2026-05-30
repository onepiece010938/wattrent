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
      "@sentry/react-native/expo",
      [
        // Google Mobile Ads (AdMob) config plugin. Sets the AdMob App ID into
        // Info.plist / AndroidManifest at native build time. Without this the
        // app crashes on launch.
        //
        // The defaults are Google's official TEST app IDs — always safe and
        // never count as invalid traffic. Provide real IDs via env when ready:
        //   EXPO_PUBLIC_ADMOB_APP_ID_IOS=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
        //   EXPO_PUBLIC_ADMOB_APP_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
        "react-native-google-mobile-ads",
        {
          androidAppId:
            process.env.EXPO_PUBLIC_ADMOB_APP_ID_ANDROID ||
            "ca-app-pub-3940256099942544~3347511713",
          iosAppId:
            process.env.EXPO_PUBLIC_ADMOB_APP_ID_IOS ||
            "ca-app-pub-3940256099942544~1458002511",
          userTrackingPermission:
            "This identifier will be used to deliver personalised ads to you.",
          // SKAdNetwork IDs — required by iOS 14+ for accurate ad attribution.
          // List maintained by Google; updated periodically.
          skAdNetworkItems: [
            "cstr6suwn9.skadnetwork",
            "4fzdc2evr5.skadnetwork",
            "2fnua5tdw4.skadnetwork",
            "ydx93a7ass.skadnetwork",
            "p78axxw29g.skadnetwork",
            "v72qych5uu.skadnetwork",
            "ludvb6z3bs.skadnetwork",
            "cp8zw746q7.skadnetwork",
            "3sh42y64q3.skadnetwork",
            "c6k4g5qg8m.skadnetwork",
            "s39g8k73mm.skadnetwork",
            "3qy4746246.skadnetwork",
            "hs6bdukanm.skadnetwork",
            "mlmmfzh3r3.skadnetwork",
            "v4nxqhlyqp.skadnetwork",
            "wzmmz9fp6w.skadnetwork",
            "su67r6k2v3.skadnetwork",
            "yclnxrl5pm.skadnetwork",
            "7ug5zh24hu.skadnetwork",
            "gta9lk7p23.skadnetwork",
            "vutu7akeur.skadnetwork",
            "y5ghdn5j9k.skadnetwork",
            "n6fk4nfna4.skadnetwork",
            "v9wttpbfk9.skadnetwork",
            "n38lu8286q.skadnetwork",
            "47vhws6wlr.skadnetwork",
            "kbd757ywx3.skadnetwork",
            "9t245vhmpl.skadnetwork",
            "a2p9lx4jpn.skadnetwork",
            "22mmun2rn5.skadnetwork",
            "4468km3ulz.skadnetwork",
            "2u9pt9hc89.skadnetwork",
            "8s468mfl3y.skadnetwork",
            "klf5c3l5u5.skadnetwork",
            "ppxm28t8ap.skadnetwork",
            "ecpz2srf59.skadnetwork",
            "uw77j35x4d.skadnetwork",
            "pwa73g5rt2.skadnetwork",
            "578prtvx9j.skadnetwork",
            "4dzt52r2t5.skadnetwork",
            "tl55sbb4fm.skadnetwork",
            "e5fvkxwrpn.skadnetwork",
            "8c4e2ghe7u.skadnetwork",
            "3rd42ekr43.skadnetwork",
            "3qcr597p9d.skadnetwork"
          ]
        }
      ]
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
      // AdMob ad-unit IDs (banner) — separate from the App IDs used by the
      // config plugin. Leave null to fall back to Google's test banner ID.
      ads: {
        androidBanner: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || null,
        iosBanner: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || null
      },
      eas: {
        projectId: "dc9a5284-10b5-47da-bc1c-053c36d08564"
      }
    }
  }
};
