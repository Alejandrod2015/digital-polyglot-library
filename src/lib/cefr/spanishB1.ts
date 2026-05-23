// Spanish B1 lemma list — words that become available at B1 (not
// in A1/A2 but legitimate for intermediate learners). Combined with
// A1+A2 to form the full B1 vocabulary universe via
// `isSpanishUpToLevel(word, "b1")`.

export const SPANISH_B1_LEMMAS: ReadonlySet<string> = new Set([
  // Trabajo / profesiones
  "ingeniero","ingeniera","abogado","abogada","médico","médica","enfermero","enfermera",
  "contador","contadora","arquitecto","arquitecta","periodista","fotógrafo","fotógrafa",
  "diseñador","diseñadora","programador","programadora","empresario","empresaria",
  "vendedor","vendedora","cajero","cajera","mecánico","mecánica","electricista","plomero",
  "carpintero","albañil","jardinero","jardinera","chef","cocinero","cocinera","camarero",
  "camarera","mesero","mesera","recepcionista","secretario","secretaria","gerente",
  "director","directora","jefe","jefa","supervisor","supervisora","asistente","ayudante",
  "becario","becaria","practicante","aprendiz","trabajador","trabajadora",
  "profesión","carrera","puesto","cargo","puesto de trabajo","empleo","ocupación",

  // Emociones / actitudes B1
  "frustración","indignación","melancolía","nostalgia","decepción","desilusión",
  "esperanza","entusiasmo","orgullo","vergüenza","culpa","celos","envidia",
  "compasión","empatía","simpatía","ternura","afecto","admiración","desprecio",
  "irritado","decepcionado","emocionado","ilusionado","frustrado","ofendido","herido",
  "agradecido","arrepentido","avergonzado","celoso","envidioso","resentido",
  "molesto","fastidiado","harto","desesperado","resignado","conforme","inseguro",

  // Opiniones / discurso
  "opinión","perspectiva","punto de vista","argumento","razonamiento","conclusión",
  "debate","discusión","polémica","controversia","acuerdo","desacuerdo","compromiso",
  "ventaja","desventaja","pro","contra","beneficio","perjuicio","riesgo","oportunidad",
  "razón","motivo","causa","consecuencia","resultado","efecto","impacto","influencia",
  "ejemplo","caso","situación","circunstancia","contexto","escenario","entorno",
  "evidencia","prueba","dato","información","estadística","cifra","porcentaje",
  "opinar","argumentar","defender","sostener","afirmar","negar","reconocer","admitir",
  "criticar","cuestionar","dudar","sospechar","confiar","desconfiar","convencer",
  "persuadir","explicar","aclarar","detallar","resumir","concluir","deducir","inferir",

  // Acciones / verbos B1
  "lograr","conseguir","alcanzar","cumplir","realizar","ejecutar","desarrollar",
  "fracasar","fallar","equivocarse","arrepentirse","disculparse","perdonar","aceptar",
  "rechazar","negarse","oponerse","apoyar","colaborar","cooperar","competir",
  "intentar","esforzarse","mejorar","superarse","crecer","progresar","avanzar",
  "retroceder","detenerse","continuar","seguir","persistir","insistir","abandonar",
  "renunciar","ceder","resistir","aguantar","soportar","sobrellevar","enfrentar",
  "afrontar","evitar","esquivar","ignorar","reconocer","identificar","distinguir",
  "comparar","contrastar","relacionar","conectar","unir","separar","dividir","combinar",
  "organizar","planificar","programar","gestionar","administrar","controlar","supervisar",
  "dirigir","liderar","seguir","obedecer","mandar","ordenar","sugerir","recomendar",
  "aconsejar","advertir","prevenir","alertar","informar","comunicar","transmitir",

  // Tecnología
  "tecnología","internet","red","conexión","wifi","datos","archivo","carpeta",
  "documento","programa","aplicación","software","sistema","plataforma","sitio web",
  "página","enlace","contraseña","clave","usuario","cuenta","perfil","mensaje",
  "correo","email","chat","videollamada","reunión virtual","descarga","actualización",
  "instalar","descargar","subir","compartir","publicar","enviar","reenviar","responder",
  "navegar","buscar","encontrar","verificar","confirmar","registrarse","iniciar sesión",
  "cerrar sesión","sincronizar","respaldar","copiar","pegar","borrar","eliminar",
  "tableta","portátil","ratón","teclado","pantalla","auricular","altavoz","micrófono",

  // Conectores / discurso
  "sin embargo","no obstante","aunque","a pesar de","pese a","mientras que","en cambio",
  "por otro lado","por una parte","además","asimismo","también","tampoco","incluso",
  "es decir","o sea","por ejemplo","en concreto","específicamente","en particular",
  "en general","por lo general","habitualmente","normalmente","generalmente","usualmente",
  "por lo tanto","por consiguiente","de modo que","así que","entonces","así pues",
  "en consecuencia","como resultado","dado que","puesto que","ya que","debido a",
  "gracias a","a causa de","por culpa de","en lugar de","en vez de","más bien",
  "en realidad","de hecho","en efecto","ciertamente","desde luego","por supuesto",
  "quizás","probablemente","posiblemente","seguramente","aparentemente","supuestamente",

  // Salud B1
  "tratamiento","diagnóstico","síntoma","prescripción","receta","análisis","examen",
  "cirugía","operación","intervención","terapia","rehabilitación","fisioterapia",
  "consulta","cita","visita médica","emergencia","urgencia","ambulancia","camilla",
  "vendaje","tirita","yeso","muletas","silla de ruedas","prótesis","implante",
  "vacuna","inyección","pastilla","jarabe","crema","pomada","antibiótico","analgésico",
  "presión","colesterol","azúcar en sangre","alergia","intolerancia","contagio",
  "infección","virus","bacteria","epidemia","pandemia",

  // Educación B1
  "asignatura","materia","disciplina","especialidad","carrera","grado","posgrado",
  "máster","maestría","doctorado","tesis","investigación","estudio","análisis",
  "matrícula","beca","préstamo","crédito","título","diploma","certificado",
  "conferencia","seminario","taller","práctica","prácticas","pasantía","intercambio",

  // Sociedad / política básica B1
  "sociedad","comunidad","ciudadano","ciudadanía","derecho","obligación","deber",
  "ley","norma","regla","regulación","legalidad","ilegalidad","justicia","injusticia",
  "votar","votación","elección","candidato","político","partido","gobierno","oposición",
  "presidente","ministro","alcalde","alcaldesa","concejal","diputado","senador",
  "impuesto","contribución","servicio público","educación pública","sanidad","seguridad",
  "policía","bombero","militar","ejército","guerra","paz","conflicto","desacuerdo",

  // Naturaleza / medio ambiente B1
  "ecología","medio ambiente","naturaleza","contaminación","polución","emisión",
  "calentamiento global","cambio climático","reciclaje","reciclar","reducir","reutilizar",
  "energía renovable","energía solar","energía eólica","combustible","gasolina","petróleo",
  "fauna","flora","especie","extinción","conservación","protección","reserva natural",
  "deforestación","incendio forestal","inundación","sequía","desierto","glaciar",

  // Cultura / arte B1
  "cultura","tradición","costumbre","ritual","ceremonia","festival","celebración",
  "carnaval","procesión","desfile","feria","exposición","muestra","galería",
  "artista","pintor","escultor","escritor","poeta","novelista","dramaturgo","cineasta",
  "obra","creación","colección","estilo","corriente","movimiento","tendencia",
  "novela","poesía","drama","comedia","tragedia","ensayo","biografía","autobiografía",
  "personaje","protagonista","antagonista","villano","héroe","heroína","narrador",
  "trama","argumento","clímax","desenlace","capítulo","escena","acto",

  // Comercio / economía B1
  "comercio","economía","mercado","empresa","negocio","corporación","sociedad",
  "accionista","socio","cliente","consumidor","proveedor","cliente","usuario",
  "producto","servicio","oferta","demanda","precio","tarifa","cuota","comisión",
  "factura","recibo","ticket","cuenta","balance","ganancia","pérdida","beneficio",
  "deuda","crédito","préstamo","hipoteca","ahorro","inversión","interés","tasa",

  // Adjetivos B1
  "complicado","complejo","sencillo","simple","obvio","evidente","claro","confuso",
  "ambiguo","preciso","vago","exacto","aproximado","detallado","general","específico",
  "esencial","fundamental","básico","secundario","principal","primario","importante",
  "trascendente","relevante","irrelevante","significativo","insignificante","crucial",
  "frecuente","común","raro","extraño","habitual","inusual","típico","atípico",
  "habitual","tradicional","convencional","moderno","contemporáneo","actual","reciente",
  "antiguo","ancestral","histórico","clásico","moderno","futurista","innovador",
  "creativo","original","auténtico","genuino","falso","artificial","imitación","réplica",
  "honesto","sincero","franco","abierto","reservado","tímido","extrovertido","introvertido",
  "responsable","irresponsable","cuidadoso","descuidado","atento","distraído",
  "eficiente","ineficiente","productivo","improductivo","útil","inútil","práctico",
  "imprudente","prudente","sensato","insensato","razonable","irrazonable","lógico",
]);
