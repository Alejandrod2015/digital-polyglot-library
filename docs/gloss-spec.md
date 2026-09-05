# Las glosas de toque, en un sitio

Cada palabra de una historia es tocable y devuelve una tarjeta. Este documento
reúne las reglas que la gobiernan; **ninguna vive aquí**, todas viven en el
fichero que las aplica, y aquí solo está el índice y el porqué. Si cambias una
regla, cámbiala en su fichero y actualiza la línea de esta tabla.

Existe porque el 2026-09-04 el usuario encontró cuatro fallos distintos en
cuatro capturas seguidas (contexto de doce palabras, `enseñado` como "taught"
donde era "shown", un verbo sin conjugación y un lema que repetía el modo). Las
cuatro reglas existían y cada una vivía donde se implementó, sin saber de las
otras.

## Dónde vive cada cosa

| regla | dónde | qué comprueba |
|---|---|---|
| El contrato: qué son `g`, `t`, `c`, `f`, `gm` | `src/lib/tapGlosses.ts` | tipos y significado de cada campo |
| Cobertura: ni un toque muerto | `scripts/rebuildTapGlosses.ts` | toda palabra del cuerpo Y del título tiene glosa |
| Reutiliza antes de pedir | `scripts/rebuildTapGlosses.ts` regla 2 | copia del bundle hermano lo que ya está escrito |
| **Glosa en contexto** | `scripts/rebuildTapGlosses.ts` regla 3 | una copia no vale si trae la frase de otro journey |
| Lo que NO es tocable | `scripts/tap-gloss-exempt.json` | artículos, numerales y nombres del reparto |
| Modo y formas | `scripts/glossMoods.ts` | subjuntivo, condicional, imperativo, enclítico |
| Conjugación, género y plural | `scripts/buildGlossForms.ts` | tablas de verbo, `gm` de los sustantivos |
| **El vocab es una glosa con etiqueta** | `docs/story-quality-spec.md` §4 | toda plaza de vocab tiene `c`, y `f` si es verbo |

## Los cinco números

| | tope | dónde | de dónde sale |
|---|---:|---|---|
| Trozo de contexto | **8 palabras** | `TOPE_TROZO` en `checkGlossVariants.ts` | el catálogo va en 4 de mediana y 6 en el p90; con 8 quedan fuera 691 de 52.277 |
| Definición del vocab curado | **8-14 palabras** | `defLo` en `validateGeneratedStory.ts` | 4-13 en A0, que tiene conceptos más simples |
| Definición: caracteres | **120** | `validateGeneratedStory.ts` | una definición enciclopédica cabía en 14 palabras largas |
| Plazas de vocab por historia | **20 a `max(25, palabras/9)`** | `vocab-count` | el suelo es 20; con 170 palabras eso ya es una pastilla cada 8,5 |
| Reparto de tipos | ~36% sustantivos | sin gate | medido sobre el Traveler A1 de España; 83% de sustantivos pinta la historia entera del mismo azul |

## Los cinco lints, y qué caza cada uno

Todos corren en el `pre-push`, envueltos en `[ -f ... ]`. **Ese `if` es una
trampa**: si el fichero no está en la rama, la barrera se salta sola y en
silencio. Fue lo que pasó con `checkGlossMoods.ts`, que vivió una semana en una
rama sin integrar mientras el hook lo llamaba sin encontrarlo.

| lint | caza |
|---|---|
| `lint:gloss-context` | palabra tocable sin `c` en su historia: la tarjeta repite la definición dos veces |
| `lint:glosses-reviewed` | copia con `rev: false`, o sea copiada y no leída contra su frase |
| `lint:gloss-moods` | forma que no es indicativo servida como entrada de diccionario |
| `lint:gloss-variants` | forma de otra variante, tipo no tocable, y el trozo de más de 8 palabras |
| `lint:vocab-layer` | plaza de vocab sin frase de contexto, verbo sin tabla, o `surface` que falta |

## El orden de una historia nueva

1. `rebuildTapGlosses.ts` cubre los huecos; lo que no exista en ningún hermano
   se escribe en `scripts/_newGlosses.json`.
2. **Leer las copias contra su frase.** `reviewCopiedGlosses.ts <bundle>` las
   vuelca con la oración donde caen. En el B1 de España, 30 de 181 traían el
   sentido de otro journey: `bombilla` decía "a mate straw" y `casero`
   "homemade".
3. `writeGlossLayer.ts <bundle> <slug> <trozos.json>` escribe la capa de
   contexto. El trozo es el mínimo con sentido, no la cláusula entera.
4. `buildGlossForms.ts <bundle> <textos.json>` para las conjugaciones y el
   género. Si la historia ya tiene capa escrita a mano, hace falta
   `--solo-formas`, o se la salta entera y sus verbos se quedan sin tabla.
5. `buildGlossMoods.ts --all --force` para el modo. `--force` es obligatorio
   tras tocar el motor: la tabla se REHACE, no se hereda.
6. Los cuatro lints.

## Lo que el generador todavía no sabe

- **Un tercio de los verbos se queda sin tabla.** El índice de formas solo
  reconoce el verbo si su infinitivo aparece en alguna historia del bundle, así
  que `añade` no encuentra `añadir`. Cobertura real: 49% en el A1 de España,
  41% en el A2, 12% en el A2 de LATAM.
- **Sin tabla tampoco hay lema**, porque el infinitivo vive dentro de `f`. Hasta
  arreglarlo, el infinitivo va entre paréntesis en la propia glosa:
  "adds (añadir)".
- Sustantivos y adjetivos no reciben bloque de formas: probado el 2026-08-26 y
  salían plurales imposibles (pieses, floreses). Van a mano.
