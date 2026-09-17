// French A1 + A2 lemma list. Dos bloques, cada uno con su fuente.
//
// BLOQUE 1: FRENCH_A1_A2_ORIGINAL (818 cadenas, el de siempre).
// Fuente declarada al crearlo: DELF A1/A2 + Routledge frequency dictionary
// French top-1500, curado a mano. Sin trazabilidad por palabra.
//
// BLOQUE 2: FRENCH_A1_A2_CURATED (2026-09-13, tercera vuelta). Reemplaza
// dos intentos anteriores que no se dieron por buenos:
//   1. FLELex/Beacco tal cual: retirado por licencia no comercial
//      (CC BY-NC-SA 4.0) sobre un check que corre en producción de pago.
//   2. Lexique383 (CC BY-SA 4.0, licencia sí compatible) con un corte de
//      frecuencia: retirado porque NINGÚN corte separa bien A1/A2 de B1/B2.
//      Calibrado con una muestra de 50 palabras B1/B2 realistas (no
//      académicas), el mejor punto disponible (750) solo lograba 49,1% de
//      cobertura del bloque 1 con 16,0% de fuga hacia B1/B2, y de las 8
//      palabras que motivaron el encargo original solo 2 entraban. La
//      frecuencia bruta no distingue nivel MCER en vocabulario abstracto
//      (estado, espíritu, asegurar son muy frecuentes aunque un manual los
//      enseñe en B1); es justo lo que FLELex resuelve combinando frecuencia
//      con juicio experto, y un corte de un solo número no puede
//      reproducirlo. Detalle de la curva en el historial de commits de
//      este archivo (b00810b2).
//
// Este bloque 2 vuelve al método del bloque 1: curado a mano, palabra por
// palabra, CADA UNA con su nivel y su referencia pública citada en el
// comentario de la propia línea (ver abajo). Nada de esto se redistribuye
// ni se embebe como dataset: es una cita puntual de nivel por palabra,
// igual que citar una entrada de diccionario.
//
// ORIGEN, primera pasada (2026-09-13): el vocabulario real de las 3
// historias guardadas del TEMA 1 del Friends FR/France A2
// (home-life-and-habits, journey cmu04ereh000732z7px7naqa2, leído de la
// base) que NO estaba ya en el bloque 1. De las 32 palabras que le faltaban,
// 28 tienen respaldo A1/A2 en la referencia citada (FLELex/Beacco,
// TreeTagger, CENTAL/UCLouvain: https://cental.uclouvain.be/cefrlex/flelex/)
// y se añaden. 4 NO tienen respaldo A1/A2 para el sentido en que las usa la
// historia y se dejan fuera a propósito:
//   - placard (armario): FLELex lo marca NOM B1, no A1/A2.
//   - ronfler (roncar): FLELex lo marca VER C2, muy por encima.
//   - soupirer (suspirar): FLELex lo marca VER B2.
//   - célibataire (soltero): la historia lo usa como NOMBRE ("le
//     célibataire"), y ese sentido es NOM B2 en FLELex. Solo el sentido
//     ADJETIVO ("célibataire" = soltero/a) tiene respaldo A2; como la
//     lista no distingue POS, no se añade para no colar el sentido B2.
//
// ORIGEN, segunda pasada (2026-09-13, mismo día, tras cerrarse los 7 temas
// / 21 historias del journey): el vocabulario de los TEMAS 2 a 7 que no
// estaba en el bloque 1, volcado por otra sesión en
// docs/fr-a2-friends-vocab-fuera-bloque1.md (commit d21d5d97 de la rama del
// journey), 132 plazas. Mismo método, palabra por palabra contra
// FleLex_TT_Beacco.tsv, emparejando la categoría gramatical (NOM/VER/ADJ/
// ADV) con la que usa la historia; si la palabra tiene forma plural en la
// tabla ("les fleurs") se cita el lema singular ("fleur"). 106 tienen
// respaldo A1/A2 y se añaden; 26 NO y se dejan fuera:
//   pédalo (NOM C1), grimace (NOM C2), surnom (NOM B2), sous-sol (NOM B2),
//   fil (NOM B1), planning (NOM B2), aimant (NOM C1), lave-vaisselle
//   (NOM C2, SÍ tiene entrada propia como compuesto), frigo (NOM B1),
//   facture (NOM B1), escalade (NOM B1), chorale (NOM B2), glacial
//   (ADJ B2), pareil (ADJ B1), rater (VER B1), témoin (NOM B1),
//   applaudissements (NOM B2), joues/joue (NOM B1), prise (NOM B1),
//   curiosité (NOM B1), enveloppe (NOM B1), étaler (VER B2); nature
//   (la historia la usa como ADJETIVO invariable, "yaourt nature", pero
//   FLELex solo tiene el sentido NOMBRE, A1; sin dato para el sentido
//   adjetivo, no se añade); papier toilette, tableau électrique y boîte
//   aux lettres son compuestos SIN entrada propia en FLELex (sus palabras
//   sueltas sí son A1/A2, pero el compuesto como unidad no tiene respaldo
//   directo, y no se extrapola). Detalle completo, con tema e historia de
//   cada rechazada, en el reporte a Journey-planning del mismo día.
//
// NO se añade nada porque un journey lo necesite MÁS ALLÁ de tener
// respaldo real en la referencia: todas las rechazadas de ambas pasadas
// también las necesitaba su historia y se quedan fuera igual.

const FRENCH_A1_A2_ORIGINAL: readonly string[] = [
  // Function words
  "le","la","les","un","une","des","du","de","au","aux","ce","cette","ces","mon","ton","son",
  "notre","votre","leur","mes","tes","ses","nos","vos","leurs",
  "je","tu","il","elle","on","nous","vous","ils","elles","me","te","se","lui","leur","y","en",
  "et","ou","mais","car","donc","puis","alors","ensuite","parce que","pour","afin","si",
  "quand","lorsque","pendant","avant","après","depuis","jusqu","entre","parmi","contre",
  "à","de","en","dans","sur","sous","derrière","devant","près","loin","avec","sans","pour",
  "ne","pas","plus","jamais","rien","personne","aucun","oui","non","peut-être","sûrement",
  "ici","là","là-bas","dehors","dedans","haut","bas","ailleurs","partout",
  "très","beaucoup","peu","trop","assez","aussi","encore","déjà","tout","tous","toute","toutes",
  "même","autre","chaque","quelque","plusieurs","tel",

  // Time
  "jour","nuit","matin","après-midi","soir","heure","minute","seconde","semaine","mois",
  "année","an","temps","moment","instant","week-end","vacances","fête",
  "lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche",
  "janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre",
  "novembre","décembre","printemps","été","automne","hiver",
  "aujourd'hui","demain","hier","maintenant","bientôt","tôt","tard","souvent","toujours",
  "jamais","parfois","quelquefois",

  // Family / people
  "famille","père","papa","mère","maman","fils","fille","frère","sœur","grand-père","grand-mère",
  "oncle","tante","cousin","cousine","mari","femme","époux","épouse","enfant","bébé",
  "garçon","fille","homme","femme","personne","gens","ami","amie","copain","copine","voisin",
  "collègue","monsieur","madame","mademoiselle",

  // Body
  "corps","tête","visage","figure","œil","oreille","nez","bouche","dent","langue","lèvre",
  "cou","épaule","bras","main","doigt","ongle","poitrine","dos","ventre","jambe","genou","pied",
  "cheveu","peau","sang","os","cœur","estomac",

  // Clothes
  "vêtement","chemise","tee-shirt","pantalon","jupe","robe","manteau","veste","pull","pyjama",
  "chaussure","botte","sandale","chaussette","chapeau","casquette","écharpe","gant","ceinture",
  "cravate","lunettes","bague","montre","sac","mochila","portefeuille","porte-monnaie",

  // Home
  "maison","appartement","chambre","salon","cuisine","salle de bain","toilettes","couloir",
  "escalier","ascenseur","porte","fenêtre","mur","sol","plafond","toit","jardin","balcon",
  "terrasse","table","chaise","canapé","fauteuil","lit","matelas","armoire","étagère","tiroir",
  "lampe","lumière","miroir","tableau","tapis","rideau","oreiller","couverture","drap","serviette",
  "savon","brosse","dentifrice","bougie","allumette","balai","aspirateur","seau","éponge",
  "casserole","poêle","assiette","verre","tasse","mug","cuillère","fourchette","couteau",
  "serviette","nappe","plateau","bol","carafe","bouteille","bocal","boîte","sac",

  // Food / drink
  "nourriture","petit-déjeuner","déjeuner","dîner","goûter","repas","plat","menu",
  "pain","beurre","confiture","fromage","jambon","œuf","œufs","lait","yaourt","crème",
  "café","thé","eau","jus","limonade","bière","vin","soda","boisson",
  "pomme","poire","orange","banane","raisin","fraise","citron","melon","ananas",
  "tomate","pomme de terre","oignon","ail","carotte","salade","laitue","concombre","courgette",
  "champignon","maïs","viande","poulet","bœuf","porc","poisson","thon","crevette","saumon",
  "riz","pâtes","spaghetti","soupe","bouillon","sauce","sel","poivre","huile","vinaigre",
  "sucre","miel","chocolat","biscuit","gâteau","tarte","glace",

  // City / places
  "ville","village","rue","avenue","place","parc","marché","magasin","boutique","supermarché",
  "boulangerie","boucherie","pharmacie","librairie","banque","poste","bibliothèque","musée",
  "théâtre","cinéma","restaurant","café","bar","hôtel","hôpital","école","collège","lycée",
  "université","bureau","usine","gare","aéroport","port","plage","montagne","fleuve","rivière",
  "lac","mer","forêt","bois","champ","ferme","église","cathédrale","château","tour","pont",
  "bâtiment","immeuble","quartier",

  // Transport
  "voiture","auto","vélo","bicyclette","moto","bus","autobus","train","métro","tramway","taxi",
  "camion","bateau","avion","hélicoptère","voyage","billet","valise","sac à dos","passeport",
  "carte","plan","arrêt","station","gare","route","autoroute","feu","carrefour",

  // Nature / weather
  "soleil","lune","étoile","ciel","nuage","pluie","neige","vent","glace","orage","tonnerre",
  "chaleur","froid","température","temps","climat","arbre","fleur","plante","feuille","branche",
  "herbe","sable","pierre","roche","terre","animal","chien","chat","oiseau","cheval","vache",
  "cochon","mouton","poule","poisson","souris","mouche","papillon","abeille","araignée",

  // School / work
  "école","classe","cours","leçon","prof","enseignant","élève","étudiant","livre","cahier",
  "stylo","crayon","gomme","règle","tableau","craie","papier","devoir","examen","note","question",
  "réponse","mot","phrase","lettre","chiffre","langue","matière",
  "travail","boulot","bureau","entreprise","patron","collègue","salaire","horaire","réunion",
  "rapport","ordinateur","portable","téléphone","mobile","écran","clavier","imprimante",

  // Verbs (top frequency)
  "être","avoir","aller","faire","venir","voir","entendre","dire","parler","savoir","pouvoir",
  "vouloir","devoir","croire","penser","comprendre","connaître","sembler","paraître",
  "vivre","mourir","naître","grandir","arriver","partir","entrer","sortir","monter","descendre",
  "rester","retourner","quitter",
  "manger","boire","prendre","cuisiner","préparer","servir","acheter","vendre","payer","coûter",
  "ouvrir","fermer","commencer","finir","terminer","travailler","étudier","apprendre","enseigner",
  "lire","écrire","écouter","demander","répondre","raconter","expliquer","aider","chercher",
  "trouver","perdre","gagner","porter","apporter","emporter","mettre","poser","placer","ranger",
  "déplacer","bouger","pousser","tirer","tenir","lâcher","laisser","donner","prendre","recevoir",
  "envoyer","appeler","téléphoner","éteindre","allumer","brancher","débrancher","charger",
  "laver","nettoyer","essuyer","sécher","mouiller","couper","mélanger","chauffer","refroidir",
  "marcher","courir","sauter","nager","danser","chanter","jouer","gagner","perdre","attendre",
  "voyager","visiter","saluer","inviter","accepter","refuser","essayer","réussir","choisir",
  "préférer","décider","oublier","se souvenir","rappeler","aimer","adorer","détester","haïr",
  "vouloir","souhaiter","espérer","sentir","ressentir","respirer","dormir","se réveiller",
  "se lever","s'asseoir","se coucher","s'habiller","se déshabiller","se laver","se doucher",

  // Adjectives
  "bon","mauvais","grand","petit","haut","bas","long","court","large","étroit","gros","mince",
  "neuf","nouveau","vieux","jeune","cher","bon marché","facile","difficile","rapide","lent",
  "fort","faible","dur","mou","propre","sale","plein","vide","ouvert","fermé","chaud","froid",
  "tiède","sec","mouillé","humide","clair","sombre","brillant","heureux","content","triste",
  "fatigué","calme","tranquille","nerveux","gentil","sympathique","poli","timide","courageux",
  "intelligent","bête","beau","joli","laid","moche","riche","pauvre","maigre","gras",
  "rouge","bleu","vert","jaune","blanc","noir","gris","marron","brun","rose","orange","violet",
  "premier","deuxième","troisième","dernier","prochain","suivant",

  // Numbers
  "zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze",
  "treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf","vingt","trente",
  "quarante","cinquante","soixante","soixante-dix","quatre-vingt","quatre-vingt-dix","cent","mille",

  // Abstract common
  "vie","mort","amour","amitié","bonheur","tristesse","peur","joie","problème","solution","idée",
  "question","réponse","histoire","conte","vérité","mensonge","rêve","plan","voyage","fête",
  "anniversaire","mariage","rendez-vous","appel","santé","maladie","douleur","médecine","sport",
  "musique","art","film","livre","journal","nouvelle","couleur","forme","taille",
];

// Bloque 2: 134 lemas (28 del tema 1 + 106 de los temas 2-7), uno por línea,
// cada uno con su nivel y referencia (FLELex/Beacco, TreeTagger, CENTAL/
// UCLouvain, citado como diccionario de nivel, no redistribuido). POS entre
// paréntesis: el que usa la historia donde apareció.
const FRENCH_A1_A2_CURATED: readonly string[] = [
  // Tema 1 (28)
  "installer",      // FLELex/Beacco: A1 (VER)
  "déranger",        // FLELex/Beacco: A1 (VER)
  "blouson",         // FLELex/Beacco: A1 (NOM)
  "disque",          // FLELex/Beacco: A1 (NOM)
  "entier",          // FLELex/Beacco: A2 (ADJ)
  "habitant",        // FLELex/Beacco: A1 (NOM)
  "attraper",        // FLELex/Beacco: A2 (VER)
  "plutôt",          // FLELex/Beacco: A1 (ADV)
  "bizarre",         // FLELex/Beacco: A1 (ADJ)
  "sommeil",         // FLELex/Beacco: A2 (NOM)
  "roman",           // FLELex/Beacco: A1 (NOM)
  "réveiller",       // FLELex/Beacco: A1 (VER)
  "tellement",       // FLELex/Beacco: A1 (ADV)
  "insupportable",   // FLELex/Beacco: A2 (ADJ)
  "taire",           // FLELex/Beacco: A2 (VER)
  "critiquer",       // FLELex/Beacco: A2 (VER)
  "avouer",          // FLELex/Beacco: A2 (VER)
  "habitude",        // FLELex/Beacco: A1 (NOM)
  "endormir",        // FLELex/Beacco: A1 (VER)
  "tranquillement",  // FLELex/Beacco: A2 (ADV)
  "tomber",          // FLELex/Beacco: A1 (VER)
  "pourtant",        // FLELex/Beacco: A1 (ADV)
  "toucher",         // FLELex/Beacco: A1 (VER)
  "douche",          // FLELex/Beacco: A2 (NOM)
  "surtout",         // FLELex/Beacco: A1 (ADV)
  "remarquer",       // FLELex/Beacco: A1 (VER)
  "finalement",      // FLELex/Beacco: A1 (ADV)
  "plaire",          // FLELex/Beacco: A1 (VER)

  // Temas 2-7 (106)
  "accueillir",       // FLELex/Beacco: A1 (VER)
  "album",            // FLELex/Beacco: A2 (NOM)
  "ambiance",         // FLELex/Beacco: A2 (NOM)
  "ancien",           // FLELex/Beacco: A1 (ADJ)
  "applaudir",        // FLELex/Beacco: A2 (VER)
  "assurance",        // FLELex/Beacco: A1 (NOM)
  "avancer",          // FLELex/Beacco: A1 (VER)
  "balade",           // FLELex/Beacco: A1 (NOM)
  "bande",            // FLELex/Beacco: A1 (NOM)
  "banlieue",         // FLELex/Beacco: A1 (NOM)
  "bavarder",         // FLELex/Beacco: A2 (VER)
  "belle-mère",       // FLELex/Beacco: A2 (NOM)
  "blague",           // FLELex/Beacco: A1 (NOM)
  "bouquet",          // FLELex/Beacco: A2 (NOM)
  "buffet",           // FLELex/Beacco: A1 (NOM)
  "chanson",          // FLELex/Beacco: A1 (NOM)
  "choix",            // FLELex/Beacco: A1 (NOM)
  "concert",          // FLELex/Beacco: A1 (NOM)
  "conduire",         // FLELex/Beacco: A1 (VER)
  "continuer",        // FLELex/Beacco: A1 (VER)
  "courage",          // FLELex/Beacco: A1 (NOM)
  "coutume",          // FLELex/Beacco: A2 (NOM)
  "crier",            // FLELex/Beacco: A1 (VER)
  "curieux",          // FLELex/Beacco: A1 (ADJ)
  "décevoir",         // FLELex/Beacco: A2 (VER)
  "déguster",         // FLELex/Beacco: A2 (VER)
  "délicieux",        // FLELex/Beacco: A1 (ADJ)
  "dentiste",         // FLELex/Beacco: A2 (NOM)
  "dessert",          // FLELex/Beacco: A1 (NOM)
  "dessiner",         // FLELex/Beacco: A1 (VER)
  "détail",           // FLELex/Beacco: A1 (NOM)
  "discours",         // FLELex/Beacco: A2 (NOM)
  "doucement",        // FLELex/Beacco: A1 (ADV)
  "électrique",       // FLELex/Beacco: A2 (ADJ)
  "embrasser",        // FLELex/Beacco: A1 (VER)
  "enfance",          // FLELex/Beacco: A1 (NOM)
  "enlever",          // FLELex/Beacco: A2 (VER)
  "énorme",           // FLELex/Beacco: A1 (ADJ)
  "envie",            // FLELex/Beacco: A1 (NOM)
  "exagérer",         // FLELex/Beacco: A2 (VER)
  "explication",      // FLELex/Beacco: A1 (NOM)
  "façon",            // FLELex/Beacco: A1 (NOM)
  "fatigant",         // FLELex/Beacco: A2 (ADJ)
  "fleur",            // FLELex/Beacco: A1 (NOM)
  "fonctionner",      // FLELex/Beacco: A2 (VER)
  "fou",              // FLELex/Beacco: A1 (ADJ)
  "hésiter",          // FLELex/Beacco: A2 (VER)
  "heureusement",     // FLELex/Beacco: A1 (ADV)
  "honneur",          // FLELex/Beacco: A1 (NOM)
  "inquiet",          // FLELex/Beacco: A2 (ADJ)
  "insister",         // FLELex/Beacco: A2 (VER)
  "jaloux",           // FLELex/Beacco: A2 (ADJ)
  "jeter",            // FLELex/Beacco: A1 (VER)
  "lever",            // FLELex/Beacco: A1 (VER)
  "marier",           // FLELex/Beacco: A1 (VER)
  "meilleur",         // FLELex/Beacco: A1 (ADJ)
  "ménage",           // FLELex/Beacco: A1 (NOM)
  "message",          // FLELex/Beacco: A1 (NOM)
  "métier",           // FLELex/Beacco: A1 (NOM)
  "micro",            // FLELex/Beacco: A2 (NOM)
  "moquer",           // FLELex/Beacco: A2 (VER)
  "musicien",         // FLELex/Beacco: A1 (NOM)
  "numéro",           // FLELex/Beacco: A1 (NOM)
  "obliger",          // FLELex/Beacco: A2 (VER)
  "organiser",        // FLELex/Beacco: A1 (VER)
  "outil",            // FLELex/Beacco: A2 (NOM)
  "pâte",             // FLELex/Beacco: A1 (NOM)
  "perdu",            // FLELex/Beacco: A2 (ADJ)
  "pièce",            // FLELex/Beacco: A1 (NOM)
  "pire",             // FLELex/Beacco: A1 (ADJ)
  "point",            // FLELex/Beacco: A2 (NOM)
  "pratique",         // FLELex/Beacco: A2 (ADJ)
  "prénom",           // FLELex/Beacco: A1 (NOM)
  "prévoir",          // FLELex/Beacco: A1 (VER)
  "promettre",        // FLELex/Beacco: A1 (VER)
  "proposition",      // FLELex/Beacco: A1 (NOM)
  "quai",             // FLELex/Beacco: A1 (NOM)
  "radio",            // FLELex/Beacco: A2 (NOM)
  "rapidement",       // FLELex/Beacco: A1 (ADV)
  "rassurer",         // FLELex/Beacco: A2 (VER)
  "reconnaître",      // FLELex/Beacco: A1 (VER)
  "regretter",        // FLELex/Beacco: A1 (VER)
  "remercier",        // FLELex/Beacco: A1 (VER)
  "remonter",         // FLELex/Beacco: A1 (VER)
  "reprendre",        // FLELex/Beacco: A1 (VER)
  "respecter",        // FLELex/Beacco: A1 (VER)
  "revenir",          // FLELex/Beacco: A1 (VER)
  "salle",            // FLELex/Beacco: A1 (NOM)
  "sauver",           // FLELex/Beacco: A1 (VER)
  "scène",            // FLELex/Beacco: A2 (NOM)
  "secret",           // FLELex/Beacco: A1 (NOM)
  "séparer",          // FLELex/Beacco: A2 (VER)
  "sérieux",          // FLELex/Beacco: A1 (ADJ)
  "sévère",           // FLELex/Beacco: A2 (ADJ)
  "sincère",          // FLELex/Beacco: A2 (ADJ)
  "soirée",           // FLELex/Beacco: A1 (NOM)
  "souvenir",         // FLELex/Beacco: A1 (NOM)
  "sportif",          // FLELex/Beacco: A1 (ADJ)
  "surprendre",       // FLELex/Beacco: A1 (VER)
  "surveiller",       // FLELex/Beacco: A2 (VER)
  "total",            // FLELex/Beacco: A2 (NOM)
  "touriste",         // FLELex/Beacco: A1 (NOM)
  "utiliser",         // FLELex/Beacco: A1 (VER)
  "vérifier",         // FLELex/Beacco: A2 (VER)
  "vexer",            // FLELex/Beacco: A2 (VER)
  "voix",             // FLELex/Beacco: A1 (NOM)
];

const normalizeOe = (s: string) => s.replace(/œ/g, "oe").replace(/æ/g, "ae");

export const FRENCH_A1_A2_LEMMAS: ReadonlySet<string> = new Set(
  [...FRENCH_A1_A2_ORIGINAL, ...FRENCH_A1_A2_CURATED].map(normalizeOe),
);

export function isFrenchA1A2(word: string): boolean {
  const lemma = normalizeOe(word.toLowerCase().trim()).replace(/’/g, "'");
  if (FRENCH_A1_A2_LEMMAS.has(lemma)) return true;
  // Strip article
  const stripped = lemma.replace(/^(le|la|les|un|une|des|du)\s+/, "").replace(/^l['']/, "");
  if (FRENCH_A1_A2_LEMMAS.has(stripped)) return true;
  // Plural (-s) → singular
  if (lemma.endsWith("s") && FRENCH_A1_A2_LEMMAS.has(lemma.slice(0, -1))) return true;
  return false;
}
