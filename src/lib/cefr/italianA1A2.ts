// Italian A1 + A2 lemma frequency list.
//
// Source: CILS A1/A2 + Routledge frequency dictionary Italian
// top-1500. Curated for the practical beginner experience.

export const ITALIAN_A1_A2_LEMMAS: ReadonlySet<string> = new Set([
  // Function words
  "il","lo","la","i","gli","le","un","uno","una","del","dello","della","dei","degli","delle",
  "io","tu","lui","lei","noi","voi","loro","mio","tuo","suo","nostro","vostro",
  "questo","questa","quello","quella","tale","stesso","altro","tutto","ogni","qualche",
  "e","o","ma","però","perché","quando","mentre","se","anche","ancora","già",
  "in","a","da","di","con","su","per","tra","fra","verso","durante","contro","senza","sopra","sotto",
  "non","no","sì","forse","sicuro","certo","mai","sempre","spesso","raramente",

  // Time
  "giorno","notte","mattina","pomeriggio","sera","ora","minuto","secondo","settimana",
  "mese","anno","tempo","momento","attimo","fine settimana","vacanza","festa",
  "lunedì","martedì","mercoledì","giovedì","venerdì","sabato","domenica",
  "gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto",
  "settembre","ottobre","novembre","dicembre","primavera","estate","autunno","inverno",
  "oggi","domani","ieri","adesso","ora","poi","dopo","prima","presto","tardi",

  // Family / people
  "famiglia","padre","papà","madre","mamma","figlio","figlia","fratello","sorella",
  "nonno","nonna","zio","zia","cugino","cugina","nipote","marito","moglie",
  "uomo","donna","bambino","bambina","ragazzo","ragazza","persona","gente","amico","amica",
  "vicino","collega","signore","signora","signorina",

  // Body
  "corpo","testa","faccia","viso","occhio","orecchio","naso","bocca","dente","lingua",
  "labbro","collo","spalla","braccio","mano","dito","unghia","petto","schiena",
  "stomaco","gamba","ginocchio","piede","cuore","sangue","pelle","capello",

  // Clothes
  "vestito","camicia","maglietta","pantalone","gonna","abito","giacca","cappotto","maglione",
  "scarpa","stivale","calzino","cappello","sciarpa","guanto","cintura","cravatta",
  "occhiali","anello","orologio","borsa","zaino","biancheria","pigiama","costume",

  // Home
  "casa","appartamento","camera","stanza","cucina","bagno","soggiorno","camera da letto",
  "giardino","balcone","terrazza","corridoio","scala","ascensore","porta","finestra",
  "muro","parete","soffitto","pavimento","tetto","tavolo","sedia","divano","poltrona",
  "letto","armadio","scaffale","cassetto","comò","lampada","specchio","quadro","tappeto",
  "tenda","cuscino","coperta","lenzuolo","asciugamano","sapone","spazzolino","dentifricio",
  "candela","fiammifero","scopa","aspirapolvere","secchio","spugna","detersivo",
  "pentola","padella","piatto","bicchiere","tazza","cucchiaio","forchetta","coltello",
  "tovagliolo","tovaglia","ciotola","caraffa","bottiglia","barattolo","scatola","sacchetto",

  // Food / drink
  "cibo","colazione","pranzo","cena","spuntino","pasto","piatto","menù",
  "pane","panino","burro","marmellata","formaggio","prosciutto","salame","uovo","uova",
  "latte","yogurt","panna","caffè","tè","acqua","succo","limonata","birra","vino",
  "mela","pera","arancia","banana","uva","fragola","limone","ciliegia","melone","anguria",
  "pomodoro","patata","cipolla","aglio","carota","insalata","lattuga","cetriolo","peperone",
  "zucchina","funghi","fagioli","piselli","mais",
  "carne","pollo","manzo","maiale","pesce","tonno","salmone","gambero","calamaro",
  "riso","pasta","spaghetti","pizza","minestra","zuppa","brodo","sugo","salsa",
  "sale","pepe","olio","aceto","zucchero","miele","cioccolato","biscotto","torta","gelato",

  // City / places
  "città","paese","strada","via","piazza","parco","mercato","negozio","supermercato",
  "panetteria","macelleria","farmacia","libreria","banca","posta","biblioteca","museo",
  "teatro","cinema","ristorante","bar","albergo","hotel","ospedale","scuola","università",
  "ufficio","stazione","aeroporto","porto","spiaggia","montagna","fiume","lago","mare",
  "bosco","campagna","fattoria","chiesa","cattedrale","castello","torre","ponte",
  "edificio","palazzo","appartamento","quartiere","casa",

  // Transport
  "macchina","auto","bicicletta","bici","moto","autobus","bus","treno","metropolitana",
  "tram","taxi","camion","nave","barca","aereo","viaggio","biglietto","valigia","zaino",
  "passaporto","mappa","fermata","stazione","strada","autostrada","semaforo","incrocio",

  // Nature / weather
  "sole","luna","stella","cielo","nuvola","pioggia","neve","vento","ghiaccio","tempesta",
  "caldo","freddo","temperatura","tempo","clima","albero","fiore","foglia","pianta",
  "erba","sabbia","sasso","pietra","terra","animale","cane","gatto","uccello","cavallo",
  "mucca","maiale","pecora","gallina","pesce","topo","mosca","farfalla","ape",

  // School / work
  "scuola","classe","lezione","insegnante","professore","professoressa","alunno","alunna",
  "studente","studentessa","libro","quaderno","penna","matita","gomma","righello",
  "lavagna","compito","esame","voto","domanda","risposta","parola","frase","lettera",
  "numero","lingua","corso","semestre",
  "lavoro","ufficio","impiego","capo","collega","stipendio","orario","riunione","relazione",
  "computer","portatile","telefono","cellulare","schermo","tastiera","stampante",

  // Verbs (top frequency)
  "essere","avere","fare","andare","venire","vedere","sentire","dire","parlare",
  "sapere","potere","volere","dovere","credere","pensare","capire","conoscere",
  "vivere","morire","nascere","crescere","arrivare","entrare","uscire","tornare",
  "mangiare","bere","cucinare","preparare","servire","comprare","vendere","pagare",
  "prendere","dare","portare","mettere","togliere","aprire","chiudere","salire","scendere",
  "camminare","correre","saltare","nuotare","ballare","cantare","giocare","vincere","perdere",
  "aspettare","cominciare","finire","lavorare","studiare","imparare","insegnare",
  "leggere","scrivere","ascoltare","domandare","rispondere","raccontare","spiegare",
  "aiutare","cercare","trovare","portare","muovere","spingere","tirare","prendere",
  "lasciare","tenere","regalare","prestare","ricevere","mandare","spedire","accendere",
  "spegnere","lavare","pulire","cucinare","scaldare","raffreddare","tagliare","mescolare",
  "rompere","aggiustare","riparare","cadere","alzarsi","sedersi","coricarsi","dormire",
  "svegliarsi","vestirsi","spogliarsi","farsi la doccia","lavarsi","pettinarsi","radersi",
  "uscire","entrare","viaggiare","visitare","salutare","invitare","chiamare","chiedere",
  "offrire","accettare","rifiutare","dire","raccontare","mentire","ricordare","dimenticare",
  "amare","piacere","interessare","stancare","preoccupare","arrabbiare","rallegrare",
  "spaventare","sorprendere","mostrare","comparare","scegliere","preferire","decidere",

  // Adjectives
  "buono","cattivo","grande","piccolo","alto","basso","lungo","corto","largo","stretto",
  "nuovo","vecchio","giovane","caro","economico","facile","difficile","veloce","lento",
  "forte","debole","duro","morbido","liscio","ruvido","pulito","sporco","pieno","vuoto",
  "aperto","chiuso","caldo","freddo","tiepido","secco","umido","chiaro","scuro","brillante",
  "felice","contento","triste","stanco","arrabbiato","preoccupato","tranquillo","nervoso",
  "gentile","simpatico","antipatico","educato","timido","coraggioso","intelligente","stupido",
  "bello","brutto","attraente","famoso","ricco","povero","magro","grasso",
  "rosso","blu","verde","giallo","bianco","nero","grigio","marrone","rosa","arancione",
  "primo","secondo","terzo","ultimo","prossimo","seguente",

  // Adverbs
  "bene","male","meglio","peggio","velocemente","lentamente","qui","qua","lì","là",
  "su","giù","vicino","lontano","dentro","fuori","davanti","dietro","sopra","sotto",
  "molto","poco","abbastanza","troppo","quasi","appena","solo","anche","neanche",
  "sempre","mai","spesso","ogni tanto","raramente","ora","subito","presto","tardi",

  // Numbers
  "zero","uno","due","tre","quattro","cinque","sei","sette","otto","nove","dieci",
  "undici","dodici","tredici","quattordici","quindici","sedici","diciassette","diciotto",
  "diciannove","venti","trenta","quaranta","cinquanta","sessanta","settanta","ottanta",
  "novanta","cento","mille","milione","primo","secondo","terzo","metà","mezzo",

  // Abstract common
  "vita","morte","amore","amicizia","felicità","tristezza","paura","gioia","sorpresa",
  "problema","soluzione","idea","domanda","risposta","storia","racconto","verità",
  "bugia","sogno","piano","viaggio","festa","compleanno","matrimonio","funerale",
  "riunione","appuntamento","intervista","conversazione","telefonata","chiamata",
  "salute","malattia","dolore","medicina","cura","sport","musica","canzone","film",

  // ── Ampliacion 2026-08-23: viaje por carretera, alojamiento, salud, telefono
  // y ventanilla ─────────────────────────────────────────────────────────────
  //
  // La lista original (792 lemas) es "el principiante practico" de casa: cocina,
  // familia, escuela, ropa. No tiene NADA de lo que un A1/A2 de viaje necesita,
  // asi que empujaba a ensenar justo lo que el A0 ya habia ensenado. Mismo caso
  // y mismo remedio que el portugues, que paso de 808 a ~950 lemas por esto
  // ([[feedback_vocab_zero_overlap_across_journeys]]).
  //
  // CRITERIO: entra lo que esta en cualquier temario A1/A2 (Contatto A1/A2,
  // Nuovo Espresso 1-2, CILS A1/A2 tienen unidades enteras de "in albergo",
  // "dal medico", "in viaggio", "alla posta"). NO entra lo que solo hace falta
  // para que pase una historia concreta: `frizione`, `tergicristallo`,
  // `segnavia`, `raccomandata` o `verbale` son B1 y se quedan fuera a proposito;
  // usarlas cuesta una de las dos plazas fuera de nivel que el gate permite por
  // historia, que es justo lo que debe costar un ancla.

  // Carretera y coche
  "autostrada","benzina","distributore","parcheggio","parcheggiare","guidare","patente",
  "multa","targa","freno","frenare","volante","curva","galleria","traffico","chilometro",
  "velocità","limite","camion","furgone","faro","portiera","sorpassare","accelerare",
  "navigatore","corsia","gomma","pneumatico","incidente","stanchezza",

  // Telefono y corriente
  "messaggio","batteria","carica","caricabatterie","presa","rete","password","tasto",
  "foto","registrare","silenzioso","scaricare","ricaricare","collegare","credito",

  // Alojamiento
  "prenotare","prenotazione","chiave","doccia","rubinetto","materasso","sveglia",
  "ricevuta","lampadina","zanzara","cortile","campanello","comodino","ospite",

  // Campo y monte
  "pino","ramo","sentiero","fango","nebbia","riposare","seguire","perdersi","sudare",
  "bagnato","insetto","castagna","radice","torcia","salita","discesa","sasso",

  // Fiesta de pueblo
  "banda","tromba","tamburo","santo","statua","griglia","salsiccia","sindaco","ballo",
  "discorso","microfono","bandiera","fumo","piazza",

  // Farmacia y medico
  "farmacia","farmacista","ricetta","sciroppo","pastiglia","cerotto","febbre",
  "termometro","tosse","raffreddore","gola","dottore","medico","riposo","ambulanza",
  "caviglia","respirare",

  // Ventanilla y papeles
  "modulo","firma","firmare","timbro","timbrare","sportello","documento","busta",
  "consegnare","consegna","ritirare","controllare","impiegato","impiegata","scrivania",
  "fotocopia","contratto","ufficio","orario","fila",

  // Verbos y estados de uso diario que faltaban
  "riuscire","smettere","rimanere","promettere","svuotare","riempire","aspettare",
  "spiegare","ripetere","decidere","provare","succedere","servire","costare","pagare",

  // ── La capa PORTABLE que la lista no tenia (2026-08-23) ────────────────────
  //
  // Todas estas las enseña el Traveler A0 italiano, que ya esta publicado: son
  // A1 sin discusion y estaban fuera de la lista solo porque la lista se hizo
  // mirando la cocina y la escuela. Se anaden al abrir la capa portable entre
  // niveles del mismo tipo (ver `scripts/saveStory.ts`): sin ellas, enseñar
  // `guardare` o `restare` en un A1 contaba como fuera de nivel.
  "guardare","restare","passare","fermare","contare","coprire","indicare","bastare",
  "suonare","girare","proporre","ridere","destro","gonfio","mattinata","motivo",
  "stasera","quanto","fondo","intorno","dove","insieme","invece",
]);

export function isItalianA1A2(word: string): boolean {
  const lemma = word.toLowerCase().trim();
  if (ITALIAN_A1_A2_LEMMAS.has(lemma)) return true;
  // Strip articles
  const stripped = lemma.replace(/^(il|lo|la|i|gli|le|un|uno|una)\s+/, "");
  if (ITALIAN_A1_A2_LEMMAS.has(stripped)) return true;
  // Plural → singular drop -e/-i
  if (lemma.endsWith("e") || lemma.endsWith("i")) {
    const sing = lemma.slice(0, -1) + (lemma.endsWith("i") ? "o" : "a");
    if (ITALIAN_A1_A2_LEMMAS.has(sing)) return true;
  }
  return false;
}
