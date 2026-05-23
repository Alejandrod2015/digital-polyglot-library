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
