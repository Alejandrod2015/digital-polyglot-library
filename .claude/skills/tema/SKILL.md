---
name: tema
description: |
  Crear o cerrar un TEMA de un journey (las 3 historias de un topic). Usalo cuando el usuario diga "/tema", "escribe el tema 3", "vamos con el siguiente tema", "cierra el tema", "da por bueno el tema", o cuando vaya a escribir, corregir o dar por terminadas las historias de un topic. Carga las reglas desde el inventario antes de escribir una linea y cierra con un registro, no con un "listo".
---

# Tema: escribir y cerrar las tres historias de un topic

Español neutro (tú, nunca vos). Restricción dura del proyecto.

Este skill NO recita reglas. Las CARGA. Si una regla no sale de los comandos de
abajo, no la cites de memoria: falta en `docs/rules-inventory.json` y ahi es
donde se añade.

## Paso 1. Carga las reglas (siempre, antes de escribir)

```
npx tsx scripts/rulesFor.ts story vocab journey
```

Lee la salida entera. Las tres secciones dicen cosas distintas:

- **Con gate**: si las rompes te para una maquina. No hace falta que las
  recuerdes, pero si las ignoras pierdes la tirada.
- **Proceso**: pasos obligatorios que ningun codigo puede comprobar.
- **SIN GATE**: nadie las comprueba. Son las unicas que dependen de que quien
  escribe se acuerde, y por eso se leen dos veces.

Si el tema es de un journey concreto, mira ademas donde esta ese journey:

```
npx tsx scripts/journeysTable.ts --journey <journeyId>
```

## Paso 2. Escribe las tres

Con el flujo que ya existe (`/generate-story`), en un unico fichero JSON con
las tres historias del topic: el validador canonico compara cada una contra sus
hermanas de la misma tanda, asi que separarlas se salta la comprobacion de
solape dentro del tema.

## Paso 3. Valida en seco, y arregla la historia (nunca el gate)

```
npx tsx scripts/saveStory.ts <data.json> --journey <id> --lang ES --level a2 --variant LATAM --dry
```

Un fallo se arregla en el texto. Bajar un umbral para que pase es exactamente
lo que prohibe `feedback_calibrate_gates_to_gold_standard`.

## Paso 4. Guarda

El mismo comando sin `--dry`. Es el UNICO camino a la base: cualquier otro
script que escriba contenido de `JourneyStory` lo bloquea un hook.

## Paso 5. Cierra el tema (esto es lo que sustituye a decir "listo")

```
npx tsx scripts/cierraTema.ts <journeyId> <tema>
```

Corre todas las comprobaciones aplicables al tema y, solo si TODAS pasan,
escribe la entrada en `scripts/tema-cierres.json` con el hash de las tres
historias. Lo que sigue de ese comando:

- **"listo" es lo que dice el registro**, no lo que dices tu. Si el cierre no
  se escribio, el tema no esta cerrado; di que fallo y que falta.
- Lo que el cierre lista como **pendiente de conjunto** (fijos, distribucion,
  escalera) no esta aprobado: esta esperando a que el journey este completo.
  Dilo con esas palabras; no lo escondas en un "todo verde".
- El tema N+1 no se puede guardar sin el cierre de N. Si `saveStory` te para,
  no busques la vuelta: te esta diciendo que el tema anterior nunca se cerro,
  o que su texto cambio despues de cerrarse.

## Paso 6. Informe

Tabla del journey con su generador canonico (`/tabla`), y las dos lineas de
siempre: `verified:` lo que corrio de verdad y `not verified:` lo que no se
midio. El audio NO entra aqui: va al final del journey y por su propia puerta
(`/audio-tema`).
