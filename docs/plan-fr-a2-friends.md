# Friends FR/France A2: plan

Estado: **PLAN APROBADO** (2026-09-13, via Journey-planning), con los nombres de tema renombrados a nivel de dominio (ver 6bis). Hasta el tema 1 no
`dp_topics_v1`, ni una linea de prosa. Nada toca la base hasta el visto bueno.

## 0. Estado comprobado (2026-09-13)

| comprobacion | resultado |
|---|---|
| `journeysTable.ts`: Friends FR A2 | no existe |
| Friends FR A0 `cmtwo6cys0007j8yzg6ni3fsc` | LIVE, Marseille, Léa y Hugo |
| Friends FR A1 `cmtwz1iop000l32jybeo2jg4x` | LIVE, Paris, Amélie |
| Escalera (french, france, relationships) | A0 y A1 existen: un A2 queda contiguo |
| Porton de temas (`scripts/_frA2TopicProbe.ts`, solo lectura) | **PORTON OK**, modo journey-level, 2 personas |
| Labels y slugs propuestos en `dp_topics_v1` | ninguno existe; cero choques |

## 1. Forma

Tipo `relationships` (etiqueta "Friends"), 1 nivel x 7 temas x 3 historias = 21,
en draft.

- **Relationships es un journey de ESCUCHA**: el comprador tiene pareja o
  amigos franceses y quiere entender a esa gente cuando habla entre si. No es
  personaje.
- **2 fijos**: el protagonista en las 21, la otra fija en la mitad o mas
  (valen menciones).
- **1 personaje nuevo por tema**, presentado en la primera historia de su
  tema, y que NO vuelve a salir ni a nombrarse en otro tema (si se nombra fuera,
  pasa a fijo y rompe el tope de 2).
- **Tema 1 sin nuevos**: la primera historia del journey solo lleva a los fijos.
- Maximo 2 personajes hablando por historia. Solo adultos de 25 a 55 en activo;
  ni ninos ni adolescentes, tampoco de fondo.
- Estilo **narrador**, como el A0 y el A1 franceses: ~28-30% de habla citada,
  comillas curvas `“”`, guardado con `--narrator`.
- Cuerpo **128-155 palabras** (banda A2 de `bodyWordBand.ts`).
- Presentacion con las tres formas francesas alternadas (aposicion,
  s'appeler, con etre), ninguna en mas de la mitad del reparto.

## 2. Ciudad y lugar

**Nantes**, distinta de Marseille (A0), Paris (A1) y Lyon (Expat A1 draft).
Reconocible sin ser postal: la Loire, el crachin, el muscadet, el beurre blanc.

Lugar central y privado: **el piso de Justine en Chantenay**, en la ladera que
mira a la Loire, con un balcon estrecho. Los temas 3 y 6 salen de el por
necesidad de la escena (la casa de la madre en Rezé; la salle des fêtes de la
boda), y vuelven.

## 3. Espina

Romain deja Strasbourg en septiembre para vivir con Justine en Nantes.
**Entiende cada palabra y se le escapa la mitad de lo que su gente quiere
decir**: las bromas de la bande, la cortesia del domingo, las cuentas que nadie
dice en voz alta. La pregunta del journey: si Romain se hace un sitio propio en
el mundo de Justine o se queda en "le copain de Justine". Cierra en la historia
21 con una eleccion y un coste, sin cliffhanger.

Por que esta espina y no otra: son exactamente las dos frases del corpus (ver 5).
Romain es el que se muda "en unos meses" y el que no se siente seguro de lo que
entiende, pero es frances, porque todo el reparto es nativo de la variante.

## 4. Reparto

Ninguno sale del A0 (Léa, Hugo, Théo, Chloé, Maxime, Louise, Antoine, Clara),
del A1 (Amélie, Marc, Camille, Olivier, Inès, Mathieu, Sophie, Baptiste) ni del
Expat A1 draft (Manon, Pauline, Sylvie, Juliette, Nicolas).

La ropa es de color FIJO: la ficha se repite literal en cada prompt de portada
cuando toque (regla de portadas, punto 1).

| quien | tema | edad | que es | aspecto fijo | como habla |
|---|---|---|---|---|---|
| **Romain** | fijo, las 21 | 32 | electricista, de Strasbourg | pelo castano claro corto, barba corta, chaqueta verde oliva | preciso, pregunta cuando no entiende, humor seco |
| **Justine** | fija, 14+ de 21 | 30 | profesora de biologia en un lycée, de Rezé | pelo negro rizado a los hombros sin flequillo, chubasquero amarillo | rapido, termina las frases de los demas |
| Mathilde | 2 | 30 | la mejor amiga de Justine desde el lycée, florista | pelo castano rojizo recogido, jersey azul marino | guardiana de las bromas de la bande |
| Nathalie | 3 | 54 | la madre de Justine, enfermera del CHU | pelo castano corto con mechas, cardigan burdeos | vouvoie hasta que decide que no |
| Julien | 4 | 34 | companero de obra de Romain | gorra negra, sudadera gris | tiene un planning para todo |
| Karim | 5 | 31 | el primer amigo propio de Romain, de la sala de escalada | pelo negro rapado, camiseta roja | entusiasta, mal consejero |
| Élise | 6 | 31 | la prima de Justine, la novia | pelo rubio largo, vestido blanco | nerviosa, lo organiza todo |
| Anaïs | 7 | 28 | la hermana de Romain, de Strasbourg | pelo castano claro con flequillo, abrigo mostaza | directa, habla de "casa" pensando en Alsacia |

**Aviso de nombres (warn, no bloquea):** del banco `french/france` solo quedan
libres Romain y Julien. Justine, Mathilde, Nathalie, Karim, Élise y Anaïs estan
fuera de lista y el validador avisara (`character-names-unverified`). Los
justifico por generacion: nombres frecuentes entre nacidos de 1970 (Nathalie) a
1998 (Anaïs). Karim es un nombre frances corriente, en ortografia francesa.

## 5. Evidencia de los temas

El corpus frances son **5 applicationReason** (los 5 clics del desplegable no
cuentan). Frases de PROPOSITO, leidas a mano: dos, de dos personas. Las otras
tres hablan de la app o del metodo. Menos de 7 frases de proposito, asi que va
**modo journey-level** (`assertTopicsGrounded`, `journeyEvidence`):

- Kelly: "I plan to move there in 6-8 months"
- Whitley: "still struggle feeling  confident with my comprehension" (el doble
  espacio es literal del corpus)

Los siete temas son MOMENTOS de la relacion (la forma de Relationships) y el
dominio lexico de cada momento. Sondeado en seco: **PORTON OK**.

## 6. Los siete temas

Ninguno repite un tema del A0 (Sports & Games, Talking & Listening, Helping &
Favours, Words & Meanings, Parties & Gifts, Houses & Neighbours, Travel &
Goodbyes) ni del A1 (Group Notes & Plans, Hosting & Care, Plans & Timing, Seats
& Tables, Invites & Boundaries, Trust & Doubts, Circles & Introductions). Nada
de bar, compra, farmacia ni transporte.

| # | label | slug | nuevo | registro |
|---|---|---|---|---|
| 1 | Home Life & Habits | home-life-and-habits | nadie | comedia domestica tierna |
| 2 | Jokes & Memories | jokes-and-memories | Mathilde | el de fuera en la mesa |
| 3 | Family & Manners | family-and-manners | Nathalie | el examen que nadie admite |
| 4 | Housework & Fairness | housework-and-fairness | Julien | humor de cuentas de pareja |
| 5 | Arguments & Apologies | arguments-and-apologies | Karim | la primera pelea de verdad |
| 6 | Ceremonies & Public Speaking | ceremonies-and-public-speaking | Élise | nervios y emocion en publico |
| 7 | Homesickness & Belonging | homesickness-and-belonging | Anaïs | nostalgia y eleccion |

### 6bis. Renombrado (2026-09-13, regla project_topic_naming_rule)

El usuario rechazo dos nombres por especificos (escena, no dominio). Se revisaron los siete con el mismo criterio. Historias y vocabulario no cambian.

| antes | ahora |
|---|---|
| Habits & Shared Space | Home Life & Habits |
| Inside Jokes & Memories | Jokes & Memories |
| Parents & Sunday Lunch | Family & Manners |
| Chores & Fair Shares | Housework & Fairness |
| Arguments & Apologies | Arguments & Apologies (igual) |
| Weddings & Speeches | Ceremonies & Public Speaking |
| Homesickness & Belonging | Homesickness & Belonging (igual) |

assertTopicsGrounded en seco con los nuevos: PORTON OK; labels y slugs libres.

### Arco de cada tema (deseo, obstaculo, coste; el slot 3 cierra)

1. **Home Life & Habits.** (1) Romain llega con sus cajas y quiere un
   armario suyo; el de Justine esta lleno; cede y deja sus herramientas en la
   cave. (2) Las noches: el ronca, ella lee con luz; pierde su lado de la cama,
   el de la ventana. (3) Tiende la ropa en el balcon como en Alsacia y el
   crachin se la moja; Justine le hace sitio en el tendedero de dentro y dice
   "chez nous" por primera vez.
2. **Jokes & Memories.** (1) Primera cena con la bande; todos rien con
   "l'histoire du pédalo" y Romain rie sin entender; Mathilde le pregunta de que
   se rie y lo pilla. (2) Mathilde le cuenta el pédalo con fotos (flashback
   marcado); Romain entiende la broma y descubre una Justine que no conocia; le
   cuesta la imagen que tenia de ella. (3) Algo le pasa a Romain delante de la
   bande y nace su propio apodo, que no le gusta; lo acepta porque es suyo.
3. **Family & Manners.** (1) Primer domingo en Rezé: vous o tu con
   Nathalie; lleva un vino de Alsace a una mesa de muscadet y la botella se
   queda cerrada. (2) Quiere ayudar con el beurre blanc y corta la salsa; se
   pierde la salsa y la tranquilidad de la mesa. (3) Salta el cuadro electrico
   y Romain lo arregla; se pierde el postre y la tarde con Justine; Nathalie le
   tutea al irse.
4. **Housework & Fairness.** (1) Julien le ensena su planning en la obra;
   Romain lo pega en la nevera y Justine se ofende; pierden el sabado. (2) La
   vaisselle por turnos y el lave-vaisselle averiado; Romain paga la pieza y
   presume; Justine saca otra cuenta. (3) Romain descubre la lista que Justine
   lleva en la cabeza; quita el planning y reparten por gusto, no por puntos.
5. **Arguments & Apologies.** (1) Romain pasa la tarde escalando con Karim, el
   movil en la taquilla, y llega tarde al concierto de la chorale donde Justine
   canta sola; no la oye. (2) Silencio, reproches, sofa; Karim le aconseja flores
   y sale peor. (3) Una disculpa sin "mais"; Romain pide oir la cancion en casa;
   Justine perdona con una condicion.
6. **Ceremonies & Public Speaking.** (1) Justine es testigo y escribe un discurso lleno
   de bromas de familia; Élise pide a Romain la luz de la sala; pasa la vispera
   alli. (2) El dia, falla la corriente en pleno discurso; Romain lo arregla a
   oscuras y se pierde el discurso de Justine. (3) Élise pide que Romain diga
   unas palabras en el vin d'honneur; usa el apodo de la bande y la familia
   aplaude.
7. **Homesickness & Belonging.** (1) Anaïs llega de Strasbourg con un kouglof y
   una noticia: el antiguo jefe quiere a Romain de vuelta; Anaïs nota que su
   hermano ya habla como un nantais. (2) Una flammekueche casera le trae el mal
   du pays; Justine se entera de la oferta por Anaïs y no por el; se pierde la
   confianza de esa noche. (3) Romain rechaza la oferta por telefono; Anaïs se va
   y la vera dos veces al ano; en el buzon pone "Justine et Romain".

## 7. Banda gramatical A2 (frances)

Lo que separa este A2 del A1 frances (narrado en presente) es **el pasado**.

| entra | ejemplo |
|---|---|
| passé composé con avoir y etre | "Hier, Mathilde a raconte l'histoire." |
| imparfait de descripcion y habito | "C'etait en 2012, il y avait un pédalo." |
| futur proche | "On va manger chez ma mere." |
| pronombres COD/COI, y, en | "Je lui ai dit.", "J'en veux." |
| relativos qui, que, ou | "la chanson qu'elle chante" |
| negacion ne... plus / jamais / rien / personne | |
| comparativo plus/moins... que | |
| conditionnel de politesse fijo | "je voudrais", "tu pourrais" |

| fuera (B1 o mas) |
|---|
| subjonctif (incluido "il faut que"), plus-que-parfait, si + imparfait, conditionnel passé, gérondif, passé simple, discours indirect al pasado, dont/lequel |

Narrador en **presente**, como la serie; el pasado vive en el dialogo y en el
**flashback marcado** ("Il y a dix ans, ..."). Objetivo por 100 oraciones:
passé composé 12-30, imparfait 3-10, futur proche 2-8, formas B1: 0.

**Aviso: la medida es floja.** El proyecto no tiene sonda gramatical francesa;
la de este plan es una regex ad hoc que sobrecuenta el imparfait ("mais",
"jamais"). Medida sobre lo publicado: A1 FR con passé composé 3 por 100
oraciones y futur proche 2, que confirma que el salto es el pasado.

Recursos estilisticos (quality spec 3ter): los de A0 y A1 mas **simil simple,
espejo concreto y flashback marcado**. Nada de B1 (reversa cosida, cambio de
ritmo) ni superior. Humor de situacion, nunca juego de palabras: las "inside
jokes" son situaciones que se cuentan, no argot.

## 8. Escalera de vocabulario

### Forma

420 plazas: **20 por historia, 14 portables y 6 ancladas** (ancladas 126/420 =
30%, el techo del gate).

| tramo | portables | ancladas | que hace |
|---|---|---|---|
| historias 1-3 | 14 | 6 | presentan; no alojan nada |
| 4-15 | 14 | 6 | presentan y alojan reencuentros de las anteriores |
| 16-21 | 14 | 6 | presentan poco nuevo portable; el cuerpo recicla |

Toda portable entra como muy tarde en la historia 15. Suelo A2 del gate: media
**1,3** con cola maxima **80%**; objetivo de diseno **1,6**, con margen.

### Solape cero

Contra las 949 palabras que ya ensenan los tres journeys franceses no
archivados. Comprobado con el taught-set real: estan **ocupados** basicos como
promettre, espérer, oublier, accepter, refuser, gentil, content, calme, rire,
pleurer, la porte, la clé, le bruit, la recette, la mairie, la valise, le frigo,
la cave, le train. El Expat A1 draft ocupa casi todos los verbos corrientes.

### Desde el A1: recirculacion SIN plaza

Lo que el A1 y el A0 ya ensenaron se usa en la prosa como palabra conocida y
no gasta plaza: promettre, espérer, oublier, accepter, refuser, préférer,
sembler, gentil, content, calme, timide, nerveux, tranquille, la fête, inviter,
l'ami, ranger, le repas, la bouteille, le cadeau, partager, raconter, manquer,
pleurer, la cave, l'oreiller. Asi el lector del A1 reencuentra su vocabulario y
cada plaza del A2 ensena algo nuevo.

### Campo lexico por tema (palabras comprobadas LIBRES)

| tema | portables libres (muestra) | ancladas libres (muestra) |
|---|---|---|
| Home Life & Habits | s'habituer, déranger, céder, supporter, régler, bizarre, plutôt, en fait, la manie, ronfler | le placard, la couette, la table de nuit, le balcon, le crachin, le tancarville |
| Jokes & Memories | se souvenir, se moquer de, taquiner, suivre, à moitié, marrant, faire semblant, deviner, remarquer | la bande, le surnom, le pédalo, la meilleure amie, le lycée, le fou rire |
| Family & Manners | impressionner, resservir, vouvoyer, avoir l'air, oser, franchement | la belle-mère, le beurre blanc, le muscadet, le gâteau nantais, Rezé, le tableau électrique, le fusible |
| Housework & Fairness | injuste, à tour de rôle, arranger, se plaindre, râler, pareil | la vaisselle, la lessive, le lave-vaisselle, la corvée, l'aimant, la panne |
| Arguments & Apologies | se disputer, reprocher, s'excuser, pardonner, bouder, crier, se calmer, vexé, en colère, avoir tort, avoir raison, se réconcilier | la chorale, la salle d'escalade, le reproche |
| Ceremonies & Public Speaking | émouvoir, ému, applaudir, prévenir, se débrouiller, tant pis | le témoin, le discours, la mariée, le vin d'honneur, la salle des fêtes, la veille, le micro, la rallonge |
| Homesickness & Belonging | appartenir, avouer, déçu, soulagé, désormais, au fond | le mal du pays, le kouglof, la flammekueche, le TER, l'étiquette |

Cognados transparentes descartados de antemano (vinyle, guitare, compromis,
cérémonie, album, photo, costume, bouquet): chocan con `vocab-no-cognates`.

### Portables de los temas 1 y 2 que TIENEN que volver en los temas 4 a 7

| palabra | ensenada | vuelve en |
|---|---|---|
| s'habituer | 1 | 3, 7 |
| céder | 1 | 4, 5 |
| déranger | 1 | 3, 6 |
| supporter | 1 | 5 |
| en fait | 1 | 4, 6 |
| bizarre | 1 | 4, 7 |
| se souvenir | 2 | 6, 7 |
| à moitié | 2 | 3, 7 |
| faire semblant | 2 | 5 |
| suivre | 2 | 3, 6 |
| se moquer de | 2 | 4, 6 |
| remarquer | 2 | 4, 7 |
| le surnom (ancla del journey) | 2 | 6, 7 |

La lista entra en el plan JSON de cada tema (`/tema`), no se repasa al final.

## 9. Riesgos conocidos

1. Nombres fuera del banco: avisos esperados, ver 4.
2. Sin sonda gramatical FR: la banda se mide flojo, ver 7.
3. Los personajes de tema no se pueden nombrar fuera de su tema; Mathilde y el
   apodo de la bande vuelven en el 6 y el 7 **solo como apodo**, sin el nombre
   de Mathilde.
4. "Family & Manners" y "Ceremonies & Public Speaking" rozan "Home & Family" y
   "Community & Celebrations" del Expat A1 draft, que es otro tipo. El lexico
   comprobado no choca.
5. Titulos: tope de 26 caracteres, sin la formula por defecto.

## 10. Proceso, cuando el plan este aprobado

1. Scaffold del journey y los 7 temas por el porton (`assertTopicsGrounded` y
   `assertLadderContiguous`), en draft. El `nextJourneyId` del A1 no se toca.
2. Un tema cada vez por `/tema`: plan JSON, esqueleto, prosa, `saveStory.ts
   --dry`, guardado, `cierraTema.ts --plan`, fila de `journeysTable.ts` y
   reporte al chat de planificacion.
3. Fuera de este encargo: audio, portadas, glosas, practica, push y correos.
