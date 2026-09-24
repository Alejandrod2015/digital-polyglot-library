# Cata de voz narradora: Friends ES Colombia A0

Journey `cmue7cgmf0007j8p6sh7f7xrh` (spanish, `a0`, variante `colombia`, estado
`draft`, 7 temas, 21 historias). **Id verificado contra la base**: no es el
Colombia C1 publicado, que es `cmrpm0tra000032vgxcs33wrb`.

## Estado medido (lectura de la base, sin escrituras)

| Dato | Valor |
| --- | --- |
| Historias | 21 |
| Historias con `audioUrl` | 0 |
| `voiceId` distintos en las 21 | ninguno (todas `null`) |
| `practiceVoiceId` distintos | ninguno (todas `null`) |

Por eso la columna "Voz narrador" sale vacia en la tabla canonica: el journey
no tiene narrador asignado, y eso es lo que frena la fase de audio.

## Referencia: que usa el Colombia C1 publicado

| Papel | Voz | voiceId | Acento declarado |
| --- | --- | --- | --- |
| Narrador | Narrator CO - Hernando | `yHD4CsKkghm19ToGLJEC` | colombian |
| Practica | Narrator LATAM - Jhenny Fluida | `FXGrCtY3PEyfqczBAlqm` | latin american |

Las dos estan en la lista de voces aprobadas del proyecto. Jhenny es LATAM
generica, no colombiana: sirve como precedente, pero no cumple "la voz de
practica sigue al pais" si se mira con lupa.

## Candidatas (maximo 3)

Formato narrador, historias cortas de barrio en Pereira, reparto de ocho. Se
busca calida y clara, que lea despacio sin sonar a leccion y que no aspire las
eses (por eso queda fuera todo lo costeño; Bogota y el eje cafetero conservan
la /s/).

| # | Nombre | voiceId | De donde sale | Por que encaja | Aprobada | Escuchar |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Narrator CO - Hernando | `yHD4CsKkghm19ToGLJEC` | Ya en la lista aprobada; narra las 21 del Friends CO C1 | Colombiano, cadencia pausada, cero friccion: no hay que aprobar nada ni buscar mas. Su registro es de documental (`informative_educational`, "deep", "commanding"), asi que el riesgo es que un A0 de barrio suene solemne | SI | [preview](https://storage.googleapis.com/eleven-public-prod/database/workspace/1da06ea679a54975ad96a2221fe6530d/voices/yHD4CsKkghm19ToGLJEC/d6LGDFlcj6SPuVkktOBC.mp3) |
| 2 | Carlos - Colombian Spanish Narrator | `Y4HwpMNrBWN5dFKi5Lw8` | Shared library, `accent=colombian`, `use_case=narrative_story` | Se describe como calida, clara y de acento colombiano neutro, pensada justo para material educativo y audiolibro. Masculina, mediana edad, "calm". Es la que mejor describe lo que pide un A0: contar despacio sin dar clase. Uso acumulado alto (5,8 M caracteres), o sea voz rodada | NO | [preview](https://storage.googleapis.com/eleven-public-prod/database/workspace/d0d1b442f20244199bcdca89cf1e24a6/voices/Y4HwpMNrBWN5dFKi5Lw8/hXCjR5AkTl9lpYFX8Vrl.mp3) |
| 3 | Carito - Conversational | `J8BF9c7OgbHiqagCNoEj` | Shared library, `accent=colombian`, `use_case=narrative_story` | Femenina joven de Bogota, "gentle", narracion intima y cercana. Aporta lo que Hernando no tiene: cercania de vecina, no de documental. Ademas diferencia el A0 del C1, que ya suena con voz masculina grave | NO | [preview](https://storage.googleapis.com/eleven-public-prod/database/workspace/7051166418d24423aa9fe28a9a22f164/voices/J8BF9c7OgbHiqagCNoEj/fsornKBBO1RfX88eZaaj.mp3) |

Los tres enlaces son las URL de preview **gratis** del shared library
(`GET /v1/shared-voices` y `GET /v1/voices/{id}`). No se sintetizo ni una linea.

## Lo que este chat NO hizo, a proposito

- No se añadio ninguna voz a la lista de voces aprobadas. Las candidatas 2 y 3
  **no estan aprobadas**; solo las añade el usuario con su frase de aprobacion.
- No se escribio `voiceId` ni `practiceVoiceId` en ninguna historia.
- No se genero audio de ningun tipo.

## Voz de practica

Queda fuera de este encargo, pero apuntado para no perderlo: si el usuario
escoge la candidata 3, Carito puede cubrir tambien la practica y el journey
quedaria con voz colombiana en las dos ranuras, que es lo que pide la regla de
"la voz sigue al pais". Si escoge 1 o 2, la practica sigue sin voz colombiana
asignada y hace falta una cata aparte.
