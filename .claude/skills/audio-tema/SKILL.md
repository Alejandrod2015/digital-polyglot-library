---
name: audio-tema
description: |
  Narrar un tema en el orden que exige el proyecto (muestra, primera entera, resto). Usalo cuando el usuario pida narrar, generar el audio de un tema o de una historia, o cuando vaya a tocar cualquier sintesis de ElevenLabs de un journey. No genera nada por su cuenta: recuerda el orden, comprueba lo que hay y para en seco si falta un paso.
---

# Audio de un tema: el orden, y quien lo hace cumplir

Español neutro (tú, nunca vos).

Esto es una envoltura fina sobre gates que YA existen. No los reimplementa y no
los rodea. Si un gate te para, la respuesta es hacer el paso que falta.

## Antes de nada: dos condiciones que no dependen de ti

1. **El verbo del usuario.** El gate 4 de `.claude/safety/pre-bash-guard.sh` lee
   el ULTIMO mensaje del usuario y bloquea toda sintesis si no dice "genera
   audio", "lanza audio", "haz el audio" o una de sus hermanas. Un "dale" o un
   "sí" no abren esa puerta. Sin el verbo no se narra, y tampoco se propone.
2. **El texto cerrado antes que el audio.** El karaoke pinta desde una COPIA del
   texto guardada al alinear: editar los parrafos despues de narrar no cambia
   nada en pantalla. Primero el tema cerrado (`/tema`, paso 5), despues el mp3.

## Carga las reglas del dominio

```
npx tsx scripts/rulesFor.ts audio
```

## El orden, que es de tres pasos y con parada entre cada uno

1. **Muestra**: titulo y primer parrafo de la PRIMERA historia del tema.
   Queda registrada, y sin ese registro el narrador entero no arranca.
2. **La primera entera**, solo cuando el usuario aprueba la muestra.
3. **Las otras dos**, solo cuando aprueba la primera.

El runner del journey se para solo en cada uno de esos puntos y escupe el
comando que falta. Cuando lo haga, pega su mensaje y espera: no busques otro
script que no tenga la parada.

## Lo que NUNCA se hace aqui

- **Regenerar audio completo para PROBAR algo.** Para oir un detalle se
  sintetiza UNA linea de muestra. Sugerir "regenera la historia entera para oir
  X" esta prohibido; el guard 6d bloquea los scripts de audio completo sin el
  opt-in consciente.
- **Narrar con una voz que no este en `src/lib/approvedVoices.ts`.** El runtime
  tira, y añadir una voz a la lista exige la frase de aprobacion del usuario.
- **Anunciar audio nuevo** en ningun correo sin la comprobacion de veracidad
  (gate 6g): web, iOS y Android, las tres, con build de tienda.

## Al terminar

`verified:` que se narro y con que voz; `not verified:` lo que no se escucho
entero. El audio no se entrega como mp3 suelto: se oye dentro de la historia.
