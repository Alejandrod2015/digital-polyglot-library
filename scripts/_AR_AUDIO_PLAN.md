# Plan de audio; Friends ES C1 Argentina (`cmrqn1s5s000032tj3kq0gykb`)

Disparar tras el **reset de cuota EL (2026-07-22 14:09Z)** y SOLO con el verbo de
audio del usuario ("genera/lanza/manda audio"). Voces ya aprobadas → no requiere
aprobar ninguna voz nueva.

## Estado actual (verificado en DB)
- Narración: **2/21** (Renzo `acHf5gp7AGOY30tJjvD4`). Faltan **19** (incluida
  `feria-de-san-telmo`, que quedó con voiceId=Lucas pero SIN audioUrl → se re-narra
  con Renzo y pisa ese voiceId).
- Covers: **21/21** ✓
- Práctica: 421 ejercicios; audio **0**; `practiceVoiceId` = null (hay que setearlo).

## Costo EL estimado
- Narración 19 historias: **~25.4k chars**.
- Práctica ~421 clips (oraciones ~80 chars): **~34k chars**.
- **Total ~60k chars**; cabe holgado en la cuota de 350k del reset.

## Voces (en allowlist, gate de voces OK)
- Narración: **Renzo** `acHf5gp7AGOY30tJjvD4` (porteño, aprobado).
- Práctica: **Jhenny** `FXGrCtY3PEyfqczBAlqm` (LATAM, aprobada).

## Secuencia (todo idempotente / re-corrible)

### Fase 1; Narración (prioridad; lo que suena en el reader)
```
npx tsx scripts/_runARNarration.ts
```
Recorre los 19 pendientes (salta los 2 ya narrados). Luego calibrar tempo por oído
(default 0.94x, ver [[project_audio_defaults]]):
```
npx tsx scripts/normalizeAudioPace.ts --apply 0.94 <slug>   # por historia si hace falta
```

### Fase 2; Audio de práctica (Jhenny)
```
npx tsx scripts/_setARPracticeVoice.ts                       # practiceVoiceId=Jhenny (no gasta créditos)
# por cada slug:
npx tsx scripts/_genPracticeClips.ts <slug>
npx tsx scripts/_seedAllSets.ts --apply --only=<slug>
npx tsx scripts/_genJourneyWords.ts <slug>                    # audio de palabra suelta (dicc)
```
**GOTCHA (del vía crucis CO):** los NOMBRES PROPIOS en las oraciones de práctica
(Juli, etc.) los engarruña el TTS y el QA transcriptOk los rechaza (fue el 23/26 de
los rechazos en CO). Esperar stragglers; el fix es reescribir esas oraciones con
PRONOMBRES (Ella/Él), y para falsos rechazos por seseo/números-palabra confirmar con
whisper y publicar a mano (uploadPublicObject + clipUrl + seed). Ver
[[feedback_practice_exercise_authoring_rules]] y [[project_journey_es_c1_friends_colombia]].

### Fase 3; Cerrar journey (después del audio, si el usuario lo pide)
- Publicar + flip a active + revalidar caché del reader (publicar por DB no refresca,
  ver [[project_journey_publish_cache]]).

## Scripts listos
- `_runARNarration.ts` (narración runner), `_genFriendsARStoryAudio.ts` (per-slug, Renzo,
  salta ya-narrados), `_setARPracticeVoice.ts` (Jhenny).
