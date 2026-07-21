---
name: grill
description: |
  Interroga al usuario ANTES de construir/generar cualquier cosa, en vez de adivinar y arrancar. Úsalo cuando el usuario diga "/grill", "grill", "interrógame", "pregúntame primero", "antes de empezar pregunta", o cuando vaya a empezar una tarea con instrucciones vagas que gastan tokens/créditos si salen mal (generar historia, cover, audio, una feature nueva, copy, un refactor con decisiones abiertas). Tras la fase de preguntas, captura las decisiones no obvias en la memoria del proyecto.
---

# Grill — interrogación socrática antes de construir

IMPORTANTE: todas las respuestas en español neutro (tú, no vos). "tienes/quieres/dices",
nunca "tenés/querés/decís". Es restricción dura del proyecto (ver `.claude/CLAUDE.md`).

Tu trabajo NO es construir todavía. Es sacar a la luz, con preguntas filosas, las
decisiones que el usuario tiene en la cabeza pero no dijo, para que lo que construyas
salga alineado al primer intento (no al tercero) y no gaste tokens, créditos de imagen
o audio en la dirección equivocada.

DPL ya tiene su "lenguaje compartido" en el sistema de memoria
(`~/.claude/projects/-Users-alejandrodelcarpio-digital-polyglot-library/memory/`),
en `.claude/CLAUDE.md` y en `docs/`. NO crees un `CONTEXT.md` paralelo: esas fuentes
SON el glosario. Este skill solo añade el ritual de interrogación + el guardado de
decisiones nuevas en esa misma memoria.

## Paso 1 — Carga el contexto antes de preguntar

Antes de disparar una sola pregunta:

1. Relee las memorias relevantes a la tarea (el índice ya viene cargado en
   `MEMORY.md`; abre los archivos `*.md` que apliquen).
2. Si la tarea toca código, lee los archivos/símbolos involucrados.
3. Identifica qué YA está decidido en memoria/spec. **No preguntes lo que la memoria
   ya responde** (regla `feedback_user_doesnt_brainstorm`: el usuario no genera
   ángulos ni diálogos; tú eliges). Pregunta solo lo genuinamente ambiguo.

## Paso 2 — Disparo de preguntas (la parte "grill")

**Máximo 3 preguntas. Ultra-cortas (una línea, idealmente < 10 palabras).** No 5, no 6.
Todo lo que puedas decidir con un default razonable, decídelo tú y NO lo preguntes:
solo pregunta lo que de verdad bloquea o lo que es caro equivocar (créditos, dirección
de producto). Si dudas entre preguntar o asumir, asume y avísalo en una línea al final.
Nada de citar memoria dentro de la pregunta ni paréntesis explicativos: eso alarga y
molesta. Reglas de calidad de las preguntas:

- **Filosas, no genéricas.** Mal: "¿qué estilo quieres?". Bien: "vi en memoria que los
  covers van flat/editorial y prohibido semi-realista; ¿esta mantiene esa línea o es
  excepción?".
- **Apoyadas en lo que ya sabes.** Cita la memoria/código que motiva la pregunta, así
  el usuario ve que no estás adivinando.
- **Cada pregunta debe cambiar lo que vas a hacer.** Si la respuesta no altera el
  output, no la preguntes (regla `feedback_no_options_just_do`).
- **Edge-cases y "qué NO hacer"** son las más valiosas: estados sin login, premium-gating,
  formato (multi-voz vs narrador), arco/continuidad, qué evitar.
- Si tras leer memoria una decisión es obvia, **propón el default y pide solo
  confirmación** en vez de preguntar a ciegas: "voy con X (por memoria Y), ¿ok?".

Formato sugerido:

```
Antes de empezar, 4 cosas:
1. ...
2. ...
3. ...
4. ...
```

Luego **PÁRATE y espera**. No construyas en el mismo turno.

## Paso 3 — Construye

Cuando el usuario responde, recién ahí ejecutas la tarea, ya alineado. Si una
respuesta abre una ambigüedad nueva e importante, haz una mini-ronda corta; si no,
avanza (no eternices el interrogatorio).

## Paso 4 — Captura decisiones no obvias (la parte "docs")

Si en la conversación se decidió algo **no obvio, duradero y no derivable del código**
(una convención, un trade-off de arquitectura, un "siempre/nunca" nuevo), guárdalo en
la memoria del proyecto siguiendo el formato de memoria (frontmatter + cuerpo con
`**Why:**` / `**How to apply:**`) y añade la línea-índice en `MEMORY.md`.

No guardes:
- lo que ya está en memoria/CLAUDE.md/docs (actualiza ese archivo en su lugar),
- detalles que solo importan a esta conversación,
- estructura de código o historia de git.

Si no hubo ninguna decisión nueva digna de memoria, no escribas nada y dilo en una
línea.

## Límites

- Default = preguntar poco y bien. 3-6 preguntas, no un cuestionario.
- No reabras decisiones ya tomadas para "asegurarte" (regla
  `feedback_commit_to_recommendations`).
- Respeta los gates de seguridad: nada de generar audio/imágenes sin el verbo explícito
  del usuario, aunque el grill lo "sugiera".
- Todo en español neutro (tú). Cero voseo, cero "che", cero vocabulario argentino.
