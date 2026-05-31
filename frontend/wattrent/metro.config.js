// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// ─────────────────────────────────────────────────────────────────────────────
// Web-only: stub out native-only modules that fail to bundle for web.
//
// `react-native-google-mobile-ads` (Invertase AdMob) imports
// `react-native/Libraries/Utilities/codegenNativeComponent`, which Metro
// refuses to bundle for the `web` platform — it's a native-only internal.
// Our app already guards every call site with `Platform.OS === 'ios' | 'android'`
// + try/catch, so on web we just need Metro to emit an empty module instead
// of trying to resolve the package's real entry point.
//
// `{ type: 'empty' }` tells Metro to substitute an empty JS module, so
// `require('react-native-google-mobile-ads')` returns `{}` on web and the
// existing runtime guards bail out gracefully.
// ─────────────────────────────────────────────────────────────────────────────
const WEB_EMPTY_MODULES = new Set(['react-native-google-mobile-ads']);

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_EMPTY_MODULES.has(moduleName)) {
    return { type: 'empty' };
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 }); 