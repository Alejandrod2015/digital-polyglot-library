# Plan de reescritura FR France A1 Friends

Fecha: 2026-09-12.

Alcance: journey `cmtwz1iop000l32jybeo2jg4x`, draft.

Objetivo: rehacer el journey para que el perfil Friends sea la fuerza principal. El viaje debe tratar situaciones sociales con amigos, posibles citas y pequenas tensiones de grupo, no instalacion ni vida de expatriados. Se intentan conservar slugs, titulos y portadas existentes.

## Principio editorial

Amélie no aprende a vivir en Paris como extranjera. Amélie aprende a ocupar un lugar propio en un grupo de amigos en Paris. Marc sigue como amigo cercano, pero deja de ser traductor social. Los objetos practicos de las portadas se reinterpretan como objetos sociales: invitaciones, notas, listas compartidas, llaves prestadas, tazas, mesas, tarjetas y ropa para salir.

## Reparto

Se conservan los personajes franceses ya creados, pero se corrigen funciones para que no suenen Expat.

- Amélie Moreau: protagonista. Encargada de libreria. Quiere participar mas en la vida social de su grupo sin que Marc decida por ella.
- Marc Dubois: amigo cercano. Tecnico de sonido. Acompana a Amélie, pero aprende a no hablar por ella.
- Nadine Bernard: amiga organizada del grupo. Coordina listas, invitaciones y pequenos planes.
- Camille Robert: amiga anfitriona. Su casa es espacio de cuidado, comida y conversaciones delicadas.
- Olivier Garnier: amigo puntual y organizador de planes. Sirve para trabajar horarios sin volverlo administrativo.
- Inès Caron: amiga nueva en el circulo. Refleja pertenencia social, no llegada a un pais.
- Mathieu Lefèvre: amigo de amigos, con posible tension romantica leve. Sirve para invitaciones y limites.
- Sophie Petit: amiga tranquila del grupo. Sirve para confianza, dudas y reparacion.
- Baptiste Renault: amigo que conecta circulos. Presenta gente, mesas y planes sin hacerlo laboral.

## Nuevos temas narrativos

Los nombres visibles y los slugs cambian para que la estructura tambien suene a Friends. Los slugs derivan del label y reemplazan los anteriores en `Journey.topics` y `JourneyStory.topic`.

| # | Tema nuevo | Slug nuevo | Dominio | Intencion | Portadas |
|---|---|---|---|---|---|
| 1 | Group Notes & Plans | `group-notes-and-plans` | notas, invitaciones y mensajes de grupo | Los "papeles" son listas sociales. Amélie empieza a escribir directamente al grupo, no a traves de Marc. | Reutilizables: papel azul, dossier, linea corregida. |
| 2 | Hosting & Care | `hosting-and-care` | hospitalidad entre amigas | Camille cuida a Amélie en casa, pero ambas negocian comodidad, gratitud y espacio. | Reutilizables: casa, taza, llave. |
| 3 | Plans & Timing | `plans-and-timing` | planes, llamadas y puntualidad afectiva | Los horarios importan porque afectan a cenas, citas y promesas de grupo. | Reutilizables: martes, llamada, regreso. |
| 4 | Seats & Tables | `seats-and-tables` | pertenecer a una mesa y a un grupo | El hall, la silla y la tarjeta son pruebas pequenas de ser incluida. | Reutilizables: hall, silla, tarjeta. |
| 5 | Invites & Boundaries | `invites-and-boundaries` | invitaciones, limites y posible cita | Amélie aprende a decir si, no y "quizas" sin quedar atrapada por el deseo de agradar. | Reutilizables: fiesta, te, pantalon negro. |
| 6 | Trust & Doubts | `trust-and-doubts` | reparar confianza entre amigos | Cuaderno, diez minutos y tarjeta sirven para aclarar malentendidos pequenos. | Reutilizables: cuaderno, espera breve, tarjeta. |
| 7 | Circles & Introductions | `circles-and-introductions` | entrar en un circulo social propio | Amélie se presenta, se sienta lejos de Marc y propone un plan suyo. | Reutilizables: circulo, mesa, miercoles. |

## Reescritura por historia

### Tema 1: Group Notes & Plans

- `le-papier-bleu`: el papel azul es una nota para organizar un cumpleanos sorpresa. Marc quiere corregirla. Amélie decide enviarla ella.
- `le-dossier-gros`: el dossier grande contiene ideas de regalo, alergias, horarios y nombres. Nadine lo hace demasiado serio. Amélie lo vuelve calido.
- `la-ligne-corrigee`: la linea corregida no es un tramite, sino una frase de invitacion. Cambiar una palabra cambia quien se siente incluido.

### Tema 2: Hosting & Care

- `chez-camille`: Amélie pasa por casa de Camille antes de una cena. No es alojamiento funcional, es cuidado de amiga.
- `la-tasse-prete`: la taza preparada abre una conversacion sobre pedir ayuda sin sentirse deuda.
- `la-clef-dedans`: la llave queda dentro durante un plan. El conflicto no es logistica, sino confianza y risa compartida.

### Tema 3: Plans & Timing

- `le-mardi-choisi`: el martes se elige para una cena donde Amélie quiere invitar a alguien sin pedir permiso a Marc.
- `l-appel-court`: una llamada corta confirma que un plan puede ser simple y honesto.
- `avant-le-retour`: antes del regreso de alguien del grupo, Amélie decide que mensaje mandar.

### Tema 4: Seats & Tables

- `la-boite-du-hall`: el hall del edificio es lugar de encuentro antes de salir juntos.
- `la-chaise-du-jeudi`: la silla en la mesa muestra si Amélie tiene lugar propio o solo acompana a Marc.
- `une-carte-calme`: una tarjeta con una frase pequena repara una incomodidad del grupo.

### Tema 5: Invites & Boundaries

- `une-fete-courte`: Amélie acepta una fiesta corta, con hora de salida clara.
- `un-the-possible`: el te con Mathieu puede ser cita o amistad. Amélie no necesita decidirlo todo de golpe.
- `le-pantalon-noir`: el pantalon negro es para salir, pero el verdadero limite es no vestirse para agradar a todos.

### Tema 6: Trust & Doubts

- `le-cahier-ouvert`: un cuaderno abierto revela una nota mal entendida. Sophie ayuda a aclararla.
- `dix-minutes`: diez minutos tarde parecen rechazo. En realidad, alguien preparo una sorpresa pequena.
- `la-carte-du-doute`: una tarjeta nombra una duda sin romper la amistad.

### Tema 7: Circles & Introductions

- `le-nom-du-cercle`: Baptiste pregunta como llamar al grupo. Amélie propone un nombre que no depende de Marc.
- `la-table-loin`: Amélie se sienta lejos de Marc y conversa por cuenta propia.
- `le-mercredi-ouvert`: el miercoles queda abierto porque Amélie propone el siguiente plan del grupo.

## Impacto tecnico

- Reescribir historias con `scripts/saveStory.ts`, siempre primero con `--dry`.
- Cerrar cada tema con `scripts/cierraTema.ts`.
- Regenerar o revisar glosas y practica despues de cambiar textos.
- No tocar audio ni portadas en esta fase.
- El audio de muestra ya creado para `le-papier-bleu` queda desactualizado si se cambia esa historia.
- Slugs de tema actualizados con `scripts/_renameFrA1FriendsTopics.ts`.

## Criterios de aceptacion

- Cada historia tiene conflicto social principal.
- Ninguna historia se apoya en extranjeria, tramites reales, integracion laboral o llegada a Francia como motor.
- Las portadas se conservan salvo que una historia quede incoherente con su imagen.
- El journey queda en draft.
- Cierre con `journeysTable.ts` despues de cada tema.

verified:
- Tabla actual revisada con `npx tsx scripts/journeysTable.ts --journey cmtwz1iop000l32jybeo2jg4x`: 21/21 historias, glosas, practica y portadas; 0/21 audio en DB.
- Plan de reescritura preparado sin tocar historias ni base de datos.
- Slugs y labels de tema actualizados en la base con `scripts/_renameFrA1FriendsTopics.ts --apply`.
- `journeysTable.ts` muestra los siete temas nuevos y mantiene 21/21 portadas.
- `npm run lint:no-emdash` limpio.

not verified:
- Aprobacion del usuario para reescribir el tema 1 con este enfoque.
- Coherencia visual exacta de cada portada, porque no se inspeccionaron las imagenes una por una.
