# -*- coding: utf-8 -*-
"""El narrador dice quien habla en las 21 del Traveler ES latam A1.

El fallo es el mismo que el del PT-BR A1 de anteayer (feedback_narrator_says
_who_speaks): 36 parrafos abrian una cita, la cerraban y abrian otra sin nada
en medio, asi que el lector contaba turnos para saber quien hablaba. En audio,
con un solo narrador leyendo las dos, no hay ni alternancia que contar.

`_acotacion.ts` daba 97% y no lo veia: mide si hay narracion AL LADO de la cita,
no si esa narracion NOMBRA a quien habla. Solo 6 de 68 parrafos citados traian
un nombre pegado a la cita.

Dos cuidados al escribir esto:
  - el habla citada tiene que quedarse entre el 25% y el 35% EXCLUSIVE, y cada
    palabra de acotacion que se anade baja ese porcentaje. En las historias que
    ya rozaban el 25 (la 5, la 8, la 10, la 12, la 16, la 17) la acotacion se
    PAGA quitando narracion o alargando la replica, no anadiendo por encima.
  - ninguna de las 420 superficies de vocab puede desaparecer de su cuerpo.
"""
import json, sys

D = json.load(open("scripts/_a1latamV3.json", encoding="utf-8"))
by = {s["slug"]: s for s in D}
fallos = []

def R(slug, a, b):
    s = by[slug]
    if a not in s["text"]:
        fallos.append(f'{slug} || {a[:75]}')
        return
    s["text"] = s["text"].replace(a, b, 1)

# ── 1. Cusco, Elena y Julio ──────────────────────────────────────────
R("el-terminal-terrestre-a-las-ocho",
  "“¿A qué hora sale?” “El horario cambia; hoy sale a las ocho en punto.” Elena mira el letrero",
  "“¿A qué hora sale?”, pregunta Elena. Julio contesta: “El horario cambia; hoy sale a las ocho en punto.” Ella mira el letrero")
R("el-terminal-terrestre-a-las-ocho",
  "“Queda un asiento disponible, adelante y del lado de la ventana.” Elena lo escucha",
  "“Queda un asiento disponible, adelante y del lado de la ventana”, dice la mujer de la taquilla. Elena la escucha")
R("el-terminal-terrestre-a-las-ocho",
  "“Es el triple de lo que cuesta ese viaje de día.” “La gente con plata toma el avión, y de noche falta gente; por eso sube.” Julio lleva la valija",
  "“Es el triple de lo que cuesta ese viaje de día”, se queja Elena. Julio le explica: “La gente con plata toma el avión, y de noche falta gente; por eso sube.” Después lleva la valija")

R("la-manta-del-bus-cama",
  "Entra una llamada de Julio. “¿Pediste la manta a tiempo",
  "Entra una llamada de Julio, que pregunta: “¿Pediste la manta a tiempo")
R("la-manta-del-bus-cama",
  "“Sí, y también el cinturón, que estaba debajo del asiento y no al costado.” “Entonces ya está; duerme antes de la primera curva.” Elena saca lentamente",
  "“Sí, y también el cinturón, que estaba debajo del asiento y no al costado”, contesta Elena. “Entonces ya está; duerme antes de la primera curva”, dice él. Ella saca lentamente")
R("la-manta-del-bus-cama",
  "“Come algo ahora, que no paran hasta las tres de la mañana.” En cada parada",
  "Julio insiste antes de cortar: “Come algo ahora, que no paran hasta las tres de la mañana.” En cada parada")
R("la-manta-del-bus-cama",
  "“Ese asiento nunca es cómodo.” Se duerme sin darse cuenta",
  "Una mujer del asiento de al lado se acomoda y comenta: “Ese asiento nunca es cómodo.” Elena se duerme sin darse cuenta")

R("amanece-en-juliaca-sin-letrero",
  "“¿Llegaste bien, o te bajaron en otro lado?” “Con retraso, pero la llegada fue tranquila.”",
  "“¿Llegaste bien, o te bajaron en otro lado?”, pregunta él. “Con retraso, pero la llegada fue tranquila”, dice Elena.")
R("amanece-en-juliaca-sin-letrero",
  "“La subida fue lenta y en la bajada frenó bastante.” “Eso es normal ahí; ese motor no aguanta la bajada de otra manera.” Elena subraya",
  "Ella sigue: “La subida fue lenta y en la bajada frenó bastante.” “Eso es normal ahí; ese motor no aguanta la bajada de otra manera”, responde Julio. Elena subraya")
R("amanece-en-juliaca-sin-letrero",
  "“Anótate este número, de alguien que maneja por esa zona.” Julio se lo dicta despacio y le presta el contacto. “Ponlo en la libreta, por si acaso”, y Elena",
  "Julio le ofrece algo antes de cortar: “Anótate este número, de alguien que maneja por esa zona.” Se lo dicta despacio y le presta el contacto. “Ponlo en la libreta, por si acaso”, insiste, y Elena")

# ── 2. Coyoacán, Ana, la señora del puesto y Carla ───────────────────
R("jitomates-sin-precio-en-coyoacan",
  "“¿A cómo el jitomate hoy?” “Según el tamaño; los chicos están en oferta y los grandes no.” La señora la reconoce y le sonríe",
  "“¿A cómo el jitomate hoy?”, pregunta Ana. “Según el tamaño; los chicos están en oferta y los grandes no”, contesta la señora, que la reconoce y le sonríe")
R("jitomates-sin-precio-en-coyoacan",
  "“Y un pedazo de queso, del salado.” “Ese es el bueno, pero cuesta el triple que el otro.” Ana mira la tabla limpia y cómo la señora pesa",
  "“Y un pedazo de queso, del salado”, pide Ana. “Ese es el bueno, pero cuesta el triple que el otro”, avisa la señora. Ana mira la tabla limpia y cómo pesa")
R("jitomates-sin-precio-en-coyoacan",
  "“Le pongo un paquete de servilletas y una docena de limones listos.” La señora le trae todo junto",
  "“Le pongo un paquete de servilletas y una docena de limones listos”, ofrece la señora, y le trae todo junto")

R("veinte-pesos-menos-en-coyoacan",
  "“¿Tienes sencillo o billete grande?” “Solo un billete grande, no me quedó nada suelto.” La señora hace la cuenta, canta el total",
  "“¿Tienes sencillo o billete grande?”, pregunta la señora. “Solo un billete grande, no me quedó nada suelto desde la mañana”, dice Ana. La señora canta el total")
R("veinte-pesos-menos-en-coyoacan",
  "“Creo que aquí falta algo, o conté yo muy rápido.” “A ver, compara: yo puse el número y tú me diste justo.” La señora hace un gesto corto y Ana espera nerviosa.",
  "“Creo que aquí falta algo, o conté yo muy rápido”, dice Ana. “A ver, compara: yo puse el número y tú me diste justo, ni un peso de más”, responde la señora con un gesto corto. Ana espera nerviosa.")
R("veinte-pesos-menos-en-coyoacan",
  "“Yo no gano quitándote monedas; usted ya viene seguido.” Aparecen los veinte pesos",
  "“Yo no gano quitándote monedas; usted ya viene seguido”, se defiende ella. Aparecen los veinte pesos")

R("carla-paga-sin-probar-la-horchata",
  "“¿Cuánto cuesta la torta?” “Cincuenta, y con descuento la mitad si te llevas dos.” Carla paga",
  "“¿Cuánto cuesta la torta?”, pregunta Carla. “Cincuenta, y con descuento la mitad si te llevas dos”, responde el señor del puesto. Carla paga")
R("carla-paga-sin-probar-la-horchata",
  "“Pídele el azúcar y la horchata en bolsita aparte, que si no te la revuelve.” Carla mira todo",
  "Ana le sopla al oído: “Pídele el azúcar y la horchata en bolsita aparte, que si no te la revuelve.” Carla mira todo")
R("carla-paga-sin-probar-la-horchata",
  "“Mañana untas la manteca sobre el pan blando.” “¿Y eso se come así, sin más?” Ana se ríe",
  "“Mañana untas la manteca sobre el pan blando”, le explica Ana. “¿Y eso se come así, sin más?”, pregunta Carla. Ana se ríe")

# ── 3. Cartagena, Lucia, su madre y el tio Jorge ─────────────────────
R("una-nota-de-voz-en-getsemani",
  "Se oye un saludo corto. “Voy la semana del quince y llevo la guitarra, si tu mamá me deja.” “Dile que no pregunte todavía, que ya bastante tiene.”",
  "Se oye un saludo corto y Jorge avisa: “Voy la semana del quince y llevo la guitarra, si tu mamá me deja.” La nota sigue más bajo, y él pide: “Dile que no pregunte todavía, que ya bastante tiene.”")
R("una-nota-de-voz-en-getsemani",
  "se queda en silencio. “Es el de la caja",
  "se queda en silencio. Después dice: “Es el de la caja")
R("una-nota-de-voz-en-getsemani",
  "“¿Qué fecha dijo?”, pregunta en voz alta. “La del quince, para la boda de tu primo.” La madre, nerviosa,",
  "“¿Qué fecha dijo?”, pregunta la madre en voz alta. “La del quince, para la boda de tu primo”, contesta Lucía. La madre, nerviosa,")

R("sin-senal-junto-a-la-muralla",
  "El tono suena cuatro veces y entra la llamada. “¿Vas a ir a esa boda",
  "El tono suena cuatro veces y entra la llamada. Lucía no saluda y suelta: “¿Vas a ir a esa boda")
R("sin-senal-junto-a-la-muralla",
  "“No sé todavía.” “Eso ya no es una respuesta, mamá; llevas un año diciendo eso.” Su madre demora en contestar y Lucía le habla suavemente, casi tan bajo que no se oye.",
  "“No sé todavía”, contesta su madre. “Eso ya no es una respuesta, mamá; llevas un año diciendo eso”, responde Lucía suavemente, casi tan bajo que no se oye. La madre demora en contestar.")
R("sin-senal-junto-a-la-muralla",
  "Lucía acerca la boca al micrófono para que se oiga bien. “Ni una mentira más en esta casa, ni por él ni por ti.”",
  "Lucía acerca la boca al micrófono y avisa: “Ni una mentira más en esta casa, ni por él ni por ti, ni por la boda.”")

R("una-carta-cruza-a-buenos-aires",
  "“Te mando el enlace; contéstame antes de que se me apague el teléfono en rojo.” Conecta",
  "Lucía le escribe a Jorge: “Te mando el enlace; contéstame antes de que se me apague el teléfono en rojo.” Conecta")
R("una-carta-cruza-a-buenos-aires",
  "“¿Lo compro o no? Quedan dos y se van a ir hoy.” “Cómpralo, y no me preguntes más.” La respuesta",
  "“¿Lo compro o no? Quedan dos y se van a ir hoy”, insiste ella. “Cómpralo, y no me preguntes más”, escribe Jorge. La respuesta")
R("una-carta-cruza-a-buenos-aires",
  "una carta corta en un sobre. “Esto se lo das tú",
  "una carta corta en un sobre y le pide: “Esto se lo das tú")

# ── 4. Oaxaca, Mateo y la tia Rosa ───────────────────────────────────
R("el-alebrije-pierde-una-pata",
  "no hace ningún gesto. “Se rompió, tía, y fue mi culpa; se me fue de la mano.” “Se rompió, sí; no te pongas así, que es madera y no un hueso.”",
  "no hace ningún gesto. “Se rompió, tía, y fue mi culpa; se me fue de la mano”, dice Mateo. “Se rompió, sí; no te pongas así, que es madera y no un hueso”, contesta ella.")
R("el-alebrije-pierde-una-pata",
  "“Yo la guardo, tía; no se la enseñes a nadie todavía.” Mateo la aprieta con la palma.",
  "“Yo la guardo, tía; no se la enseñes a nadie todavía, ni al vecino”, pide Mateo, y la aprieta con la palma.")

R("el-copal-no-se-pega-solo",
  "“¿Y si queda torcida?” “Se despega y ya está; no te preocupes.” Rosa lo dice desde la puerta, sin entrar.",
  "“¿Y si queda torcida?”, pregunta Mateo. “Se despega y ya está; no te preocupes”, contesta Rosa desde la puerta, sin entrar.")
R("el-copal-no-se-pega-solo",
  "y la estira bien. “Déjala boca abajo",
  "y la estira bien. Rosa le avisa: “Déjala boca abajo")
R("el-copal-no-se-pega-solo",
  "“Esto es más complicado de lo que parece.” “Todo lo es la primera vez.” Mateo mira el extremo suelto",
  "“Esto es más complicado de lo que parece”, dice Mateo. “Todo lo es la primera vez”, responde Rosa. Él mira el extremo suelto")

R("rosa-afila-una-varilla-de-copal",
  "“Primero se limpia y después se pega, paso a paso.” “¿Y el clavo, no sirve?” “El clavo no: eso es para muebles, y esto no es un mueble sino una figura.”",
  "Rosa empieza: “Primero se limpia y después se pega, paso a paso, sin prisa.” “¿Y el clavo, no sirve?”, pregunta Mateo. “El clavo no: eso es para muebles, y esto no es un mueble sino una figura”, contesta ella.")
R("rosa-afila-una-varilla-de-copal",
  "“Ahora lo terminas tú: una capa fina, y también la raya del ala.” Mateo lo hace despacio.",
  "“Ahora lo terminas tú: una capa fina, y también la raya del ala, que se nota”, dice Rosa. Mateo lo hace despacio.")

# ── 5. San Telmo, Pablo y Marta ──────────────────────────────────────
R("un-lomito-completo-en-san-telmo",
  "“Un lomito y un cortado, por favor.” “¿El lomito completo o simple?” Pablo no sabe",
  "“Un lomito y un cortado, por favor”, pide Pablo. “¿El lomito completo o simple?”, pregunta el mesero. Pablo no sabe")
R("un-lomito-completo-en-san-telmo",
  "“Esto no es lo que pedí; llegó",
  "Pablo se queja: “Esto no es lo que pedí; llegó")
R("un-lomito-completo-en-san-telmo",
  "“Mirá vos, pediste el completo.” “Yo quería el simple, pero dije que sí.” Marta le explica",
  "“Mirá vos, pediste el completo”, se ríe Marta. “Yo quería el simple, pero dije que sí sin pensar”, contesta él. Marta le explica")

R("dos-columnas-y-una-birome",
  "“A la izquierda tu columna, a la derecha la de acá.” “¿Y si las dos palabras son iguales?” “Entonces no va en la pizarra, no la llenes de más.”",
  "Marta empieza: “A la izquierda tu columna, a la derecha la de acá.” “¿Y si las dos palabras son iguales?”, pregunta Pablo. “Entonces no va en la pizarra, no la llenes de más”, contesta ella.")
R("dos-columnas-y-una-birome",
  "“Esto es necesario si querés vivir acá.” “Jamás lo tires; eso dura.” Pablo estira la hoja",
  "“Esto es necesario si querés vivir acá”, dice Marta. “Jamás lo tires; eso dura”, insiste. Pablo estira la hoja")
R("dos-columnas-y-una-birome",
  "“Trato hecho”, y eso sí es verdadero.",
  "“Trato hecho”, contesta él, y eso sí es verdadero.")

R("pablo-explica-el-bondi",
  "“¿Este colectivo va al centro?” “Ese bondi va, sí, pero el otro no.” Nadia intenta",
  "“¿Este colectivo va al centro?”, pregunta Nadia. “Ese bondi va, sí, pero el otro no”, contesta alguien de la fila. Nadia intenta")
R("pablo-explica-el-bondi",
  "“Colectivo y bondi son la misma cosa; acá se dice de las dos maneras.”",
  "“Colectivo y bondi son la misma cosa; acá se dice de las dos maneras”, le explica él.")
R("pablo-explica-el-bondi",
  "“¿Y la pileta del club es piscina?” “Piscina se entiende, pero acá nadie la llama así.” “Anótalo donde puedas”, y Nadia",
  "“¿Y la pileta del club es piscina?”, pregunta Nadia. “Piscina se entiende, pero acá nadie la llama así”, contesta Pablo. “Anótalo donde puedas”, insiste, y Nadia")

# ── 6. Barranquilla, Camilo, su mama y Alveiro ───────────────────────
R("un-candado-nuevo-tras-el-carnaval",
  "“Paga el cuarto por noche y no saluda a nadie.” “El alquiler se cobra los viernes, como a todos.”",
  "“Paga el cuarto por noche y no saluda a nadie en el patio”, dice su mamá desde la terraza. “El alquiler se cobra los viernes, como a todos”, contesta Camilo.")
R("un-candado-nuevo-tras-el-carnaval",
  "“¿Usted sabe quién es?” “Ni idea; el patrón no dijo nada.” La mamá de Camilo se abanica en la terraza, al lado de una planta seca.",
  "“¿Usted sabe quién es?”, pregunta Camilo. “Ni idea; el patrón no dijo nada, ni a mí ni a nadie”, responde ella, que se abanica en la terraza, al lado de una planta seca.")

R("un-favor-a-oscuras-en-barranquilla",
  "“Disculpe, ¿le sobra un enchufe?” “Me sobra, sí; suba.” Alveiro contesta desde arriba y deja la puerta entornada.",
  "“Disculpe, ¿le sobra un enchufe para cargar la linterna?”, pregunta Camilo. “Me sobra, sí; suba”, contesta Alveiro desde arriba, y deja la puerta entornada.")
R("un-favor-a-oscuras-en-barranquilla",
  "“A la lista del edificio le faltan dos nombres y uno es el suyo.” Alveiro no se queja",
  "Camilo le avisa: “A la lista del edificio le faltan dos nombres y uno es el suyo.” Alveiro no se queja")
R("un-favor-a-oscuras-en-barranquilla",
  "“Hazme el favor y firma abajo.” “Le debo una, entonces.” Incluso le ofrece la escoba",
  "“Hazme el favor y firma abajo”, pide Camilo. “Le debo una, entonces, y de las grandes”, dice Alveiro. Incluso le ofrece la escoba")
R("un-favor-a-oscuras-en-barranquilla",
  "“Ya volvió la luz”, y el pasillo",
  "“Ya volvió la luz”, grita alguien del patio, y el pasillo")

R("la-cubeta-sube-dos-pisos",
  "suelta un hilo y se para. “El agua no sube",
  "suelta un hilo y se para. Camilo golpea arriba y avisa: “El agua no sube")
R("la-cubeta-sube-dos-pisos",
  "“Suba a bañarse arriba.” “¿Y la cubeta?” “La cubeta se la presto yo.”",
  "“Suba a bañarse arriba”, ofrece Alveiro. “¿Y la cubeta?”, pregunta Camilo. “La cubeta se la presto yo”, contesta el otro.")
R("la-cubeta-sube-dos-pisos",
  "“Ahí tienes un paño limpio; el resto lo encuentras solo.” “El desagüe gotea desde hace meses, ya lo sé.” Gotea,",
  "“Ahí tienes un paño limpio; el resto lo encuentras solo”, dice Alveiro. “El desagüe gotea desde hace meses, ya lo sé”, añade. Gotea,")

# ── 7. Palermo, Sofia, Pablo, Lucas y Marta ──────────────────────────
R("dos-entradas-para-palermo",
  "“Te consigo entrada para el ensayo del jueves, pero avisá hoy.” “Voy.” Sofía no se conforma",
  "Sofía le ofrece: “Te consigo entrada para el ensayo del jueves, pero avisá hoy.” “Voy”, dice Pablo. Ella no se conforma")
R("dos-entradas-para-palermo",
  "“Yo llevo la letra y vos traé algo.” “¿Y a qué hora quedamos?” “A las ocho en la acera, no adentro.”",
  "“Yo llevo la letra y vos traé algo”, dice Sofía. “¿Y a qué hora quedamos?”, pregunta Pablo. “A las ocho en la acera, no adentro”, contesta ella.")
R("dos-entradas-para-palermo",
  "“Un poco; es la primera vez que me invitan y no sé si voy a entender la mitad.”",
  "“Un poco; es la primera vez que me invitan y no sé si voy a entender la mitad”, contesta él.")

R("otro-sello-para-corrientes",
  "“¿Trae la planilla completa?” “Creo que sí; la llené anoche.” “Le falta la casilla y el sello de la empresa.”",
  "“¿Trae la planilla completa?”, pregunta la empleada. “Creo que sí; la llené anoche”, dice Pablo. “Le falta la casilla y el sello de la empresa”, avisa ella.")
R("otro-sello-para-corrientes",
  "“Es la regla: primero el sello y después el servicio.” “¿Y cuánto tarda?” La empleada mueve la cabeza",
  "“Es la regla: primero el sello y después el servicio”, explica la empleada. “¿Y cuánto tarda?”, pregunta él. Ella mueve la cabeza")
R("otro-sello-para-corrientes",
  "“Entonces vuelvo mañana: ida y vuelta otra vez, y un veinte por ciento de suerte.”",
  "“Entonces vuelvo mañana: ida y vuelta otra vez, y un veinte por ciento de suerte”, dice Pablo.")

R("empanadas-y-un-submarino",
  "con el brazo estirado. “Traje de más, por si acaso.” “Siempre falta algo, así que está bien.”",
  "con el brazo estirado. “Traje de más, por si acaso”, dice Pablo. “Siempre falta algo, así que está bien”, contesta Lucas.")
R("empanadas-y-un-submarino",
  "Sofía llega con malas noticias. “Se cae el ensayo",
  "Sofía llega con malas noticias y las suelta de golpe: “Se cae el ensayo")
R("empanadas-y-un-submarino",
  "“¿Y ahora qué hacemos el jueves?” “Lo mismo, pero acá, y a las nueve en punto.” “Entonces yo traigo el asado y vos ponés tanto disco como quieras.”",
  "“¿Y ahora qué hacemos el jueves?”, pregunta Marta. “Lo mismo, pero acá, y a las nueve en punto”, contesta Lucas. “Entonces yo traigo el asado y vos ponés tanto disco como quieras”, se ríe Pablo.")

# ── 8. Los tres que la acotacion convierte en elenco ─────────────────
# `castOf` solo mete en el elenco a quien aparece pegado a un verbo de habla en
# DOS historias o mas. Al poner las acotaciones, Elena, Mateo y Marta cruzan ese
# umbral por primera vez, y entonces `journey-character-introduction` pide lo
# que pide para todos: un sintagma que diga QUE SON, antes de su primera cita.
# Marta ademas no aparecia hasta el cuarto parrafo, despues de dos citas, asi
# que no bastaba con describirla donde estaba: hay que meterla en la apertura.
# Las tres presentaciones no pueden salir con el mismo molde: la variedad de
# formas la mide `journey-introduction-form-variety` y el tope es la mitad. Van
# una por forma: Elena "tras el lugar", Mateo "con ser", Marta aposicion.
R("el-terminal-terrestre-a-las-ocho",
  "Elena llega con la valija y un bolso, y busca el letrero de su ruta.",
  "En la puerta está Elena, una viajera que anda sola por el sur, con la valija y un bolso. Busca el letrero de su ruta.")
R("el-alebrije-pierde-una-pata",
  "Mateo baja la figura y se le resbala.",
  "Mateo es un sobrino que pasa los domingos ahí. Baja la figura y se le resbala.")
R("un-lomito-completo-en-san-telmo",
  "entra al bar de siempre. El mesero llena el vaso",
  "entra al bar de siempre con Marta, una amiga que trabaja a la vuelta. El mesero llena el vaso")

# ── 9. Lo que la acotacion rompe aguas abajo ─────────────────────────
# `narrator-speaker-introduced` exige que la PALABRA con la que se nombra a
# quien habla salga ANTES de la primera cita. Poner acotaciones crea hablantes
# donde antes no habia ninguno ("la mujer de la taquilla", "el otro"), asi que
# cada una hay que pagarla: o se nombra a esa persona en la apertura, o se le
# da la replica a alguien que ya estaba. Lo segundo sale mas barato en palabras,
# y el cuerpo tiene un tope duro de 190.
R("el-terminal-terrestre-a-las-ocho",
  "“Queda un asiento disponible, adelante y del lado de la ventana”, dice la mujer de la taquilla. Elena la escucha",
  "“Queda un asiento disponible, adelante y del lado de la ventana”, le repite Julio. Elena lo escucha")
R("jitomates-sin-precio-en-coyoacan",
  "camina hasta la verdura.",
  "camina hasta la verdura de la señora de siempre.")
R("carla-paga-sin-probar-la-horchata",
  "“Cincuenta, y con descuento la mitad si te llevas dos”, responde el señor del puesto.",
  "“Cincuenta, y con descuento la mitad si te llevas dos”, le contesta Ana.")
R("una-nota-de-voz-en-getsemani",
  "con un apellido que aquí no se dice.",
  "con un apellido que aquí no se dice delante de su madre.")
R("una-nota-de-voz-en-getsemani",
  "se queda en silencio. Después dice: “Es el de la caja: tu tío Jorge, que anda lejos y no llama a su hermana.”",
  "se queda en silencio. “Es el de la caja: tu tío Jorge, que anda lejos y no llama a su hermana”, dice ella.")
R("una-nota-de-voz-en-getsemani",
  "La noticia corre antes del mediodía. La misma duda da vueltas toda la mañana. Lucía anota",
  "La noticia corre antes del mediodía y da vueltas toda la mañana. Lucía anota")
R("el-copal-no-se-pega-solo",
  "con la goma de la cocina.",
  "con la goma que Rosa guarda en la cocina.")
R("pablo-explica-el-bondi",
  "hay gente esperando.",
  "hay gente esperando, y entre ella Pablo.")
R("la-cubeta-sube-dos-pisos",
  "Camilo golpea arriba y avisa:",
  "Camilo golpea la puerta de Alveiro y avisa:")
R("la-cubeta-sube-dos-pisos",
  "“La cubeta se la presto yo”, contesta el otro.",
  "“La cubeta se la presto yo”, contesta él.")
R("otro-sello-para-corrientes",
  "a una oficina de Corrientes.",
  "a una oficina de Corrientes, donde una empleada atiende el mostrador.")
R("empanadas-y-un-submarino",
  "“¿Y ahora qué hacemos el jueves?”, pregunta Marta.",
  "“¿Y ahora qué hacemos el jueves?”, pregunta Sofía.")

# ── 10. Pagar las palabras y devolver los bloques a su sitio ─────────
# El cuerpo tiene tope duro de 190 palabras y las acotaciones lo empujaron por
# encima en cinco historias. Se paga cortando narracion que no lleva vocab.
# Los bloques del lector se agrupan de tres oraciones: partir una oracion en dos
# corre TODAS las fronteras y deja un bloque sin ninguna pildora, que es lo que
# miden `narrator-block-cluster` y `narrator-block-distribution`. Por eso la
# presentacion de Elena vuelve a caber en la oracion que ya existia.
R("el-terminal-terrestre-a-las-ocho",
  "En la puerta está Elena, una viajera que anda sola por el sur, con la valija y un bolso. Busca el letrero de su ruta.",
  "En la puerta está Elena, una viajera de paso, con la valija y un bolso, y busca el letrero de su ruta.")
R("el-terminal-terrestre-a-las-ocho",
  "Detrás del vidrio venden el boleto y le dan un pasaje de papel.",
  "Detrás del vidrio le dan el boleto y un pasaje de papel.")
R("veinte-pesos-menos-en-coyoacan",
  "La luz del mediodía cae de lado en Coyoacán y Ana vuelve el martes con el monedero casi vacío.",
  "El mediodía cae de lado en Coyoacán y Ana vuelve el martes con el monedero casi vacío.")
R("veinte-pesos-menos-en-coyoacan",
  "Ana apoya la mano en el mostrador y revisa las monedas antes de guardarlas.",
  "Ana revisa las monedas antes de guardarlas.")
R("una-nota-de-voz-en-getsemani",
  "Es una nota de voz de once segundos y Lucía la pone en altavoz.",
  "La nota de voz dura once segundos y Lucía la pone en altavoz.")
R("una-nota-de-voz-en-getsemani",
  "Lucía deja el teléfono encendido en la mesa y no se mueve.",
  "Lucía deja el teléfono encendido y no se mueve.")
R("una-carta-cruza-a-buenos-aires",
  "Lucía anda hasta la oficina, pide permiso a su jefa y se queda hasta tarde.",
  "Lucía pide permiso a su jefa y se queda hasta tarde.")
R("una-carta-cruza-a-buenos-aires",
  "Su madre pone también una carta corta en un sobre y le pide:",
  "Su madre pone una carta en un sobre y le pide:")
R("el-alebrije-pierde-una-pata",
  "El alebrije lleva doce años en la misma repisa, con polvo. Mateo es un sobrino que pasa los domingos ahí. Baja la figura y se le resbala.",
  "El alebrije lleva doce años en la misma repisa, con polvo. Mateo, un sobrino que pasa los domingos ahí, baja la figura y se le resbala.")
R("el-alebrije-pierde-una-pata",
  "La tía Rosa, una mujer que talla figuras desde joven, entra secándose las manos, calla un momento y no hace ningún gesto.",
  "La tía Rosa, una mujer que talla figuras, entra secándose las manos, calla y no hace ningún gesto.")
R("empanadas-y-un-submarino",
  "Pablo llega con la picada en una mano y las empanadas en la otra.",
  "Pablo llega con la picada y las empanadas, y Sofía sube detrás.")

# ── 11. Ultimo repaso: ancla sensorial, tope de palabras y bloques ───
# La 5 se quedo sin ninguna categoria sensorial al recortarle "la luz"; el
# `narrator-sensory-anchor` lo canta y tiene razon, la apertura quedaba en ficha
# tecnica. En la 9, la 16 y la 17 la pildora no se mueve quitando palabras: hay
# que mover la FRONTERA, y la frontera va cada tres oraciones, asi que se parte
# o se junta una oracion y el bloque denso se reparte.
R("veinte-pesos-menos-en-coyoacan",
  "El mediodía cae de lado en Coyoacán",
  "La luz del mediodía cae de lado en Coyoacán")
R("el-terminal-terrestre-a-las-ocho",
  "un chofer de taxi que ya la llevó al mirador",
  "un chofer que ya la llevó al mirador")
R("el-terminal-terrestre-a-las-ocho",
  "Otro viajero pregunta por ese asiento y se queda sin él.",
  "Otro viajero pide ese asiento y se queda sin él.")
R("el-alebrije-pierde-una-pata",
  "La pata rota es fina y tiene la punta partida en dos.",
  "La pata rota es fina y la punta está partida.")
R("el-alebrije-pierde-una-pata",
  "Pone la tapa de vidrio encima para tapar el canto y la mancha. Esa noche la figura sigue en su repisa.",
  "Pone la tapa de vidrio para tapar el canto y la mancha. Esa noche sigue en su repisa.")
R("una-carta-cruza-a-buenos-aires",
  "“Esto se lo das tú en la mano; nunca se lo mando yo por correo. Y no borres nada.”",
  "“Esto se lo das tú en la mano; nunca se lo mando yo por correo, y no borres nada.”")
R("un-candado-nuevo-tras-el-carnaval",
  "responde ella, que se abanica en la terraza, al lado de una planta seca.",
  "responde ella. Se abanica en la terraza, al lado de una planta seca.")
R("un-favor-a-oscuras-en-barranquilla",
  "Camilo sube con un taburete, ata la linterna arriba y se sienta en el borde.",
  "Camilo sube con un taburete. Ata la linterna arriba y se sienta en el borde.")

# La 9 no se arregla moviendo palabras: el bloque denso son tres oraciones muy
# cargadas seguidas. Partiendo la primera en dos, la tercera (guitarra, funda,
# bolso) cae al bloque siguiente y el reparto queda 6 y 5 en vez de 8 y 3. No
# cuesta ni una palabra.
R("una-carta-cruza-a-buenos-aires",
  "Su madre pone una carta en un sobre y le pide: “Esto se lo das",
  "Su madre pone una carta en un sobre. Le pide: “Esto se lo das")

# Sofia tambien cruza al elenco al ponerle voz en la 21, asi que su primera
# historia (la 19) tiene que decir quien es antes de su primera cita.
# Sofia entra por la forma "tras el lugar" y no por aposicion: con cinco
# personajes en el elenco, `journey-introduction-form-variety` deja como mucho
# tres presentaciones con el mismo molde, y las aposiciones ya eran cuatro.
R("dos-entradas-para-palermo",
  "En Palermo, Sofía baja del colectivo con dos entradas en la mano. Pablo la espera en una banca, con el morral entre las piernas.",
  "En Palermo espera Sofía, una amiga del grupo, con dos entradas. Pablo está en una banca, con el morral entre las piernas.")

json.dump(D, open("scripts/_a1latamV3.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
if fallos:
    print("NO CASARON:")
    for f in fallos: print(" ", f)
    sys.exit(1)
print("temas 1 y 2 acotados")
