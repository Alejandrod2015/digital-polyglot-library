# Traveler · spanish/latam · A1 (journey cmt5vxwgd0007324oesy195k8, draft)

REHECHO el 2026-08-24. La version anterior partia de una premisa inventada:
Ana como "guia de la Ciudad de Mexico" que recorria cuatro paises. En el A0 Ana
NO es mexicana ni es guia; es una visitante cuyo pais no se nombra nunca
("Ana mira el menu, pero no comprende mucho", "¿por que no hay horchata en mi
pais?"). Y el A0 no tiene protagonista: son siete arcos independientes.

## La forma del A0, leida de la base (no supuesta)

| tema | lugar | elenco | protagonista |
|---|---|---|---|
| food-everyday-life | Ciudad de Mexico | Ana, la señora del mercado, Carla | Ana, visitante sin pais |
| home-family | Cartagena | Lucia, su mama, la abuela, el tio Jorge | Lucia, local |
| meeting-new-people | Buenos Aires | Pablo, Marta, Lucas, Sofia | Pablo, recien llegado sin pais |
| places-getting-around | Cusco | Elena, Julio | Elena, turista sin pais |
| community-celebrations | Barranquilla | Camilo, su mama, su abuelo | Camilo, local |
| legends-folklore | Oaxaca | Mateo, la tia Rosa | Mateo, local |
| nature-adventure | Patagonia, Chile | Valentina, su papa | Valentina |

Reglas que salen de ahi y que el A1 hereda:
- Un sitio por tema. Nadie cruza de tema.
- A quien viene de fuera no se le nombra el pais: es "turista" y dice "mi pais".
- Cada tema es un arco de tres con un giro emocional, no tres estampas.

## Los siete temas del A1 (porton `assertTopicsGrounded`: OK)

| # | slug | label | lugar | elenco que continua | cita verbatim |
|---|---|---|---|---|---|
| 1 | night-buses | Night Buses | Cusco | Elena + Julio | "speak  Spanish when travelling" (Geraldine) |
| 2 | prices-and-change | Prices & Change | Ciudad de Mexico | Ana + la señora + Carla | "Conduct full business meetings in Spanish" (Christopher) |
| 3 | calls-and-messages | Calls & Messages | Cartagena | Lucia + su mama | "I want to have my own conversations with her" (Jaelyn) |
| 4 | help-and-repairs | Help & Repairs | Oaxaca | Mateo + la tia Rosa | "reached for or fixed" (Jaelyn) |
| 5 | names-for-things | Names for Things | Buenos Aires | Pablo + Marta + Lucas | "understand and use slang from Colombia" (Ty) |
| 6 | doors-and-neighbours | Doors & Neighbours | Barranquilla | Camilo + su mama | "I wish to talk to neighbours" (Vincent) |
| 7 | trails-and-weather | Trails & Weather | Patagonia | Valentina + su papa | "a different way to learn Spanish" (Earl) |

`doors-and-neighbours` y `trails-and-weather` son slugs NUEVOS: se crean con
`isUniversal: false`.

**La cita 7 es la mas floja de las siete y no lo escondo.** "A different way to
learn Spanish" respalda cualquier tema, que es justo lo que el porton existe
para impedir; pasa porque cumple el minimo de 3 palabras y 15 caracteres. En
las 31 frases escritas del corpus no hay ninguna que pida montaña, sendero ni
clima. Si el tema 7 se cae, se cae por ahi.

## Choque con la regla de edades

Cuatro elencos del A0 se apoyan en abuela, abuelo o tia, y desde el 2026-07-07
el contenido NUEVO no lleva ancianos ni niños. Al continuarlos: los jovenes
(Lucia, Camilo, Mateo) son adultos en activo, y los abuelos no reaparecen. La
tia Rosa se queda solo si se la escribe como adulta de 40-55, no como anciana.

## Elenco y espina, tema por tema

Nadie es nuevo: los siete elencos vienen del A0 y siguen en su sitio. Cada
ficha cita lo que el A0 dejo escrito, para no volver a inventar biografia.

**1 · Night Buses · Cusco · Elena + Julio**
A0: "Elena es turista en Cusco, Peru"; "Se llama Julio y vive en Cusco", chofer
de taxi, la lleva al mirador y le propone Machu Picchu.
A1: Elena sigue hacia el sur y el unico transporte es el bus de noche.
(1) comprar el pasaje y entender que incluye · (2) la noche a bordo, el frio,
las paradas · (3) llegar sola y agradecerle a Julio por telefono.

**2 · Prices & Change · Ciudad de Mexico · Ana + la señora del mercado + Carla**
A0: Ana no comprende el menu y aprende "picante"; "¿por que no hay horchata en
mi pais?"; en la tercera ya guia a su amiga Carla.
A1: Ana ya no teme el menu; ahora el problema es el dinero.
(1) el precio no esta escrito y hay que preguntarlo · (2) el vuelto sale mal y
hay que decirlo sin pelear · (3) Ana le enseña a Carla a preguntar antes de pagar.

**3 · Calls & Messages · Cartagena · Lucia + su mama (Jorge, por telefono)**
A0: la foto del tio Jorge, musico en Argentina; la llamada; "El proximo año,
visito Cartagena. Lo prometo."
A1: llega ese proximo año y hay que cuadrarlo por mensajes.
(1) Jorge manda una fecha · (2) la mama no contesta y Lucia media · (3) el viaje
queda confirmado, con hora y todo.

**4 · Help & Repairs · Oaxaca · Mateo + la tia Rosa**
A0: el alebrije que "cuida la casa"; Rosa lo movia cada noche; "la magia esta en
la historia, en la imaginacion".
A1: el alebrije se rompe.
(1) se cae y pierde una pata · (2) Mateo lo pega mal y queda peor · (3) Rosa le
enseña a repararlo de verdad, y el secreto pasa de nuevo.

**5 · Names for Things · Buenos Aires · Pablo + Marta + Lucas**
A0: Pablo recien llegado y timido; Marta es de Buenos Aires; el cumpleaños de
Lucas; "¿Ves? No sos timido".
A1: Pablo ya tiene amigos, pero sigue pidiendo mal.
(1) pide una cosa y le traen otra · (2) Marta le hace una lista de dos columnas ·
(3) Pablo corrige a otro recien llegado.

**6 · Doors & Neighbours · Barranquilla · Camilo + su mama**
A0: el Carnaval, el disfraz de plumas, "por unos dias, toda la ciudad es una
sola familia".
A1: pasado el Carnaval, el barrio de diario.
(1) llega un vecino nuevo · (2) hay que pedirle un favor · (3) la puerta que se
queda abierta.

**7 · Trails & Weather · Patagonia · Valentina + su papa**
A0: el sendero, la mochila pesada, el condor, la lluvia bajo la roca, el lago
azul; "la aventura no es llegar; la aventura es el camino".
A1: Valentina vuelve al mismo sendero y ahora lee ella el tiempo.
(1) el parte y lo que hay que llevar · (2) la tormenta que si llega · (3) la
cumbre, o darse la vuelta.

## Sin espina comun, a proposito

El A0 no tiene una y el A1 tampoco: son siete arcos independientes de tres. Es
lo que separa esta forma de la version anterior, que colgaba las 21 de una sola
protagonista que viajaba. Choca con la tabla de `project_journey_structure_plan`
(Traveler: 2 personajes fijos), pero esa tabla dice de si misma que "no describe
lo que existe"; el A0 manda porque es lo que el alumno acaba de leer.

## Lo que queda por rehacer

Las 21 historias, enteras. El vocabulario (420 plazas) esta validado y sin
solape, pero esta pegado a las escenas viejas, asi que hay que re-encajarlo
escena a escena.
