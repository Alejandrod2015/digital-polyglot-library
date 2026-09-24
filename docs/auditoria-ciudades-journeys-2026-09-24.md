# Auditoria de ciudades de journey (2026-09-24)

## La regla

Puesta por el usuario el 2026-09-24, literal: "Las ciudades de los journeys
tienen que ser ciudades muy conocidas fuera de esos países, principalmente por
nuestro grupo objetivo, anglosajones."

Regla DURA. Afecta a la **ciudad que enmarca** el journey (la que sale en la
tienda, en la portada y en el arranque de las historias), no a los barrios ni a
los sitios concretos de dentro, que siguen siendo pequeños y específicos. Se
decide ANTES de fijar los siete temas.

Fila del inventario: `journey-city-known-abroad` en `docs/rules-inventory.json`,
gate declarado `process` (hoy no lo comprueba ningún código; ver la propuesta al
final).

## Cómo se midió

Tres pasadas sobre la base, live + draft, 50 journeys (archivados fuera):

1. `scripts/_ciudadesAudit.ts`: nombres propios repetidos por journey, sin el
   reparto, para no partir de una lista inventada.
2. `scripts/_ciudadesAudit2.ts`: cuántas de las 21 historias nombran cada
   ciudad de un listado por idioma. Ese número es la columna "hist.".
3. `scripts/_ciudadesAudit3.ts` y `_ciudadesAudit4.ts`: sinopsis y primer
   párrafo de la primera historia escrita, y frases de sitio ("en X", "pueblo
   de..."), para distinguir la ciudad marco de las que solo se mencionan.

La memoria del proyecto (fichas `project_journey_*`) se usó solo para
contrastar. Donde memoria y texto no coinciden, la fila va como **dudoso**.

## Veredictos

`SÍ` = reconocible por un anglosajón fuera del país. `NO` = no lo es.
`multiciudad` = el journey no tiene una sola ciudad marco (los siete temas son
siete sitios); ahí la regla se aplica ciudad a ciudad.
`sin ciudad` = no hay ciudad, por diseño.

### Incumplen (certezas)

| Journey | Ciudad marco | Hist. con el nombre |
|---|---|---|
| Friends ES colombia A0 (draft) | Pereira | 3/21 (+ los 21 prompts de portada, dato del encargo) |
| Traveler ES spain A1 (live) | Nerja (pueblo de la costa de Malaga) | Nerja 1/21, Malaga 2/21 |
| Traveler ES spain A2 (live) | Nerja (mismo reparto y pueblo) | Nerja 1/21, Malaga 3/21 |
| Traveler ES spain B2 (live) | Vitoria (Vitoria-Gasteiz) | 5/21 |
| Expat FR france A1 (draft) | Clermont-Ferrand | 4/21 |
| Friends FR france A2 (live) | Nantes | 8/21 |
| Friends FR france B1 (live) | Lille | Lille 2/21, Roubaix 2/21 |
| Friends DE germany A0 (live) | Bremen | Bremen 4/21, Munchen 7/21 |
| Friends DE germany A2 (draft) | Hannover | Hannover 2/21, Munster 4/21 |
| Friends IT italy A0 (live) | Genova | 4/21 (+ "Genoa" 2/21) |
| Friends ES spain A2 (live) | Salamanca | 2/21 |
| Friends ES chile A1 (draft) | Valparaiso | 1/21 |

### Cumplen (certezas)

| Journey | Ciudad marco | Hist. con el nombre |
|---|---|---|
| Friends FR france A1 (live) | Paris | 8/21 |
| Friends FR france A0 (live) | Marseille | Marseille 2/21, Paris 11/21 |
| Expat DE germany C1 (live) | Berlin | 8/21 |
| Expat DE germany C1 (draft, Hamburgo) | Hamburg | 3/21 |
| Friends DE germany A1 (live) | Frankfurt | Frankfurt 5/21, Rostock 10/21 |
| Traveler ES spain B1 (live) | Madrid | 3/21 |
| Friends ES spain B1 (draft, 12/21) | Santiago de Compostela | 1/21 |
| Friends ES argentina A1 (draft) | Buenos Aires, NUNCA nombrada | 0/21 (Villa Crespo, Warnes, Araoz, Corrientes) |
| Friends ES mexico A0 (draft) | Guadalajara | 2/21 |
| Friends PT brazil A1 (draft) | Brasilia | 1/21 |
| Friends IT italy A1 (draft) | Milan | Milano 1/21; "via Padova" (calle de Milan) 4/21 |
| Traveler KO korea A0 (draft) | Seul | 1/1 escrita |
| Traveler PL poland A0 (draft) | Krakow | 1/1 escrita |
| Traveler AR egypt A0 (draft) | El Cairo | 1/1 escrita |

### Como se cerraron los 12 dudosos (2026-09-24, segunda pasada)

Los cuatro de discrepancia memoria/texto se resolvieron **con el texto**, que es
lo que lee el usuario. En los cuatro, la ciudad "en conflicto" resulto ser el
ORIGEN o el DESTINO del hilo conductor, nunca el escenario. Medido frase a
frase con `scripts/_ciudadesAudit5.ts`, que imprime cada oracion donde sale cada
candidata:

| Journey | Ciudad marco | Por que, con el texto delante | La memoria |
|---|---|---|---|
| Friends DE A0 | **Bremen** | "Anna is back in Bremen after eight years", "eine Grafikerin aus Bremen", "Vier Freunde wohnen noch in Bremen". Munchen (7/21) es el trabajo viejo al que puede volver: es el dilema del journey, no el sitio | coincide |
| Friends DE A1 | **Frankfurt** | "Julia is new in Frankfurt", "sitzt am Abend auf der Treppe in Frankfurt", "Heute gehore ich nach Frankfurt". Rostock (10/21) es de donde viene: sale siempre en videollamada, en un tren o en cajas sin abrir | coincide |
| Friends DE A2 | **Hannover** | "the same tiny flat in Hannover", y el penalti "gegen Hannover". Munster (4/21) es el trabajo y el sofa que dejo atras | coincide |
| Friends FR A0 | **Marseille** | "Lea est une jeune femme de Marseille", el cafe y la pista de petanca del Panier. Paris (11/21) es adonde se muda Hugo en marzo, la espina del journey | coincide |

Los otros ocho, resueltos sin preguntar a nadie:

| Journey | Cierre | Razon |
|---|---|---|
| Friends FR B1 | Lille, **NO** | El marco es Lille (Vieux-Lille, el barrio de Fives); Roubaix es la casa del hermano. Lille no esta en la lista corta francesa de un anglosajon (Paris, Nice, Marseille, Lyon, Bordeaux) |
| Friends IT A0 | Genova, **NO** | El nombre suena (Colon, el equipo), pero no se coloca en el mapa: las italianas reconocibles son Roma, Venecia, Florencia, Milan, Napoli, Pisa |
| Friends ES spain A2 | Salamanca, **NO** | La conoce quien ha estudiado espanol ahi, que es un subconjunto del target, no el target. Fuera de ese grupo no dice nada |
| Friends ES spain B1 | Santiago de Compostela, **SI** | Es la unica de las dudosas que llega al anglosajon por una via mainstream y no academica: el Camino de Santiago tiene libros y peliculas en ingles, y la ciudad da nombre a la ruta |
| Friends ES chile A1 | Valparaiso, **NO** | De Chile viaja el nombre del pais y Santiago. Valparaiso es patrimonio y destino de viajero informado, no de lector medio |
| Friends ES argentina A1 | Buenos Aires, **SI**, pero nunca nombrada | El marco son Villa Crespo, Warnes, Araoz y Corrientes, todo Buenos Aires. Cordoba (4/21) es adonde se va Damian. La ciudad cumple la regla y el lector no puede saberlo: no aparece escrita ni una vez en las 21 |
| Friends PT brazil A1 | Brasilia, **SI** | Capital de Brasil: un anglosajon la coloca en el pais aunque no sepa nada mas. Que no sea destino turistico no es lo que mide la regla |
| Traveler DE A0 | **multiciudad**, no dudoso | Los siete temas son paisajes y el journey es una gira (Dresden, Heidelberg, Triberg, costa, lago, montana). Leipzig (9/21) es la casa y la escuela de Hannah, el ancla del hilo, no el escenario de las escenas |

Ninguno de los doce quedo sin resolver.

### Multiciudad (la regla se aplica ciudad a ciudad)

Los siete temas son siete sitios; no hay una ciudad marco que cambiar, y el
coste de arreglar uno es el de un tema, no el del journey.

| Journey | Sitios (de `topics` o del texto) | Cuáles chirrían |
|---|---|---|
| Friends DE germany C1 (live) | berlin, hamburg, koeln, muenchen, dortmund, leipzig, stuttgart | Dortmund, Leipzig, Stuttgart |
| Traveler DE germany A1 (draft) | Nürnberg, Hamburg, München, Köln, Leipzig, Heidelberg, Freiburg | Nürnberg, Leipzig, Freiburg |
| Traveler IT italy A1 (live) | Roma, Firenze, Napoli, Bologna, Palermo | Bologna, Palermo |
| Traveler IT italy A2 (draft) | Torino, Palermo, Roma, Verona, Padova | Torino, Padova |
| Friends ES spain A1 (live) | madrid, barcelona, sevilla, valencia, bilbao, granada, san-sebastian | San Sebastián (dudoso) |
| Friends ES colombia C1 (live) | bogota, medellin, cali, barranquilla, cartagena, bucaramanga, villavicencio | Bucaramanga, Villavicencio, Barranquilla |
| Friends ES argentina C1 (draft) | buenos-aires, cordoba, rosario, mendoza, bariloche, salta, mar-del-plata | Rosario, Salta, Mar del Plata |
| Friends ES mexico C1 (draft) | Oaxaca/Tlacolula, monterrey, veracruz, tijuana y tres de comida/fiesta | Veracruz, Tlacolula |
| Traveler ES mexico A1 (live) | Oaxaca, Puebla, Tulum, Guanajuato, Mérida | Guanajuato, Mérida (dudosos) |
| Traveler PT brazil A0 (draft) | rio-de-janeiro, belo-horizonte, fortaleza, porto-alegre, natal, sao-luis, bonito | todos menos Rio |
| Traveler PT brazil A1 (live) | Paraty, Salvador, Niterói | Paraty, Niterói |
| Traveler PT brazil A2 (live) | manaus, florianopolis, foz-do-iguacu, olinda, belem, pantanal, ouro-preto | todos menos Foz do Iguaçu |
| Traveler PT brazil B1 (live) | salvador, recife, jericoacoara, lencois-maranhenses, campo-grande, petropolis, gramado | todos menos Salvador |
| Traveler PT brazil B2 (draft) | sao-paulo, curitiba, serra-gaucha, paraty, chapada-diamantina, fernando-de-noronha, brasilia | todos menos São Paulo |
| Cultural ES latam A0 (draft) | Barranquilla, Medellín, Ciudad de México, Oaxaca, Lima, Cusco | Barranquilla |
| Traveler ES latam A0 (live) | Barranquilla, Cartagena, Buenos Aires, Ciudad de México, Cusco | Barranquilla |
| Traveler ES latam A1 (live) | Cartagena (Getsemaní), Buenos Aires, Barranquilla, Cusco | Barranquilla |
| Traveler ES latam A2 (live) | Medellín, Salvador, Buenos Aires, Rosario, Guadalajara, Mérida, puerto de Santa Rosa (Perú) | Santa Rosa, Rosario, Mérida |
| Traveler ES latam B1 (live) | Manizales, Mendoza, Lima y otros | Manizales |
| Traveler ES latam B2 (live) | San Telmo (Buenos Aires), Mendoza, Valparaíso, Cali, Guadalajara, Lima | Valparaíso, Cali |
| Traveler DE germany A0 (draft) | Dresden, Heidelberg, Triberg y paisajes; Leipzig como casa | Leipzig, Triberg |

### Sin ciudad, por diseño

| Journey | Nota |
|---|---|
| Friends ES latam A1 (draft) | Decisión explícita: sin ciudad ni país, lugares por tipo (ver `project_journey_es_a1_friends_latam_neutral`). La regla no le aplica |
| Conversations ES latam A0 (draft) | Terraza, balcón, escalera. Ninguna ciudad en las 21 |
| Friends ES latam C1 (live) | Un apartamento y el parche; solo menciones sueltas (Oaxaca 1/21, Lima 1/21) |

## Resumen

- 50 journeys live + draft.
- 12 incumplen con certeza (una de ellas, el Friends ES colombia A0, ya la está
  cambiando otro chat a Medellín).
- 14 cumplen con certeza.
- 0 dudosos: los 12 de la primera pasada se cerraron con el texto delante.
- 21 multiciudad y 3 sin ciudad: ahí la regla no se decide journey a journey.
- Tres de los que incumplen están publicados y narrados (Traveler ES spain A1 y
  A2, y Traveler ES spain B2; también Friends FR A2, B1, DE A0 e IT A0), así que
  cambiarles la ciudad se paga en resíntesis. **No se tocó ninguna.**

## El campo y el gate (hechos el 2026-09-24, en dos commits)

Lo caro de esta auditoría no fue medir: fue que **el dato no tenía sitio donde
vivir**. La ciudad marco existía repartida por 21 textos, por la memoria y por
los prompts de portada, y de ahí salieron las cuatro discrepancias. Así que
primero el campo, después el gate.

**`Journey.city` + `Journey.cityMode`** (`single` | `multi` | `none`). NULL es
"nadie lo ha rellenado" y es distinto de "no aplica": si los 21 de gira y los 3
sin ciudad se guardaran como NULL, la distinción se perdería en cuanto alguien
mirase la columna. Rellenos los 50 con lo medido, sin cambiar ninguna ciudad
(`scripts/aplicaCiudadJourney.ts`, idempotente y que NO pisa una ciudad que
alguien haya cambiado a propósito). `journeysTable.ts` lo enseña en una columna
nueva, así que la próxima auditoría es leer la tabla.

**El gate**, en `assertTopicsGrounded` (`src/lib/topicEvidence.ts`), que ya era
la única puerta obligatoria del momento en que se fijan los temas:

1. Tira si no se declara ciudad. Declararla es obligatorio incluso para decir
   "gira" o "sin ciudad": así "no aplica" es una decisión escrita, no un olvido.
2. Si es `single`, la comprueba contra `src/lib/approvedCities.ts`, la lista
   aprobada por idioma, al estilo de la allowlist de voces.
3. La ciudad se mira ANTES que los nombres de tema, porque si la ciudad está
   mal los siete temas sobran.

La lista se siembra con las ciudades de los journeys que YA cumplían, y con
nada más. Que falten Sevilla o Napoli no es un olvido: es que nadie las ha
aprobado. **La amplía el usuario**, no Claude.

Falta una pieza que no puedo poner yo: el hook `PreToolUse` que impida editar
`approvedCities.ts` sin una frase de aprobación del usuario, como el que
protege `approvedVoices.ts`. Es configuración del harness y la tiene que
aprobar el usuario. Hasta entonces, la lista se protege por convención, no por
gate.

## Estado de la comprobación

verified:
- 50 journeys live + draft leídos de la base (archivados excluidos en la
  consulta, no a mano).
- Conteo por journey de cuántas de las 21 historias nombran cada ciudad,
  reproducible con `npx tsx scripts/_ciudadesAudit2.ts`.
- Sinopsis y primer párrafo de la primera historia escrita de cada journey,
  leídos uno a uno.
- `npm run lint:rules-inventory` limpio tras añadir la fila a mano:
  349 filas, 194 con gate, 79 de proceso, 76 sin gate (el trinquete de `none`
  no sube).

not verified:
- Los prompts de portada. No están en el repo (salvo los ficheros de escenas de
  algún journey suelto), así que la columna "hist. con el nombre" mide SOLO el
  texto. El único dato de portadas de este informe, los 21 prompts con Pereira,
  viene del encargo, no de una medición mía.
- El veredicto "reconocible por un anglosajón" es mi juicio, no una medida. No
  hay lista aprobada ni dato de búsqueda detrás; por eso los dudosos van
  separados en vez de repartidos entre SÍ y NO.
- Que la memoria del proyecto quede corregida. Las fichas de Friends DE A0, A1
  y A2 y de Friends FR A0 coinciden con el texto, así que no había nada que
  corregir; la discrepancia estaba entre el texto y el conteo bruto de la
  primera pasada, que confundía el origen y el destino del hilo con el
  escenario. Lo que sí falta es que ninguna ficha declare la ciudad de los
  demás journeys.
- Que el Friends ES argentina A1 deba nombrar Buenos Aires. Es un hallazgo, no
  una decisión: la ciudad cumple la regla pero no se lee.
- No se tocó contenido de ningún journey, ni una ciudad, y no se generó nada.
  Lo escrito en `city`/`cityMode` es lo que YA era cierto hoy.
- El gate solo corre en journeys NUEVOS, al fijar los temas. No mide, ni
  bloquea, ni arregla los 12 que incumplen hoy; esos esperan a que el usuario
  decida, y tres de ellos están publicados y narrados.
- La lista aprobada no tiene hook que impida a Claude ampliarla por su cuenta.
  Hace falta que el usuario añada ese `PreToolUse`.
