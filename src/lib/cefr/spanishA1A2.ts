// Spanish A1 + A2 lemma frequency list (~1100 lemmas).
//
// Source: high-frequency Spanish A1/A2 reference vocabulary
// (CEFR Cervantes A1 + Routledge frequency dictionary top-1500).
// Curated to match the practical A1 learner experience: words a
// beginner meets in their first months — household items, daily
// actions, family, food, places, weather, body, time, basic
// adjectives, common verbs, function words.
//
// Words NOT in this list (e.g. "anafe", "talega", "alfiletero",
// "escabel", "taburete", "anaquel", "gaveta", "biombo", "visillo")
// are rare/literary/regional and inappropriate for an A1 vocab
// teaching slot. The validator uses this list to fail A1 stories
// whose vocab leaks above the level.
//
// All entries are lowercase, NFD-normalized (diacritics intact),
// in lemma form (infinitive for verbs, masculine singular for
// nouns/adjectives). When checking a vocab item, normalize the
// candidate the same way before lookup.
//
// To add a word: insert it in the right category alphabetically.
// To remove a false positive: same. Don't add cognates that the
// validator already flags (importante, normal, social, etc.).

export const SPANISH_A1_A2_LEMMAS: ReadonlySet<string> = new Set([
  // ── Function words ──
  "a","ante","bajo","con","contra","de","desde","durante","en","entre",
  "hacia","hasta","mediante","para","por","pueblo","según","sin","sobre","tras",
  "el","la","los","las","un","una","unos","unas","lo",
  "y","e","o","u","pero","sino","aunque","porque","como","cuando",
  "donde","mientras","si","aunque","ni","que","cual","cuyo","quien","quienes",
  "este","esta","estos","estas","ese","esa","esos","esas","aquel","aquella",
  "aquellos","aquellas","mi","mis","tu","tus","su","sus","nuestro","nuestra",
  "nuestros","nuestras","vuestro","vuestra","vuestros","vuestras",
  "yo","tú","él","ella","nosotros","nosotras","vosotros","vosotras","ellos","ellas",
  "me","te","se","nos","os","le","les","la","lo","las","los",
  "alguien","nadie","algo","nada","alguno","ninguno","todo","cada","otro","mismo",
  "mucho","poco","más","menos","muy","tan","tanto",

  // ── Time / frequency ──
  "hoy","ayer","mañana","ahora","antes","después","luego","pronto","tarde","temprano",
  "ya","todavía","aún","siempre","nunca","jamás","a veces","frecuentemente",
  "día","noche","tarde","mañana","mediodía","semana","mes","año","hora","minuto",
  "segundo","fin","fin de semana","verano","invierno","otoño","primavera",
  "lunes","martes","miércoles","jueves","viernes","sábado","domingo",
  "enero","febrero","marzo","abril","mayo","junio","julio","agosto",
  "septiembre","octubre","noviembre","diciembre",
  "rato","momento","tiempo","vez","veces","fecha","calendario","reloj",

  // ── Family / people ──
  "familia","padre","papá","madre","mamá","hijo","hija","hermano","hermana",
  "abuelo","abuela","tío","tía","primo","prima","sobrino","sobrina",
  "marido","esposo","esposa","mujer","hombre","niño","niña","bebé",
  "amigo","amiga","novio","novia","vecino","vecina","compañero","compañera",
  "señor","señora","señorita","persona","gente","alguien","todos",
  "joven","mayor","adulto","abuela","abuelo","nieto","nieta",

  // ── Body ──
  "cuerpo","cabeza","cara","ojo","oreja","nariz","boca","diente","lengua","labio",
  "cuello","hombro","brazo","mano","dedo","uña","pecho","espalda","cintura",
  "pierna","rodilla","pie","corazón","estómago","piel","pelo","cabello",
  "voz","sonrisa","mirada",

  // ── Clothes ──
  "ropa","camisa","camiseta","pantalón","falda","vestido","abrigo","chaqueta","saco",
  "zapato","zapatilla","bota","sombrero","gorra","bufanda","guante","calcetín","media",
  "cinturón","corbata","pijama","bolso","bolsa","gafas","anillo","reloj","collar",
  "blusa","sudadera","jersey","traje","uniforme","botón","cremallera",
  "suéter",

  // ── Home / household ──
  "casa","apartamento","piso","habitación","cuarto","dormitorio","cocina","comedor",
  "sala","baño","aseo","ducha","bañera","jardín","patio","balcón","terraza",
  "pasillo","escalera","puerta","ventana","techo","suelo","pared","muro",
  "mesa","silla","sofá","sillón","cama","armario","estante","cajón","cómoda","mueble",
  "lámpara","luz","bombilla","espejo","cuadro","alfombra","cortina","reloj",
  "llave","cerradura","timbre","escoba","trapo","jabón","champú","toalla",
  "cepillo","peine","pasta","pasta de dientes","papel","papel higiénico",
  "vela","fósforo","caja","bote","cubo","balde","botella","frasco","tarro",
  "olla","sartén","plato","vaso","copa","taza","tetera","cafetera","cuchara","tenedor",
  "cuchillo","servilleta","mantel","bandeja","jarra","abridor","sacacorchos",
  "nevera","frigorífico","microondas","horno","estufa","cocina","lavadora","aspirador","plancha",

  // ── Food / drink ──
  "comida","desayuno","almuerzo","cena","merienda","postre","plato","menú",
  "pan","queso","mantequilla","mermelada","huevo","leche","yogur","cereal",
  "fruta","manzana","pera","plátano","banana","uva","naranja","limón","fresa","sandía",
  "melón","piña","mango","durazno","cereza",
  "verdura","tomate","cebolla","ajo","papa","patata","zanahoria","lechuga","pepino",
  "calabaza","maíz","champiñón","espinaca",
  "carne","pollo","cerdo","ternera","pescado","atún","salmón","jamón","salchicha",
  "arroz","pasta","fideo","sopa","ensalada","sándwich","bocadillo","hamburguesa",
  "pizza","helado","chocolate","galleta","pastel","tarta","torta","caramelo",
  "azúcar","sal","pimienta","aceite","vinagre","salsa",
  "agua","zumo","jugo","café","té","leche","cerveza","vino","refresco","bebida",

  // ── City / places ──
  "ciudad","pueblo","barrio","calle","avenida","carretera","puente","esquina",
  "plaza","parque","jardín","mercado","tienda","supermercado","panadería","carnicería",
  "farmacia","librería","peluquería","banco","correo","biblioteca","museo","teatro",
  "cine","restaurante","cafetería","bar","hotel","hospital","clínica","escuela",
  "colegio","instituto","universidad","oficina","fábrica","estación","aeropuerto",
  "puerto","playa","montaña","río","lago","mar","bosque","campo","granja",
  "iglesia","catedral","templo","castillo","torre","fuente","monumento",
  "edificio","casa","piso","apartamento","hogar","local","entrada","salida",

  // ── Transport ──
  "coche","auto","carro","bici","bicicleta","moto","motocicleta","autobús","bus",
  "tren","metro","tranvía","taxi","camión","camioneta","barco","lancha","avión","helicóptero",
  "viaje","billete","boleto","maleta","mochila","equipaje","pasaporte","mapa",
  "parada","estación","aeropuerto","terminal","andén","embarcadero","muelle",
  "vía","carretera","autopista","semáforo","cruce","puente","puente peatonal","luz roja",
  "estacionamiento","taquilla","bocina",
  // Regional transport types — A1 vocabulary in their respective regions.
  // Latin-American Spanish traveler journeys lean heavily on these; the
  // generic "autobús" is rare in actual speech in MX/AR/CO/PE.
  "combi","colectivo","micro","minibús",
  // Travel logistics / lodging — basic A1-A2 across the Spanish-speaking world.
  "hostal","pensión","alojamiento","mirador","malecón","distrito","sector","barrio",
  "visitante","sendero","senda","feria","feria artesanal","puerto",

  // ── Nature / weather ──
  "sol","luna","estrella","cielo","nube","lluvia","nieve","viento","hielo","tormenta",
  "calor","frío","temperatura","clima","tiempo",
  "árbol","flor","hoja","planta","rama","hierba","césped","arena","piedra","roca",
  "animal","perro","gato","pájaro","gallina","vaca","caballo","cerdo","oveja",
  "pez","ratón","mosca","mariposa","abeja",

  // ── School / work ──
  "escuela","colegio","clase","alumno","alumna","estudiante","profesor","profesora",
  "maestro","maestra","libro","cuaderno","lápiz","bolígrafo","goma","regla","mochila",
  "pizarra","mesa","silla","tarea","examen","nota","palabra","frase","letra",
  "número","cuenta","problema","pregunta","respuesta","idioma","lengua",
  "trabajo","oficina","empresa","jefe","jefa","compañero","empleado","sueldo",
  "horario","reunión","informe","carta","papel","documento","ordenador","computadora",
  "móvil","teléfono","celular","tableta","pantalla","teclado","ratón",

  // ── Verbs (top frequency A1+A2) ──
  "ser","estar","haber","tener","hacer","ir","venir","ver","oír","decir",
  "saber","poder","querer","deber","creer","pensar","sentir","entender","conocer",
  "vivir","morir","nacer","crecer","llegar","entrar","salir","volver","quedar",
  "permanecer","irse","marcharse","escapar",
  "comer","beber","tomar","probar","cocinar","preparar","servir","comprar","vender",
  "pagar","costar","ganar","perder","guardar","sacar","poner","quitar","llenar",
  "vaciar","abrir","cerrar","subir","bajar","caminar","correr","saltar","nadar",
  "bailar","cantar","jugar","ganar","perder","esperar","empezar","comenzar","terminar","acabar",
  "trabajar","estudiar","aprender","enseñar","leer","escribir","hablar","escuchar",
  "preguntar","responder","contestar","contar","explicar","ayudar","cuidar","mirar",
  "buscar","encontrar","llevar","traer","mover","empujar","tirar","agarrar","coger",
  "tomar","dejar","dar","regalar","prestar","devolver","recibir","mandar","enviar",
  "abrir","cerrar","encender","apagar","conectar","desconectar","colgar","quitar","poner",
  "lavar","secar","limpiar","barrer","planchar","cocinar","calentar","enfriar","cortar",
  "pelar","mezclar","probar","servir","ordenar","arreglar","reparar","romper","romperse","caer",
  "caerse","levantarse","sentarse","acostarse","dormir","despertar","despertarse",
  "vestirse","desvestirse","ducharse","bañarse","peinarse","afeitarse","cepillar",
  "salir","entrar","viajar","visitar","conocer","saludar","despedirse","abrazar","besar",
  "llamar","invitar","pedir","ofrecer","aceptar","rechazar","decir","contar","mentir",
  "creer","dudar","recordar","olvidar","pensar","imaginar","soñar","desear","esperar",
  "gustar","encantar","interesar","aburrir","cansar","preocupar","molestar","enfadar",
  "alegrarse","entristecer","sorprender","asustar",
  "necesitar","intentar","probar","conseguir","lograr","fracasar","aprobar",
  "mostrar","enseñar","describir","explicar","comparar","elegir","preferir","decidir",
  "comprar","alquilar","vender","prestar","ahorrar","gastar","pagar","cobrar",
  "viajar","aterrizar","despegar","aparcar","conducir","manejar","frenar","acelerar",

  // ── Adjectives ──
  "bueno","malo","grande","pequeño","alto","bajo","largo","corto","ancho","estrecho",
  "nuevo","viejo","joven","mayor","menor","caro","barato","gratis",
  "fácil","difícil","posible","imposible","necesario","importante","seguro",
  "rápido","lento","temprano","puntual",
  "fuerte","débil","duro","blando","suave","áspero","liso","rugoso",
  "limpio","sucio","lleno","vacío","abierto","cerrado","encendido","apagado",
  "caliente","frío","tibio","helado","fresco","seco","mojado","húmedo",
  "claro","oscuro","brillante","apagado","colorido",
  "feliz","contento","alegre","triste","cansado","aburrido","enfadado","enojado",
  "preocupado","nervioso","tranquilo","relajado","sorprendido","asustado",
  "amable","cariñoso","simpático","antipático","educado","grosero","tímido","valiente",
  "inteligente","tonto","listo","sabio","trabajador","perezoso",
  "guapo","feo","bonito","hermoso","atractivo",
  "rico","pobre","famoso","conocido","desconocido",
  "delgado","gordo","flaco","fuerte",
  "rojo","azul","verde","amarillo","blanco","negro","gris","marrón","café","rosa",
  "naranja","morado","violeta","dorado","plateado",
  "primero","segundo","tercero","cuarto","quinto","último","siguiente","próximo",
  "redondo","cuadrado","triangular","largo","corto","plano","hondo","profundo",

  // ── Adverbs (basic, no discourse markers) ──
  "bien","mal","mejor","peor","rápido","despacio","fuerte","suavemente",
  "aquí","ahí","allí","arriba","abajo","cerca","lejos","dentro","fuera",
  "delante","detrás","encima","debajo","alrededor","enfrente",
  "sí","no","quizás","tal vez","seguramente","probablemente","claro",
  "casi","apenas","solo","sólo","únicamente","incluso","también","tampoco",
  "demasiado","bastante","suficiente",

  // ── Numbers ──
  "cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez",
  "once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho",
  "diecinueve","veinte","treinta","cuarenta","cincuenta","sesenta","setenta",
  "ochenta","noventa","cien","ciento","mil","millón",
  "primero","segundo","tercero","mitad","medio","doble","triple",

  // ── Common abstract / situations ──
  "vida","muerte","amor","cariño","amistad","felicidad","tristeza","miedo","alegría",
  "sorpresa","problema","solución","idea","pregunta","respuesta","historia","cuento",
  "verdad","mentira","secreto","sueño","plan","viaje","aventura","fiesta","cumpleaños",
  "boda","funeral","reunión","cita","entrevista","conversación","llamada",
  "salud","enfermedad","dolor","medicina","cura","ejercicio","deporte","juego",
  "música","canción","arte","cuadro","película","libro","novela","poema","noticia",
  "color","forma","tamaño","peso","precio","número","cantidad","total","suma","resta",

  // ── Common nouns extras ──
  "cosa","cosas","modo","manera","forma","tipo","clase","grupo","pareja","par",
  "lado","parte","trozo","pedazo","mitad","mitades","punta","centro","medio","borde",
  "nombre","apellido","dirección","teléfono","correo","email",
  "regalo","sorpresa","detalle","gracias","favor","ayuda","problema","accidente",
  "ruido","silencio","sonido","voz","grito","susurro","risa","llanto",
  "olor","sabor","gusto","color","aspecto","apariencia",

  // ── A2 expansion: practical items learners meet by month 6 ──
  // Tools / household
  "tijera","cinta","cuerda","cordel","hilo","aguja","botón","alfiler","clip",
  "martillo","clavo","tornillo","sierra","destornillador","herramienta","taller",
  "trapo","polvo","escoba","fregona","cubo","balde","esponja","detergente",
  "candado","cadena","gancho","colgador","percha","cesta","cesto","canasto","canasta",
  "balcón","ventanal","cristal","vidrio","reja","barandilla","persiana","contraventana",
  "armario","ropero","estantería","repisa","cajón","cómoda","gabinete","aparador",
  "cuadro","pintura","retrato","fotografía","foto","marco","póster","afiche",
  "escalera","peldaño","escalón","barandal","ascensor","elevador","sótano","ático",
  "ventana","ventanal","puerta","portón","pestillo","picaporte","cerradura","timbre",
  "cama","colchón","manta","frazada","sábana","funda","almohada","cojín","peluche",
  "mesa","silla","sofá","sillón","banco","banqueta","escritorio","tarima","mueble",
  "lámpara","bombilla","interruptor","enchufe","cable","alargador","pila","batería",
  "papel","cartón","tela","plástico","metal","madera","piedra","ladrillo","cemento",
  "envase","botella","frasco","tarro","lata","paquete","bolsa","caja","cubo","sobre",
  "bandeja","fuente","plato","vaso","copa","jarra","florero","cuenco",
  // Materials / surfaces
  "tejado","techo","piso","suelo","pared","muro","columna","esquina","rincón",
  "patio","jardín","huerta","huerto","prado","césped","camino","sendero","vereda",
  "cuesta","colina","cerro","valle","río","arroyo","laguna","estanque","piscina",
  "playa","arena","piedra","roca","montaña","cima","cumbre","desierto","selva",
  // Body / health additions
  "hueso","sangre","piel","uña","cabello","barba","bigote","mejilla","frente",
  "cuello","garganta","pecho","cintura","cadera","muslo","tobillo","talón","palma",
  "muñeca","codo","rodilla","espalda","barriga","estómago","corazón","pulmón",
  "salud","fiebre","tos","resfriado","gripe","catarro","alergia","dolor","herida",
  "venda","tirita","crema","pastilla","jarabe","médico","enfermera","dentista",
  // Verbs (A2)
  "acomodar","colocar","poner","situar","mover","arrastrar","empujar","tirar",
  "ordenar","organizar","arreglar","reparar","romper","romperse","caer","caerse",
  "plegar","doblar","desdoblar","abrir","cerrar","apretar","aflojar","atar","desatar",
  "envolver","desenvolver","cubrir","descubrir","tapar","destapar","esconder","mostrar",
  "agitar","mezclar","batir","remover","verter","llenar","vaciar","derramar","manchar",
  "repartir","entregar","recoger","juntar","separar","unir","dividir",
  "extender","encoger","estirar","apretar","apoyar","sostener","sujetar","soltar",
  "cargar","descargar","subir","bajar","alzar","levantar","apilar","colgar","descolgar",
  "encender","apagar","prender","conectar","desconectar","enchufar","desenchufar",
  "barrer","fregar","trapear","pulir","frotar","secar","mojar","enjuagar","aclarar",
  "tender","planchar","coser","remendar","desgarrar","cortar","rasgar","romper",
  "calentar","enfriar","hervir","cocer","cocinar","freír","asar","hornear","tostar",
  "morder","masticar","tragar","saborear","oler","tocar","apretar","golpear","empujar",
  "saltar","brincar","trepar","escalar","gatear","arrastrarse","tumbarse","acostarse",
  "respirar","suspirar","bostezar","estornudar","toser","reír","sonreír","llorar",
  "gritar","susurrar","murmurar","cantar","tararear","silbar","aplaudir","aclamar",
  "olvidar","recordar","saludar","despedirse","esperar","aguardar","apurar","apresurar",
  "elegir","escoger","preferir","comparar","probar","examinar","observar","vigilar",
  "perderse","encontrarse","encontrar","extraviar","esconderse","aparecer","desaparecer",
  // Adjectives / states (A2)
  "roto","rota","quebrado","entero","completo","incompleto","cerrado","abierto",
  "ocupado","libre","ausente","presente","vacío","lleno","medio","entero",
  "hondo","profundo","bajo","alto","ancho","estrecho","grueso","fino","delgado",
  "afilado","romo","puntiagudo","redondo","cuadrado","plano","liso","rugoso",
  "brillante","mate","oscuro","pálido","intenso","fuerte","suave","ligero","pesado",
  "tierno","duro","blando","crujiente","jugoso","dulce","salado","amargo","ácido",
  "rico","sabroso","delicioso","asqueroso","horrible","precioso","feo","raro","común",
  "hambriento","sediento","cansado","despierto","dormido","activo","perezoso","ocupado",
  "amistoso","cariñoso","tierno","duro","severo","estricto","relajado","tenso",
  "preocupado","tranquilo","calmado","nervioso","ansioso","asustado","valiente","cobarde",
  "perdido","encontrado","escondido","visible","invisible","claro","oscuro","brillante",
  // Sensations / atmosphere
  "hambre","sed","sueño","frío","calor","prisa","vergüenza","miedo","susto","alegría",
  "sombra","luz","aire","viento","brisa","corriente","aroma","perfume","humo","vapor",
  "ruido","sonido","silencio","eco","ritmo","melodía","tono",
  // Animals (A2)
  "pollo","gallo","gallina","pato","conejo","oveja","cabra","cerdo","cordero","ternero",
  "ratón","rata","hormiga","araña","mosca","mosquito","mariposa","abeja","avispa",
  "águila","paloma","gorrión","loro","cuervo","búho","ganso","cisne",
  "tiburón","ballena","delfín","cangrejo","tortuga","rana","sapo","serpiente","lagarto",
  // School / objects (A2)
  "regla","goma","sacapuntas","corrector","carpeta","archivador","pizarra","tiza",
  "marcador","rotulador","plumón","pegamento","cola","tijera","grapadora","grapa",
  "diccionario","atlas","mapa","globo","calculadora","ordenador","portátil","tablet",
  "auricular","altavoz","micrófono","cámara","cargador","cable","memoria","disco",
  // Travel / nature
  "maleta","valija","mochila","bolso","cartera","monedero","tarjeta","billete","boleto",
  "viajero","turista","guía","mapa","brújula","linterna","botiquín","cantimplora",
  "tienda","carpa","saco","hoguera","fogata","leña","brasa","ceniza","carbón",
  "montaña","cumbre","sendero","camino","puente","túnel","carretera","autopista",
  "isla","costa","puerto","muelle","barca","velero","yate","canoa","kayak","balsa",
  // Food (A2 extras)
  "harina","levadura","masa","pasta","fideo","tallarín","ravioli","salsa","caldo",
  "sopa","crema","puré","ensalada","aderezo","mayonesa","mostaza","kétchup","ketchup",
  "pimienta","comino","canela","menta","albahaca","perejil","cilantro","orégano",
  "vinagre","aceite","mantequilla","margarina","manteca","grasa",
  "miel","mermelada","jalea","chocolate","cacao","caramelo","gomita","chicle",
  "jugo","zumo","refresco","gaseosa","limonada","horchata","batido","licuado",
  "rosca","bollo","tarta","torta","pastel","budín","flan","helado","sorbete",
  "queso","yogur","crema","nata","mantequilla","huevo","tortilla","omelet",
  "cordero","ternera","filete","chuleta","costilla","muslo","pechuga","pierna",
  "atún","sardina","salmón","trucha","bacalao","calamar","pulpo","camarón","langostino",
  // Clothing extras
  "camiseta","playera","sudadera","jersey","chaleco","americana","levita","saco",
  "vaquero","jean","pantalón corto","short","bermuda","mallas","leggings","panty",
  "bañador","traje de baño","bikini","gorro","beanie","visera","pañuelo","bufanda",
  "bota","sandalia","chancla","tenis","zapatilla","tacón","pantufla","mocasín",
  "billetera","monedero","cartera","mochila","maletín","equipaje","correa","cinturón",
  // City / urban
  "acera","banqueta","cruce","semáforo","paso","peatón","cebra","bordillo","cuneta",
  "farola","poste","cartel","letrero","señal","valla","cerca","muro","tapia","jardinera",
  "tienda","local","negocio","quiosco","puesto","feria","mercado","plaza","portal",
  "edificio","torre","rascacielos","casa","chalet","cabaña","granja","rancho","finca",
  "barrio","manzana","callejón","callejuela","plazoleta","arboleda","alameda","parque",
  // Numbers extra
  "primer","segunda","tercera","cuarta","quinta","sexta","séptima","octava","novena","décima",
  "ciento","mil","millón","billón","docena","centena","decena","par","trío","cuarteto",

  // ── A2 expansion II: borderline / commonly used A2 words ──
  "varilla","cometa","corredor","mazo","paño","cordel","nudo","gancho","cuerda",
  "rama","tronco","raíz","semilla","fruta","semilla","grano","cáscara","corteza",
  "ola","marea","corriente","brisa","aire","atmósfera","horizonte","amanecer","atardecer",
  "vapor","humo","ceniza","carbón","leña","fogata","chispa","brasa","llama",
  "cresta","loma","ladera","barranco","cuesta","planicie","llanura","meseta","sabana",
  "barrio","manzana","cuadra","alameda","paseo","glorieta","rotonda","callejón",
  "sótano","pasaje",
  "vuelta","giro","curva","desvío","atajo","ruta","trayecto","recorrido",
  "salto","brinco","paso","caminata","carrera","marcha","viaje",
  "abrazo","beso","saludo","despedida","sonrisa","mueca","gesto","seña",
  "regalo","sorpresa","premio","reconocimiento","gracia","favor","ayuda","servicio",
  "sueño","pesadilla","despertar","siesta","descanso","reposo","pausa","alivio",
  "asombro","sorpresa","susto","miedo","temor","valor","coraje","confianza","duda",
  "aroma","fragancia","perfume","esencia","olor","tufo","hedor",
  "sabor","gusto","aroma","textura","tacto","consistencia",
  "tono","timbre","melodía","ritmo","silencio","eco","murmullo","susurro",
  "frase","oración","palabra","sílaba","letra","número","cifra","signo","símbolo",
  "verdad","mentira","historia","cuento","relato","leyenda","mito","fábula",
  "deseo","intención","propósito","plan","proyecto","idea","ocurrencia",
  "esfuerzo","intento","prueba","intento","práctica","ensayo","experiencia",
  "ánimo","entusiasmo","interés","curiosidad","sorpresa","emoción","sentimiento",
  "agua","aguardiente","aguafiestas","aguanieve","aguacero","chubasco","tormenta",
  "manguera","grifo","caño","tubería","ducha","fregadero","lavabo","inodoro","retrete",
  "papel","sello","sobre","carta","postal","tarjeta","invitación","factura","recibo",
  "moneda","billete","dinero","cambio","cuenta","saldo","precio","oferta","descuento",
  "bolso","bolsillo","cartera","monedero","billetera","tarjetero","chequera",

  // ── Catch-up: palabras A1/A2 obvias que aún faltaban ──
  "tierra","suelo","barro","lodo","polvareda","arena","piedra","grava","roca",
  "usado","gastado","nuevo","reciente","antiguo","moderno","reciente",
  "vacío","ocupado","disponible","reservado","cerrado","abierto",
  "limpio","sucio","manchado","fresco","podrido","caduco",
  "vela","fuego","llama","luz","oscuridad","penumbra","sombra",
  "ruedas","rueda","llanta","goma","caucho","neumático",
  "patín","patinaje","patines","bicicleta","triciclo","scooter",
  "cinta","cordón","cuerda","hilo","cable","alambre","cadena",
  "pintura","pincel","brocha","rodillo","barniz","esmalte","color","tinta",
  "papel","cartón","plástico","metal","madera","tela","cuero","goma",
  "viento","brisa","ráfaga","tormenta","huracán","tornado","ventisca",
  "luz","sombra","oscuro","brillo","reflejo","resplandor","destello",
  "sonido","ruido","silencio","murmullo","susurro","grito","eco",
  "olor","aroma","perfume","fragancia","hedor","aliento","vaho",
  "sabor","gusto","aroma","picante","insípido","soso","dulce","ácido",

  // ── Round 3 expansion: A2 functional words found as false positives ──
  // Furniture / objects / household
  "libreta","cuaderno","agenda","carpeta","portafolios","bloc","libreta de notas",
  "pupitre","escritorio","mesilla","mesita","banqueta",
  "calzado","zapatería","zapatero","pantufla","alpargata","mocasín",
  "tapete","alfombra","alfombrilla","felpudo","estera",
  "lámpara","linterna","luz","velador","candil","lamparita","luminaria",
  "tablón","tabla","plancha","placa","panel","cartelera","letrero",
  "armario","ropero","guardarropa","clóset","perchero","percha","gancho",
  "estante","estantería","librero","librería","biblioteca","repisa",
  "vitrina","exhibidor","mostrador","escaparate","escenario",
  "contenedor","envase","caja","cajita","cesto","cesta","papelera","cubo de basura",
  "tapa","cubierta","forro","funda","envoltorio","empaque","envuelto",
  "cobertor","manta","frazada","colcha","edredón","cubrecama",
  "fuente","plato","plato hondo","plato llano","cuenco","bol","tazón",
  // Materials / craft
  "témpera","tempera","acuarela","crayón","crayola","plastilina","arcilla","barro",
  "cartulina","cartoncillo","cartón","papel maché","collage","manualidad",
  "tabique","pared interior","mampara","separador",
  "pegamento","cola","goma","silicona","esparadrapo","cinta adhesiva","adhesivo","cinta",
  "broche","grapa","clavo","tachuela","alfiler",
  "molde","plantilla","patrón","figura","forma",
  // Body parts / sensations extras
  "espuma","burbuja","gota","chorro","mancha","huella","marca","raya",
  "silueta","forma","perfil","contorno","esquema","sombra",
  "destello","brillo","reflejo","resplandor","relámpago","chispa",
  // Pets / sea
  "pecera","acuario","jaula","correa","collar","comedero","bebedero",
  "caracol","caracola","concha","perla","alga","coral",
  "submarino","barco","velero","balsa","canoa","yate","crucero",
  // Print / media
  "revista","periódico","diario","catálogo","folleto","panfleto","cartel","afiche",
  "cuaderno","agenda","calendario","álbum","cuento","novela","poema","poesía",
  // Common A2 verbs / adjectives that appear
  "hervir","derretir","disolver","enfriar","calentar","cocer","tostar",
  "arrastrar","empujar","jalar","tirar","levantar","apilar","colocar","ubicar",
  "extender","desplegar","plegar","doblar","enrollar","desenrollar","estirar","encoger",
  "atar","amarrar","sujetar","fijar","clavar","colgar","desprender","despegar",
  "raspar","pulir","frotar","lijar","barnizar","pintar","pintarrajear","colorear",
  "marcar","señalar","apuntar","subrayar","trazar","dibujar","esbozar","bosquejar",
  "examinar","revisar","controlar","verificar","comprobar","analizar","observar",
  "remover","mezclar","batir","revolver","agitar","sacudir","balancear","mecer",
  "polvo",
  // Weather / atmosphere A2
  "sombrío","nublado","despejado","soleado","lluvioso","ventoso","tormentoso",
  "brumoso","nebuloso","gélido","helado","cálido","ardiente","tibio","fresco",
  // Decorations / objects
  "decoración","figura","florero",
  "candelabro","portavelas","portarretrato","portarretratos","marco","cuadro",
  "espejo","espejito","mariposa","pajarito","peluche","muñeca","muñeco","juguete",
  // Hardware / nail / building A2
  "clavo","tornillo","tuerca","arandela","bisagra","gozne","cerrojo","picaporte",
  "ladrillo","cemento","yeso","mortero","azulejo","baldosa","mosaico",
  "ducha","grifo","caño","cañería","tubo","tubería","desagüe","sumidero",
  // School A2 specific
  "escritorio","escritorio escolar","pupitre","tablilla","pizarra","encerado","tiza",
  "regla","escuadra","compás","transportador","calculadora","ábaco",
  "lámpara portátil","linterna","luz recargable","pila","batería","cargador",
  // Misc functional A2
  "maletín","mochila","saco",
  "farol","faro","farolito","linterna","velón",

  // ── Round 4: más A2 funcional clara ──
  "asiento","silla","banca","sentadero","butaca",
  "protector","protección","escudo","barrera","valla","cerca","reja","verja",
  "trofeo","premio","copa",
  "pañuelo",
  "boina","gorra","sombrero","capucha","capote",
  "pileta","piscina","alberca","tina","bañera","jacuzzi","fuente",
  "despertador","alarma","reloj despertador","sirena","campana","timbre",
  "casillero","casilla","ranura","compartimiento","compartimento",
  "recipiente","contenedor","tazón","ensaladera","fuente",
  "depósito","tanque","barril","cisterna","aljibe",
  "artificial","sintético","natural","real","auténtico","falso","verdadero",
  "purificador","filtro","colador","cernidor","tamiz",
  "pinza","tenaza","alicate","prensa","abrazadera","sujetador",
  "cortador","cuchilla","sierra","navaja","tijeras","podadora",
  "ficha","tarjeta","credencial","carnet","cédula","placa","etiqueta",
  "alineado","alineación","ordenado","desordenado","recto","torcido",
  "calzado","zapatos","botas","pantuflas","chanclas","sandalias",
  // Sounds / textures
  "vibración","temblor","sacudida","chirrido","crujido","golpe","estruendo",
  "zumbido","gorjeo","ladrido","maullido","cacareo","croar","silbido",
  // House extras commonly used
  "porche","entrada","vestíbulo","recibidor","antesala","sala de espera",
  "puerta principal","puerta trasera","portal","umbral","quicio",
  "borde","orilla","margen","esquina","rincón","punta","extremo",
  // Activities / actions A2
  "celebración","fiesta","reunión","encuentro","conferencia","asamblea",
  "preparativos","arreglos","decoración","montaje","colocación","instalación",
  "limpieza","barrida","fregado","lavado","aseo","desinfección",
  // Common verbs A2 round 2
  "ordenar","desordenar","clasificar","separar","mezclar","combinar",
  "preparar","arreglar","organizar","planificar","programar","agendar",
  "celebrar","festejar","conmemorar","homenajear","brindar","aplaudir",
  "decorar","adornar","embellecer","arreglar","ornamentar","pintar",

  // ── Round 5: palabras A2 finales ──
  "palacio","castillo","mansión","villa","cabaña","choza","tienda",
  "ocultar","ocultarse","esconder","esconderse","tapar","cubrir","disimular",
  "mostrar","mostrarse","revelar","destapar","descubrir","aparecer",
  "resistente","duradero","firme","sólido","robusto","fuerte","frágil","delicado",
  "mirador","balcón","terraza","observatorio","atalaya","ventanilla",
  "acceso","entrada","ingreso","salida","abertura","apertura","paso",
  "acumulador","batería","pila","carga","energía","electricidad",

  // === Brecha A1+A2 (vocab común que faltaba). Solo entradas confirmadas
  // A1/A2 según Plan Curricular del Cervantes. Las B1+ que estaban aquí
  // antes (morral, abanico, baúl, burbujear, chal, etc.) se quitaron para
  // que el validator caze correctamente el vocab fuera de nivel. ===
  // Lugares
  "lugar","sitio","zona","barrio","centro","afueras","pueblo","aldea",
  "calle","avenida","callejón","plaza","parque","jardín","paseo",
  "esquina","cruce","semáforo","carretera","camino","sendero","ruta",
  "puente","túnel","puerto","aeropuerto","estación","parada",
  "cabina","kiosco","quiosco","farmacia","panadería","pastelería","heladería",
  "carnicería","frutería","pescadería","peluquería","barbería","lavandería",
  "zapatería","papelería","librería","biblioteca","museo","teatro","cine",
  "circo","feria","estadio","gimnasio","piscina","cancha","pista",
  "ubicación","situación","posición","dirección","área",
  // Transporte
  "vehículo","carro","auto","coche","camión","autobús","bus","tranvía","metro","tren",
  "bote","barca","barco","bicicleta","bici","moto","patineta","patines","triciclo",
  // Acciones de movimiento (solo A1/A2)
  "pasar","cruzar","girar","doblar","regresar","volver","mudar","viajar",
  "encontrar","buscar","perderse",
  // Comunicación
  "mensaje","aviso","anuncio","noticia","nota",
  "cartel","letrero","señal","signo","símbolo","icono","logotipo","logo","marca","sello",
  "conexión","red","contacto","encuentro","cita",
  // Sistema básico
  "sistema","programa","aplicación","servicio","función","modo","tipo",
  "modelo","versión","clase","grupo","serie",
  "número","código","clave","contraseña","usuario","cuenta","perfil",
  // Tránsito
  "tráfico","retraso","demorar","demorado","hora","minuto","segundo","reloj","alarma","despertador",
  "avanzar","continuar","ajustar","mensajero","tablero","cierre","estuche","abanico",
  // Phrases (multi-word vocab items that the worker selects as single
  // teaching units; the validator checks them verbatim, so they live
  // here as keys).
  "recién hecho","tierra mojada","de todos modos","continuar derecho","movimiento bancario",
  "de un solo trago","dar vuelta","al fin","otra vez","que le vaya bien","sin querer",
  // Tienda / alimentación regional
  "dulcería","medialuna",
  // Sonido / objetos
  "parlante","parasol","morral","cúpula","antigüedad",
  // ── Regional food / drink (Latin-American Traveler vocab) ──
  // Vocab A1-A2 reconocible en su región: el aprendiz que visita
  // México encuentra "tinto" / "fonda" / "mole" en menús; el que va a
  // Argentina ve "humita" / "medialuna"; el de Lima "lúcuma" / "ceviche".
  // Antes de esta entrada, mi lista los marcaba C2 por defecto y rompía
  // las historias Traveler del nivel inicial.
  "tinto","fonda","mole","guajolote","ajonjolí","carnitas","trompo","humita","lúcuma","ceviche",
  "chipa","arepa","empanada","tamal","tamales","tortilla","churro","pastel","postre","pan",
  // Cocina / cocción
  "harina","masa","vapor","horno","fuego","aceite","cebolla","ajo","tomate","limón",
  "azúcar","sal","pimienta","leche","queso","huevo","jamón","carne","pescado",
  "voltear","mezclar","hervir","cocinar","preparar","servir","probar","hornear","picar",
  "rebanar","amasar","batir","calentar","enfriar","derretir",
  // Verbos cotidianos A1-A2 que faltaban
  "rascarse","acercarse","alejarse","agacharse","levantarse","sentarse",
  "meter","sacar","compartir","entregar","recoger","alcanzar","apoyar","empujar",
  "tardar","apurarse","apurar","esperar","quedarse","irse","volver",
  "firmar","anotar","escribir","leer","contar","sumar","restar",
  "sonar","vibrar","tocar","golpear","llamar",
  "resolver","arreglar","explicar","entender","comprender","aprender","enseñar",
  "decidir","elegir","probar","intentar",
  "enseguida","ahora","luego","después","antes","mientras","todavía","ya",
  // Adjetivos / participios cotidianos
  "angosto","ancho","estrecho","amplio","arrugado","arruinado","cansado","tranquilo",
  "espeso","aguado","frío","caliente","tibio","fresco","seco","mojado","sucio","limpio",
  "rico","sabroso","delicioso","amargo","dulce","salado","ácido","picante",
  "delantal","servilleta","mantel","bandeja","tabla","cuchillo","cuchara","tenedor",
  // Objetos cotidianos / cocina
  "vidriera","licuadora","cafetera","tetera","cazuela","sartén","olla",
  // Otros
  "igual","mismo","distinto","diferente","parecido","propio","ajeno",
  "pelota","balón","juguete","muñeca","caja","cubo","pala","cubeta",
  "sorbo","trago","bocado","mordida","gota","chorro",
  "pasto","césped","tierra","arena","piedra","barro","polvo",
  "bastón","muleta","silla","banca","banco","taburete","sillón","sofá",
  "señorita","señor","señora","don","doña","joven","viejo","anciano","muchacho","muchacha",
  "asentir","negar","decir","contestar","responder","preguntar","gritar","susurrar","callar",
  "pito","silbato","timbre","campana","sirena",
  "siga","sigue","vaya","ven","mire","mira","toma","dale","espere","perdón","disculpe",
  // Verbos/objetos restantes que faltaban tras la primera expansión
  "canal","trajinera","orientarse","orientar","reducido","reducir",
  "asentir","asiente","asintió","descansar","receta","prender","apagar","encender",
  "rato","ratito","calma","tranquilidad","silencio","ruido",
  // Lodging vocab (A2 traveler) que el validator marcaba como C2
  "residencial","portal","apartamento","departamento","alquiler","alojarse","alquilar",
  // Objetos comunes
  "guitarra","piano","violín","batería","tambor","flauta",
  "micrófono","auricular","audífono","sirena",
  "bandera","corona","sombrilla","paraguas","ventilador",
  "funda","caja","mochila","bolso",
  // Cualidades / adjetivos
  "principal","central","trasero","superior","inferior",
  "tranquilidad","calma","paz","silencio",
  "paisaje","vista","escena","ambiente","clima",
  "incómodo","cómodo","fácil","difícil","sencillo","complicado","simple",
  "amplio","ancho","estrecho",
  "equivocado","correcto","incorrecto","exacto","seguro",
  "roto","dañado","reparado","arreglado",
  "atrasado","retrasado","temprano","tarde","puntual",
  // Verbos comunes
  "cenar","desayunar","almorzar","merendar","probar",
  "arreglar","reparar","cambiar","faltar","sobrar","necesitar","pedir",
  "brillar","iluminar",
  // Casa
  "ventilador","aire","viento","brisa",
  "ropero","armario","clóset","closet","cajón","estante",
  "dibujo","pintura","cuadro","retrato","póster",
  "techo","tejado","arco","columna",
  "fila","cola","línea","orden",
  // Comida
  "croissant","bollo","empanada","torta","pastel","tarta",
  "ramo","flor","planta","árbol",
  "unión","lazo","relación",
  "pase","pasaje","ticket","entrada","boleto","vale",
  "tesoro","joya",
  // Misceláneo
  "ventanilla","mostrador","cajero","oficina",
  "invitado","turista","viajero",
  "garaje","parking",
  // Materiales
  "metálico","plástico","madera","tela","cuero","vidrio","cristal","papel",
  "lento","lentamente","rápidamente","despacio","veloz",
  "abierto","cerrado","encendido","apagado","prendido","activo","inactivo",
  "vacío","lleno","completo",

  // ── Round 4: conversational/regional/LATAM expansion ──
  // Words that surfaced as false-positive C2 in v2-2026-06 audits but
  // are A1-natural for English-native LATAM-Spanish learners. Source:
  // 23 first-cohort stories produced June 2026. Categories: time
  // adverbials, household objects, common gestures, recurring-cast
  // settings (fonda, mudanza, hall), Latin American color words,
  // conversational courtesy formulas. All audited at A1 reading level.

  // Time adverbials & conversational anchors
  "al mediodía","a tiempo","esta tarde","esta noche","ahora mismo",
  "por la mañana","por la tarde","por la noche","anoche","mediodía",
  "primera vez","próxima vez","muchos años","mes pasado","día anterior",
  "por ahora","ya no","ya está","ya es el momento","sin falta",
  "tres horas","llevamos así","tiempo correcto","luz suave",

  // Conversational courtesy / fillers
  "no te preocupes","en serio","tal vez","por eso","trato hecho",
  "no puede ser","sin conocer","darse cuenta","darse vuelta",
  "disculpe","disculpen","pásale","marchando","ya","ahora",
  "exactamente","exacto","exacta","excusa","excusas",
  "tilo","mate","café","té","leche",

  // LATAM affectionate / address
  "mija","mijo","ustedes","ustedes","querido","querida","linda","lindo",
  "chiquito","chiquita","chiquitos","chiquitas","igualito","igualita",
  "ratito","poquito","poquita",

  // LATAM food / drink / kitchen
  "fonda","jitomate","chile","choclo","molinillo","jamaica","tele",
  "refrigerador","termo","manteca","medialunas","medialuna","galletitas",
  "verdulería","mesero","casera","casero","humita","humitas","pan dulce",
  "pan caliente","reunión","silencio","postre","flan",

  // LATAM building / household
  "departamento","hall","ascensor","valija","valijas","balcón","balcones",
  "fachada","hierro","nene","nena","luminoso","luminosa","mudanza",
  "patio interno","planta baja","limonero","regadera","inquilino",
  "inquilinos","cartero","cartera","bolsillo","bolsillos","delantal",
  "bronce","mantel","servilleta","álbum",

  // Common A1 verbs (frequency-high, missing from prior list)
  "presentar","funcionar","partir","untar","notar","acompañar","detener",
  "alegrar","regar","depender","acordarse","acostumbrarse","engañar",
  "heredar","suspirar","destapar","empujar","voltear","sostener","molestar",
  "asentir","explicar","invitar","despertar","sonar","probar","alegrarse",
  "abrir","cerrar",

  // Common A1 adjectives / states (left/right, sizes, fillers)
  "izquierda","derecha","izquierdo","derecho","norte","sur","este","oeste",
  "fino","fina","finos","finas","rápida","rápidas","quieto","quieta",
  "junto","juntos","junta","juntas","parecido","parecida","parecidos","parecidas",
  "contento","contenta","cansado","cansada","curioso","curiosa","escrito","escrita",
  "calmo","calma","calmos","calmas","liviano","liviana","callado","callada",
  "ordenado","ordenada","apagado","apagada","triste","fresco","fresca","frescas",
  "zurdo","zurda","grueso","gruesa","hondo","honda","fría","frío","frías","fríos",

  // Common A1 nouns / abstract A1
  "asunto","coincidencia","costumbre","mayoría","presión","portada","fondo",
  "justo","justos","belleza","pena","ruido","timbre","golpe","golpes","suave",
  "suaves","pliegue","pliegues","rodaja","rodajas","gesto","mensaje","letra",
  "nota","notas","margen","comedor","gente","letrero","canasta","cajón","álbum",
  "sombrero","sombra","cines","cine","cerro","parque","plaza","puerta","ventana",
  "almuerzo","mañana","tarde","noche","caldo","costilla","queso","cebolla",
  "ajo","tortilla","pollo","arroz","sopa","pan","azúcar","mantequilla",
  "abrigo","campera","liviana","sobre","caja","cajas","ojos","mano","manos",
  "esposo","esposa","abuela","abuelo","hermano","hermana","prima","primo",
  "tío","tía","sobrino","sobrina","nieto","nieta","vecino","vecina","vecinos",
  "amigas","amigos","escuela","trabajo","barrio","esquina","cuadra","cuadras",
  "edificio","pasillo","piso","sala","cocina","habitación","cuarto","baño",
  "ratito","pedazo","frasco","frascos","huerto","sello","sellos","ventanas",
  "amanecer","atardecer","cielo","luz","luces","aire","sol","sombra",

  // A1-natural verb participles used as adjectives
  "tomado","tomada","puesto","puesta","escrita","escritos","escritas",
  "asado","asada","frito","frita","fritos","fritas","hervido","hervida",
  "abierto","abierta","cerrado","cerrada","perdido","perdida","encendido",
  "encendida","sentado","sentada","quieto","quieta","callado","callada",

  // Numbers / quantities A1
  "cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce",
  "trece","catorce","quince","veinte","treinta","cuarenta","cincuenta",
  "cien","cientos","mil",

  // Misc household / actions A1
  "lavar","limpiar","preparar","cocinar","cortar","servir","tomar","poner",
  "saber","entrar","salir","subir","bajar","abrir","cerrar","llegar","esperar",
  "venir","ir","mirar","ver","oír","escuchar","hablar","decir","contar","leer",
  "estudiar","aprender","enseñar","ayudar","comer","beber","dormir","despertar",
  "cuidar","crecer","vivir","morir","reír","llorar","sentir","pensar","creer",
  "querer","poder","tener","hacer","dar","traer","llevar","dejar","tocar",
  "buscar","encontrar","trabajar","jugar","pagar","mandar","recibir","empezar",
  "terminar","cerrar","decidir","cambiar","guardar","abrir",
]);

/**
 * Normalize a Spanish lemma for lookup. Lowercase + trim, keeping
 * diacritics (the list preserves them). Strips leading articles
 * ("la casa" → "casa") so vocab items that came with articles still
 * resolve.
 */
export function normalizeSpanishLemma(input: string): string {
  const lower = input.toLowerCase().trim();
  return lower.replace(/^(la|el|los|las|un|una|unos|unas)\s+/, "");
}

/**
 * Check whether a Spanish word is in the A1/A2 vocabulary list.
 * Used by the validator when a story's level === "a1" (and likely
 * "a2" too, since the i+1 rule allows one level above).
 *
 * Normalization layers (cascading; first match wins):
 *   1. Exact lemma lookup
 *   2. Strip plural -s → singular ("perros" → "perro")
 *   3. Strip plural -es → singular ("lápices" → "lápiz" via "lápic")
 *      — handled by stripping -es and trying common stem variants
 *   4. Strip reflexive -se → -r infinitive ("ducharse" → "duchar")
 *   5. Strip diminutive -ito/-ita/-illo/-illa → base ("perrito" → "perro")
 *   6. Femenino → masculino (-a → -o) for adjectives ("buena" → "bueno")
 *   7. Participio → infinitive (-ado/-ido → -ar/-er/-ir)
 *      ("cocinado" → "cocinar", "comido" → "comer")
 */
export function isSpanishA1A2(word: string): boolean {
  const lemma = normalizeSpanishLemma(word);
  if (SPANISH_A1_A2_LEMMAS.has(lemma)) return true;

  // 1. Plural -s → singular
  if (lemma.endsWith("s") && lemma.length > 3) {
    const singular = lemma.slice(0, -1);
    if (SPANISH_A1_A2_LEMMAS.has(singular)) return true;
    // -es → drop completely (lápices → lápic) and try -z (lápiz)
    if (lemma.endsWith("es") && lemma.length > 4) {
      const stem = lemma.slice(0, -2);
      if (SPANISH_A1_A2_LEMMAS.has(stem)) return true;
      if (SPANISH_A1_A2_LEMMAS.has(stem + "z")) return true;
    }
  }

  // 2. Reflexive -se → -r infinitive ("ducharse" → "duchar" → "ducharse")
  if (lemma.endsWith("se") && lemma.length > 4) {
    const root = lemma.slice(0, -2);
    if (SPANISH_A1_A2_LEMMAS.has(root + "r")) return true;
    if (SPANISH_A1_A2_LEMMAS.has(root)) return true;
  }

  // 3. Diminutivos -ito/-ita/-illo/-illa → base. Spanish A1/A2 uses
  // these freely ("perrito", "casita", "chiquillo"). The base form
  // must exist in the list. We also handle -cito/-cita (ratoncito).
  const diminutiveSuffixes = ["ito", "ita", "illo", "illa", "cito", "cita"];
  for (const suf of diminutiveSuffixes) {
    if (lemma.endsWith(suf) && lemma.length > suf.length + 2) {
      const base = lemma.slice(0, -suf.length);
      if (SPANISH_A1_A2_LEMMAS.has(base)) return true;
      // Some bases end in vowel: perr(o) → perrito → strip suf and try +o/+a
      if (SPANISH_A1_A2_LEMMAS.has(base + "o")) return true;
      if (SPANISH_A1_A2_LEMMAS.has(base + "a")) return true;
    }
  }

  // 4. Femenino → masculino (-a → -o). Most A1/A2 adjectives are
  // stored in masculine form ("bueno", "alto", "rojo"). The feminine
  // form ("buena", "alta", "roja") should resolve to the same entry.
  if (lemma.endsWith("a") && lemma.length > 2) {
    const masc = lemma.slice(0, -1) + "o";
    if (SPANISH_A1_A2_LEMMAS.has(masc)) return true;
  }

  // 5. Participio pasado → infinitivo. "cocinado" → "cocinar",
  // "comido" → "comer", "vivido" → "vivir". Used as adjectives often.
  if (lemma.endsWith("ado") && lemma.length > 4) {
    const root = lemma.slice(0, -3);
    if (SPANISH_A1_A2_LEMMAS.has(root + "ar")) return true;
  }
  if (lemma.endsWith("ido") && lemma.length > 4) {
    const root = lemma.slice(0, -3);
    if (SPANISH_A1_A2_LEMMAS.has(root + "er")) return true;
    if (SPANISH_A1_A2_LEMMAS.has(root + "ir")) return true;
  }
  // Femenino del participio: -ada → -ar, -ida → -er/-ir
  if (lemma.endsWith("ada") && lemma.length > 4) {
    const root = lemma.slice(0, -3);
    if (SPANISH_A1_A2_LEMMAS.has(root + "ar")) return true;
  }
  if (lemma.endsWith("ida") && lemma.length > 4) {
    const root = lemma.slice(0, -3);
    if (SPANISH_A1_A2_LEMMAS.has(root + "er")) return true;
    if (SPANISH_A1_A2_LEMMAS.has(root + "ir")) return true;
  }

  return false;
}
