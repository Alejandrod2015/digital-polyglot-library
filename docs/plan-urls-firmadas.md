# Tanda: URLs firmadas para el audio (encargo ejecutable)

Fecha: 2026-09-13. Preparado por el chat de planificación tras la tanda
"muro en la API" (auth en `/api/audio/generate` + gate de plan en los
endpoints de audio, hoy en el working tree sin commitear).

ESTADO 2026-09-13: fase 1 ejecutada (Opus) y revisada por el chat de
planificación; en el working tree, sin commitear, flag apagado. Siguiente
paso: fase 2 (bucket privado + env, la hace el usuario).

## Objetivo

Que un mp3 de historia solo sea descargable con una URL firmada de corta
vida emitida a un usuario con sesión y plan. Hoy el bucket R2 es público
(`pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev`), las URLs son permanentes,
y quien tenga una la comparte para siempre.

## Estado que asume este encargo (válvula de estado)

- `src/lib/objectStorage.ts` firma SigV4 a mano (PUT y presigned PUT ya
  existen; NO existe presigned GET). Config por env:
  `MEDIA_STORAGE_ENDPOINT`, `MEDIA_STORAGE_BUCKET`,
  `MEDIA_STORAGE_ACCESS_KEY_ID`, `MEDIA_STORAGE_SECRET_ACCESS_KEY`,
  `MEDIA_STORAGE_PUBLIC_BASE_URL`, `MEDIA_STORAGE_REGION`.
- URLs de audio en datos: `JourneyStory.audioUrl`,
  `JourneyStory.audioFragments[].url` (secciones), `UserStory.audioUrl`,
  clips de práctica (`media/generated/audio/practice-*`, ver
  `src/lib/storyPracticeAudio.ts:118`), catálogo de libros
  (`media/catalog/audio/*`, referenciado desde `src/data/books`), y
  standalone en Sanity (`audioUrl` en CMS). `audioSegments` y
  `audioWordTimings` NO llevan URLs.
- La tanda anterior (gate de plan) está aplicada en el working tree:
  `src/lib/audioAccess.ts`, `src/lib/internalApiAuth.ts` y los endpoints
  tocados. Si no está, parar y reportar.
- El móvil no tiene OTA: las builds instaladas reproducen la URL que la API
  les da en el momento; no construyen URLs por su cuenta.

## Decisiones tomadas (no reabrir)

1. **Bucket privado nuevo** (`dpl-media-private`), mismo account de R2. El
   público actual se queda para portadas e imágenes (emails y páginas
   anónimas las necesitan, y el acceso público de R2 es por bucket, no por
   prefijo).
2. **Firma en el momento de entrega** (presigned GET S3 sobre el bucket
   privado), no una ruta proxy con cookies: los players móviles instalados
   no mandan headers al pedir el mp3, pero reproducen cualquier URL que la
   API devuelva.
3. **Caducidad 24 h.** Cubre una sesión con snapshot cacheado en el móvil;
   inútil para compartir o scrapear de forma durable.
4. **La base de datos NO se migra.** La URL pública actual queda como
   identificador canónico; el firmador deriva la key del path `/media/...`
   y emite la URL firmada al servir. Cero riesgo de migración de datos.
5. **Flag `MEDIA_SIGNED_AUDIO=1`**: con el flag apagado todo se comporta
   como hoy. El código se puede desplegar antes de tocar Cloudflare.

## Trabajo de código (fase 1, desplegable con el flag apagado)

1. `src/lib/objectStorage.ts`: `getPresignedGetUrl({ key, expiresInSeconds })`
   (variante GET del presigned PUT existente) y config del bucket privado
   (`MEDIA_PRIVATE_BUCKET`; mismas keys si el token de API cubre ambos
   buckets).
2. `src/lib/mediaSigning.ts` (nuevo, solo servidor):
   - `signAudioUrl(stored: string | null)`: si el flag está apagado o la URL
     no es de audio nuestro, passthrough; si no, extrae la key del path y
     devuelve el presigned GET del bucket privado.
   - `signAudioFragments(json)`: mapea `fragments[].url`.
3. Envolver TODOS los puntos de entrega de audio con ese firmador:
   - Web SSR: `src/app/stories/[slug]/page.tsx` (audioUrl y audioFragments
     del payload), `story-of-the-day`, páginas de libro
     (`src/app/books/[bookSlug]/[storySlug]/page.tsx` y readers), y
     cualquier página que pase `story.audio` a `Player`.
   - API: `user-stories`, `standalone-story-audio`, `standalone-stories`,
     `story-practice`, `journey/practice`, `library`, `mobile/journey`,
     `mobile/talking-points`, y las rutas de práctica que devuelven clips.
   - Studio: las rutas `studio/audio-editor/*` y `studio/journeys/*` que
     devuelven audioUrl (el Studio también tiene que seguir oyendo tras el
     purge).
   - Verificar que NINGÚN componente cliente construye URLs de audio desde
     una key (la firma necesita el secreto): `resolveCatalogAudioUrl` en
     `src/lib/publicMedia.ts` se usa desde `Player` (cliente); el audio de
     catálogo debe llegar ya firmado por props desde SSR.
4. Escritores: `uploadAudioObject()` en objectStorage que sube al bucket
   privado y devuelve la URL canónica de siempre (la de la base). Cambiar a
   ella los escritores de audio: `src/lib/elevenlabs.ts`,
   `narrationPostProcess.ts`, `storyPracticeAudio.ts`, `audioEditorSplice.ts`
   y el generate-local del Studio. Portadas e imágenes siguen en
   `uploadPublicObject`.
5. Scripts:
   - `scripts/_copiaAudioPrivado.ts`: copia el audio del bucket público al
     privado (S3 CopyObject dentro del mismo account, sin bajar los bytes).
     Idempotente, con conteo final origen vs destino.
     ALCANCE (corregido en la ejecución de la fase 1): los prefijos del plan
     original se quedaban cortos; el barrido de la base encontró audio también
     en `media/polyglot/`, `media/standalone/`, `media/uploads/audio/`,
     `media/practice*/` y `media/multivoice-segments/`. La fuente de verdad es
     `SIGNED_AUDIO_PREFIXES` + `isSignableAudioKey` en `src/lib/mediaSigning.ts`
     (prefijo Y extensión de audio, porque las carpetas por slug guardan la
     portada junto al mp3); firmador, copia y purga filtran con la MISMA
     función para que no se desincronicen.
   - `scripts/_purgaAudioPublico.ts`: borra esos prefijos del bucket público.
     NO se ejecuta en esta tanda; queda listo para la fase 4. Debe pedir
     confirmación explícita y respetar el guard de comandos destructivos.
6. Tests: unit del firmador (key extraction, expiry, passthrough con flag
   apagado) y un smoke con `--dry` que recorra los endpoints y verifique que
   ninguna respuesta contiene el host público cuando el flag está encendido.

## Fases operativas (después del código)

- **Fase 2 (usuario, Cloudflare + Vercel):** crear el bucket privado,
  comprobar que el token de API alcanza ambos buckets, y poner
  `MEDIA_PRIVATE_BUCKET` y `MEDIA_SIGNED_AUDIO` (aún `0`) en Vercel y en
  `.env` local.
- **Fase 3 (corte):** correr la copia, spot-check de un presigned GET por
  tipo (historia, sección, práctica, catálogo), encender el flag en Vercel,
  desplegar en el batch normal, y verificar reproducción en web anónima
  (historia del día), web con sesión, y las apps DE TIENDA en iOS y Android
  (regla 6g: la build local no cuenta).
- **Fase 4 (purga, a los 14 días):** correr `_purgaAudioPublico.ts`. Aquí
  mueren las URLs ya filtradas. Los 14 días cubren snapshots cacheados de
  builds móviles y cualquier email o página cacheada con URL vieja de audio.
- Punto de verificación móvil ANTES de la fase 4: confirmar que la app
  re-pide el metadata de audio al abrir una historia (no reproduce una URL
  guardada de hace días). Si reproduce desde snapshot, adelantar un release
  móvil o alargar la gracia.

## Fuera de alcance de esta tanda

- DRM (Widevine/FairPlay): sobreingeniería para este producto.
- Cifrar los mp3 descargados offline en el móvil.
- Rotar nombres de archivo ya filtrados: la purga de la fase 4 los mata.
- Firmar portadas o imágenes: siguen públicas a propósito.

## Válvula de calidad

El resultado vuelve al chat de planificación antes de darse por bueno:
diff de la fase 1 + salida del smoke con flag encendido en local + conteos
de la copia. El ejecutor no encadena la fase 3 ni la 4 por su cuenta.
