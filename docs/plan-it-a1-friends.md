# Plan: Friends IT A1 (Milano)

Estado: PENDIENTE de revision del chat de planificacion (Journey-planning-2).
Fecha: 2026-09-14. Chat ejecutor: IT_Italy_A1_Friends_1-Texto.
Fuera de este plan: fila `Journey`, temas en la base, historias, audio, portadas, glosas, practica, push y correos.

## 0. Estado comprobado antes de planear

| Comprobacion | Resultado |
|---|---|
| `journeysTable.ts --idioma italian` | Traveler A1 live, Friends A0 draft, Traveler A2 draft. No existe Friends A1 (cuadra) |
| Friends IT A0 (`cmu0dpa3i0007j80ugstn0jf0`) | draft, Genova, Alice y Matteo (cuadra) |
| `assertLadderContiguous` para Friends italian/italy a1 (en seco) | pasa |
| `assertTopicsGrounded`, modo journey-level, con los 7 temas de este plan (en seco) | pasa; 2 personas detras |
| `assertJourneyType relationships / Friends` | pasa |
| Slugs y labels de los 7 temas en `Topic` | los 7 libres |
| Molde `docs/plan-fr-a1-friends*.md` | NO esta en `origin/main`: vive sin commitear en el checkout principal. Leido de ahi; como molde se uso sobre todo `docs/plan-de-a1-friends.md` (aprobado, en main) |
| Disco | 1,3 GB libres, no 8: worktree con checkout parcial (sin `public/`, `apps/`, `android-twa/`) |

Scripts de solo lectura: `scripts/_itA1Friends/dump.ts`, `ground.ts`, `cand.ts`, `lvl.ts`.

## 1. Forma

| Campo | Valor |
|---|---|
| Tipo | Friends (`typeSlug` relationships), italian / italy, a1, 1x7x3 |
| Estilo | narrador, una voz, habla citada dentro de la prosa, banda 25-35% (el A0 de Genova esta en 28,6) |
| Largo | 128-155 palabras por cuerpo (banda A1 del spec, un minuto) |
| Parrafos | 4, 5 o 6, distinto entre las tres historias de cada tema |
| Lugar | Milano, NoLo: una casa di ringhiera en via Padova (el cortile, la ringhiera del primero y del tercer piso), con salidas cortas al parque de la Martesana, a Linate y a la bottega del cortile |
| Fijos | 2: Elisa (en las 21) y Davide (en mas de la mitad) |
| Nuevos | 1 por tema desde el tema 2, en la primera historia del tema, confinado a su tema |
| Hablan por historia | 2, como mucho 3; el narrador ancla cada cambio de voz |
| Cierre de tema | la historia 3 cierra su arco; ningun mini-cliffhanger en el ultimo slot |

**Por que Milano.** Ningun journey live o draft la usa (medido sobre el texto de los 39 vigentes). Traveler A1/A2 pasan por Roma, Napoli, Firenze, Bologna, Catania, Palermo, Torino, Verona, Padova, Messina y Scilla; el A0 esta en Genova. Un anglosajon la situa sin ayuda y trae anclas propias que no toca nadie: la casa di ringhiera, Ferragosto con la ciudad vacia, las fontanelle.

## 2. Banda gramatical A1 (vara externa)

El validador no tiene sonda de gramatica para italiano: **la medida es floja** y la vara es externa, el sillabo CILS A1 de la Universita per Stranieri di Siena, nivel **receptivo** (el alumno lee y escucha, no produce). Contraste con el CILS A2 para saber que queda fuera.

**Nuevo respecto al A0 (CILS A1 receptivo):**
- `passato prossimo` con `avere` y `essere` en verbos frecuentes: 3 a 6 usos por historia. Es lo que la hace A1. La narracion va en presente; el passato prossimo cuenta lo que paso antes de la escena y vive sobre todo en las citas ("Ho dimenticato la sveglia").
- Modales `potere`, `dovere`, `volere` + infinitivo; `vorrei` de cortesia.
- Imperativo de `tu` y `voi`, afirmativo y negativo, nunca cerrando una replica (`dialogue-bare-imperative`).
- Subordinadas: causal con `perché`, temporal con `quando`, final implicita con `per` + infinitivo, hipotetica con `se` + presente, relativa con `che` (como mucho 2 por historia).
- Pronombres de complemento (CILS A1 receptivo): tonicos tras preposicion libres; atonos `lo, la, li, le, gli` como mucho 3 por historia (el CILS los pide productivos en A2).

**Prohibido (CILS A2 o superior):** imperfetto (tambien `era` y `c'era`), futuro, condizionale salvo `vorrei`, congiuntivo, `stare` + gerundio, `si` impersonal, `ne`, clitico doble (`glielo`, `me lo`), completivas con `che` ("dice che..."), estilo indirecto. Nada de argot ni dialecto milanes.

**Unica desviacion declarada:** el CILS pone la conjugacion de `andare, bere, dare, dire, fare, stare, venire` en A2. Se permiten en presente y passato prossimo porque son del Vocabolario di base y el A0 ya los usa; prohibirlos no deja escribir una escena.

- Mediana 6-8 palabras por oracion, techo de densidad 11 (`cierraTema`). Si se pasa, se quita un hecho, no se aprieta la frase.
- Recursos A1 (spec 3ter): causalidad explicita, humor de situacion, gancho final literal. Nada figurado.
- Emocion en tres piezas (sensacion, motivo, gesto); ultima linea en imagen concreta, nunca maxima.

## 3. Reparto (propio)

Ningun nombre sale en el texto de los 39 journeys live+draft ni en los planes de `docs/`. Ningun oficio repite el de un personaje de otro journey: descartados por choque `parrucchiera` (Julieta, ES Friends A1; Katrin, DE Friends C1), `portinaio` (Wollny, DE Expat C1), `traduttrice` (Celia, ES Traveler B1), `commessa` (figurante del DE Expat C1). Todos adultos en activo, italianos, 29-45 anos. Nadie hereda nada del A0: la continuidad con Genova es solo de vocabulario.

| Nombre | Rol | Edad | Ficha fija (repetida en cada escena) | Presentacion (que ES) | Forma | Tema |
|---|---|---|---|---|---|---|
| **Elisa** | protagonista, en las 21; de Milano, vive en el tercer piso | 33 | pelo castano claro liso por los hombros, sin flequillo; chaqueta de punto verde botella (fuera del uniforme) | "Elisa, un'hostess di Linate," | aposicion | todos |
| **Davide** | fijo; de Lecco, vive en el primer piso; reparte de 6 a 13 | 34 | pelo negro corto, barba corta; sudadera roja | "Davide è un postino di via Padova" | con essere | todos |
| Nicola | nuevo | 38 | cabeza rapada, bigote castano; chaleco amarillo de Poste | "Nicola, un collega di Davide," | aposicion | 2 |
| Serena | nueva; trabaja desde casa en el segundo piso | 36 | pelo negro rizado recogido, gafas redondas; jersey gris perla | "Sulla ringhiera c'è Serena, una ricercatrice del Politecnico" | dopo il luogo | 3 |
| Noemi | nueva | 41 | pelo rubio corto, sin flequillo; bata azul claro | "Noemi è una veterinaria di via Padova" | con essere | 4 |
| Tommaso | nuevo; bottega en el cortile | 45 | pelo castano con entradas, barba gris corta; delantal de cuero marron | "Nella bottega c'è Tommaso, un falegname" | dopo il luogo | 5 |
| Gabriele | nuevo | 29 | pelo rubio rizado corto; camiseta blanca y gorra azul | "Gabriele, un gelataio di NoLo," | aposicion | 6 |
| Arianna | nueva; la novia de Davide | 31 | pelo castano oscuro largo en trenza, sin flequillo; chaqueta vaquera | "Arianna è un'insegnante di yoga" | con essere | 7 |

Formas: aposicion 3, con essere 3, dopo il luogo 2 (ninguna pasa de la mitad). **El perro** no es personaje: mestizo mediano, blanco con una oreja negra, collar rojo desde el tema 1; no habla, y su nombre no llega hasta la ultima historia (sale en un solo cuerpo, fuera del reparto que miden los gates). Aviso esperado: `character-names-unverified` en los que no esten en el banco `italian/italy`.

## 4. Espina

Elisa y Davide son amigos desde el liceo y viven en la misma casa di ringhiera. Una noche de lluvia encuentran un perro atado a la ringhiera del cortile, sin collar. Nadie lo reclama. Elisa lo quiere, pero vuela a turnos y duerme fuera; Davide propone el trato: **"Metà e metà."**

La pregunta del journey: **se puede tener algo a medias con un amigo (tiempo, dinero, casa) sin que la amistad se vuelva cuentas?** Cada tema lleva el trato a un terreno nuevo y cada vez le cuesta algo a uno de los dos. En el tema 7 Arianna se muda con Davide y es alergica: la mitad de Davide se acaba. Elisa se queda el perro sola, Davide pasa a ser el paseo del domingo, y el perro por fin tiene nombre. La mitad se acaba; la amistad no.

Diferencia con las espinas vigentes: nadie se muda de ciudad (FR A0, FR A2, DE A0, DE A1), no hay confesion ni pacto amoroso (IT A0), no hay negocio (FR B1). Lo compartido es pequeno y diario, que es donde el A1 tiene sus palabras.

## 5. Los siete temas

Nombres de DOMINIO (`project_topic_naming_rule`): ingles, ampersand, 2-4 palabras, sin pais, slug derivado, `isUniversal: false`. Ninguno nombra objetos sueltos ni coincide con los 21 temas italianos vigentes.

**Evidencia.** El corpus italiano son 4 solicitudes y **una sola frase de proposito** (Susan). No da para una cita por tema: citar por separado repartiria una frase entre siete temas, que es el anti-patron que el porton prohibe. Por eso los siete van en **modo journey-level**, igual que el A0 de Genova y el DE A1. Salida en seco de `assertTopicsGrounded`:

```
MODO JOURNEY-LEVEL · 2 persona(s) detras de todo el journey
  <- I will be going on a solo trip to Italy
  <- understand and speak some basic Italian
  <- as I learn foreign languages
```

Lectura honesta: la frase de Susan sostiene el SUELO (italiano basico, entender a gente hablando entre si); la de Irina esta porque el porton pide dos personas. Los dominios salen del tipo Friends.

| # | Tema (slug) | Cita (journey-level) | Nuevo | Arco del tema | Coste no devuelto |
|---|---|---|---|---|---|
| 1 | Pets & Strays (`pets-and-strays`) | "understand and speak some basic Italian" | - | Elisa vuelve de un vuelo de noche y encuentra el perro atado y empapado; lo secan en casa de Davide; buscan al dueno por el cortile y el barrio sin suerte; el lunes toca el canile y Davide propone "metà e metà" | Elisa pierde el fin de semana en el lago de Como que tenia pagado |
| 2 | Work & Shifts (`work-and-shifts`) | idem | Nicola | La aerolinea le cambia los turnos a Elisa y el martes no hay nadie; Davide cambia su ronda con Nicola; Elisa se duerme, falla el relevo y el perro pasa ocho horas solo | Davide regala a Nicola sus sabados libres de un mes |
| 3 | Neighbours & Noise (`neighbours-and-noise`) | idem | Serena | El perro aulla cuando se queda solo; notitas en la ringhiera; Serena, que trabaja desde casa, se queja en la reunion del condominio; al final solo se calla si hay alguien | Davide deja el calcetto del jueves, despues de diez anos |
| 4 | Bills & Expenses (`bills-and-expenses`) | idem | Noemi | El perro se traga un calcetin; urgencia de noche con Noemi, 380 euros; Davide no llega hasta el sueldo y paga Elisa; nace el cuaderno de gastos y Elisa apunta hasta el pienso | Davide vende su vieja bici para devolver su mitad |
| 5 | Repairs & DIY (`repairs-and-diy`) | idem | Tommaso | El perro muerde la pata de la silla de la madre de Elisa; Davide lo arregla con el taladro y lo empeora; Tommaso los ayuda en la bottega | la pata original: la silla vuelve con una pata de otra madera |
| 6 | Summer & Holidays (`summer-and-holidays`) | idem | Gabriele | Ferragosto, Milano vacia y bochorno; Davide esta en Puglia; Elisa y el perro sobreviven al calor entre fontanelle y la sombra de la gelateria de Gabriele; Davide vuelve antes porque a Elisa le cambian un vuelo | dos dias de mar de Davide; en Puglia ha conocido a alguien (sin nombre aqui) |
| 7 | Couples & Living Together (`couples-and-living-together`) | idem | Arianna | Arianna se muda con Davide y estornuda desde la primera caja; Davide intenta sostener su mitad sin decirlo; Elisa lo descubre y decide ella: se queda el perro sola | la mitad de Davide, y con ella el sabado libre de Elisa; cierre sin gancho: el domingo Davide llama al perro por su nombre desde el cortile |

## 6. Vocabulario

### Forma

- **20 plazas por historia: 15 portables y 5 ancladas** (25% de ancladas, margen bajo el tope del 30%).
- **Solape:** lo ANCLADO a cero contra los tres journeys italianos vigentes; la capa PORTABLE (verbo, adjetivo, adverbio, expresion) se reabre, tambien la del A0 de Genova (`project_vocab_portable_layer_between_levels`, la que ya aplica `saveStory`). Clasificacion portable/anclada a mano, no por `type`.
- Ancla cultural siempre en plaza: casa di ringhiera, Ferragosto, fontanella, cortile.
- Nunca cognados transparentes (hostess, yoga, microchip, trolley van en el texto, no en plaza) ni universales.
- Suelo de escalera A1 del gate: media 1,6, cola 70%, ancladas 30%. **Objetivo del plan: media 2,0 o mas, cola 55% o menos.** Se mide al cerrar cada tema con un `recirc.ts` portado del A0.

### Campo por tema

Cruzado el 2026-09-14 contra las 1.152 superficies de vocab de los tres journeys italianos. `*` = fuera de `italianA1A2.ts` (ver bloqueo 8.2).

| # | Libres (candidatas a plaza) | Ya ensenadas en otro journey italiano (solo texto) |
|---|---|---|
| 1 | randagio, collare, ciotola, cuccia, crocchette, zampa, pelo, abbaiare, adottare, padrone, cortile, portone, legare, spaventato, ringhiera, canile, cucciolo | cane, guinzaglio, coda, coperta, magro, asciugamano, bagnato, tremare |
| 2 | sveglia, volo, pausa, ferie, straordinario, stipendio, divisa, pacco, in anticipo, dimenticare, giro, cambio | turno, orario, lettera, consegnare, scambiare, valigia, capo, sbagliare, stanco |
| 3 | lamentarsi, bigliettino, condominio, amministratore, campanello, disturbare, silenzioso, fastidio, arrabbiarsi, calmarsi, tapparella, ululare | rumore, silenzio, riunione, muro, sottile, pianerottolo, bussare |
| 4 | bolletta, spese, risparmiare, prestito, debito, veterinario, visita, calzino, inghiottire, ricevuta, costoso, bonifico, salvadanaio | quaderno, dividere, restituire, portafoglio, conto, soldi, metà, scontrino |
| 5 | trapano, cacciavite, martello, chiodo, vite, colla, aggiustare, rompere, graffiare, gamba, attrezzi, bottega, falegname, vernice, pennello, dipingere, misurare, maniglia | mordere, sedia, legno, divano, cuscino |
| 6 | ferie (si no la gasta el 2), afa, zanzara, ventilatore, condizionatore, ghiacciolo, fontanella, sudare, Ferragosto, abbronzato, cono, coppetta, gusto, pistacchio, abbassare | caldo, vuoto, ombra, serranda, gelato, spiaggia, mare |
| 7 | convivere, allergia, starnutire, fidanzata, trasloco, scatolone, rinunciare, chiavi, fare spazio | fidanzato, armadio, cassetto, spazzolino, scegliere, tenere, nome, salutare, mancare |

### Escalera desde el A0 de Genova (recirculacion en el TEXTO)

El alumno que termina el A0 ya conoce estas portables. Vuelven en la prosa desde el tema 1 para que el A1 no le suene a idioma nuevo; pueden reabrirse como plaza, pero se prefiere gastar la plaza en palabra nueva.

| Tema | Portables del A0 que reaparecen en el cuerpo |
|---|---|
| 1 | aspettare, cercare, trovare, asciugare, accarezzare, annusare, sporco, piccolo, avere freddo, avere fame, piano piano, insieme |
| 2 | lavorare, arrivare, tornare, partire, presto, dopo, essere in ritardo, di notte, di mattina, torno subito, va bene |
| 3 | gridare, sussurrare, suonare, arrabbiato, nervoso, tranquillo, piangere, chiedere scusa, mi dispiace, avere ragione |
| 4 | dividere, contare, comprare, perdere, giusto, difficile, invece, davvero, uno per te e uno per me |
| 5 | rompersi, rotto, usare, mettere, togliere, vecchio, nuovo, forte, lentamente, quasi, non importa |
| 6 | restare, sparire, fresco, lontano, stasera, avere caldo, buon viaggio, ci vediamo |
| 7 | abbracciare, sorridere, ridere, triste, contento, felice, ti voglio bene, lo so, per sempre, la prima volta |

### Recirculacion interna, planificada desde el tema 1

La leccion del A0 de Genova: la escalera bloquea el guardado del ULTIMO tema si no se planea desde el primero. Reglas:

1. **Toda portable nueva entra como muy tarde en la historia 15** (tema 5). Los temas 6 y 7 gastan sus plazas en ancladas de su campo, expresiones y portables reabiertas.
2. **Objetos de la espina que viajan por las 21 en el texto:** il cane, il guinzaglio, la ciotola, il collare rosso, la ringhiera, il cortile, il quaderno delle spese (desde el 4), "metà e metà".
3. **Reensenanza acotada** en los temas 6 y 7: solo portables de los temas 1 a 3, a 6 historias o mas de distancia, como mucho 4 por historia, y siempre palabra libre.
4. **Palabras gramaticales nunca como plaza.**
5. Lista obligatoria de reencuentro (portable del tema 1-3 -> temas donde tiene que volver en el cuerpo):

| Palabra (tema de entrada) | Vuelve en |
|---|---|
| abbaiare (1) | 3, 6, 7 |
| spaventato (1) | 3, 5 |
| legare (1) | 4, 6 |
| adottare (1) | 7 |
| dimenticare (2) | 4, 5, 7 |
| in anticipo (2) | 5, 6 |
| sveglia (2) | 3, 6 |
| stipendio (2) | 4 |
| lamentarsi (3) | 5, 7 |
| arrabbiarsi (3) | 4, 7 |
| disturbare (3) | 6, 7 |
| calmarsi (3) | 4, 6 |
| risparmiare (4) | 6, 7 |
| costoso (4) | 5, 7 |
| aggiustare, rompere (5) | 7 |

La lista se copia al JSON de plan de cada tema, y el cierre de cada tema mide la escalera acumulada antes de seguir.

## 7. Proceso por tema (fase 2, tras aprobacion)

Paso previo, una vez: `scripts/_scaffoldFriendsITa1.ts` calcado del DE A1 (`assertLadderContiguous`, `assertTopicsGrounded` journey-level, `assertJourneyType`), primero con `--dry`.

Por tema, del 1 al 7: `rulesFor.ts story vocab journey` y `journeysTable.ts --journey <id>`; plan JSON (registro, espina, recursos, quiere/impide/cuesta/cambia/emocion, parrafos) con la lista de reencuentro; esqueleto con el golpe emocional y despues prosa, las tres en un JSON; `saveStory.ts <data.json> --journey <id> --lang IT --level a1 --variant italy --narrator --dry`; guardado; `cierraTema.ts`; escalera acumulada; reporte a Journey-planning con `verified:` / `not verified:`.

Al final: lectura seguida de las 21 buscando plantillas en 3 o mas historias.

## 8. Bloqueos de codigo que hay que decidir ANTES del tema 1

1. **El reparto italiano solo lee presente.** `HABLA_POR_IDIOMA.IT` (`src/lib/validateJourneyStories.ts`) no tiene passato prossimo ("ha detto", "ha chiesto"). En un A1 que lo use, `castOf` sale vacio y los checks de reparto pasan sin medir, el mismo fallo que se arreglo en frances hoy. Arreglo: anadir las formas con auxiliar y un test en `validateJourneyStoriesIT.test.ts`.
2. **La lista de nivel italiana no da para un A1.** `italianA1A2.ts` tiene 797 lemas y `vocab-level-frequency` falla en a1 con 3 o mas plazas fuera de lista. Casi todo el campo libre de la tabla 6 esta fuera (hasta `nome`, `chiavi`, `euro`). Medido: el Traveler IT A1 live tiene de 7 a 20 plazas fuera de lista por historia. Sin decision, ninguna historia guarda. Propuesta: ampliar la lista con el Vocabolario di base y los temarios CILS A1/A2 en tandas, con el visto bueno del usuario (legitimo segun `feedback_vocab_zero_overlap_across_journeys`: la palabra tiene que estar en un temario A1/A2, no pasar una historia concreta).
3. **Sin sonda de gramatica italiana.** La banda de la seccion 2 hoy solo la aplica quien escribe. Propuesta: portar el detector del suelo A0 italiano (imperfetto, futuro, condizionale, congiuntivo, stare + gerundio ya los reconoce) a un marcador por tema que el cierre imprima.

## 9. Decisiones para el usuario

1. Milano, la casa di ringhiera de via Padova y la espina del perro "metà e metà", con final agridulce.
2. Los siete temas y su orden.
3. Elisa y Davide como fijos, y el reparto de la seccion 3.
4. Los tres bloqueos de la seccion 8.
