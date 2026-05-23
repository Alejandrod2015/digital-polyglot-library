// French A1 + A2 lemma frequency list.
//
// Source: DELF A1/A2 + Routledge frequency dictionary French
// top-1500. Curated for the practical beginner experience.

export const FRENCH_A1_A2_LEMMAS: ReadonlySet<string> = new Set([
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
]);

export function isFrenchA1A2(word: string): boolean {
  const lemma = word.toLowerCase().trim();
  if (FRENCH_A1_A2_LEMMAS.has(lemma)) return true;
  // Strip article
  const stripped = lemma.replace(/^(le|la|les|un|une|des|du)\s+/, "").replace(/^l['']/, "");
  if (FRENCH_A1_A2_LEMMAS.has(stripped)) return true;
  // Plural (-s) → singular
  if (lemma.endsWith("s") && FRENCH_A1_A2_LEMMAS.has(lemma.slice(0, -1))) return true;
  return false;
}
