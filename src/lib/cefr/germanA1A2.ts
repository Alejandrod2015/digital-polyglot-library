// German A1 + A2 lemma frequency list.
//
// Source: Goethe-Institut A1/A2 Wortliste + Routledge frequency
// dictionary top-1500 Deutsch. Curated for the practical learner
// experience in the first months.
//
// All entries lowercase (despite German noun capitalization), in
// lemma form: infinitive for verbs (-en ending kept), nominative
// singular for nouns/adjectives. The validator lowercases the input
// before lookup so the case mismatch is handled.

export const GERMAN_A1_A2_LEMMAS: ReadonlySet<string> = new Set([
  // Function words
  "der","die","das","ein","eine","einen","einem","einer","eines","den","dem","des",
  "ich","du","er","sie","es","wir","ihr","mein","dein","sein","ihr","unser","euer",
  "und","oder","aber","denn","weil","obwohl","wenn","als","damit","dass","ob",
  "in","an","auf","bei","mit","nach","von","zu","aus","über","unter","vor","hinter",
  "neben","zwischen","gegen","für","durch","ohne","um","seit","bis","ab","nicht",
  "kein","keine","nichts","niemand","nie","schon","noch","mehr","weniger","sehr","ganz",
  "auch","nur","fast","etwa","ungefähr","vielleicht","wirklich","sicher","leider",
  "hier","da","dort","oben","unten","links","rechts","vorne","hinten","überall",

  // Time
  "tag","nacht","morgen","mittag","abend","stunde","minute","sekunde","woche","monat",
  "jahr","jahrzehnt","zeit","moment","augenblick","wochenende","feiertag","urlaub",
  "montag","dienstag","mittwoch","donnerstag","freitag","samstag","sonntag",
  "januar","februar","märz","april","mai","juni","juli","august","september","oktober",
  "november","dezember","frühling","sommer","herbst","winter",
  "heute","morgen","gestern","jetzt","gleich","sofort","später","früh","spät",
  "immer","oft","manchmal","selten","nie","täglich","wöchentlich","monatlich",

  // Family / people
  "familie","vater","papa","mutter","mama","sohn","tochter","bruder","schwester",
  "oma","opa","großvater","großmutter","onkel","tante","cousin","cousine",
  "mann","frau","kind","baby","junge","mädchen","freund","freundin","kollege","kollegin",
  "nachbar","nachbarin","gast","besucher","mensch","person","leute","mitarbeiter",

  // Body
  "körper","kopf","gesicht","auge","ohr","nase","mund","zahn","zunge","lippe",
  "hals","schulter","arm","hand","finger","brust","rücken","bauch","bein","knie","fuß",
  "haar","haut","blut","knochen","herz","magen","lunge","leber",

  // Clothes
  "kleidung","hemd","hose","rock","kleid","jacke","mantel","pullover","jeans",
  "schuh","stiefel","sandale","sportschuh","socke","strumpf","hut","mütze","schal",
  "handschuh","krawatte","gürtel","brille","ring","uhr","tasche","rucksack",
  "anzug","kostüm","bluse","t-shirt","unterwäsche","badehose","badeanzug",

  // Home
  "haus","wohnung","zimmer","schlafzimmer","wohnzimmer","küche","bad","badezimmer",
  "garten","balkon","terrasse","keller","dachboden","treppe","aufzug","tür","fenster",
  "wand","decke","boden","dach","tisch","stuhl","sofa","sessel","bett","schrank",
  "regal","kommode","lampe","spiegel","bild","teppich","vorhang","gardine","kissen",
  "decke","laken","handtuch","seife","zahnpasta","zahnbürste","kamm","bürste",
  "kerze","streichholz","besen","staubsauger","mülleimer","müll","abfall",
  "topf","pfanne","teller","glas","tasse","becher","löffel","gabel","messer",
  "serviette","tischdecke","schüssel","schale","kanne","krug","flasche","dose",

  // Food / drink
  "essen","frühstück","mittagessen","abendessen","mahlzeit","speise","gericht",
  "brot","brötchen","butter","marmelade","käse","wurst","schinken","ei","eier",
  "milch","joghurt","sahne","quark","tee","kaffee","wasser","saft","limonade","bier",
  "wein","sekt","apfel","birne","orange","banane","weintraube","kirsche","erdbeere",
  "zitrone","melone","tomate","gurke","kartoffel","zwiebel","karotte","möhre","salat",
  "kohl","blumenkohl","brokkoli","pilz","reis","nudel","spaghetti","mehl","zucker",
  "salz","pfeffer","öl","essig","honig","schokolade","keks","kuchen","torte","eis",
  "fleisch","huhn","rind","schwein","fisch","lachs","thunfisch","krabbe","garnele",
  "suppe","brühe","soße","gewürz","kraut","minze","basilikum",

  // City / places
  "stadt","dorf","straße","platz","park","markt","laden","geschäft","supermarkt",
  "bäckerei","metzgerei","apotheke","buchhandlung","friseur","bank","post",
  "bibliothek","museum","theater","kino","restaurant","café","kneipe","bar",
  "hotel","krankenhaus","klinik","arztpraxis","schule","kindergarten","universität",
  "büro","firma","fabrik","bahnhof","flughafen","hafen","strand","berg","fluss",
  "see","meer","wald","feld","wiese","bauernhof","kirche","dom","schloss","burg",
  "brücke","turm","denkmal","gebäude","ort","stelle","umgebung","viertel",

  // Transport
  "auto","wagen","fahrrad","motorrad","bus","zug","tram","u-bahn","s-bahn","taxi",
  "lastwagen","lkw","schiff","boot","flugzeug","helikopter","fahrt","reise","ticket",
  "fahrkarte","fahrschein","koffer","gepäck","pass","ausweis","karte","plan","route",
  "haltestelle","station","gleis","spur","ampel","kreuzung","zebrastreifen",

  // Nature / weather
  "sonne","mond","stern","himmel","wolke","regen","schnee","wind","eis","sturm",
  "gewitter","blitz","donner","wärme","kälte","wetter","klima","luft","temperatur",
  "baum","blume","pflanze","blatt","ast","gras","sand","stein","fels","erde","boden",
  "tier","hund","katze","vogel","pferd","kuh","schwein","schaf","ziege","huhn","hahn",
  "fisch","maus","ratte","spinne","fliege","mücke","schmetterling","biene","wespe",

  // School / work
  "schule","klasse","unterricht","lehrer","lehrerin","schüler","schülerin","student",
  "studentin","buch","heft","stift","kugelschreiber","bleistift","gummi","lineal",
  "tafel","kreide","papier","notiz","hausaufgabe","prüfung","note","aufgabe","übung",
  "geschichte","geschichten","korb","körbe","notizbuch","notizbücher",
  "wort","satz","buchstabe","zahl","frage","antwort","sprache","fach","kurs","semester",
  "arbeit","beruf","job","chef","chefin","kollege","kollegin","mitarbeiter","gehalt",
  "lohn","arbeitszeit","pause","sitzung","besprechung","brief","mail","bericht",
  "computer","laptop","handy","telefon","smartphone","tablet","bildschirm","tastatur",
  "maus","drucker","kabel","akku","ladegerät",

  // Verbs (top frequency A1+A2)
  "sein","haben","werden","können","müssen","sollen","wollen","mögen","dürfen",
  "machen","tun","gehen","kommen","fahren","laufen","rennen","springen","fallen",
  "stehen","sitzen","liegen","schlafen","aufstehen","aufwachen","schauen","sehen",
  "hören","sprechen","sagen","fragen","antworten","reden","erzählen","verstehen",
  "wissen","kennen","lernen","studieren","denken","glauben","meinen","finden",
  "lesen","schreiben","arbeiten","helfen","brauchen","möchten","mögen","lieben",
  "hassen","wünschen","hoffen","warten","suchen","finden","verlieren","gewinnen",
  "kaufen","verkaufen","bezahlen","kosten","sparen","ausgeben","verdienen",
  "essen","trinken","kochen","backen","braten","schneiden","mischen","probieren",
  "schmecken","riechen","fühlen","spüren","atmen","leben","sterben","geboren",
  "wachsen","öffnen","schließen","anschalten","ausschalten","drücken","ziehen",
  "schieben","heben","tragen","bringen","holen","nehmen","geben","schenken",
  "zeigen","verstecken","suchen","finden","wählen","entscheiden","versuchen",
  "üben","lernen","wiederholen","erinnern","vergessen","verstehen","erklären",
  "putzen","waschen","aufräumen","reparieren","kaputtmachen","kaputtgehen",
  "ankommen","abfahren","fortgehen","zurückkommen","besuchen","treffen",
  "einladen","einkaufen","bezahlen","kochen","servieren","decken","abräumen",
  "anziehen","ausziehen","umziehen","duschen","baden","kämmen","rasieren",

  // Adjectives
  "gut","schlecht","groß","klein","alt","neu","jung","hoch","niedrig","lang","kurz",
  "breit","schmal","dick","dünn","schwer","leicht","schnell","langsam","heiß","kalt",
  "warm","kühl","trocken","nass","sauber","schmutzig","voll","leer","offen","zu",
  "hell","dunkel","laut","leise","stark","schwach","hart","weich","glatt","rau",
  "billig","teuer","reich","arm","frei","besetzt","gesund","krank","müde","wach",
  "fröhlich","traurig","glücklich","unglücklich","wütend","ruhig","nervös","ängstlich",
  "freundlich","höflich","unhöflich","nett","gemein","klug","dumm","fleißig","faul",
  "schön","hässlich","attraktiv","jung","alt","ähnlich","gleich","verschieden",
  "richtig","falsch","wichtig","unwichtig","leicht","schwierig","einfach","kompliziert",
  "rot","blau","grün","gelb","weiß","schwarz","grau","braun","rosa","orange","lila",

  // Adverbs
  "gut","schlecht","schnell","langsam","laut","leise","heute","morgen","gestern",
  "jetzt","bald","spät","früh","oft","immer","manchmal","selten","nie","schon",
  "noch","wieder","wirklich","vielleicht","wahrscheinlich","sicher","klar","genau",
  "fast","etwa","ungefähr","sehr","ganz","ziemlich","wenig","viel","mehr","weniger",
  "hier","da","dort","oben","unten","drinnen","draußen","vorne","hinten","links","rechts",

  // Numbers
  "null","ein","eins","zwei","drei","vier","fünf","sechs","sieben","acht","neun","zehn",
  "elf","zwölf","dreizehn","vierzehn","fünfzehn","sechzehn","siebzehn","achtzehn",
  "neunzehn","zwanzig","dreißig","vierzig","fünfzig","sechzig","siebzig","achtzig",
  "neunzig","hundert","tausend","million","erste","zweite","dritte","letzte","nächste",

  // Common abstract
  "leben","tod","liebe","freundschaft","glück","pech","problem","lösung","frage",
  "antwort","grund","ursache","wirkung","ziel","zweck","plan","idee","gedanke",
  "wahrheit","lüge","geheimnis","traum","reise","ferien","urlaub","party","fest",
  "geburtstag","hochzeit","beerdigung","treffen","termin","besuch","gespräch","anruf",
  "gesundheit","krankheit","schmerz","medizin","arzt","ärztin","apotheke",
  "sport","spiel","musik","kunst","film","buch","roman","gedicht","nachricht",

  // ── Round 2 (June 2026) — added during German conversational beta build.
  // Common A1 nouns/verbs/expressions not in the initial list that surface
  // as false-positive C2 during v2-2026-06 audits.
  "klingel","lächeln","bäcker","bäckerei","schweigen","gewohnheit","kanne","gern","gerne",
  "blättern","blättert","seite","seiten","stecken","steckt","empfehlen","empfohlen",
  "ansehen","sieht","halten","hält","gießen","gießt","lachen","lacht","regnen","regnet",
  "schauen","schaut","zeigen","zeigt","gezeigt","besuchen","besucht",
  "samstagmorgen","sonntagmorgen","sonntagnachmittag","wochenende","arbeitstag",
  "kartoffelsuppe","gemüsesuppe","familienrezept","lieblingsessen","lieblingstasse",
  "knie","arm","schulter","rücken","finger","stirn","wange","kinn",
  "großmutter","großvater","enkel","enkelin","cousine","cousin",
  "rezept","zutaten","löffel","gabel","messer","teller","glas","schüssel",
  "süden","norden","osten","westen","ecke","mitte","rand",
  "geräusch","stimme","ton","klang","wort","satz","frage","antwort",
  "schublade","kamera","hunger","hängen","hängt","hingehängt","schrift","schriften",
  "folgen","folgt","namen","karte","karten","lieblingskuchen","behalten","behält",
  "anschauen","angeschaut","fallen","fällt","fertig","leer","ganz","ganze","ganzen",
  "spree","rhein","donau","elbe","alster",
  "kantine","tablett","buchhaltung","wohnen","wohnt","wohnst","gewohnt","schluck","schlucke",
  "pausenraum","erdgeschoss","zeitung","zeitungen","stock","stockwerk","abteilung",
  "baum","bäume","haus","häuser","nähe","generation","generationen","enkel","enkelin","enkelkind",
  "kollege","kollegin","kollegen","chef","chefin","mitarbeiter","mitarbeiterin",
  "leopoldstraße","schwabing","kreuzberg","eppendorf","palermo",
  "kennenlernen","kennengelernt","kennt","mag","mochte","gemocht",
  "anfang","ende","mitte","seite","richtung","weg","platz","raum",
  "schließen","schließt","öffnen","öffnet","gehen","geht","kommen","kommt",
  "warten","wartet","gewartet","essen","isst","gegessen","trinken","trinkt","getrunken",
  "schauen","schaut","sehen","sieht","gesehen","hören","hört","gehört",
  "bleiben","bleibt","blieb","geblieben","stehen","steht","stand","gestanden",
  "tragen","trägt","getragen","fallen","fällt","gefallen","brechen","bricht",
  "vergessen","vergisst","vergessen","erinnern","erinnert","sich erinnern",
  "lernen","lernt","gelernt","arbeiten","arbeitet","gearbeitet",
  "glas","gläser","blume","blumen","auge","augen","ohr","ohren","mund",
  "kabeljau","forelle","fischladen","fischsuppe","sonnenblumenkern","sonnenblumenkerne","roggenbrot",
  "schale","schürze","daumen","finger","fischhand","fischerhand","gefühl","schritt",
  "stuhl","sofa","sessel","regal","schrank","schublade","ofen","etikett",
  "kartoffel","kartoffeln","lauch","zitrone","sahne","butter","mehl","zucker",
  "mantel","jacke","schuhe","stiefel","hose","hemd","kleid","rock",
  "marmeladenglas","jam","brötchen","brot","kuchen","torte","keks",
  "messe","markt","markttag","laden","geschäft","supermarkt",
  "chef","chefin","kollege","kollegin","mieter","mieterin","vermieter","vermieterin",
  "telefonieren","telefoniert","klingeln","klingelt","klopfen","klopft",
  "vorhang","vorhänge","tüte","tüten","papier","stift","zettel","heft",
  "werner","jonas","stefan","lena","hilde","becker","hoffmann","klaus","maja",
  "stuttgart","augsburg","bayern","hamburg","münchen","berlin","schwabing","eppendorf",
  "leopoldstraße","friedrichstraße","hohenzollernstraße",
  "wickeln","wickelt","gewickelt","schneiden","schneidet","geschnitten",
  "scheinen","schien","geschienen","schmecken","schmeckt","duften","duftet",
  "räumen","räumt","aufräumen","aufgeräumt","setzen","setzt","gesetzt",
  "stehen bleiben","drehen","dreht","gedreht","grüßen","grüßt","gegrüßt",
  "süß","salzig","sauer","scharf","mild","frisch","alt","neu","ganz","leer","voll",
  "sonnig","wolkig","windig","regnerisch","ruhig","laut","leise","traurig","fröhlich",
  "vermieten","vermietet","kennen","kennenlernen","versuchen","versucht",
  "zahlen","zahlt","bezahlt","kosten","kostet","gekostet","gehen","ging","gegangen",
  "vergessen","vergisst","erinnern","erinnert","verstehen","versteht","verstanden",
  "schließen","schloss","öffnen","öffnete","versprechen","versprochen","erklären","erklärt",
  "wecken","weckt","geweckt","zögern","zögert","gezögert","halten","gehalten",
  "mensch","menschen","lage","fehlen","fehlt","gefehlt","mittagessen","abendessen","frühstück",
  "flur","geduld","sache","streit","projekt","mal","male","erstes","letztes",
  "kerne","kern","sonnenblume","sonnenblumenkerne",
  "erkennen","erkennt","erkannt","füllen","füllt","gefüllt",
  "vergessen","vergisst","vergessen","versprechen","verspricht","versprochen",
  "käsekuchen","apfelkuchen","jacke","heft","topf","suppe","tasse","tassen",
  "tante","onkel","nachbarin","nachbar","fenster","mantel","frühling",
  "danke","bitte","hallo","tschüss","entschuldigung","natürlich","manchmal",
  "klopfen","klopft","klingeln","klingelt","schließen","schließt",
  "kalt","warm","heiß","kühl",
  "moment","stück","ende","anfang","mitte","seite","teil",
  "park","straße","platz","markt","geschäft","laden",
]);

export function isGermanA1A2(word: string): boolean {
  const lemma = word.toLowerCase().trim();
  if (GERMAN_A1_A2_LEMMAS.has(lemma)) return true;
  // German nouns may come with article; strip
  const stripped = lemma.replace(/^(der|die|das|ein|eine|den|dem|des)\s+/, "");
  if (GERMAN_A1_A2_LEMMAS.has(stripped)) return true;
  // Compound nouns: if it ends with an A1/A2 noun, accept (e.g.
  // "Hausschuh" → contains "schuh"). Conservative: only accept if
  // the SECOND half is A1/A2 (compound head determines meaning).
  for (let i = 3; i < lemma.length - 2; i++) {
    const tail = lemma.slice(i);
    if (GERMAN_A1_A2_LEMMAS.has(tail)) return true;
  }
  return false;
}
