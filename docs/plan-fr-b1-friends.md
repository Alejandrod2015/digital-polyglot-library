# Friends FR/France B1: plan

Estado: **PLAN, sin aprobar.** No hay journey creado, ni temas nuevos en
`dp_topics_v1`, ni una linea de prosa. Nada toca la base hasta el visto bueno.

## 0. Estado comprobado (2026-09-14)

| comprobacion | resultado |
|---|---|
| `journeysTable.ts`: Friends FR A0 `cmtwo6cys0007j8yzg6ni3fsc` | LIVE, Marseille, Lea y Hugo |
| Friends FR A1 `cmtwz1iop000l32jybeo2jg4x` | LIVE, Paris, Amelie y Marc |
| Friends FR A2 `cmu04ereh000732z7px7naqa2` | DRAFT, Nantes, Romain y Justine, 21 historias con texto |
| Friends FR B1 | no existe |
| Escalera (french, france, Friends) con `assertLadderContiguous` | **ESCALERA OK** (A0, A1, A2 y B1 contiguos) |
| Porton de temas (`scripts/_frB1TopicProbe.ts`, solo lectura) | **PORTON OK**, modo journey-level, 2 personas |
| Choques de label/slug en `dp_topics_v1` | ninguno (ver 6) |

## 1. Forma

Tipo `relationships` (etiqueta "Friends"), 1 nivel x 7 temas x 3 historias = 21,
en draft.

- **Journey de ESCUCHA**, como el resto de la escalera: quien lo compra quiere
  entender a gente francesa cuando habla entre si.
- **2 fijos**: Aurelien en las 21; Elodie en la mitad o mas (valen menciones).
- **1 personaje nuevo por tema** (temas 2 a 7), presentado en la primera
  historia de su tema, y que **no vuelve a salir ni a nombrarse** en otro tema.
- **Tema 1 sin nuevos**: la primera historia del journey solo lleva a los fijos.
- Maximo 2 personajes hablando por historia. Solo adultos de 32 a 41 en activo;
  ni ninos ni adolescentes ni ancianos, tampoco de fondo.
- Estilo **narrador**, como el A0, el A1 y el A2: ~28-30% de habla citada,
  comillas curvas `“”`, guardado con `--narrator`. Cada cambio de voz anclado
  por acotacion o linea de narrador (liston 97-100%, `feedback_narrator_says_who_speaks`).
- Cuerpo **140-166 palabras** (banda B1 de `bodyWordBand.ts`).
- Sinopsis **en frances**, 2-3 frases, con gramatica de B1 y sin spoiler del
  giro. Ninguna sinopsis de slot 3 termina en pregunta ni en gancho.
- Presentacion con las tres formas francesas alternadas (aposicion,
  `s'appeler`, con `être`), ninguna en mas de la mitad del reparto.

## 2. Ciudad y lugar

**Lille**, distinta de Marseille (A0), Paris (A1), Nantes (A2) y Lyon (Expat
A1). Reconocible sin ser postal y con un lexico propio que un B1 puede
aprender: el estaminet, la Braderie de septiembre, el beffroi, la
Grand-Place, el welsh y la carbonnade, la drache (lluvia fuerte, regional).

Lugar central: **un antiguo local de Fives**, barrio obrero en reconversion,
que los fijos convierten en un taller-cafe de reparacion de bicicletas. Salen
de alli por necesidad de la escena (el cabinet del centro, la casa del hermano
en Roubaix, el banco, el estaminet del barrio, la Grand-Place) y vuelven.

## 3. Espina

Aurelien, contable desde hace diez anos, y Elodie, mecanica de bicicletas, son
amigos desde la fac. Cuando a el le ofrecen un ascenso y la tienda de ella
cierra la misma semana, deciden abrir juntos un taller en Fives. **La pregunta
del journey: si una amistad de quince anos sobrevive a convertirse en socios**,
con dinero, rumores, cansancio y orgullo por medio. Cierra en la historia 21 con
una eleccion y un coste, sin cliffhanger.

Por que esta espina: el nivel. Un B1 es el nivel de dar y pedir consejo, de
contar lo que dijo otro, de hablar de lo que habria que hacer y de opinar sobre
trabajo, dinero y sentimientos. Una espina de decisiones compartidas obliga a
esa gramatica (ver 7) en vez de alojarla con calzador. Se aparta a proposito
del molde de la escalera: en el A0 alguien se va, en el A2 alguien llega y
duda si volver; aqui **nadie se muda**.

Enlace con el corpus (ver 5): quien se muda "en unos meses" acaba entre gente
que habla de trabajo, de dinero y de los demas, y la frase de Whitley es
exactamente eso a B1: entender la conversacion de otros adultos.

## 4. Reparto

Ninguno sale del A0 (Lea, Hugo, Theo, Chloe, Maxime, Louise, Antoine, Clara),
del A1 (Amelie, Marc, Camille, Olivier, Ines, Mathieu, Sophie, Baptiste), del A2
(Romain, Justine, Mathilde, Nathalie, Julien, Karim, Elise, Anais) ni del Expat
A1 (Manon, Pauline, Sylvie, Juliette, Nicolas). **Nada se hereda del A2 salvo
vocabulario** (`feedback_no_shared_cast_across_journeys`).

La ropa es de color FIJO: la ficha se repite literal en cada prompt de portada
cuando toque (regla de portadas, punto 1).

| quien | tema | edad | que es | aspecto fijo | como habla |
|---|---|---|---|---|---|
| **Aurélien** | fijo, las 21 | 35 | contable en un cabinet del centro, luego socio del taller | pelo castano oscuro corto, sin flequillo, gafas de montura negra, sin barba; impermeable azul marino | prudente, pide cifras, dice "attends" antes de decidir |
| **Élodie** | fija, 14+ de 21 | 34 | mecanica de bicicletas, amiga de Aurelien desde la fac | pelo rubio oscuro recogido en mono bajo, sin flequillo; sudadera naranja | rapida y directa, bromea para no decir lo que siente |
| Guillaume | 2 | 39 | el hermano mayor de Aurelien, agente inmobiliario en Roubaix | pelo castano muy corto con entradas, barba corta; chaqueta de traje gris | da consejos que nadie pide, casi siempre con "à ta place" |
| Yasmine | 3 | 33 | conseillère bancaire, companera de fac de Elodie | pelo negro liso por los hombros, sin flequillo; blazer burdeos | amable y exacta, explica con numeros |
| Florian | 4 | 41 | el patron del estaminet de Fives | pelo rubio canoso rapado, bigote; delantal verde oscuro | repite lo que oye, siempre con "paraît-il" |
| Marion | 5 | 32 | enfermera de noche en el hospital universitario | pelo castano rojizo largo y ondulado, sin flequillo; abrigo camel | directa, detesta los rodeos |
| Quentin | 6 | 37 | medico de cabecera del barrio, primer cliente del taller | pelo negro rizado corto, sin flequillo; cazadora azul electrico | tranquilo, habla despacio, manda descansar |
| Charlotte | 7 | 36 | periodista de un diario local, companera de fac de los dos | pelo castano con flequillo recto y media melena; gabardina beige | curiosa, rapida, busca la frase para el titular |

**Aviso de nombres (warn, no bloquea):** los 16 nombres jovenes del banco
`french/france` ya estan TODOS usados por los otros journeys franceses, asi que
los ocho iran fuera de lista y el validador avisara
(`character-names-unverified`). Los justifico por generacion (nacidos entre 1984
y 1993): Aurelien, Elodie, Guillaume, Florian, Quentin, Marion, Charlotte y
Yasmine son nombres frecuentes en Francia en esos anos, en ortografia francesa.

## 5. Evidencia de los temas

El corpus frances son **5 applicationReason** (los 5 clics del desplegable no
cuentan). Frases de PROPOSITO, leidas a mano: dos, de dos personas; las otras
tres hablan de la app. Menos de 7 frases de proposito, asi que va **modo
journey-level** (`assertTopicsGrounded`, `journeyEvidence`), igual que el A2:

- Kelly: "I plan to move there in 6-8 months"
- Whitley: "still struggle feeling  confident with my comprehension" (el doble
  espacio es literal del corpus)

Dos de los cinco solicitantes franceses se declararon **Intermediate** (Dalma y
Whitley): el B1 es el peldano que les falta.

Sondeado en seco con `scripts/_frB1TopicProbe.ts`: **PORTON OK**.

## 6. Los siete temas

Nombres a nivel de **dominio lexico**, nunca objeto ni escena
(`project_topic_naming_rule`). Ninguno repite un tema del A0, del A1 ni del A2,
y ninguno coincide con los del Expat A1 (Work & Study, Shopping & Money, Health
& Wellbeing...). Nada de bar, compra, farmacia ni transporte como tema.

| # | label | slug | estado del slug | nuevo | registro |
|---|---|---|---|---|---|
| 1 | Careers & Ambitions | careers-and-ambitions | libre | nadie | comedia agridulce de oficina |
| 2 | Advice & Opinions | advice-and-opinions | existe (Traveler ES B1), mismo label | Guillaume | sobremesa familiar con consejos no pedidos |
| 3 | Money & Debts | money-and-debts | libre | Yasmine | tension seca de cifras entre amigos |
| 4 | Rumours & Reputation | rumours-and-reputation | libre | Florian | comedia de barrio, el telefono roto |
| 5 | Dating & Romance | dating-and-romance | libre | Marion | romance torpe y honesto |
| 6 | Stress & Burnout | stress-and-burnout | libre | Quentin | agotamiento contenido, sin melodrama |
| 7 | Pride & Envy | pride-and-envy | existe (Traveler ES B1), mismo label | Charlotte | orgullo herido y reparacion |

"Gossip & Rumours" se descarto: el label ya pertenece al slug `el-chisme` del
Friends ES C1, y un slug es un label global.

### Arco de cada tema (deseo, obstaculo, coste; el slot 3 cierra)

1. **Careers & Ambitions.** (1) Aurelien quiere contarle a Elodie que el
   cabinet le ofrece un ascenso; ella llega con la noticia de que su tienda
   cierra en diciembre; se calla la suya y pierde su noche de celebracion; medio
   en broma, le recuerda el plan de la fac: un taller juntos. (2) Quiere estudiar
   el proyecto con cifras antes de decidir; el cabinet le pide respuesta el
   viernes y Elodie no quiere un "peut-être"; rechaza el ascenso, que ya no
   volvera. (3) Presenta su dimision y quiere irse sin drama; los companeros no
   entienden que deje un CDI; pierde el sueldo fijo y su mesa frente al beffroi,
   y Elodie le da la llave del local.
2. **Advice & Opinions.** (1) En la comida de domingo en Roubaix, Aurelien
   quiere el apoyo de su hermano; Guillaume le da consejos sin preguntar y se
   ofende al saber que ya dimitio; pierden la comida en paz. (2) Guillaume
   conoce un local mejor situado en el Vieux-Lille; Aurelien quiere su ayuda sin
   deberle la decision; Elodie opina lo contrario; elige Fives y Guillaume se
   siente despreciado. (3) Aurelien le pide una opinion sincera, no una
   aprobacion; Guillaume encuentra un fallo real en el local (la instalacion
   electrica); Aurelien lo reconoce, pierde un mes y el orgullo, y los hermanos
   hacen las paces.
3. **Money & Debts.** (1) En el banco, Yasmine explica que sin aportacion
   personal no hay prestamo; Aurelien pone los ahorros que guardaba para
   comprarse un piso y renuncia a el. (2) El banco solo acepta a Aurelien como
   titular, porque Elodie lleva meses sin contrato; el taller seria legalmente de
   el; Elodie se niega a ser "l'employée de son copain". (3) Aurelien le presta
   a Elodie su parte para que pongan lo mismo; ella insiste en firmar un
   reconocimiento de deuda y devolverlo cada mes; entre los dos queda una cuenta
   escrita, y el banco firma.
4. **Rumours & Reputation.** (1) En el estaminet, Florian cuenta que, segun
   dicen, a Aurelien lo echaron del cabinet por un error; Aurelien quiere
   desmentirlo con calma y cuanto mas explica, mas verdad parece; dos antiguos
   companeros que iban a ser clientes no vienen. (2) Aurelien quiere saber quien
   empezo el rumor; lo reconstruye frase a frase y llega a una broma de Elodie
   mal repetida; la discusion le cuesta la noche de pintar juntos. (3) Circula
   que el estaminet de Florian va a cerrar; Aurelien, con sus numeros de
   contable, lo desmiente delante del barrio; para hacerlo admite en publico que
   tenia miedo de fracasar, y pierde su imagen de hombre seguro; el barrio
   vuelve.
5. **Dating & Romance.** (1) Primera cita en la Grand-Place: Aurelien quiere
   impresionar a Marion y se presenta como expert-comptable, sin decir que lo
   dejo. (2) La segunda cita cae la noche de montar el taller; quiere estar en
   los dos sitios y le miente tambien a Elodie, que monta sola las estanterias.
   (3) Le cuenta la verdad a Marion; a ella no le molesta el oficio sino la
   mentira, y decide no seguir; Aurelien pierde la relacion y vuelve al taller a
   contarselo todo a Elodie, sin excusas.
6. **Stress & Burnout.** (1) Tres semanas antes de abrir, trabajan catorce
   horas al dia para inaugurar el fin de semana de la Braderie; Quentin, primer
   cliente, ve que a Elodie le tiemblan las manos; ella quiere seguir y lo niega.
   (2) Elodie se duerme de pie en el taller; Quentin le da una baja de una
   semana; Aurelien quiere hacerlo todo solo y pierde la inauguracion en la
   Braderie, que solo hay una vez al ano. (3) Aurelien reconoce que tambien esta
   al limite; aprenden a cancelar y fijan reglas (el domingo cerrado); pierden
   los folletos impresos y la fecha, y abren un martes cualquiera.
7. **Pride & Envy.** (1) Charlotte los entrevista para el diario local y le
   pregunta casi todo a Aurelien, "el contable que lo dejo todo"; a el le gusta;
   Elodie sale en la foto al fondo y no dice nada. (2) El articulo sale sin el
   nombre de Elodie; Charlotte recuerda que Aurelien le dijo que la idea fue
   suya; el lo dijo, y Elodie, herida en su orgullo, deja de hablarle una tarde
   entera. (3) El diario no corrige; Aurelien quiere reparar el dano sin palabras
   grandes y le cede a Elodie la gerencia y el mostrador, y se queda con las
   cuentas en la trastienda; pierde la parte visible que empezaba a gustarle, y
   el primer cliente del dia pregunta por la mecanica.

Moldes que se evitan a proposito: nadie se muda ni vuelve a su ciudad; ningun
apodo como cierre (ya lo hizo el A2); ningun discurso en publico como climax
(tema 6 del A2); ningun nombre en un buzon o en una puerta como ultima imagen.

## 7. Banda gramatical B1 (frances)

Lo que separa este B1 del A2 frances: **se narra en pasado** y entran el
subjuntivo, el condicional y el estilo indirecto con concordancia. Un B1 narrado
en presente no puede tener su gramatica (`feedback_level_measured_externally`).

- **Narrador**: passé composé + imparfait, con plus-que-parfait para lo
  anterior. Nada de passé simple.
- **Dialogo**: presente, passé composé, futur, conditionnel, subjonctif.

| entra (B1) | ejemplo |
|---|---|
| subjonctif présent tras `il faut que`, `vouloir que`, `bien que`, `avant que`, `pour que`, `je ne pense pas que` | "Il faut que tu dormes." |
| conditionnel présent: cortesia, consejo, hipotesis | "À ta place, je garderais ce poste." |
| si + imparfait, conditionnel | "Si on ouvrait en septembre, on aurait la Braderie." |
| discours indirect au passé con concordancia | "Florian a raconté qu'Aurélien avait fait une erreur." |
| plus-que-parfait | "Il avait déjà signé." |
| gérondif, `dont`, `ce qui` / `ce que` | "en rentrant", "le local dont il rêvait" |

| fuera (B2 o mas) |
|---|
| passé simple, subjonctif passé e imparfait, conditionnel passé ("j'aurais dû"), futur antérieur, `lequel` y compuestos, participio presente de escrito |

**Banda por 100 oraciones**, calcada de la banda B1 aceptada para espanol
(`project_grammar_band_b1`) y adaptada al frances, donde el subjuntivo vivo es el
presente: **subjonctif présent 1-4, conditionnel présent 1-5, discours indirect
au passé 1-3**. Con 40-45 oraciones por tema son 1-2 subjuntivos, 1-2
condicionales y 1 estilo indirecto por tema como minimo; el objetivo de diseno
es **al menos una forma B1 por historia**, para que ninguna suene a A2.

**Aviso: la medida es floja.** El proyecto no tiene sonda gramatical francesa.
La medire con una sonda de trabajo (`scripts/_frB1Gram.ts`) que **primero se
prueba con frases de control** (regla 5 de la memoria de niveles) y la reportare
por historia y por tema al cerrar cada uno.

Recursos estilisticos (quality spec 3ter): los de A0-A2 mas los de B1,
**reversa cosida** (querer y no hacerlo, con motivo y gesto en la misma oracion)
y **cambio de ritmo** (tras frases largas, una corta como golpe). Nada de B2:
ni ironia, ni subtexto sin gesto, ni elipsis temporal, ni narrador con opinion.

## 8. Escalera de vocabulario

### Forma

420 plazas: **20 por historia, 14 portables y 6 ancladas** (ancladas 30%, el
techo del gate). Techo por historia `max(25, palabras/9)` = 25; no se rellena.

| gate de conjunto | liston | objetivo de diseno |
|---|---|---|
| `journey-vocab-level-floor` | 60% de plazas fuera de la lista FR A1-A2 | 70% |
| `journey-vocab-recirculation` (B1, provisional) | portables media 1,2, cola 80% | media 1,6 |
| ancladas | 30% maximo | 30% |

Toda portable entra como muy tarde en la historia 15, para que tenga temas donde
reaparecer.

**Aviso sobre el suelo del 60%:** la lista de `main` (`frenchA1A2.ts`, la de 818
lemas) es corta y da por "de nivel" palabras que un A2 ya tiene (probado:
`conseiller`, `dépenser`, `emprunter` salen fuera de A1-A2). El gate pasara con
facilidad y medira poco, asi que el criterio de eleccion lo aplico yo: una plaza
B1 tiene que ser palabra que un A2 no sabe. No uso ni amplio la lista ampliada de
la otra rama (licencia no comercial, `project_french_level_list_license`).

### Solape

Lo que dice el codigo de `saveStory`: las portables se reabren entre journeys y
las ancladas se reabren entre niveles del mismo tipo; dentro de este journey,
cero. **Criterio mas estricto que aplico**: ninguna plaza gasta una palabra que ya
ensenaron el A0, el A1 o el A2 Friends ni el Expat A1. Sondeado con
`scripts/_frB1Libres.ts`: ya estan ocupadas, entre otras, se lancer, hésiter,
regretter, avoir tort, critiquer, insister, bavarder, se taire, jaloux,
embrasser, fier, l'envie, avouer, reconnaître, réparer, le métier, le salaire,
le loyer, le patron.

### Desde el A2: recirculacion SIN plaza

Lo que el A2 ya enseno se usa en la prosa como palabra conocida y no gasta
plaza: regretter, avouer, reconnaître, hésiter, insister, critiquer, se
souvenir, remarquer, promettre, décevoir, exagérer, rassurer, déranger, jaloux,
inquiet, sincère, bizarre, fatigué, avoir tort, changer d'avis, en fait, par
contre, tant pis, désormais, avoir honte, faire bonne impression, le boulot, le
salaire, le métier, le choix, le secret. El lector que viene del A2 reencuentra
su vocabulario y cada plaza del B1 ensena algo nuevo.

### Campo lexico por tema (comprobadas LIBRES y fuera de A1-A2)

| tema | portables (muestra) | ancladas (muestra) |
|---|---|---|
| Careers & Ambitions | démissionner, ambitieux, prendre le risque, en avoir marre | la carrière, l'entretien, le CDI, la reconversion, l'atelier, le beffroi |
| Advice & Opinions | conseiller, déconseiller, convaincre, à ta place, être d'accord, avoir raison, franchement | l'avis, le Vieux-Lille, la carbonnade |
| Money & Debts | emprunter, rembourser, économiser, dépenser, investir, radin, fauché | la dette, les économies, le devis, la caution, la facture, le compte |
| Rumours & Reputation | prétendre, deviner, soi-disant, paraît-il, se méfier | la rumeur, les ragots, la réputation, l'estaminet, le welsh |
| Dating & Romance | draguer, séduire, rompre, tomber amoureux, célibataire | la rencontre, le coup de foudre, la Grand-Place |
| Stress & Burnout | craquer, se reposer, s'inquiéter, épuisé, surmené, tenir le coup | le stress, la fatigue, l'arrêt maladie, la braderie, la drache |
| Pride & Envy | envier, échouer, féliciter, se vanter, pardonner | la fierté, la jalousie, la réussite, l'échec |

Es una muestra, no la lista final. Por lo denso que ya es el catalogo frances,
cada tema sigue el **orden "vocab primero"** del spec (3ter): antes de la escena,
las ~20 palabras del nivel comprobadas libres con `_frB1Libres.ts`; despues, la
escena alrededor. Cognados transparentes (stress, burn-out, carrière en su uso
cognado) se revisan contra `vocab-no-cognates` antes de fijarlos.

### Portables que TIENEN que volver

La lista de reencuentros (palabra, tema donde se ensena, temas donde vuelve)
entra en el plan JSON de cada tema de `/tema`, no se repasa al final. Las
portables de los temas 1 y 2 (consejo, riesgo, acuerdo) son las que mas
recorrido tienen y se reservan para volver en 4 a 7.

## 9. Riesgos conocidos

1. Nombres fuera del banco: avisos esperados, ver 4.
2. Sin sonda gramatical FR: la banda se mide con una sonda de trabajo, ver 7.
3. Suelo de nivel medido con la lista corta de `main`: pasa facil, ver 8.
4. Los personajes de tema no se pueden nombrar fuera de su tema; Marion (5) no
   vuelve, y por eso su tema cierra la relacion dentro del tema.
5. "Money & Debts" y "Stress & Burnout" rozan "Shopping & Money" y "Health &
   Wellbeing" del Expat A1, que es otro tipo; el lexico se comprueba igual.
6. Titulos: tope de 26 caracteres, sin la formula por defecto.

## 10. Proceso, cuando el plan este aprobado

1. Scaffold del journey y los 7 temas por los portones (`assertLadderContiguous`,
   `assertTopicsGrounded` y `assertJourneyType`), en draft. El `nextJourneyId`
   del A2 no se toca.
2. Un tema cada vez por `/tema`: plan JSON, vocab primero, esqueleto, prosa,
   `saveStory.ts --dry`, guardado, sonda gramatical, `cierraTema.ts --plan`, fila
   de `journeysTable.ts` y reporte a Journey-planning.
3. Al final, lectura seguida de las 21 buscando plantillas repetidas e informe
   de conjunto.
4. Fuera de este encargo: audio, portadas, glosas, practica, push y correos.
