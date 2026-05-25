# Handoff: Migrate iPhone collections from local file → backend sync

## Objetivo
Hacer que las favorite collections del usuario sean **las mismas en web e iPhone**. Hoy el web ya lee/escribe via backend (Postgres). El iPhone sigue leyendo/escribiendo de un JSON local. Hay que migrar iPhone a leer/escribir via API, manteniendo el local como cache offline.

## Backend (ya hecho en web)
- Tabla: `dp_favorite_collections_v1` (Prisma model `FavoriteCollection`, schema identico al type `FavoriteCollection` de iPhone)
- Endpoints listos:
  - `GET /api/collections` — lista del user
  - `POST /api/collections` — crear
  - `PATCH /api/collections/:id` — rename
  - `DELETE /api/collections/:id`
  - `POST /api/collections/:id/items` — add `{ word, language }`
  - `DELETE /api/collections/:id/items?key=...`
  - `POST /api/collections/sync` — bulk upsert (merge wordKeys por union, idempotente). Endpoint específico para la migración del iPhone.

## Trabajo iPhone (esta sesión)
Modificar SOLO `apps/mobile/src/mobile/collections.ts` para reemplazar lectura/escritura local por API + cache local como fallback offline.

### Requisitos de seguridad zero-risk
1. **Local file NUNCA se borra**. Es el cache + safety net.
2. **Backup antes de migrar**: copiar `collections-${userId}.json` → `collections-${userId}.backup-${timestamp}.json` (queda permanente).
3. **Flag de migración**: `collections-migrated-${userId}.flag` se escribe SOLO al final, después de que todo el flow terminó OK. Si algo falla mid-way, no se escribe el flag, próximo launch reintenta, datos intactos.
4. **Merge cross-device**: el endpoint `/api/collections/sync` ya hace la unión de wordKeys (nunca borra entries). Solo manda lo local; el backend responde con el set unificado.
5. **Sign signatures**: `loadCollections` y `saveCollections` aceptan un opts opcional `{ sessionToken }`. Sin sessionToken, comportamiento local-only (offline fallback). Con sessionToken, sync con backend.

### Callers que actualizar
- `apps/mobile/src/mobile/MobileLibraryShell.tsx` líneas ~3232 y ~5578: pasar `{ sessionToken: sessionToken ?? null }` a las dos llamadas existentes.

### API base
- `https://reader.digitalpolyglot.com/api/collections...` (idem otros endpoints mobile)
- Header: `Authorization: Bearer <sessionToken>` (Clerk)

### Build + deploy
- Mobile testing: xcodebuild Release + devicectl install en iPhone físico (per memory). NUNCA `expo run:ios`.
- TestFlight: 1 EAS build por día max (per memory). Verificar buildNumber en EAS + Info.plist + App Store Connect antes de lanzar.
- NO pushear ni hacer EAS build sin verbo imperativo explícito del usuario ("manda" / "lanza" / "ship").

### Schema del FavoriteCollection (mobile y backend idénticos)
```ts
type FavoriteCollection = {
  id: string;              // e.g. "col-1234-abcd"
  name: string;
  wordKeys: string[];      // "${language}::${word}" lowercased
  createdAt: string;       // ISO
  language?: string;       // "Spanish", "German", etc. (optional, legacy)
};
```

### Tests a correr post-cambio (en iPhone físico Release build)
1. Crear collection en web → aparece en iPhone tras refresh
2. Crear collection en iPhone → aparece en web tras refresh
3. Add word a collection en web → aparece en iPhone
4. Eliminar collection en iPhone → desaparece en web
5. Modo avión en iPhone: collections siguen visibles (cache local), edits se sincronizan al volver online
6. First-launch tras update: backup file aparece, collections preservadas en backend, flag se escribe

## Estado del web (ya en main)
- UI: swipe-left en favoritos revela "Collection" (azul) + "Delete" (rojo). Tap Collection → modal con lista de collections existentes + input para crear nueva.
- Modal: toggle membership con click; nueva collection con Enter.
- Backend: persistido en Neon prod.
