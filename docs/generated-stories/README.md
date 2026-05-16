# Generated stories — ES LATAM A1 / Food & Drink (2do tema)

5 historias generadas con el Custom GPT **DPL Multi-Voice Story Writer** ([link](https://chatgpt.com/g/g-6a07641293588191b353b6187d672744-dpl-multi-voice-story-writer)) para el segundo tema del journey español-LATAM A1 (`food-daily-life` en `src/app/journey/journeyCurriculum.ts`).

Variantes regionales rotadas a propósito para diferenciarse de las 4 historias colombianas ya existentes en ese tema (`el-mercado-de-medellin`, `el-secreto-del-cafe`, `el-festival-de-la-arepa`, `el-misterio-del-bosque`).

## Resumen

| # | Title | Region | arcType | Synopsis | Body | Vocab | Speakers |
|---|---|---|---|---:|---:|---:|---|
| 1 | Tacos en Coyoacán | CDMX, MX | last-minute-decision | 60w | 235w | 20 | Elena, Martín, Vendedor |
| 2 | La pizarra de Surquillo | Lima, PE | plan-falls-short | 62w | 218w | 20 | Nico, Teresa, Rubén |
| 3 | Parrilla en San Telmo | BsAs, AR | late-reveal | 71w | 234w | 20 | Pablo, Camila, Raúl |
| 4 | Pupusas en La Campana | San Salvador, SV | white-lie | 67w | 241w | 20 | Diego, Julia |
| 5 | Guayoyo en Chacaíto | Caracas, VE | small-stake | 71w | 210w | 20 | Valeria, Darío, Miriam |

## Validación contra spec

Todas pasan los checks principales:

- ✓ JSON parse OK (las 5)
- ✓ Synopsis 45-90 palabras (las 5)
- ✓ Body 180-320 palabras, con 4 historias en target 220-280 y 1 (Guayoyo) ligeramente debajo (210)
- ✓ arcType ejecutado y distinto en cada una (no se repite ninguno)
- ✓ Multi-voz plain text con `Speaker: line`
- ✓ ≥2 personajes nombrados y ≥4 turnos por historia
- ✓ Cero personajes repiten nombres entre historias ni con las 4 historias colombianas existentes
- ✓ Cero títulos repiten / token-overlap mayor a 50% con existentes
- ✓ Vocab 20 items por historia, definitions 3-7 inglesas
- ✓ Sin laughter / hmm / stage directions

Anomalías menores detectadas (no bloqueantes):

- **Story 2 (La pizarra de Surquillo)**: tiene `quedar` duplicado en vocab (surface `quedó` + `queda`) — viola la regla "no same-root duplicates", pero los dos sentidos son legítimamente distintos (parar de moverse vs. quedar disponible). Recomendado: dropear uno antes de subir al Studio.
- **Story 5 (Guayoyo en Chacaíto)**: body 210 palabras, debajo del target 220 (arriba del hard min 180). Para A1 está OK pero si se quiere ajustar, pedirle al GPT "alarga 30-40 palabras manteniendo todo".

## Cómo usar

Cada `.json` se puede pegar tal cual en el Studio. El `surface` field aparece solo en items donde la forma flexionada del texto difiere del lemma; si lemma y surface coinciden, omitido por diseño.

## Re-generar / iterar

Para una nueva historia, abrir el GPT y mandar un prompt en una sola línea:

```
Genera historia en español (variante X) nivel A1. Tema: <tema concreto>, arcType <arcType>.
Títulos a evitar: <lista>.
Nombres a evitar: <lista>.
Recent arcTypes: <lista de los últimos 3>.
```

El GPT devuelve JSON listo (~30s).
