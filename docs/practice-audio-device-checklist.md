# Checklist mínima; prueba de audio de práctica en device

Objetivo: confirmar lo ÚNICO que no pude verificar server-side; que el audio
**suena** en el cliente (iPhone/Android) y coincide con el texto. El riesgo
conocido es el bug "endpoint responde 200 pero el device queda MUDO"
(`project_practice_audio_open_issues.md`): si el botón responde pero NO se oye
nada, eso es el bug de cliente → anótalo.

Build: **13** (iPhone: Release/TestFlight · Android: Play interno).

## Qué reproduce cada tipo (para saber qué esperar oír)
- **meaning_in_context** → la **PALABRA** sola.
- **fill_blank** → la **ORACIÓN** completa.
- **listen_choose** → la **ORACIÓN** (solo en Expat DE y Traveler es-latam).
- **match_meaning** → la **PALABRA** de cada par al tocarla.

## Criterio de aprobación por fila
1. Se **oye** audio (no silencio).
2. Lo que se oye **coincide** con el texto/palabra en pantalla.
3. La oración es **corta y limpia** (no párrafo gigante, no fragmento cortado).

---

## A) Entrada vía HISTORIA; Traveler es-latam (español, tiene los 4 tipos)

| # | Tipo | Acción | iPhone | Android |
|---|------|--------|:------:|:-------:|
| 1 | meaning | tocar play de la palabra | ☐ | ☐ |
| 2 | fill_blank | tocar play de la oración | ☐ | ☐ |
| 3 | listen_choose | tocar play (oración a adivinar) | ☐ | ☐ |
| 4 | match_meaning | tocar 2 palabras distintas | ☐ | ☐ |

## B) Entrada vía HISTORIA; Expat DE (alemán, 2º idioma + listen)

| # | Tipo | Acción | iPhone | Android |
|---|------|--------|:------:|:-------:|
| 5 | fill_blank | play oración (alemán) | ☐ | ☐ |
| 6 | listen_choose | play oración (alemán) | ☐ | ☐ |
| 7 | match_meaning | tocar 1 palabra | ☐ | ☐ |

## C) Sección PRACTICE (tab, no vía historia)

| # | Qué | Acción | iPhone | Android |
|---|-----|--------|:------:|:-------:|
| 8 | pool | hacer 2-3 ejercicios, oír su audio | ☐ | ☐ |
| 9 | favorito | guardar 1 palabra → practicarla → play | ☐ | ☐ |

> Fila 9 es la de mayor riesgo histórico (favoritos usaba párrafo crudo +
> slices del mp3 maestro → "Ich auch"). Debe oírse una **oración corta propia**,
> completa, en voz aprobada.

---

## Si algo falla
- **Suena mal / otra cosa que el texto** → problema de contenido (avísame, es raro; server-side quedó coherente).
- **Botón responde pero NO suena** → bug de cliente (el conocido "200 mudo"); anota tipo + plataforma + entrada (historia/tab).
- **Error/carga infinita** → anota el tipo, idioma y si fue vía historia o tab.
