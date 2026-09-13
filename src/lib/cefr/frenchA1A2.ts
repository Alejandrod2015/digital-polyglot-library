// French A1 + A2 lemma list. Dos bloques, cada uno con su fuente.
//
// BLOQUE 1: FRENCH_A1_A2_ORIGINAL (818 cadenas, el de siempre).
// Fuente declarada al crearlo: DELF A1/A2 + Routledge frequency dictionary
// French top-1500, curado a mano. Sin trazabilidad por palabra.
//
// BLOQUE 2: FRENCH_A1_A2_LEXIQUE (2026-09-13, sustituye al bloque FLELex del
// mismo día, retirado por licencia no comercial: ver el commit anterior).
// Fuente EXTERNA: Lexique383 (lexique.org / openlexicon), base de datos
// lexical del francés de Boris New, Christophe Pallier y colaboradores
// (Université de Savoie / CNRS). ~140.000 formas con frecuencia lematizada
// en dos corpus (subtítulos de película y libros).
//   http://www.lexique.org  ·  http://openlexicon.fr/datasets-info/Lexique382/
//   New, B., Pallier, C., Brysbaert, M. & Ferrand, L. (2004). Lexique 2: a
//   new French lexical database. Behavior Research Methods 36(3), 516-524.
//   Licencia: CC BY-SA 4.0 (verificada en openlexicon.fr, permite uso
//   comercial con atribución y misma licencia en derivados).
//
// Lexique NO trae nivel MCER por palabra (a diferencia de FLELex); es una
// lista de FRECUENCIA. Método: para cada lema, frecuencia = promedio de
// freqlemfilms2 y freqlemlivres (subtítulos + libros, por millón de
// palabras); se ordena todo Lexique por esa frecuencia, excluyendo nombres
// propios, onomatopeyas, símbolos, abreviaturas y números (cgram NAM/ONO/
// SYM/ABR/NUM), palabras con dígitos, y una lista corta de soeces/insultos
// que la frecuencia de subtítulos sube alto sin que eso diga nada de su
// nivel (register, no nivel; ya tienen su propia exención en
// validateGeneratedStory).
//
// CALIBRACIÓN (2026-09-13, segunda vuelta; la primera usó una muestra B2/C1
// académica demasiado fácil de separar y no se dio por buena. Ver
// feedback_level_measured_externally: la vara viene de fuera, no del
// catálogo). Dos referencias:
//   - Bloque 1 (816 lemas curados a mano, asumidos A1/A2 real). 793 existen
//     como lema suelto en Lexique.
//   - Muestra de 50 palabras B1/B2 REALISTAS (no académicas): las que un
//     manual pondría en B1 o B2 y no antes, con nivel citado de FLELex/
//     Beacco por palabra (fuente usada aquí SOLO como referencia de
//     calibración editorial, no redistribuida ni embebida en la lista
//     final; ningún dato de FLELex queda en este archivo). Incluye las
//     siete que dio el usuario (néanmoins B2, davantage B1, revendiquer B1,
//     soupçonner B2, épanouissement B2, enjeu B1, auparavant B1) más 43 más:
//     rapport, regard, pauvre, état, expérience, esprit, avenir,
//     professionnel, politique, assurer, résultat, actuel, intérêt, maladie,
//     victime, empêcher, mesure, risque, danger, tendance, comportement,
//     réduire, majorité, preuve, constituer, chercheur, désormais, réseau,
//     débat, lutter, souligner, soutenir, appliquer, craindre, capacité,
//     essentiel, égalité, favoriser, démocratie, réduction, durable,
//     récemment, envisager (todas B1 o B2 en FLELex/Beacco).
//
// CURVA (cobertura de bloque 1 encontrado en Lexique, % de la muestra
// B1/B2 que SÍ se cuela dentro del corte, es decir el fallo):
//   corte | cobertura bloque1 | fuga muestra B1/B2
//    2000 |   75,5% (599/793) |  52,0% (26/50)
//    3000 |   86,6% (687/793) |  66,0% (33/50)
//    4000 |   91,8% (728/793) |  82,0% (41/50)
//    6000 |   96,2% (763/793) |  88,0% (44/50)
// El punto que mejor separa (maximiza cobertura menos fuga) es 750, con
// 49,1% de cobertura y solo 16,0% de fuga (8/50).
//
// CORTE APLICADO: 750.
//
// LÍMITE, y no menor: en NINGÚN punto de la curva la fuga baja de forma
// aceptable para un gate de nivel. Al corte óptimo (750) siguen colándose
// 8 de 50 palabras B1/B2 realistas (rapport, regard, pauvre, état, esprit,
// assurer, empêcher, craindre), y de las ocho
// palabras que motivaron el encargo original (souvenir, vaisselle,
// pardonner, blague, habitude, dispute, discours, accent) solo DOS entran
// (souvenir, habitude); las otras seis quedan fuera igual que antes,
// porque su frecuencia es demasiado parecida a la de palabras B1/B2 reales
// para separarlas con un solo número. La causa: frecuencia bruta no
// distingue nivel MCER para vocabulario abstracto/discursivo (estado,
// espíritu, informe, impedir, asegurar son MUY frecuentes en francés
// general aunque un manual los enseñe en B1); eso es justo lo que FLELex
// resuelve combinando frecuencia con juicio experto, y lo que un corte de
// un solo número no puede reproducir. CONCLUSIÓN: el corte de frecuencia
// pura no es una vía viable para ampliar el gate de A1/A2 francés más allá
// de lo que ya cubre el bloque 1 curado a mano; no se recomienda mantener
// este bloque 2 como solución final (ver el reporte a Journey-planning del
// mismo día).
// NO se añade nada porque un journey lo necesite: el corte es el mismo para
// cualquier journey francés, elegido antes de mirar ninguna historia.

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

// Bloque 2, generado desde Lexique383.tsv al corte 750 (ver cabecera). 366 lemas.
const FRENCH_A1_A2_LEXIQUE: readonly string[] = [
  "abandonner","accompagner","accord","affaire","âge","agir","aide","ainsi","air","ajouter","âme",
  "amener","amuser","ancien","apercevoir","apparaître","approcher","argent","arme","armée",
  "arrêter","asseoir","assurer","attention","au-dessus","aucune","aussitôt","autant","autour",
  "autres","avancer","avis","balle","battre","besoin","bien","bonjour","bord","bout","bruit",
  "brûler","ça","cacher","calmer","camp","capitaine","cas","casser","cause","cela","celle","celui",
  "certain","cesser","cet","ceux","chacun","chance","changer","chef","chemin","chéri","chez",
  "chose","coeur","coin","combien","comme","comment","compte","compter","conduire","confiance",
  "continuer","côté","coucher","coup","cour","couvrir","craindre","cri","crier","d'","d'abord",
  "d'autres","dame","debout","début","découvrir","dès","désolé","désoler","devenir","dieu",
  "différent","disparaître","docteur","dont","doucement","doute","doux","droit","drôle","échapper",
  "effet","embrasser","emmener","empêcher","endroit","enfin","enlever","ennemi","ensemble","entier",
  "envie","époque","espèce","esprit","est-ce que","état","eux","éviter","exactement","excuser",
  "exemple","exister","face","façon","faim","fait","falloir","faute","faux","fin","flic","fois",
  "fond","force","fou","français","frapper","front","garde","garder","gars","gauche","général",
  "genre","geste","glisser","goût","grave","groupe","guerre","gueule","habiter","habitude",
  "honneur","humain","ignorer","image","imaginer","important","importer","impossible","impression",
  "inquiéter","installer","intéresser","intérieur","jeter","jeu","journée","jurer","juste","l'",
  "l'un","lancer","laquelle","lequel","lever","libre","lieu","ligne","longtemps","lui-même","ma",
  "maintenir","maître","mal","malade","malgré","manière","manquer","marche","marier","mec",
  "médecin","meilleur","mener","mentir","merci","mieux","milieu","moi","moins","monde","montrer",
  "mouvement","ni","nom","nu","numéro","obliger","occuper","odeur","oeil","offrir","oh","ok",
  "ombre","or","ordre","oser","où","ouais","paix","par","pardon","pareil","parent","parole","part",
  "partie","passage","passer","pays","peine","pensée","permettre","peuple","photo","pièce","plaire",
  "plaisir","pleurer","plutôt","poche","point","police","possible","pourquoi","pourtant","présent",
  "présenter","président","presque","prêt","prévenir","prier","prince","prison","prix","promettre",
  "propos","protéger","que","quel","quelle","quelqu'un","quelques","qui","quoi","raison","ramener",
  "reconnaître","réfléchir","regard","regarder","rejoindre","remarquer","remettre","remonter",
  "rencontrer","rendre","rentrer","répéter","reprendre","ressembler","reste","retenir","retour",
  "retrouver","réveiller","revenir","rêver","revoir","rire","risquer","roi","rouler","s'","sa",
  "salle","salut","sauver","scène","secret","seigneur","sens","sentiment","serrer","service","seul",
  "seulement","signe","silence","simple","simplement","sinon","situation","soeur","soldat","sorte",
  "soudain","souffrir","sourire","souvenir","suffire","suite","suivre","sujet","sûr","surtout","t'",
  "ta","taire","tant","tellement","tendre","tenter","tiens","toi","tomber","toucher","tourner",
  "travers","traverser","tromper","trou","truc","tuer","type","utiliser","valoir","vers","visite",
  "vite","vivant","voici","voilà","voix","voler","vrai","vraiment","vue",
];

const normalizeOe = (s: string) => s.replace(/œ/g, "oe").replace(/æ/g, "ae");

export const FRENCH_A1_A2_LEMMAS: ReadonlySet<string> = new Set(
  [...FRENCH_A1_A2_ORIGINAL, ...FRENCH_A1_A2_LEXIQUE].map(normalizeOe),
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
