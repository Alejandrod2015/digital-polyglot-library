---
name: tabla
description: |
  La tabla de journeys, o la de un journey concreto. Usalo cuando el usuario diga "/tabla", "dame la tabla", "la tabla de journeys", "como va el journey X", "estado de los journeys", o pida cualquier cuadro de estado del catalogo. Ejecuta el generador canonico y pega SU salida; componer una tabla a mano esta prohibido.
---

# Tabla: un solo generador, y se pega su salida

Español neutro (tú, nunca vos).

## Por que existe este skill

Habia OCHO scripts de tabla de journeys en `scripts/` porque cada chat se
fabrico el suyo. Una tabla compuesta a mano es una tabla inventada: las cuentas
salen de la cabeza del chat y no de la base, y el usuario no tiene forma de
distinguirlas. Desde ahora hay un generador y solo uno.

## El comando

Todos los journeys (live + draft):

```
npx tsx scripts/journeysTable.ts
```

Un journey concreto, por temas y por historias:

```
npx tsx scripts/journeysTable.ts --journey <journeyId>
```

Archivados (SOLO si el usuario los pide con esa palabra):

```
npx tsx scripts/journeysTable.ts --archived
```

## Reglas de uso, y no son negociables

1. **Pega la salida tal cual.** No la resumas, no la reordenes, no la
   "traduzcas" a otro formato. Puedes añadir texto ANTES o DESPUES.
2. **Nunca compongas una tabla a mano**, ni "solo esta vez", ni porque el
   comando falle. Si el comando falla, lo que se reporta es el fallo.
3. **Falta una columna que el usuario pide?** Se amplia
   `scripts/journeysTable.ts` en un commit y se vuelve a correr. No se rellena
   a mano ni se pega desde otro sitio.
4. **Archivados fuera**, salvo que el usuario diga "archived" o "archivados".
   Es regla dura del proyecto: live + draft y nada mas.
5. Si un dato no se pudo medir, la tabla lo dice. No lo completes tu.

## Cuando el usuario pide otra cosa

Cuadros que no son la tabla de journeys (voces, glosas, practica) tienen sus
propios scripts. Busca el que existe antes de escribir uno nuevo; un script de
tabla mas es justo el problema que este skill vino a cerrar.
