const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const DEFAULT_PRODUCTION_APP_URL = "https://reader.digitalpolyglot.com";
const DEFAULT_PRODUCTION_CLERK_PUBLISHABLE_KEY = "pk_live_Y2xlcmsuZGlnaXRhbHBvbHlnbG90LmNvbSQ";
const deviceApiBaseUrl = process.env.EXPO_PUBLIC_DEVICE_API_BASE_URL?.trim() ?? "";
const buildProfile = process.env.EAS_BUILD_PROFILE?.trim().toLowerCase() ?? "";
const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() ?? "";
const xcodeConfiguration = process.env.CONFIGURATION?.trim().toLowerCase() ?? "";
const appVariant = process.env.APP_VARIANT?.trim().toLowerCase() ?? "";
const isProductionBuild =
  buildProfile === "production" ||
  nodeEnv === "production" ||
  xcodeConfiguration === "release" ||
  appVariant === "production";

function resolveApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (!raw) {
    return DEFAULT_PRODUCTION_APP_URL;
  }

  try {
    const url = new URL(raw);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (isProductionBuild && isLocalhost) {
      return DEFAULT_PRODUCTION_APP_URL;
    }
    return raw;
  } catch {
    return isProductionBuild ? DEFAULT_PRODUCTION_APP_URL : raw;
  }
}

function resolveClerkPublishableKey(apiBaseUrl) {
  const raw = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const targetApiBaseUrl = deviceApiBaseUrl || apiBaseUrl;
  const isProductionApi = targetApiBaseUrl === DEFAULT_PRODUCTION_APP_URL || isProductionBuild;
  const isTestKey = raw.startsWith("pk_test_") || raw.startsWith("test_");

  if (isProductionApi && (!raw || isTestKey)) {
    return DEFAULT_PRODUCTION_CLERK_PUBLISHABLE_KEY;
  }

  return raw;
}

const apiBaseUrl = resolveApiBaseUrl();
const clerkPublishableKey = resolveClerkPublishableKey(apiBaseUrl);

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "Digital Polyglot",
  // Pin the Expo account that owns this project so EAS never prompts an
  // account chooser (which also listed the unrelated `muvn` org this login
  // belongs to). DPL is solely under the personal account.
  owner: "delcarpio321",
  slug: "digital-polyglot-mobile",
  scheme: "digitalpolyglot",
  version: "1.0",
  newArchEnabled: false,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  // App icon (home screen). Square dP mark, 1024x1024, opaque (no alpha;
  // App Store rejects alpha). Source: brand square logo. The native iOS
  // appiconset is also replaced directly for xcodebuild builds; this field
  // keeps prebuild/EAS in sync so the icon survives a regen.
  icon: "./assets/icon.png",
  assetBundlePatterns: ["**/*"],
  // (Native splash config moved to the `expo-splash-screen` plugin
  // below; gives us `imageWidth` so the wordmark renders at the
  // same width the ExtendedSplash uses, eliminating the "logo size
  // pop" between native and React splashes.)
  plugins: [
    "expo-secure-store",
    "expo-web-browser",
    "expo-notifications",
    "expo-iap",
    // Solo hace algo cuando el build apunta a un http:// local; ver el plugin.
    "./plugins/allow-local-cleartext",
    [
      "expo-splash-screen",
      {
        // imageWidth controls the actual wordmark width on the
        // native splash. Setting it to ~270pt matches the
        // explicit pixel width in ExtendedSplash so the user
        // doesn't see a size-pop when the React-rendered splash
        // takes over. (iOS: the wide wordmark renders fine.)
        backgroundColor: "#0c1626",
        image: "./assets/splash-logo-white.png",
        imageWidth: 270,
        // Android 12+ forces the system splash into a centered ICON slot
        // (a bounded circle) and crops anything wider, so the horizontal
        // wordmark can't go here. Use the SQUARE dP monogram in WHITE on a
        // TRANSPARENT background, padded to sit inside the circular mask; the
        // navy `backgroundColor` above shows through. White (not the colored
        // mark) so it reads as one continuous white-on-navy splash with the
        // React ExtendedSplash wordmark that follows.
        //
        // Why transparent + white fixes the "colored logo flash": Android 12
        // rejects a splash icon that has a solid (non-transparent) background
        // and falls back to the launcher icon, which is the COLORED dP on
        // white; that was the flash the user saw. splash-android.png had a
        // solid navy fill; splash-android-fg.png is the same mark, recolored
        // white on transparent so Android accepts it as the system splash icon.
        android: {
          image: "./assets/splash-android-fg.png",
          imageWidth: 180,
        },
      },
    ],
  ],
  ios: {
    // Sign in with Apple. La guía 4.8 de la App Store obliga a ofrecer un
    // login equivalente en privacidad en cuanto la app ofrece Google o
    // Facebook, que es justo nuestro caso. Esto añade el entitlement
    // `com.apple.developer.applesignin` al target; el perfil de
    // aprovisionamiento tiene que llevar la capability habilitada en el
    // Apple Developer portal o la firma falla.
    usesAppleSignIn: true,
    // iPhone-only para el lanzamiento: declarar iPad obliga a subir capturas
    // de iPad. Se puede añadir iPad después; quitarlo una vez publicado, no.
    supportsTablet: false,
    bundleIdentifier: "com.digitalpolyglot.mobile",
    // Universal Links: con esto, un enlace https a digitalpolyglot.com/go/app
    // abre la app DIRECTAMENTE, sin el dialogo "¿Abrir en...?" del esquema
    // propio y sin pantalla intermedia. El otro extremo es
    // /.well-known/apple-app-site-association, que ya sirve
    // JJSDKZ9AN7.com.digitalpolyglot.mobile. Ojo: iOS solo lee ese fichero al
    // INSTALAR, asi que esto no surte efecto hasta un build nuevo.
    associatedDomains: [
      "applinks:digitalpolyglot.com",
      "applinks:www.digitalpolyglot.com",
    ],
    // OJO: este `buildNumber` es la fuente de verdad para el
    // CFBundleVersion del IPA. Tiene PRECEDENCIA sobre `app.json`
    // (Expo descarta app.json cuando existe app.config.js). EAS
    // `autoIncrement: true` NO funciona aquí porque EAS no muta JS.
    // Bumpear manualmente cada release a (max submitted on App Store
    // Connect) + 1.
    buildNumber: "314",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Background audio: story playback keeps sounding when the app is
      // backgrounded or the screen is locked (audiobook-style). Must stay
      // in sync with ios/DigitalPolyglot/Info.plist (the committed native
      // project xcodebuild actually reads); this keeps a prebuild/EAS regen
      // from dropping the entry. Paired with `staysActiveInBackground: true`
      // in NativeAudioPlayer's setAudioModeAsync.
      UIBackgroundModes: ["audio"],
    },
  },
  android: {
    // OJO: NO es `com.digitalpolyglot.mobile` (el bundle id de iOS). Play ya
    // tiene reservado `com.digitalpolyglot.app` desde la TWA de Bubblewrap de
    // marzo 2026 (app ID 4973262390913816082, borrador en prueba interna), con
    // Play App Signing ya configurado y `android-twa/android.keystore` como
    // clave de subida. Un package name en Play es irreversible, así que la app
    // Expo reusa esa entrada en vez de quemar un segundo nombre. El servidor ya
    // apunta aquí vía GOOGLE_PLAY_PACKAGE_NAME, y el assetlinks.json de
    // producción publica las huellas de este package.
    package: "com.digitalpolyglot.app",
    // App Links, el equivalente de los Universal Links. El assetlinks.json de
    // produccion ya publica las huellas de ESTE package (por eso el enlace
    // abre la app y no el navegador), y aqui se declara el otro extremo.
    // `autoVerify` es lo que evita el dialogo de "abrir con".
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "digitalpolyglot.com", pathPrefix: "/go/app" },
          { scheme: "https", host: "www.digitalpolyglot.com", pathPrefix: "/go/app" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    // Fuente de verdad del versionCode del AAB, igual que `ios.buildNumber`
    // para el IPA: Expo descarta app.json, y EAS `autoIncrement` no muta JS.
    // La TWA gastó el 1, así que la app Expo arranca en 2. Bumpear a mano en
    // cada subida a Play; Play rechaza un versionCode repetido o menor.
    // El 23 se subió al track interno el 2026-08-06 y ya está quemado, así que
    // el siguiente build tiene que salir con este 24 o Play lo rechaza.
    versionCode: 25,
    adaptiveIcon: {
      // Android recorta el foreground a un círculo/squircle según el launcher y
      // solo respeta el 66% central, así que reusar `icon.png` (el mark llena
      // el 87% del ancho) le comería los bordes al logo.
      // `icon-adaptive-foreground.png` es el mismo mark sobre blanco opaco,
      // reencuadrado al 49% del lienzo (la misma caja que `splash-android-fg`).
      // OJO con el cálculo, aquí se documentó mal una vez: el área VISIBLE son
      // los 72dp centrales de 108, así que un mark al 62% del lienzo ocupaba el
      // 92% del ancho visible y se veía como una barra pegada a las paredes del
      // círculo, no "igual que en iOS" (allí es el 87% de una máscara cuadrada).
      // Al 49% del lienzo son 74% del ancho visible y la tinta cae entera dentro
      // de la zona segura de 66dp. Al ser opaco, `backgroundColor` no llega a
      // verse; se deja en blanco por coherencia.
      foregroundImage: "./assets/icon-adaptive-foreground.png",
      backgroundColor: "#ffffff",
    },
    permissions: [
      // expo-notifications en Android 13+ (API 33). Sin declararlo no se puede
      // ni pedir el permiso en runtime.
      "android.permission.POST_NOTIFICATIONS",
    ],
    // Play Billing lo añade el plugin de expo-iap; no declarar
    // com.android.vending.BILLING a mano para no duplicarlo.
  },
  extra: {
    clerkPublishableKey,
    apiBaseUrl,
    EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID:
      process.env.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID?.trim() ?? "",
    EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID:
      process.env.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID?.trim() ?? "",
    eas: {
      projectId: "9d9393fb-0f04-43fd-83d1-f33ecd82a74e",
    },
  },
};

module.exports = config;
