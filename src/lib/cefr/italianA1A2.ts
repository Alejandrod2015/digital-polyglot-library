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
]);

// BLOQUE 2: ITALIAN_A1_A2_CURATED (2026-09-14). Mismo metodo que el bloque
// curado de frenchA1A2.ts: palabra por palabra, solo las que el plan del
// Friends IT A1 (docs/plan-it-a1-friends.md, commit 6405c2a8) necesita y que
// faltaban en el bloque 1. Cada una lleva su nivel y su categoria en KELLY
// Italian (Kilgarriff et al., ssharoff.github.io/kelly), usado solo como
// referencia de nivel por palabra; la lista KELLY no se redistribuye (es
// CC BY-NC-SA 2.0). Solo entran las que KELLY marca A1 o A2. Las del plan que
// KELLY marca B1 o mas, o que no trae, se quedan fuera a proposito: van en el
// texto, no en plaza, o cuentan como las 1-2 fuera de nivel que el check tolera.
// Ampliado tema a tema (2026-09-14, via Journey-planning-2): cada palabra que
// una historia del journey usa como plaza y KELLY marca A1/A2, nunca una que
// ninguna historia use. Tema 3 (Neighbours & Noise): 19 palabras. Tema 4 (Bills & Expenses): 33.
// Fuera tambien "straordinario": KELLY lo da A1 como ADJETIVO y el plan lo usa
// como NOMBRE (horas extra); la lista no distingue categoria.
const ITALIAN_A1_A2_CURATED: readonly string[] = [
  "adottare",         // KELLY: A1 (VER)
  "affare",           // KELLY: A2 (NOM)
  "amministratore",   // KELLY: A2 (NOM)
  "attenzione",       // KELLY: A1 (NOM)
  "bravo",            // KELLY: A2 (ADJ)
  "calcio",           // KELLY: A2 (NOM)
  "calcolare",        // KELLY: A2 (VER)
  "cambiare",         // KELLY: A1 (VER)
  "cambio",           // KELLY: A2 (NOM)
  "cancellare",       // KELLY: A2 (VER)
  "chiave",           // KELLY: A2 (NOM)
  "colpa",            // KELLY: A2 (NOM)
  "concerto",         // KELLY: A2 (NOM)
  "consegnare",       // KELLY: A2 (VER)
  "contare",          // KELLY: A2 (VER)
  "conto",            // KELLY: A1 (NOM)
  "coraggio",         // KELLY: A2 (NOM)
  "costare",          // KELLY: A2 (VER)
  "davvero",          // KELLY: A1 (ADV)
  "differenza",       // KELLY: A1 (NOM)
  "discutere",        // KELLY: A2 (VER)
  "dividere",         // KELLY: A2 (VER)
  "elenco",           // KELLY: A2 (NOM)
  "euro",             // KELLY: A1 (NOM)
  "girare",           // KELLY: A2 (VER)
  "giro",             // KELLY: A1 (NOM)
  "giusto",           // KELLY: A1 (ADJ)
  "grave",            // KELLY: A1 (ADJ)
  "gruppo",           // KELLY: A1 (NOM)
  "gusto",            // KELLY: A2 (NOM)
  "importo",          // KELLY: A2 (NOM)
  "insieme",          // KELLY: A1 (ADV)
  "intero",           // KELLY: A1 (ADJ)
  "inutile",          // KELLY: A2 (ADJ)
  "invece",           // KELLY: A1 (ADV)
  "legare",           // KELLY: A1 (VER)
  "mancare",          // KELLY: A1 (VER)
  "messaggio",        // KELLY: A1 (NOM)
  "nascondere",       // KELLY: A2 (VER)
  "nome",             // KELLY: A1 (NOM)
  "ombra",            // KELLY: A2 (NOM)
  "ormai",            // KELLY: A1 (ADV)
  "pace",             // KELLY: A1 (NOM)
  "pari",             // KELLY: A1 (ADJ)
  "parte",            // KELLY: A1 (NOM)
  "partire",          // KELLY: A1 (VER)
  "pericoloso",       // KELLY: A2 (ADJ)
  "prezioso",         // KELLY: A2 (ADJ)
  "promettere",       // KELLY: A2 (VER)
  "proporre",         // KELLY: A1 (VER)
  "provare",          // KELLY: A1 (VER)
  "ragione",          // KELLY: A1 (NOM)
  "restare",          // KELLY: A1 (VER)
  "ricercatore",      // KELLY: A2 (NOM)
  "ricordo",          // KELLY: A2 (NOM)
  "ridere",           // KELLY: A2 (VER)
  "rinunciare",       // KELLY: A2 (VER)
  "rispetto",         // KELLY: A1 (NOM)
  "salvare",          // KELLY: A2 (VER)
  "sbagliare",        // KELLY: A2 (VER)
  "scusare",          // KELLY: A2 (VER)
  "segnare",          // KELLY: A2 (VER)
  "semplice",         // KELLY: A1 (ADJ)
  "serio",            // KELLY: A2 (ADJ)
  "sguardo",          // KELLY: A2 (NOM)
  "silenzio",         // KELLY: A2 (NOM)
  "spendere",         // KELLY: A2 (VER)
  "squadra",          // KELLY: A2 (NOM)
  "strano",           // KELLY: A2 (ADJ)
  "studio",           // KELLY: A1 (NOM)
  "succedere",        // KELLY: A1 (VER)
  "suonare",          // KELLY: A2 (VER)
  "toccare",          // KELLY: A2 (VER)
  "trattare",         // KELLY: A1 (VER)
  "uguale",           // KELLY: A2 (ADJ)
  "usare",            // KELLY: A1 (VER)
  "valere",           // KELLY: A1 (VER)
  "visita",           // KELLY: A2 (NOM)
  "votare",           // KELLY: A2 (VER)
];
for (const w of ITALIAN_A1_A2_CURATED) (ITALIAN_A1_A2_LEMMAS as Set<string>).add(w);

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
    // Plural en -i de nombres en -e ("chiavi" -> "chiave").
    if (lemma.endsWith("i") && ITALIAN_A1_A2_LEMMAS.has(lemma.slice(0, -1) + "e")) return true;
  }
  return false;
}
