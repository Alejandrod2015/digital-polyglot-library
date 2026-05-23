// Spanish B2 additional lemmas. Combine with A1+A2+B1 via
// `isSpanishUpToLevel(word, "b2")`. B2 introduces abstract concepts,
// academic discourse, nuanced emotions, formal vocabulary.

export const SPANISH_B2_LEMMAS: ReadonlySet<string> = new Set([
  // Análisis / discurso académico
  "análisis","síntesis","argumentación","tesis","antítesis","hipótesis","premisa",
  "fundamento","planteamiento","enfoque","aproximación","perspectiva","metodología",
  "procedimiento","estrategia","táctica","esquema","estructura","modelo","paradigma",
  "investigación","estudio","experimento","observación","análisis","evaluación",
  "valoración","juicio","crítica","reseña","comentario","interpretación","explicación",
  "exposición","disertación","conferencia","ponencia","intervención","presentación",
  "diagnóstico","pronóstico","previsión","predicción","proyección","estimación",
  "conclusión","resultado","hallazgo","descubrimiento","constatación","comprobación",

  // Conceptos abstractos
  "concepto","noción","idea","teoría","filosofía","ideología","doctrina","creencia",
  "convicción","principio","valor","ética","moral","virtud","vicio","dignidad",
  "honor","prestigio","reputación","fama","notoriedad","trascendencia","legado",
  "esencia","naturaleza","carácter","índole","identidad","personalidad","temperamento",
  "actitud","postura","posicionamiento","disposición","tendencia","inclinación","sesgo",
  "verdad","realidad","ficción","imaginación","fantasía","ilusión","apariencia",
  "consciencia","conciencia","subconsciente","inconsciente","mente","intelecto","razón",
  "intuición","percepción","sensibilidad","perspicacia","agudeza","ingenio","talento",
  "capacidad","habilidad","destreza","competencia","aptitud","cualidad","facultad",

  // Sociedad B2
  "diversidad","pluralidad","inclusión","exclusión","discriminación","prejuicio",
  "estereotipo","minoría","mayoría","marginación","integración","asimilación",
  "globalización","modernización","industrialización","urbanización","migración",
  "inmigración","emigración","exilio","refugiado","desplazado","ciudadanía","nacionalidad",
  "identidad cultural","patrimonio","herencia","legado cultural","raíces","tradiciones",
  "valores sociales","normas sociales","convenciones","tabúes","prohibiciones",
  "desigualdad","brecha","pobreza","riqueza","clase social","jerarquía","privilegio",
  "movilidad social","ascenso","descenso","éxito","fracaso","logro","reconocimiento",

  // Política / economía B2
  "democracia","autocracia","dictadura","monarquía","república","federalismo",
  "constitución","tratado","acuerdo","alianza","pacto","convenio","contrato",
  "negociación","mediación","arbitraje","reconciliación","reforma","revolución",
  "estabilidad","inestabilidad","crisis","auge","recesión","depresión","recuperación",
  "inflación","deflación","desempleo","empleo","productividad","competitividad",
  "comercio internacional","exportación","importación","arancel","sanción","embargo",
  "moneda","divisa","cambio","mercado financiero","bolsa","acción","bono","fondo",

  // Tecnología avanzada B2
  "inteligencia artificial","algoritmo","datos","big data","machine learning",
  "automatización","robótica","ciberseguridad","privacidad","encriptación","blockchain",
  "criptomoneda","plataforma digital","aplicación móvil","red social","interacción",
  "experiencia de usuario","interfaz","accesibilidad","usabilidad","funcionalidad",
  "innovación","desarrollo","prototipo","lanzamiento","mantenimiento","actualización",

  // Emociones complejas B2
  "resentimiento","rencor","amargura","resignación","conformismo","perfeccionismo",
  "ambición","codicia","avaricia","generosidad","desinterés","altruismo","egoísmo",
  "vanidad","humildad","modestia","arrogancia","soberbia","prepotencia","insolencia",
  "compasión","piedad","misericordia","crueldad","violencia","agresividad","hostilidad",
  "afecto","cariño","amor","pasión","obsesión","fascinación","atracción","repulsión",
  "anhelo","añoranza","melancolía","tristeza profunda","duelo","luto","pérdida",
  "tranquilidad","serenidad","paz interior","equilibrio","armonía","desequilibrio",

  // Cultura / arte B2
  "estética","creatividad","inspiración","talento","virtuosismo","maestría","genio",
  "obra maestra","clásico","contemporáneo","vanguardia","tradicional","experimental",
  "abstracción","figuración","realismo","surrealismo","impresionismo","expresionismo",
  "simbolismo","metáfora","alegoría","ironía","sátira","parodia","homenaje","tributo",
  "crítica literaria","crítica de arte","análisis textual","interpretación","exégesis",
  "intertextualidad","referencia","alusión","cita","plagio","autoría","autenticidad",

  // Naturaleza / ciencia B2
  "ecosistema","biodiversidad","sostenibilidad","sustentable","renovable","no renovable",
  "biológico","ecológico","orgánico","sintético","molecular","celular","genético",
  "evolución","adaptación","mutación","selección natural","especie","extinción",
  "experimento","laboratorio","investigación científica","hipótesis científica",
  "metodología científica","peer review","publicación","revista científica","estudio",

  // Verbos B2
  "analizar","examinar","investigar","explorar","indagar","escudriñar","profundizar",
  "evaluar","valorar","apreciar","ponderar","considerar","contemplar","reflexionar",
  "meditar","cavilar","reconsiderar","replantear","cuestionar","interpelar",
  "argumentar","fundamentar","sustentar","respaldar","corroborar","ratificar",
  "demostrar","probar","evidenciar","manifestar","exteriorizar","exhibir","desplegar",
  "implementar","ejecutar","aplicar","poner en práctica","llevar a cabo","materializar",
  "concretar","plasmar","cristalizar","consolidar","afianzar","reforzar","fortalecer",
  "debilitar","desgastar","erosionar","socavar","minar","subvertir","cuestionar",
  "transformar","modificar","alterar","reformar","renovar","actualizar","modernizar",
  "promover","fomentar","impulsar","incentivar","estimular","motivar","alentar",
  "desalentar","desincentivar","obstaculizar","entorpecer","frenar","ralentizar",

  // Adjetivos B2
  "trascendental","fundamental","esencial","intrínseco","inherente","característico",
  "distintivo","peculiar","particular","exclusivo","único","singular","excepcional",
  "extraordinario","notable","destacado","sobresaliente","prominente","relevante",
  "sutil","matizado","sofisticado","refinado","elegante","exquisito","selecto","exclusivo",
  "ambiguo","equívoco","impreciso","vago","nebuloso","difuso","borroso","oscuro",
  "explícito","implícito","tácito","sobreentendido","evidente","obvio","manifiesto",
  "subjetivo","objetivo","imparcial","neutro","sesgado","tendencioso","parcializado",
  "coherente","incoherente","consistente","inconsistente","contradictorio","paradójico",
  "factible","inviable","viable","practicable","ejecutable","alcanzable","inalcanzable",
  "polémico","controversial","polémica","debatible","cuestionable","incuestionable",
  "ético","inmoral","amoral","virtuoso","vicioso","corrupto","íntegro","honrado",
]);
