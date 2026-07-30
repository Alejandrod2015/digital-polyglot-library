# Push en Android (FCM)

Estado al 2026-07-30: código y credenciales listos y verificados en local.
**Falta el rebuild del APK y la prueba en el device**, más las tres `FCM_*` en
Vercel.

Proyecto Firebase: **`digital-polyglot-e9c5e`** (project number `818559197891`),
creado bajo **digitalpolyglots@gmail.com**, plan Spark. NO está bajo
admin@digitalpolyglot.com, que es la cuenta del Play Console. La API de Firebase
Cloud Messaging (V1) está habilitada; la heredada, no (es la correcta: el sender
usa v1).

## Qué estaba roto

En un Pixel 6a (`com.digitalpolyglot.app`, versionCode 15), al abrir Ajustes,
el registro de push devolvía:

```
Default FirebaseApp is not initialized in this process com.digitalpolyglot.app.
Make sure to call FirebaseApp.initializeApp(Context) first.
```

Dos causas independientes, las dos arregladas en código:

1. **App**: `getDevicePushTokenAsync()` de expo-notifications habla con
   Firebase Messaging dentro del proceso, y el APK no llevaba
   `google-services.json`. Sin ese archivo no hay FirebaseApp que inicializar.
2. **Servidor**: `src/lib/pushRecipients.ts` descartaba todo token cuyo
   `provider` no fuera `"apns"`, y el único sender era `src/lib/apnsPush.ts`.
   Aunque el device hubiera registrado bien, el token quedaba guardado en
   Clerk y nunca se le enviaba nada.

El **recordatorio diario NO depende de esto**: es una notificación local
(`scheduleNotificationAsync`, `apps/mobile/src/notifications/dailyReminder.ts`)
y no pasa por FCM. Lo que se veía en la tarjeta era el error del registro de
push remoto, que `MobileSettingsScreen` pinta debajo del toggle.

## Hecho

### 1. Firebase Console

App Android registrada con el package `com.digitalpolyglot.app` (no el bundle id
de iOS, `com.digitalpolyglot.mobile`). `apps/mobile/google-services.json` está en
su sitio y commiteado: viaja dentro del APK de todos modos, no es un secreto, y
EAS lo necesita en el tarball (`.easignore` no lo excluye).

`app.config.js` lo detecta solo con `fs.existsSync`: si el archivo está, añade
`android.googleServicesFile`; si no, el build sigue saliendo sin push. Es
condicional porque Expo aborta el build de Android entero si la ruta apunta a un
archivo inexistente.

### 2. Service account

Clave privada generada para
`firebase-adminsdk-fbsvc@digital-polyglot-e9c5e.iam.gserviceaccount.com` y
escrita en `.env.local` (que además se pasó a modo 600). El JSON descargado se
borró: Google no permite recuperar una clave, solo generar otra, así que **el
único sitio donde vive el valor es `.env.local`**. Para Vercel, copiar de ahí.

| env var            | valor |
| ------------------ | ----- |
| `FCM_PROJECT_ID`   | `digital-polyglot-e9c5e` |
| `FCM_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@digital-polyglot-e9c5e.iam.gserviceaccount.com` |
| `FCM_PRIVATE_KEY`  | el PEM, con los `\n` escapados (como `APNS_AUTH_KEY`) |

Verificado que autentican: un envío a un token deliberadamente inválido devolvió
`400 INVALID_ARGUMENT` de FCM, es decir que el JWT de la service account se firmó
bien y Google emitió el access token. Un fallo de credenciales daría 401/403.

## Lo que falta

### 3. Rebuild y verificación

1. Build local de Android (prebuild → assemble → adb).
2. En el Pixel: Ajustes → activar el toggle de recordatorio. Ya no debe salir
   ningún mensaje de error debajo; si sale, `adb logcat | grep "\[push\]"`
   muestra el error crudo (`registerPush.ts` lo manda a `console.warn`).
3. Studio → Notificaciones → "Test send" con la misma cuenta logueada en el
   Pixel. La respuesta trae `results[].transport`, así que se ve si falló el
   lado `apns` o el `fcm`.

## Cómo quedó el reparto

- iOS: token nativo APNs → `src/lib/apnsPush.ts` (ya funcionaba, sin cambios).
- Android: token nativo FCM → `src/lib/fcmPush.ts` (FCM HTTP v1, service
  account → JWT RS256 → access token → `messages:send`).
- No se usa el Expo Push Service en ninguna de las dos: los tokens son nativos
  (`getDevicePushTokenAsync`) y el servidor habla directo con Apple y Google.
  Por eso **subir credenciales FCM a expo.dev no haría nada** en esta
  arquitectura; lo que hace falta es el `google-services.json` en el build.
- Una campaña con un solo transporte configurado ya no se bloquea: sale por el
  que esté listo y los tokens del otro se cuentan como fallidos con el motivo.
