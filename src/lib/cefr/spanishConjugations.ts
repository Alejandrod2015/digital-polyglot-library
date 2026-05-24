// Spanish verb conjugation → infinitive lookup.
//
// The CEFR lemma lists store INFINITIVES ("comer", "poder"). Stories use
// conjugated forms ("comieron", "puedo"). Without this table the level
// checker would flag every conjugated form of a perfectly basic A1 verb.
//
// Strategy:
// 1. Programmatically generate regular conjugations for the ~200 most
//    common verbs (-ar, -er, -ir), covering presente/pretérito perfecto/
//    pretérito imperfecto/futuro/condicional/subjuntivo presente +
//    imperfecto/imperativo/gerundio.
// 2. Override with explicit irregulars for the top high-frequency
//    irregular verbs (ser, estar, ir, hacer, tener, decir, etc.).
//
// Built once at module load. O(1) lookup forever after.

type VerbType = "ar" | "er" | "ir";

// Most common Spanish verbs (high frequency in everyday speech). The
// generator below produces ~50 conjugated forms per regular verb. For
// irregulars, the IRREGULAR_FORMS map overrides incorrect outputs.
const COMMON_VERBS: string[] = [
  // -ar core
  "hablar","trabajar","estudiar","preguntar","contestar","ayudar","escuchar",
  "mirar","tomar","llegar","llamar","comprar","pagar","entrar","esperar",
  "buscar","encontrar","jugar","caminar","cantar","bailar","cocinar","preparar",
  "necesitar","desear","gustar","quedar","quedarse","levantar","levantarse",
  "bañar","bañarse","peinar","peinarse","cepillar","cepillarse","afeitar","afeitarse",
  "vestir","vestirse","quitarse","ducharse","despertar","despertarse","acostar","acostarse",
  "casarse","enamorarse","alegrarse","preocuparse","cansarse","sentar","sentarse",
  "explicar","contar","mostrar","enseñar","practicar","empezar","comenzar","terminar",
  "regresar","volver","ganar","perder","jugar","gastar","ahorrar","prestar",
  "alquilar","cocinar","desayunar","almorzar","cenar","probar","cortar","mezclar",
  "calentar","enfriar","limpiar","lavar","secar","planchar","ordenar","arreglar",
  "ensuciar","romper","reparar","cambiar","tirar","botar","guardar","colocar",
  "poner","sacar","mandar","enviar","llevar","traer","cargar","aparcar","estacionar",
  "manejar","conducir","arrancar","apagar","encender","prender","funcionar","fallar",
  "andar","caminar","correr","saltar","brincar","nadar","viajar","visitar","pasear",
  "descansar","durar","tardar","empujar","jalar","tirar","golpear","tocar","besar",
  "abrazar","saludar","despedir","despedirse","invitar","aceptar","rechazar","decidir",
  "olvidar","recordar","memorizar","aprender","enseñar","considerar","pensar","creer",
  "opinar","comentar","explicar","describir","resumir","calcular","sumar","restar",
  "multiplicar","dividir","contar","numerar","medir","pesar","caber","gastar",
  "amar","odiar","querer","desear","preferir","escoger","elegir","seleccionar",
  "votar","ganar","perder","competir","luchar","pelear","discutir","gritar",
  "llorar","reír","sonreír","reír","carcajear","molestar","fastidiar","aburrir",
  "divertir","entretener","admirar","respetar","felicitar","celebrar","brindar",

  // -er core
  "comer","beber","leer","aprender","comprender","entender","creer","ver","saber",
  "conocer","correr","romper","temer","esconder","esconderse","recoger","perder",
  "ascender","ascender","descender","prometer","cometer","admitir","caer","caerse",
  "atrevarse","ofender","ofender","obedecer","conocer","reconocer","aparecer",
  "desaparecer","crecer","parecer","merecer","favorecer","establecer","ofrecer",

  // -ir core
  "vivir","escribir","abrir","subir","decidir","permitir","existir","recibir",
  "partir","cubrir","descubrir","sufrir","unir","reunir","reunirse","sentir",
  "sentirse","mentir","preferir","servir","seguir","perseguir","conseguir",
  "consentir","convertir","convertirse","dirigir","corregir","exigir","elegir",
  "fingir","construir","destruir","distribuir","contribuir","incluir","concluir",
  "huir","escapar","admitir","cumplir","traducir","producir","reducir","conducir",
  "discutir","competir","repetir","despedir","despedirse","medir","pedir",
  "vestir","vestirse","reír","sonreír","freír","reñir","gemir","ceñir","teñir",

  // Irregular (will be overridden by IRREGULAR_FORMS for tricky tenses,
  // but regular endings get scaffold)
  "ser","estar","haber","ir","tener","hacer","decir","poder","querer","saber",
  "ver","dar","venir","salir","poner","traer","oír","caer","caer","saber",
  "conocer","parecer","quedar","mantener","sostener","obtener","contener",
  "componer","suponer","exponer","oponer","disponer","proponer","imponer",
  "rehacer","deshacer","satisfacer","decir","predecir","contradecir","bendecir",
  "maldecir","traer","atraer","contraer","distraer","extraer","sustraer",
  "salir","sobresalir","valer","equivaler","prevaler","dormir","morir",
  "pedir","impedir","despedir","medir","repetir","servir","seguir","perseguir",
];

// IRREGULAR conjugated forms. The programmatic generator handles regular
// endings; the entries below force the correct mapping for irregulars.
// Format: array of [surfaceForm, infinitive] tuples. We use an array
// instead of an object literal so duplicate keys (which happen across
// homograph paradigms like "siento" = sentir/sentar) don't trip
// TypeScript's TS1117 "duplicate property" error. Later entries win.
// Stored as a single string parsed by JSON.parse so TS1117 (duplicate
// property) never fires. Homograph paradigms like "siento" appear in
// both sentir and sentar; later occurrences win at JSON.parse time on
// all major engines.
const IRREGULAR_FORMS_RAW = `{
  // ser
  "soy":"ser","eres":"ser","es":"ser","somos":"ser","sois":"ser","son":"ser",
  "fui":"ser","fuiste":"ser","fue":"ser","fuimos":"ser","fuisteis":"ser","fueron":"ser",
  "era":"ser","eras":"ser","éramos":"ser","erais":"ser","eran":"ser",
  "seré":"ser","serás":"ser","será":"ser","seremos":"ser","seréis":"ser","serán":"ser",
  "sería":"ser","serías":"ser","seríamos":"ser","seríais":"ser","serían":"ser",
  "sea":"ser","seas":"ser","seamos":"ser","seáis":"ser","sean":"ser",
  "fuera":"ser","fueras":"ser","fuéramos":"ser","fuerais":"ser","fueran":"ser",
  "fuese":"ser","fueses":"ser","fuésemos":"ser","fueseis":"ser","fuesen":"ser",
  "sé":"ser","sed":"ser","siendo":"ser","sido":"ser",

  // estar
  "estoy":"estar","estás":"estar","está":"estar","estamos":"estar","estáis":"estar","están":"estar",
  "estuve":"estar","estuviste":"estar","estuvo":"estar","estuvimos":"estar","estuvisteis":"estar","estuvieron":"estar",
  "estaba":"estar","estabas":"estar","estábamos":"estar","estabais":"estar","estaban":"estar",
  "estaré":"estar","estarás":"estar","estará":"estar","estaremos":"estar","estaréis":"estar","estarán":"estar",
  "estaría":"estar","estarías":"estar","estaríamos":"estar","estaríais":"estar","estarían":"estar",
  "esté":"estar","estés":"estar","estemos":"estar","estéis":"estar","estén":"estar",
  "estuviera":"estar","estuvieras":"estar","estuviéramos":"estar","estuvierais":"estar","estuvieran":"estar",
  "estando":"estar","estado":"estar",

  // haber
  "he":"haber","has":"haber","ha":"haber","hemos":"haber","habéis":"haber","han":"haber",
  "hay":"haber","hube":"haber","hubiste":"haber","hubo":"haber","hubimos":"haber","hubisteis":"haber","hubieron":"haber",
  "había":"haber","habías":"haber","habíamos":"haber","habíais":"haber","habían":"haber",
  "habré":"haber","habrás":"haber","habrá":"haber","habremos":"haber","habréis":"haber","habrán":"haber",
  "habría":"haber","habrías":"haber","habríamos":"haber","habríais":"haber","habrían":"haber",
  "haya":"haber","hayas":"haber","hayamos":"haber","hayáis":"haber","hayan":"haber",
  "hubiera":"haber","hubieras":"haber","hubiéramos":"haber","hubierais":"haber","hubieran":"haber",
  "habiendo":"haber","habido":"haber",

  // tener
  "tengo":"tener","tienes":"tener","tiene":"tener","tenemos":"tener","tenéis":"tener","tienen":"tener",
  "tuve":"tener","tuviste":"tener","tuvo":"tener","tuvimos":"tener","tuvisteis":"tener","tuvieron":"tener",
  "tenía":"tener","tenías":"tener","teníamos":"tener","teníais":"tener","tenían":"tener",
  "tendré":"tener","tendrás":"tener","tendrá":"tener","tendremos":"tener","tendréis":"tener","tendrán":"tener",
  "tendría":"tener","tendrías":"tener","tendríamos":"tener","tendríais":"tener","tendrían":"tener",
  "tenga":"tener","tengas":"tener","tengamos":"tener","tengáis":"tener","tengan":"tener",
  "tuviera":"tener","tuvieras":"tener","tuviéramos":"tener","tuvierais":"tener","tuvieran":"tener",
  "ten":"tener","teniendo":"tener","tenido":"tener",

  // hacer
  "hago":"hacer","haces":"hacer","hace":"hacer","hacemos":"hacer","hacéis":"hacer","hacen":"hacer",
  "hice":"hacer","hiciste":"hacer","hizo":"hacer","hicimos":"hacer","hicisteis":"hacer","hicieron":"hacer",
  "hacía":"hacer","hacías":"hacer","hacíamos":"hacer","hacíais":"hacer","hacían":"hacer",
  "haré":"hacer","harás":"hacer","hará":"hacer","haremos":"hacer","haréis":"hacer","harán":"hacer",
  "haría":"hacer","harías":"hacer","haríamos":"hacer","haríais":"hacer","harían":"hacer",
  "haga":"hacer","hagas":"hacer","hagamos":"hacer","hagáis":"hacer","hagan":"hacer",
  "hiciera":"hacer","hicieras":"hacer","hiciéramos":"hacer","hicierais":"hacer","hicieran":"hacer",
  "haz":"hacer","haciendo":"hacer","hecho":"hacer",

  // ir
  "voy":"ir","vas":"ir","va":"ir","vamos":"ir","vais":"ir","van":"ir",
  "iba":"ir","ibas":"ir","íbamos":"ir","ibais":"ir","iban":"ir",
  "iré":"ir","irás":"ir","irá":"ir","iremos":"ir","iréis":"ir","irán":"ir",
  "iría":"ir","irías":"ir","iríamos":"ir","iríais":"ir","irían":"ir",
  "vaya":"ir","vayas":"ir","vayamos":"ir","vayáis":"ir","vayan":"ir",
  "ve":"ir","id":"ir","yendo":"ir","ido":"ir",

  // decir
  "digo":"decir","dices":"decir","dice":"decir","decimos":"decir","decís":"decir","dicen":"decir",
  "dije":"decir","dijiste":"decir","dijo":"decir","dijimos":"decir","dijisteis":"decir","dijeron":"decir",
  "decía":"decir","decías":"decir","decíamos":"decir","decíais":"decir","decían":"decir",
  "diré":"decir","dirás":"decir","dirá":"decir","diremos":"decir","diréis":"decir","dirán":"decir",
  "diría":"decir","dirías":"decir","diríamos":"decir","diríais":"decir","dirían":"decir",
  "diga":"decir","digas":"decir","digamos":"decir","digáis":"decir","digan":"decir",
  "dijera":"decir","dijeras":"decir","dijéramos":"decir","dijerais":"decir","dijeran":"decir",
  "di":"decir","diciendo":"decir","dicho":"decir",

  // poder
  "puedo":"poder","puedes":"poder","puede":"poder","podemos":"poder","podéis":"poder","pueden":"poder",
  "pude":"poder","pudiste":"poder","pudo":"poder","pudimos":"poder","pudisteis":"poder","pudieron":"poder",
  "podía":"poder","podías":"poder","podíamos":"poder","podíais":"poder","podían":"poder",
  "podré":"poder","podrás":"poder","podrá":"poder","podremos":"poder","podréis":"poder","podrán":"poder",
  "podría":"poder","podrías":"poder","podríamos":"poder","podríais":"poder","podrían":"poder",
  "pueda":"poder","puedas":"poder","podamos":"poder","podáis":"poder","puedan":"poder",
  "pudiera":"poder","pudieras":"poder","pudiéramos":"poder","pudierais":"poder","pudieran":"poder",
  "pudiendo":"poder","podido":"poder",

  // querer
  "quiero":"querer","quieres":"querer","quiere":"querer","queremos":"querer","queréis":"querer","quieren":"querer",
  "quise":"querer","quisiste":"querer","quiso":"querer","quisimos":"querer","quisisteis":"querer","quisieron":"querer",
  "quería":"querer","querías":"querer","queríamos":"querer","queríais":"querer","querían":"querer",
  "querré":"querer","querrás":"querer","querrá":"querer","querremos":"querer","querréis":"querer","querrán":"querer",
  "querría":"querer","querrías":"querer","querríamos":"querer","querríais":"querer","querrían":"querer",
  "quiera":"querer","quieras":"querer","queramos":"querer","queráis":"querer","quieran":"querer",
  "quisiera":"querer","quisieras":"querer","quisiéramos":"querer","quisierais":"querer","quisieran":"querer",
  "queriendo":"querer","querido":"querer",

  // saber
  "sé":"saber","sabes":"saber","sabe":"saber","sabemos":"saber","sabéis":"saber","saben":"saber",
  "supe":"saber","supiste":"saber","supo":"saber","supimos":"saber","supisteis":"saber","supieron":"saber",
  "sabía":"saber","sabías":"saber","sabíamos":"saber","sabíais":"saber","sabían":"saber",
  "sabré":"saber","sabrás":"saber","sabrá":"saber","sabremos":"saber","sabréis":"saber","sabrán":"saber",
  "sabría":"saber","sabrías":"saber","sabríamos":"saber","sabríais":"saber","sabrían":"saber",
  "sepa":"saber","sepas":"saber","sepamos":"saber","sepáis":"saber","sepan":"saber",
  "supiera":"saber","supieras":"saber","supiéramos":"saber","supierais":"saber","supieran":"saber",
  "sabiendo":"saber","sabido":"saber",

  // ver
  "veo":"ver","ves":"ver","ve":"ver","vemos":"ver","veis":"ver","ven":"ver",
  "vi":"ver","viste":"ver","vio":"ver","vimos":"ver","visteis":"ver","vieron":"ver",
  "veía":"ver","veías":"ver","veíamos":"ver","veíais":"ver","veían":"ver",
  "veré":"ver","verás":"ver","verá":"ver","veremos":"ver","veréis":"ver","verán":"ver",
  "vería":"ver","verías":"ver","veríamos":"ver","veríais":"ver","verían":"ver",
  "vea":"ver","veas":"ver","veamos":"ver","veáis":"ver","vean":"ver",
  "viera":"ver","vieras":"ver","viéramos":"ver","vierais":"ver","vieran":"ver",
  "viendo":"ver","visto":"ver",

  // dar
  "doy":"dar","das":"dar","da":"dar","damos":"dar","dais":"dar","dan":"dar",
  "di":"dar","diste":"dar","dio":"dar","dimos":"dar","disteis":"dar","dieron":"dar",
  "daba":"dar","dabas":"dar","dábamos":"dar","dabais":"dar","daban":"dar",
  "daré":"dar","darás":"dar","dará":"dar","daremos":"dar","daréis":"dar","darán":"dar",
  "daría":"dar","darías":"dar","daríamos":"dar","daríais":"dar","darían":"dar",
  "dé":"dar","des":"dar","demos":"dar","deis":"dar","den":"dar",
  "diera":"dar","dieras":"dar","diéramos":"dar","dierais":"dar","dieran":"dar",
  "dando":"dar","dado":"dar",

  // venir
  "vengo":"venir","vienes":"venir","viene":"venir","venimos":"venir","venís":"venir","vienen":"venir",
  "vine":"venir","viniste":"venir","vino":"venir","vinimos":"venir","vinisteis":"venir","vinieron":"venir",
  "venía":"venir","venías":"venir","veníamos":"venir","veníais":"venir","venían":"venir",
  "vendré":"venir","vendrás":"venir","vendrá":"venir","vendremos":"venir","vendréis":"venir","vendrán":"venir",
  "vendría":"venir","vendrías":"venir","vendríamos":"venir","vendríais":"venir","vendrían":"venir",
  "venga":"venir","vengas":"venir","vengamos":"venir","vengáis":"venir","vengan":"venir",
  "viniera":"venir","vinieras":"venir","viniéramos":"venir","vinierais":"venir","vinieran":"venir",
  "ven":"venir","viniendo":"venir","venido":"venir",

  // salir
  "salgo":"salir","sales":"salir","sale":"salir","salimos":"salir","salís":"salir","salen":"salir",
  "salí":"salir","saliste":"salir","salió":"salir","salisteis":"salir","salieron":"salir",
  "salía":"salir","salías":"salir","salíamos":"salir","salíais":"salir","salían":"salir",
  "saldré":"salir","saldrás":"salir","saldrá":"salir","saldremos":"salir","saldréis":"salir","saldrán":"salir",
  "saldría":"salir","saldrías":"salir","saldríamos":"salir","saldríais":"salir","saldrían":"salir",
  "salga":"salir","salgas":"salir","salgamos":"salir","salgáis":"salir","salgan":"salir",
  "saliera":"salir","salieras":"salir","saliéramos":"salir","salierais":"salir","salieran":"salir",
  "sal":"salir","saliendo":"salir","salido":"salir",

  // poner
  "pongo":"poner","pones":"poner","pone":"poner","ponemos":"poner","ponéis":"poner","ponen":"poner",
  "puse":"poner","pusiste":"poner","puso":"poner","pusimos":"poner","pusisteis":"poner","pusieron":"poner",
  "ponía":"poner","ponías":"poner","poníamos":"poner","poníais":"poner","ponían":"poner",
  "pondré":"poner","pondrás":"poner","pondrá":"poner","pondremos":"poner","pondréis":"poner","pondrán":"poner",
  "pondría":"poner","pondrías":"poner","pondríamos":"poner","pondríais":"poner","pondrían":"poner",
  "ponga":"poner","pongas":"poner","pongamos":"poner","pongáis":"poner","pongan":"poner",
  "pusiera":"poner","pusieras":"poner","pusiéramos":"poner","pusierais":"poner","pusieran":"poner",
  "pon":"poner","poniendo":"poner","puesto":"poner",

  // traer
  "traigo":"traer","traes":"traer","trae":"traer","traemos":"traer","traéis":"traer","traen":"traer",
  "traje":"traer","trajiste":"traer","trajo":"traer","trajimos":"traer","trajisteis":"traer","trajeron":"traer",
  "traía":"traer","traías":"traer","traíamos":"traer","traíais":"traer","traían":"traer",
  "traeré":"traer","traerás":"traer","traerá":"traer","traeremos":"traer","traeréis":"traer","traerán":"traer",
  "traería":"traer","traerías":"traer","traeríamos":"traer","traeríais":"traer","traerían":"traer",
  "traiga":"traer","traigas":"traer","traigamos":"traer","traigáis":"traer","traigan":"traer",
  "trajera":"traer","trajeras":"traer","trajéramos":"traer","trajerais":"traer","trajeran":"traer",
  "trayendo":"traer","traído":"traer",

  // oír
  "oigo":"oír","oyes":"oír","oye":"oír","oímos":"oír","oís":"oír","oyen":"oír",
  "oí":"oír","oíste":"oír","oyó":"oír","oísteis":"oír","oyeron":"oír",
  "oía":"oír","oías":"oír","oíamos":"oír","oíais":"oír","oían":"oír",
  "oiré":"oír","oirás":"oír","oirá":"oír","oiremos":"oír","oiréis":"oír","oirán":"oír",
  "oiga":"oír","oigas":"oír","oigamos":"oír","oigáis":"oír","oigan":"oír",
  "oyera":"oír","oyeras":"oír","oyéramos":"oír","oyerais":"oír","oyeran":"oír",
  "oyendo":"oír","oído":"oír",

  // caer
  "caigo":"caer","caes":"caer","cae":"caer","caemos":"caer","caéis":"caer","caen":"caer",
  "caí":"caer","caíste":"caer","cayó":"caer","caímos":"caer","caísteis":"caer","cayeron":"caer",
  "caía":"caer","caías":"caer","caíamos":"caer","caíais":"caer","caían":"caer",
  "caiga":"caer","caigas":"caer","caigamos":"caer","caigáis":"caer","caigan":"caer",
  "cayera":"caer","cayeras":"caer","cayéramos":"caer","cayerais":"caer","cayeran":"caer",
  "cayendo":"caer","caído":"caer",

  // dormir / morir (o → ue, o → u)
  "duermo":"dormir","duermes":"dormir","duerme":"dormir","duermen":"dormir",
  "durmió":"dormir","durmieron":"dormir","durmiendo":"dormir","durmiera":"dormir",
  "muero":"morir","mueres":"morir","muere":"morir","mueren":"morir","murió":"morir",
  "murieron":"morir","muriendo":"morir","muerto":"morir",

  // pedir / repetir / servir / seguir (e → i)
  "pido":"pedir","pides":"pedir","pide":"pedir","piden":"pedir","pidió":"pedir","pidieron":"pedir","pidiendo":"pedir",
  "repito":"repetir","repites":"repetir","repite":"repetir","repiten":"repetir","repitió":"repetir","repitieron":"repetir","repitiendo":"repetir",
  "sirvo":"servir","sirves":"servir","sirve":"servir","sirven":"servir","sirvió":"servir","sirvieron":"servir","sirviendo":"servir",
  "sigo":"seguir","sigues":"seguir","sigue":"seguir","seguimos":"seguir","seguís":"seguir","siguen":"seguir","siguió":"seguir","siguieron":"seguir","siguiendo":"seguir",

  // querer-pattern (e → ie)
  "siento":"sentir","sientes":"sentir","siente":"sentir","sienten":"sentir","sintió":"sentir","sintieron":"sentir","sintiendo":"sentir",
  "miento":"mentir","mientes":"mentir","miente":"mentir","mienten":"mentir","mintió":"mentir","mintieron":"mentir","mintiendo":"mentir",
  "prefiero":"preferir","prefieres":"preferir","prefiere":"preferir","prefieren":"preferir","prefirió":"preferir","prefirieron":"preferir","prefiriendo":"preferir",

  // jugar (u → ue)
  "juego":"jugar","juegas":"jugar","juega":"jugar","jugamos":"jugar","jugáis":"jugar","juegan":"jugar",
  "jugué":"jugar","jugaste":"jugar","jugó":"jugar","jugamos":"jugar","jugasteis":"jugar","jugaron":"jugar",
  "jugaba":"jugar","jugara":"jugar","jugaría":"jugar","juegue":"jugar","jugando":"jugar","jugado":"jugar",

  // pensar, empezar, comenzar, cerrar, sentar, despertar (e → ie)
  "pienso":"pensar","piensas":"pensar","piensa":"pensar","piensan":"pensar",
  "empiezo":"empezar","empiezas":"empezar","empieza":"empezar","empiezan":"empezar","empecé":"empezar",
  "comienzo":"comenzar","comienzas":"comenzar","comienza":"comenzar","comienzan":"comenzar","comencé":"comenzar",
  "cierro":"cerrar","cierras":"cerrar","cierra":"cerrar","cierran":"cerrar",
  "siento":"sentar","sientas":"sentar","sienta":"sentar","sientan":"sentar",
  "despierto":"despertar","despiertas":"despertar","despierta":"despertar","despiertan":"despertar",

  // contar, encontrar, mostrar, recordar, volver, mover, dormir, morir (o → ue)
  "cuento":"contar","cuentas":"contar","cuenta":"contar","cuentan":"contar",
  "encuentro":"encontrar","encuentras":"encontrar","encuentra":"encontrar","encuentran":"encontrar",
  "muestro":"mostrar","muestras":"mostrar","muestra":"mostrar","muestran":"mostrar",
  "recuerdo":"recordar","recuerdas":"recordar","recuerda":"recordar","recuerdan":"recordar",
  "vuelvo":"volver","vuelves":"volver","vuelve":"volver","vuelven":"volver","vuelto":"volver",
  "muevo":"mover","mueves":"mover","mueve":"mover","mueven":"mover",
  "puedo":"poder","puedes":"poder","puede":"poder","pueden":"poder",

  // construir, destruir, contribuir, distribuir, incluir (i → y)
  "construyo":"construir","construyes":"construir","construye":"construir","construyen":"construir","construyó":"construir",
  "destruyo":"destruir","destruyes":"destruir","destruye":"destruir","destruyen":"destruir","destruyó":"destruir",
  "incluyo":"incluir","incluyes":"incluir","incluye":"incluir","incluyen":"incluir","incluyó":"incluir","incluyeron":"incluir",
  "distribuyo":"distribuir","distribuyes":"distribuir","distribuye":"distribuir","distribuyen":"distribuir","distribuyó":"distribuir",

  // conocer, parecer, ofrecer, aparecer, crecer, merecer, agradecer (-zco)
  "conozco":"conocer","conoces":"conocer","conoce":"conocer","conocen":"conocer",
  "parezco":"parecer","pareces":"parecer","parece":"parecer","parecen":"parecer",
  "ofrezco":"ofrecer","ofreces":"ofrecer","ofrece":"ofrecer","ofrecen":"ofrecer",
  "aparezco":"aparecer","apareces":"aparecer","aparece":"aparecer","aparecen":"aparecer",
  "crezco":"crecer","creces":"crecer","crece":"crecer","crecen":"crecer",

  // leer / creer (i → y in 3rd person pretérito)
  "leyó":"leer","leyeron":"leer","leyendo":"leer","leído":"leer",
  "creyó":"creer","creyeron":"creer","creyendo":"creer","creído":"creer",

  // High-frequency 3rd-person preterite of regular verbs that the
  // morphological rules might miss because of accent shifts. Add the
  // most common 100 single-form anchors here.
  "llegó":"llegar","llegaron":"llegar","llegué":"llegar",
  "miró":"mirar","miraron":"mirar","miré":"mirar",
  "observó":"observar","observaron":"observar","observé":"observar",
  "buscó":"buscar","buscaron":"buscar","busqué":"buscar",
  "tomó":"tomar","tomaron":"tomar","tomé":"tomar",
  "pasó":"pasar","pasaron":"pasar","pasé":"pasar",
  "habló":"hablar","hablaron":"hablar","hablé":"hablar",
  "trabajó":"trabajar","trabajaron":"trabajar","trabajé":"trabajar",
  "preguntó":"preguntar","preguntaron":"preguntar","pregunté":"preguntar",
  "contestó":"contestar","contestaron":"contestar","contesté":"contestar",
  "encontró":"encontrar","encontraron":"encontrar","encontré":"encontrar",
  "esperó":"esperar","esperaron":"esperar","esperé":"esperar",
  "necesitó":"necesitar","necesitaron":"necesitar","necesité":"necesitar",
  "compró":"comprar","compraron":"comprar","compré":"comprar",
  "pagó":"pagar","pagaron":"pagar","pagué":"pagar",
  "entró":"entrar","entraron":"entrar","entré":"entrar",
  "salió":"salir","salieron":"salir",
  "comió":"comer","comieron":"comer","comí":"comer","comiste":"comer",
  "bebió":"beber","bebieron":"beber",
  "abrió":"abrir","abrieron":"abrir","abrí":"abrir","abriste":"abrir",
  "subió":"subir","subieron":"subir",
  "bajó":"bajar","bajaron":"bajar","bajé":"bajar",
  "caminó":"caminar","caminaron":"caminar","caminé":"caminar",
  "corrió":"correr","corrieron":"correr",
  "vivió":"vivir","vivieron":"vivir","viví":"vivir",
  "escribió":"escribir","escribieron":"escribir","escribí":"escribir",
  "decidió":"decidir","decidieron":"decidir","decidí":"decidir",
  "olvidó":"olvidar","olvidaron":"olvidar","olvidé":"olvidar",
  "regresó":"regresar","regresaron":"regresar","regresé":"regresar",
  "viajó":"viajar","viajaron":"viajar","viajé":"viajar",
  "explicó":"explicar","explicaron":"explicar","expliqué":"explicar",
  "contó":"contar","contaron":"contar",
  "mostró":"mostrar","mostraron":"mostrar",
  "enseñó":"enseñar","enseñaron":"enseñar",
  "ayudó":"ayudar","ayudaron":"ayudar","ayudé":"ayudar",
  "llamó":"llamar","llamaron":"llamar","llamé":"llamar",
  "tocó":"tocar","tocaron":"tocar","toqué":"tocar",
  "perdió":"perder","perdieron":"perder","perdí":"perder",
  "ganó":"ganar","ganaron":"ganar","gané":"ganar",
  "terminó":"terminar","terminaron":"terminar","terminé":"terminar",
  "empezó":"empezar","empezaron":"empezar","empecé":"empezar",
  "comenzó":"comenzar","comenzaron":"comenzar","comencé":"comenzar",
  "cambió":"cambiar","cambiaron":"cambiar","cambié":"cambiar",
  "intentó":"intentar","intentaron":"intentar","intenté":"intentar",
  "trató":"tratar","trataron":"tratar","traté":"tratar",
  "siguió":"seguir","siguieron":"seguir","seguí":"seguir",
  "pidió":"pedir","pidieron":"pedir","pedí":"pedir",
  "repitió":"repetir","repitieron":"repetir","repetí":"repetir",
  "sintió":"sentir","sintieron":"sentir","sentí":"sentir",
  "pensó":"pensar","pensaron":"pensar","pensé":"pensar",
  "creyó":"creer","creyeron":"creer","creí":"creer","creímos":"creer",
  "leyó":"leer","leyeron":"leer","leí":"leer",
  "vio":"ver","vieron":"ver","vi":"ver","viste":"ver",
  "supo":"saber","supieron":"saber","supe":"saber","supiste":"saber",
  "trajo":"traer","trajeron":"traer","traje":"traer",
  "dio":"dar","dieron":"dar","di":"dar","dimos":"dar",
  "vino":"venir","vinieron":"venir","vine":"venir","vinimos":"venir",
  "salió":"salir","salieron":"salir","salí":"salir",
  "puso":"poner","pusieron":"poner","puse":"poner",
  "deja":"dejar","dejas":"dejar","dejo":"dejar","dejan":"dejar","dejé":"dejar","dejó":"dejar","dejaron":"dejar",
  "lleva":"llevar","llevas":"llevar","llevo":"llevar","llevan":"llevar","llevé":"llevar","llevó":"llevar","llevaron":"llevar",
  "queda":"quedar","quedas":"quedar","quedo":"quedar","quedan":"quedar","quedé":"quedar","quedó":"quedar","quedaron":"quedar",
  "busca":"buscar","buscas":"buscar","busco":"buscar","buscan":"buscar","busqué":"buscar","buscó":"buscar","buscaron":"buscar",
  "ayuda":"ayudar","ayudas":"ayudar","ayudo":"ayudar","ayudan":"ayudar","ayudé":"ayudar","ayudó":"ayudar","ayudaron":"ayudar",
  "espera":"esperar","esperas":"esperar","espero":"esperar","esperan":"esperar","esperé":"esperar","esperó":"esperar","esperaron":"esperar",
  "trabaja":"trabajar","trabajas":"trabajar","trabajo":"trabajar","trabajan":"trabajar","trabajé":"trabajar","trabajó":"trabajar","trabajaron":"trabajar",
  "estudia":"estudiar","estudias":"estudiar","estudio":"estudiar","estudian":"estudiar","estudié":"estudiar","estudió":"estudiar","estudiaron":"estudiar",
  "pregunta":"preguntar","preguntas":"preguntar","pregunto":"preguntar","preguntan":"preguntar","pregunté":"preguntar","preguntó":"preguntar","preguntaron":"preguntar",
  "responde":"responder","respondes":"responder","respondo":"responder","responden":"responder","respondí":"responder","respondió":"responder","respondieron":"responder",
  "escucha":"escuchar","escuchas":"escuchar","escucho":"escuchar","escuchan":"escuchar","escuché":"escuchar","escuchó":"escuchar","escucharon":"escuchar",
  "mira":"mirar","miras":"mirar","miro":"mirar","miran":"mirar",
  "habla":"hablar","hablas":"hablar","hablo":"hablar","hablan":"hablar",
  "necesita":"necesitar","necesitas":"necesitar","necesito":"necesitar","necesitan":"necesitar",
  "trata":"tratar","tratas":"tratar","trato":"tratar","tratan":"tratar",
  "intenta":"intentar","intentas":"intentar","intento":"intentar","intentan":"intentar",
  "compra":"comprar","compras":"comprar","compro":"comprar","compran":"comprar",
  "vende":"vender","vendes":"vender","vendo":"vender","venden":"vender","vendí":"vender","vendió":"vender","vendieron":"vender",
  "abre":"abrir","abres":"abrir","abro":"abrir","abren":"abrir",
  "cierra":"cerrar","cierras":"cerrar","cierro":"cerrar","cierran":"cerrar","cerré":"cerrar","cerró":"cerrar","cerraron":"cerrar",
  "entra":"entrar","entras":"entrar","entro":"entrar","entran":"entrar",
  "llega":"llegar","llegas":"llegar","llego":"llegar","llegan":"llegar",
  "pasa":"pasar","pasas":"pasar","paso":"pasar","pasan":"pasar",
  "cambia":"cambiar","cambias":"cambiar","cambio":"cambiar","cambian":"cambiar",
  "regresa":"regresar","regresas":"regresar","regreso":"regresar","regresan":"regresar",
  "ocurre":"ocurrir","ocurres":"ocurrir","ocurro":"ocurrir","ocurren":"ocurrir","ocurrí":"ocurrir","ocurrió":"ocurrir","ocurrieron":"ocurrir",
  "sucede":"suceder","sucedes":"suceder","sucedo":"suceder","suceden":"suceder","sucedí":"suceder","sucedió":"suceder","sucedieron":"suceder",
  "parece":"parecer","pareces":"parecer","parezco":"parecer","parecen":"parecer",
  "vive":"vivir","vives":"vivir","vivo":"vivir","viven":"vivir",
  "muere":"morir","mueres":"morir","muero":"morir","mueren":"morir",
  "siente":"sentir","sientes":"sentir","siento":"sentir","sienten":"sentir",
  "duerme":"dormir","duermes":"dormir","duermo":"dormir","duermen":"dormir",
  "muestra":"mostrar","muestras":"mostrar","muestro":"mostrar","muestran":"mostrar",
  "cuenta":"contar","cuentas":"contar","cuento":"contar","cuentan":"contar",
  "vuelve":"volver","vuelves":"volver","vuelvo":"volver","vuelven":"volver","volví":"volver","volvió":"volver","volvieron":"volver",
  "encuentra":"encontrar","encuentras":"encontrar","encuentro":"encontrar","encuentran":"encontrar",
  "recuerda":"recordar","recuerdas":"recordar","recuerdo":"recordar","recuerdan":"recordar",
  "piensa":"pensar","piensas":"pensar","pienso":"pensar","piensan":"pensar",
  "siente":"sentir","sientes":"sentir","siento":"sentir","sienten":"sentir",
  "elige":"elegir","eliges":"elegir","elijo":"elegir","eligen":"elegir","elegí":"elegir","eligió":"elegir","eligieron":"elegir",
  "escoge":"escoger","escoges":"escoger","escojo":"escoger","escogen":"escoger","escogí":"escoger","escogió":"escoger","escogieron":"escoger",

  // Reflexive forms (the morphological rule strips -se but conjugated
  // reflexives also lose the -se, e.g. "me levanto", "se levanta")
  "levanto":"levantar","levantas":"levantar","levanta":"levantar","levantan":"levantar",
  "siento":"sentar","sientas":"sentar","sienta":"sentar","sientan":"sentar",
  "despierto":"despertar","despiertas":"despertar","despierta":"despertar","despiertan":"despertar",
  "acuesto":"acostar","acuestas":"acostar","acuesta":"acostar","acuestan":"acostar",
  "viste":"vestir","vistes":"vestir","visto":"vestir","visten":"vestir","vistió":"vestir","vistieron":"vestir",
  "baño":"bañar","bañas":"bañar","baña":"bañar","bañan":"bañar","bañé":"bañar","bañó":"bañar","bañaron":"bañar",

  "ven":"venir","ves":"ver","ten":"tener","ponla":"poner","ponle":"poner","sácalo":"sacar","dámelo":"dar","dime":"decir",
  "espérame":"esperar","quédate":"quedarse","levántate":"levantar","cálmate":"calmar","mírame":"mirar","escúchame":"escuchar","ayúdame":"ayudar"
}`;
// Strip // comments and trailing commas before JSON.parse so the source
// stays readable with section markers.
function stripJsonExtras(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n")
    .replace(/,(\s*[}\]])/g, "$1");
}
const IRREGULAR_FORMS: Record<string, string> = JSON.parse(
  stripJsonExtras(IRREGULAR_FORMS_RAW),
);

// Programmatic regular conjugator
function genRegularConjugations(verb: string): string[] {
  if (verb.length < 3) return [];
  const ending = verb.slice(-2);
  const stem = verb.slice(0, -2);
  const out: string[] = [];
  if (ending === "ar") {
    // presente
    out.push(stem + "o", stem + "as", stem + "a", stem + "amos", stem + "áis", stem + "an");
    // pretérito perfecto simple
    out.push(stem + "é", stem + "aste", stem + "ó", stem + "amos", stem + "asteis", stem + "aron");
    // imperfecto
    out.push(stem + "aba", stem + "abas", stem + "ábamos", stem + "abais", stem + "aban");
    // futuro
    out.push(verb + "é", verb + "ás", verb + "á", verb + "emos", verb + "éis", verb + "án");
    // condicional
    out.push(verb + "ía", verb + "ías", verb + "íamos", verb + "íais", verb + "ían");
    // subjuntivo presente
    out.push(stem + "e", stem + "es", stem + "emos", stem + "éis", stem + "en");
    // subjuntivo imperfecto
    out.push(stem + "ara", stem + "aras", stem + "áramos", stem + "arais", stem + "aran");
    out.push(stem + "ase", stem + "ases", stem + "ásemos", stem + "aseis", stem + "asen");
    // gerundio + participio
    out.push(stem + "ando", stem + "ado", stem + "ada", stem + "ados", stem + "adas");
  } else if (ending === "er") {
    out.push(stem + "o", stem + "es", stem + "e", stem + "emos", stem + "éis", stem + "en");
    out.push(stem + "í", stem + "iste", stem + "ió", stem + "imos", stem + "isteis", stem + "ieron");
    out.push(stem + "ía", stem + "ías", stem + "íamos", stem + "íais", stem + "ían");
    out.push(verb + "é", verb + "ás", verb + "á", verb + "emos", verb + "éis", verb + "án");
    out.push(verb + "ía", verb + "ías", verb + "íamos", verb + "íais", verb + "ían");
    out.push(stem + "a", stem + "as", stem + "amos", stem + "áis", stem + "an");
    out.push(stem + "iera", stem + "ieras", stem + "iéramos", stem + "ierais", stem + "ieran");
    out.push(stem + "iendo", stem + "ido", stem + "ida", stem + "idos", stem + "idas");
  } else if (ending === "ir") {
    out.push(stem + "o", stem + "es", stem + "e", stem + "imos", stem + "ís", stem + "en");
    out.push(stem + "í", stem + "iste", stem + "ió", stem + "imos", stem + "isteis", stem + "ieron");
    out.push(stem + "ía", stem + "ías", stem + "íamos", stem + "íais", stem + "ían");
    out.push(verb + "é", verb + "ás", verb + "á", verb + "emos", verb + "éis", verb + "án");
    out.push(verb + "ía", verb + "ías", verb + "íamos", verb + "íais", verb + "ían");
    out.push(stem + "a", stem + "as", stem + "amos", stem + "áis", stem + "an");
    out.push(stem + "iera", stem + "ieras", stem + "iéramos", stem + "ierais", stem + "ieran");
    out.push(stem + "iendo", stem + "ido", stem + "ida", stem + "idos", stem + "idas");
  }
  return out;
}

// Build the lookup table at module load. ~200 verbs × ~50 forms +
// ~700 explicit irregulars = ~10000 entries.
const conjugationMap = new Map<string, string>();
for (const verb of COMMON_VERBS) {
  for (const form of genRegularConjugations(verb)) {
    if (!conjugationMap.has(form)) conjugationMap.set(form, verb);
  }
}
// Irregulars override
for (const [form, inf] of Object.entries(IRREGULAR_FORMS)) {
  conjugationMap.set(form, inf);
}

/** Return the infinitive of a Spanish word if it's a known conjugated
 *  form. Otherwise return null. Case-insensitive, accent-sensitive. */
export function spanishInfinitiveOf(word: string): string | null {
  const w = word.toLowerCase().trim();
  return conjugationMap.get(w) ?? null;
}

/** True if the word is in our verb conjugation table. Useful for tests. */
export function isKnownConjugation(word: string): boolean {
  return spanishInfinitiveOf(word) !== null;
}
