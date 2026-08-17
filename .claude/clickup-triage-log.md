# ClickUp IN PROGRESS — Triage log

Board: "App" — https://app.clickup.com/90151227602/v/b/6-901523935786-2
Tarea programada: `clickup-inprogress-triage` (diaria 9:05am).

Cada entrada: fecha | tarjeta | veredicto | dónde | acción.
Veredictos: 🔴 accionable este repo · ⚪ otro repo/laptop · ⏳ falta info · ✅ ya triageada sin cambios.

---

## 2026-06-23 (línea base, triage manual)

- 🔴 **Journeys: Regresar a Journey** — back-link del reader apuntaba a `/?variant=X` (home de carruseles para no-polyglot → forzaba re-seleccionar journey+idioma). Fix en `src/app/journey/JourneyClient.tsx` (`withReturn` → `/journey?variant=X`, que renderiza JourneyClient para todos los planes). Verificado en localhost (las cards generan `returnTo=%2Fjourney%3Fvariant%3D…`). **Hecho en local, sin pushear — espera OK del usuario. → Movida a FOR REVIEW.**
- ⚪ **Contraportada Journal en Studio** — vive en la otra laptop/repo (Studio). No se toca. Solo registro.

Nota para próximos runs: si estas dos tarjetas siguen en IN PROGRESS sin cambios de actividad, marcarlas ✅ sin re-analizar. La tarjeta 1 sigue pendiente solo del push (verbo del usuario).
