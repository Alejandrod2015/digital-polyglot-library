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

| Journey | Ciudad marco | Veredicto | Hist. con el nombre |
|---|---|---|---|
| Friends ES colombia A0 (draft) | Pereira | NO | 3/21 (+ los 21 prompts de portada, dato del encargo) |
| Traveler ES spain A1 (live) | Nerja (pueblo de la costa de Málaga) | NO | Nerja 1/21, Málaga 2/21 |
| Traveler ES spain A2 (live) | Nerja (mismo reparto y pueblo) | NO | Nerja 1/21, Málaga 3/21 |
| Traveler ES spain B2 (live) | Vitoria (Vitoria-Gasteiz) | NO | 5/21 |
| Expat FR france A1 (draft) | Clermont-Ferrand | NO | 4/21 (+ 2/21 con el nombre completo) |
| Friends FR france A2 (live) | Nantes | NO | 8/21 |

### Cumplen (certezas)

| Journey | Ciudad marco | Hist. con el nombre |
|---|---|---|
| Friends FR france A1 (live) | Paris | 8/21 |
| Expat DE germany C1 (live) | Berlin | 8/21 |
| Expat DE germany C1 (draft, Hamburgo) | Hamburg | 3/21 |
| Traveler ES spain B1 (live) | Madrid | 3/21 |
| Friends ES mexico A0 (draft) | Guadalajara | 2/21 |
| Friends IT italy A1 (draft) | Milán | Milano 1/21; "via Padova" (calle de Milán) 4/21 |
| Traveler KO korea A0 (draft) | Seúl | 1/1 escrita |
| Traveler PL poland A0 (draft) | Kraków | 1/1 escrita |
| Traveler AR egypt A0 (draft) | El Cairo | 1/1 escrita |

### Dudosos (no decido a ojo)

| Journey | Ciudad | Qué me hace dudar | Hist. |
|---|---|---|---|
| Friends FR france A0 (live) | Marseille | La memoria la fija en Le Panier (Marsella), pero el texto nombra Paris en 11 historias y Marseille en 2, porque el hilo es que Hugo se muda a Paris. La ciudad marco casi no se dice | Marseille 2/21, Paris 11/21 |
| Friends FR france B1 (live) | Lille | Lille es frontera: la conoce quien sigue fútbol o ha cruzado a Bélgica, no el lector medio. Además el arranque está en Roubaix | Lille 2/21, Roubaix 2/21 |
| Friends DE germany A2 (draft) | Hannover o Münster | La memoria la llama "Friends DE A2 (Hannover)"; el texto nombra Münster en 4 historias y Hannover en 2. Ninguna de las dos es reconocible fuera | Münster 4/21, Hannover 2/21 |
| Friends DE germany A1 (live) | Frankfurt o Rostock | La memoria la llama "(Frankfurt)"; el texto nombra Rostock en 11 y Frankfurt en 5. Frankfurt cumple, Rostock no: la discrepancia decide el veredicto | Rostock 11/21, Frankfurt 5/21 |
| Friends DE germany A0 (live) | Bremen o München | La memoria la llama "(Bremen)"; el texto nombra München en 7 y Bremen en 4 | München 7/21, Bremen 4/21 |
| Friends IT italy A0 (live) | Genova | Genoa se reconoce como puerto y como equipo, pero no está en la lista corta de ciudades italianas de un anglosajón | Genova 4/21 + "Genoa" 2/21 |
| Friends ES spain A2 (live) | Salamanca | Muy conocida por quien ha estudiado español (es destino clásico de estudiantes), casi nada fuera de ese grupo. El target es el estudiante, así que puede ser la excepción | 2/21 |
| Friends ES spain B1 (draft, 12/21) | Santiago de Compostela | Se conoce por el Camino, no por la ciudad. Depende de si "conocida por el Camino" cuenta | 1/21 |
| Friends ES chile A1 (draft) | Valparaíso | La memoria la fija en Valparaíso (cerro Cordillera) y el texto casi no la nombra. Fuera de Chile se conoce menos que Santiago | Valparaíso 1/21, Santiago 1/21 |
| Friends ES argentina A1 (draft) | Córdoba o Buenos Aires | El texto nombra Córdoba en 4 historias, pero las calles son porteñas (Warnes, Aráoz, Corrientes). No sé cuál es el marco | Córdoba 4/21 |
| Friends PT brazil A1 (draft) | Brasília | Se reconoce como capital y por su arquitectura, pero no es destino conocido; el texto la nombra una vez y vive en "308 Norte" y el Eixão | Brasília 1/21 |
| Traveler DE germany A0 (draft) | Leipzig (con Heidelberg de segunda) | Los siete temas son paisajes, no ciudades, pero el texto se ancla en Leipzig en 9 historias. Ni el marco ni el reparto de ciudades están declarados en ningún sitio | Leipzig 9/21, Heidelberg 4/21 |

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

### Sin ciudad, por diseño

| Journey | Nota |
|---|---|
| Friends ES latam A1 (draft) | Decisión explícita: sin ciudad ni país, lugares por tipo (ver `project_journey_es_a1_friends_latam_neutral`). La regla no le aplica |
| Conversations ES latam A0 (draft) | Terraza, balcón, escalera. Ninguna ciudad en las 21 |
| Friends ES latam C1 (live) | Un apartamento y el parche; solo menciones sueltas (Oaxaca 1/21, Lima 1/21) |

## Resumen

- 50 journeys live + draft.
- 6 incumplen con certeza (una de ellas, el Friends ES colombia A0, ya estaba
  identificada y su arreglo va en otro encargo).
- 9 cumplen con certeza.
- 12 dudosos, la mayoría por discrepancia entre la memoria y el texto.
- 20 multiciudad y 3 sin ciudad: ahí la regla no se decide journey a journey.

## Dónde debería vivir el gate (propuesta, sin implementar)

1. En el paso que fija los TEMAS, no en el validador de historias: la ciudad se
   elige antes del primer tema, y `assertTopicsGrounded`
   (`src/lib/topicEvidence.ts`) ya es la única puerta obligatoria de ese
   momento, con su hook `.claude/safety/pre-topic-guard.sh`.
2. La forma barata: que el journey DECLARE su ciudad (hoy no hay campo; solo se
   deduce del texto, que es justo lo que ha hecho cara esta auditoría) y que
   `assertTopicsGrounded` exija esa ciudad contra una lista commiteada de
   ciudades aprobadas por idioma, tirando si no está y pidiendo el sí del
   usuario para añadir una nueva, igual que la allowlist de voces.
3. El validador de historias NO sirve: cuando una historia llega ahí, la ciudad
   ya está pagada en 21 briefs y en los prompts de portada, y el arreglo cuesta
   un journey entero en vez de una línea.

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
- La ciudad marco de los journeys donde memoria y texto discrepan (Friends DE
  A0, A1 y A2, Friends FR A0). Hace falta que lo confirme quien los escribió.
- No se tocó contenido de ningún journey, no se generó nada y no se
  implementó ningún gate.
