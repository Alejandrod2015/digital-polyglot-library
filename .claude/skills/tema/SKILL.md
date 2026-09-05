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

## Paso 2. El PLAN del tema, antes de la primera linea de prosa

Se escribe ANTES de escribir, se le ENSEÑA al usuario, y se guarda en un JSON
que despues pide el cierre. Seis campos del tema y cuatro por historia; ninguno
puede quedar vacio:

```json
{
  "tipo": "Traveler", "nivel": "a2", "variante": "LATAM",
  "registro": "como suena el tema, en una linea",
  "espina": "el hilo que atraviesa el journey y pasa por este tema",
  "historias": [
    { "slot": "1", "quiere": "", "impide": "", "cuesta": "", "cambia": "" },
    { "slot": "2", "quiere": "", "impide": "", "cuesta": "", "cambia": "" },
    { "slot": "3", "quiere": "", "impide": "", "cuesta": "", "cambia": "" }
  ]
}
```

`cuesta` es lo que el personaje PIERDE y no recupera. Sin coste no hay arco,
hay temario. `registro` se declara aqui para poder variarlo entre temas: el
cierre compara el tuyo con el de los dos temas anteriores del journey.

El plan se enseña al usuario y se espera su visto bueno. Escribir prosa antes
de eso es lo que este paso viene a impedir: corregir el deseo de una historia
cuesta una frase antes de escribirla y tres historias despues.

## Paso 3. Escribe las tres

Con el flujo que ya existe (`/generate-story`), en un unico fichero JSON con
las tres historias del topic: el validador canonico compara cada una contra sus
hermanas de la misma tanda, asi que separarlas se salta la comprobacion de
solape dentro del tema.

## Paso 4. Valida en seco, y arregla la historia (nunca el gate)

```
npx tsx scripts/saveStory.ts <data.json> --journey <id> --lang ES --level a2 --variant LATAM --dry
```

Un fallo se arregla en el texto. Bajar un umbral para que pase es exactamente
lo que prohibe `feedback_calibrate_gates_to_gold_standard`.

## Paso 5. Guarda

El mismo comando sin `--dry`. Es el UNICO camino a la base: cualquier otro
script que escriba contenido de `JourneyStory` lo bloquea un hook.

## Paso 6. Cierra el tema (esto es lo que sustituye a decir "listo")

```
npx tsx scripts/cierraTema.ts <journeyId> <tema> --plan <plan.json>
```

Corre todas las comprobaciones aplicables al tema y, solo si TODAS pasan,
escribe la entrada en `scripts/tema-cierres.json` con el hash de las tres
historias. Lo que sigue de ese comando:

- **"listo" es lo que dice el registro**, no lo que dices tu. Si el cierre no
  se escribio, el tema no esta cerrado; di que fallo y que falta.
- Lo que el cierre lista como **pendiente de conjunto** (fijos, distribucion,
  escalera) no esta aprobado: esta esperando a que el journey este completo.
  Dilo con esas palabras; no lo escondas en un "todo verde".
- **Sin `--plan` no cierra.** El plan del paso 2 entra en el registro con el
  cierre; un campo vacio para el comando y dice cual falta.
- Los **avisos** del detector de tics (estructura clonada, densidad alta para el
  nivel, registro repetido tres temas seguidos) no bloquean y tampoco son
  "limpio": se leen y se dicen, que para eso se midieron.
- El tema N+1 no se puede guardar sin el cierre de N. Si `saveStory` te para,
  no busques la vuelta: te esta diciendo que el tema anterior nunca se cerro,
  o que su texto cambio despues de cerrarse.

## Paso 7. Informe

Tabla del journey con su generador canonico (`/tabla`), y las dos lineas de
siempre: `verified:` lo que corrio de verdad y `not verified:` lo que no se
midio. El audio NO entra aqui: va al final del journey y por su propia puerta
(`/audio-tema`).
