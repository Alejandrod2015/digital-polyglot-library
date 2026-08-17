# Brief · Español España A1 · "Irene vuelve a Nerja"

Reescrito 2026-08-16 sobre datos de usuario. La primera versión la diseñé desde
la coherencia del catálogo (qué temas no cubre otro journey, qué ciudad no se
pisa) y salió un journey tipo "Expat" que no pedía nadie. Esta versión sale de
lo que la gente escribió.

## 1. En qué se basa

23 solicitudes de español en `BetaSignup`, las 23 con motivación escrita a mano
(`npx tsx scripts/userEvidence.ts spanish`):

| Para qué quieren el español | Personas |
|---|---|
| Travel | 8 |
| Just for fun | 6 |
| Family connection | 3 |
| Work | 2 |
| Move abroad | 1 |
| Holiday home in Spain and I wish to talk to neighbours | 1 |
| Otras (mantener la carrera, hablarlo sin más) | 2 |

**Nadie pide vivir y trabajar en España.** Ocho de veintitrés van a viajar, seis
lo hacen por gusto y tres por familia. El único lector activo del España A0,
Vincent, escribió que tiene **casa de vacaciones y quiere hablar con los
vecinos**, y que se apuntó *"instead of books and classes"*.

**Consecuencias directas sobre la v1 de este brief:**

1. Fuera el tipo "Expat". Es **Friends**: lo que se construye es un círculo local.
2. Fuera el tema "el trabajo y las clases". Solo 2 de 23 mencionan trabajo, y el
   lector que tenemos dijo expresamente que huía de las clases.
3. Fuera "la ropa y el tiempo", que no lo respalda ninguna motivación.
4. Entran "los vecinos" y "la fiesta del pueblo", que sí.
5. Fuera Nacho, el compañero de clase. No hay clases.

**El marco.** El A0 recorre siete ciudades: el alumno pasa por España. El A1 no
recorre nada, **vuelve al mismo sitio**. Ese marco sirve a la vez al que viaja,
al que tiene casa allí y al que va a ver a la familia, que son 12 de 23.

## 2. Lo fijo

| | Valor | Por qué |
|---|---|---|
| Idioma / variante / nivel | español · spain · a1 | En español no hay A1 en ninguna variante |
| Tipo | **Friends** | Círculo local, no vida nueva |
| Estructura | 7 temas × 3 historias = 21 | Estándar del proyecto |
| Formato | **narradora**, diálogo mínimo | A0, A1 y A2 narrados; el multipersonaje empieza en B1 |
| Voz | **Maia**, `jipeLrCHZ6ByxrU2JP9i` | La del A0 España: el alumno no nota costura al cambiar de nivel |
| Largo | **134 palabras** | Medido: el A0 corre a 134 ppm (131-136 en 13 historias). Un minuto |
| Vocab | **24 items** | Igual que el A0 |

El largo no sube respecto al A0. Si cada nivel creciera para meter la misma
trama con más gramática, en C1 habría historias de diez minutos.

## 3. El escalón A0 → A1

Medido sobre los 21 cuerpos del A0: **cero** pasados de cualquier tipo, **cero**
pronombres de objeto agrupados, subordinadas en el 3% de las frases.

| | A0 | A1 |
|---|---|---|
| Tiempos | solo presente | presente + **pretérito perfecto** |
| Frase | una idea por frase | dos ideas unidas por porque, cuando, si, que |
| Pronombres | evitados | **se lo da, me lo dice, te lo enseño** |
| Léxico | lo que se ve y se toca: arena, toalla, ola, concha | lo que se hace y se siente: quedar, tardar, hacer falta, probarse |
| Historia | escena de acciones encadenadas | **un obstáculo pequeño y su solución** |

**No lleva**: indefinido, imperfecto, subjuntivo, condicional, relativas
encadenadas, giro final ni revelación. Eso es de A2 en adelante.

**Consecuencia del minuto fijo**: a 134 palabras el A1 cuenta menos que el A0,
porque más palabras se van en gramática. "Pau da la concha a Lucía" son seis
palabras; en A1 son catorce: "Pau ha encontrado una concha y se la ha dado a
Irene". Donde el A0 encadena cinco acciones, el A1 tiene sitio para tres.
**Un obstáculo por historia, nunca dos.**

## 4. La espina

**Irene**, treintaypocos, madrileña con una casa pequeña en **Nerja**. No vive
allí: vuelve cada temporada. Cada hilo es reentrar en la vida del pueblo y
descubrir que las cosas tienen reglas que nadie explica.

Nerja no aparece en el A0, ni Irene, ni el resto del reparto.

| Personaje | Quién | Edad |
|---|---|---|
| Irene | vuelve cada temporada a su casa del pueblo | adult |
| Toñi | la vecina de al lado, la que sabe todo | adult |
| Quique | el del bar de la plaza | adult |

Sin niños y sin ancianos, por la regla de voces.

**Mecanismos repartidos a propósito**, para no repetir 21 veces "el local sabio
enseña a la de fuera": Toñi enseña en los vecinos y en la casa; Irene observa
sin maestro en el reloj; el sistema la sorprende en el bar y en la farmacia; en
la compra es un intercambio entre iguales; y en la fiesta es ella la que aporta
algo.

## 5. Los 21 slots

Arcos resueltos contra la regla del validador (un no-comfort no se repite en las
3 anteriores; los comfort, máximo 2 seguidos) más dos reglas propias: el slot 0
no puede llevar arco de cierre y el slot 2 tiene que aterrizar. Reparto:
reframe-turn 5, mini-cliffhanger 5, recurring-character-callback 5,
harmonic-close 4, daily-encounter 2.

### los-vecinos
| Slot | Arco | Historia | El obstáculo |
|---|---|---|---|
| 0 | reframe-turn | Irene llega y saluda a todo el mundo con un "hola" corto | Aquí no se saluda de paso, se pregunta por la familia |
| 1 | mini-cliffhanger | Toñi le ha guardado un paquete que llegó en marzo | Lleva meses en su casa y nadie se lo dijo |
| 2 | recurring-character-callback | Irene le sube fruta a Toñi sin que se lo pidan | Ya sabe cómo funciona |

### el-bar
| Slot | Arco | Historia | El obstáculo |
|---|---|---|---|
| 0 | daily-encounter | Se sienta a esperar la carta y no llega nadie | Aquí se pide en la barra |
| 1 | reframe-turn | Pide una caña y llega una tapa que no ha pedido | Cree que es un error, y no lo es |
| 2 | harmonic-close | Quiere pagar y no sabe cómo se pide | Quique lleva su cuenta con tiza en la barra |

### la-compra
| Slot | Arco | Historia | El obstáculo |
|---|---|---|---|
| 0 | mini-cliffhanger | Pide un kilo de todo y vuelve cargada para una semana | Se va tres días y no le va a dar tiempo |
| 1 | recurring-character-callback | La pescadera le enseña a pedir "para dos" | Y le pregunta por Toñi, porque aquí todos se conocen |
| 2 | harmonic-close | Le faltan diez céntimos y se los fían | Ya no es la de la casa de arriba, es Irene |

### el-reloj
| Slot | Arco | Historia | El obstáculo |
|---|---|---|---|
| 0 | reframe-turn | Llega a comer a las dos y está lleno; a las cuatro, cerrado | El horario no es el suyo |
| 1 | mini-cliffhanger | Queda con Toñi "por la tarde" y no sabe qué hora es eso | Se planta a las cinco y no hay nadie |
| 2 | recurring-character-callback | Empieza a llegar a la vez que los demás | Nadie se lo explica: lo aprende mirando |

### la-casa
| Slot | Arco | Historia | El obstáculo |
|---|---|---|---|
| 0 | daily-encounter | Llega tras meses fuera y no hay agua caliente | No sabe ni cómo se llama lo que hay que tocar |
| 1 | reframe-turn | Toñi sube y le va poniendo nombre a la casa | Cuadro, llave de paso, persiana: la casa tiene vocabulario |
| 2 | harmonic-close | Desatasca sola la persiana y baja a contárselo | Esta vez no ha necesitado a nadie |

### el-medico-y-la-farmacia
| Slot | Arco | Historia | El obstáculo |
|---|---|---|---|
| 0 | mini-cliffhanger | Le duele la garganta y va a la farmacia | En su país eso se coge del estante |
| 1 | recurring-character-callback | La farmacéutica le pregunta los síntomas | Se queda sin palabras justo cuando las necesita |
| 2 | harmonic-close | Vuelve preparada y esta vez se explica | Ha tenido que aprenderse las palabras antes de salir |

### la-fiesta-del-pueblo
| Slot | Arco | Historia | El obstáculo |
|---|---|---|---|
| 0 | reframe-turn | Se entera de la fiesta por un cartel, dos días antes | Todo el mundo lleva meses sabiéndolo |
| 1 | mini-cliffhanger | Toñi le dice que traiga algo y no dice qué | No sabe si es comida, bebida o una silla |
| 2 | recurring-character-callback | Lleva lo que hacía su abuela y se acaba lo primero | Por fin aporta en vez de recibir |

## 6. Reglas duras para la generación

1. 134 palabras. El gate es el minuto de audio, no una estimación.
2. 24 items de vocab, todos presentes literalmente en el cuerpo.
3. Narradora. El diálogo aparece solo cuando la frase lo pide, nunca como forma.
4. Un obstáculo por historia. Si hay dos, sobra uno.
5. Presente y pretérito perfecto. Nada más.
6. Las anclas culturales se etiquetan `register: "cultural"` desde el principio.
7. El campo `cast` se siembra a la vez que el texto, no después.
8. Ninguna historia cierra con frase-moraleja. Se cierra en un hecho concreto.
