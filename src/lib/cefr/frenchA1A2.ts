// French A1 + A2 lemma list. Dos bloques, cada uno con su fuente.
//
// BLOQUE 1: FRENCH_A1_A2_ORIGINAL (818 cadenas, el de siempre).
// Fuente declarada al crearlo: DELF A1/A2 + Routledge frequency dictionary
// French top-1500, curado a mano. Sin trazabilidad por palabra.
//
// BLOQUE 2: FRENCH_A1_A2_FLELEX_BEACCO (añadido 2026-09-13).
// NO SUBIR: licencia no comercial (CC BY-NC-SA 4.0), pendiente de sustituir.
// validateGeneratedStory corre en producción (api/studio/validar,
// revalidate-qa-pass) de un producto de pago; una fuente NC no puede vivir
// ahí. Buscando una fuente A1/A2 francesa con nivel MCER y licencia
// compatible con uso comercial (CC BY, CC BY-SA o dominio público).
// Fuente EXTERNA: FLELex / Beacco (TreeTagger), CENTAL, UCLouvain.
//   https://cental.uclouvain.be/cefrlex/flelex/download/  (FleLex_TT_Beacco.tsv)
//   Pintard, A. & François, T. (2020). Combining expert knowledge with
//   frequency information to infer CEFR levels for words. READI 2020, pp. 85-92.
//   François, T., Gala, N., Watrin, P. & Fairon, C. (2014). FLELex: a graded
//   lexical resource for French foreign learners. LREC 2014.
//   Licencia CC BY-NC-SA 4.0.
// El recurso asigna UN nivel MCER por lema combinando los Référentiels de
// Beacco (A1, A2...) con la distribución de frecuencias en manuales de FLE.
// Criterio de extracción, y ninguno más: toda fila con level A1 o A2, menos
// las que ya estaban en el bloque 1. Se quitan solo tres errores del
// etiquetador (nombres propios marcados NOM: margot, tommy, zoé); "FAUX" y
// "VRAI" vienen en mayúsculas en el TSV y entran en minúsculas.
// NO se añade nada porque un journey lo necesite. Palabras que un A2 querría
// y la fuente pone en B1 se quedan fuera a propósito: vaisselle, pardonner,
// dispute. La fuente escribe "oe" donde el bloque 1 escribe "œ"; la búsqueda
// normaliza los dos lados.
//
// POR QUE (2026-09-13): el bloque 1 se quedaba corto para un A2 (souvenir,
// blague, habitude, discours, accent no estaban) y bloqueaba el tema 1 del
// Friends FR/France A2 en vocab-level-frequency. La vara viene de fuera, no
// del catálogo (feedback_level_measured_externally).

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

// Bloque 2, generado desde FleLex_TT_Beacco.tsv (ver cabecera). 1268 lemas.
const FRENCH_A1_A2_FLELEX_BEACCO: readonly string[] = [
  "abandonner","abricot","abriter","accent","accident","accompagner","accomplir","accord","accueil",
  "accueillir","achat","actif","activité","actualité","actuellement","adapter","addition",
  "administratif","admirable","admirer","adolescent","adorable","adresse","adulte","affaire",
  "affiche","affoler","africain","âge","âgé","agence","agir","agréable","agriculture","ah","aide",
  "aile","ainsi","air","ajoute","ajouter","album","alcool","aliment","alimentation","allemand",
  "allô","allonger","amateur","ambassade","ambiance","américain","amoureux","amusant","amuser",
  "analyser","ancien","âne","anglais","angle","animateur","animation","animer","annoncer",
  "antiquité","apercevoir","apéritif","apparaître","appareil","appartenir","applaudir","apprenti",
  "approcher","appuyer","archéologue","architecte","architecture","argent","arme","arrêter",
  "arrondissement","article","artifice","artiste","asseoir","assistant","assister","association",
  "assurance","atelier","attacher","attaquer","attention","attraper","au-dessus","auberge","auprès",
  "aussitôt","australien","autant","auteur","autoriser","autour","avancer","avantage","aventure",
  "avis","avouer","bac","baguette","baigner","bain","balade","balle","ballon","bancaire","bande",
  "banlieue","base","basket","battre","bavarder","beau-frère","beauté","beaux-arts","belge",
  "belle-mère","ben","besoin","bêtise","bien","bienvenir","bis","bise","bisou","bistrot","bizarre",
  "blague","blé","blessure","blond","blouson","boeuf","bof","bonjour","bonsoir","bord","boulanger",
  "boule","boulevard","bouquet","bourgeois","bout","bowling","brave","bravo","brésilien","briller",
  "bruit","brûler","buffet","bulletin","cacher","cadeau","caisse","caissier","camarade","campagne",
  "camping","canadien","candidat","canne","cantine","capable","capitale","carnet","carrière","cas",
  "casque","casser","cause","cave","ceci","cela","célèbre","célébrer","célibataire","celui",
  "centre","centre-ville","cependant","céréale","cérémonie","certain","certainement","chacun",
  "chaîne","chaleureux","champagne","champion","chance","changer","chanson","chant","chanteur",
  "charcuterie","charité","charmant","charme","châtain","chemin","cheminée","chèque","chère",
  "chéri","chevalier","chèvre","chez","chic","chinois","choix","chômage","chômeur","chose","chut",
  "cidre","cimetière","ciné","cire","cité","citer","classique","clé","client","club","code","coeur",
  "coiffer","coin","colère","collection","collectionner","collectionneur","coller","colline",
  "colonie","colorer","combat","combien","comédie","comédien","comique","commander","comme",
  "comment","commentaire","commenter","commerçant","commerce","commercial","commissariat","commun",
  "communauté","communication","compagnie","complet","compléter","compliquer","composer",
  "comptabilité","compter","concerner","concert","concours","condition","conducteur","conduire",
  "confiance","confirmer","confortable","congé","connaissance","consacrer","conseil","conseiller",
  "conserver","considérer","console","consommer","constater","construction","construire","contact",
  "contacter","contemporain","continent","continu","continuer","contrôle","convaincre",
  "conversation","coopération","corde","corriger","côte","côté","coucher","coup","coupe","couple",
  "cour","courage","course","couscous","coutume","couvrir","crèche","créer","créole","crêpe","cri",
  "crier","crise","critiquer","croissant","cuire","cuisinier","culinaire","cultivé","cultiver",
  "culture","culturel","curieux","d'abord","d'accord","dame","dangereux","danse","danseur","date",
  "dater","début","décevoir","décision","déclarer","décontracter","décor","décoration","décorer",
  "découverte","découvrir","décrire","défendre","définir","degré","déguiser","déguster","délicieux",
  "demande","déménager","demi","demi-heure","dentiste","départ","département","dépêcher","dépendre",
  "déposer","déranger","dès","désespérer","désirer","désoler","dessert","dessin","dessinateur",
  "dessiner","destination","détail","développement","développer","devenir","dévorer","diable",
  "dialogue","dieu","différence","différent","difficulté","dinde","direct","directement",
  "directeur","direction","diriger","discours","discussion","discuter","disparaître","disque",
  "divers","diversité","diviser","divorcer","document","domaine","domestique","double","doucement",
  "douche","doute","doux","droit","drôle","durer","dynamique","échange","échanger","éclairage",
  "économie","économique","écoute","écrivain","écu","écurie","effet","effondrer","également","eh",
  "électricité","électrique","élégant","élément","élire","embrasser","émission","emmener","émotion",
  "emploi","enchanter","endormir","endroit","énergie","enfance","enfermer","enfin","engager",
  "enlever","ennuyer","ennuyeux","énorme","enquête","enseignement","ensemble","ensoleiller",
  "entier","entraîner","entrée","envie","environ","environnement","épée","épeler","épice","épicer",
  "épisode","éplucher","époque","épouser","équipe","équipement","erreur","escargot","esclave",
  "espace","espagnol","essentiel","est","étage","étonner","étranger","étude","euh","euro",
  "européen","eux","évidemment","évoluer","évolution","évoquer","exactement","exagérer","excellent",
  "exclamer","excuser","exemple","exercice","exister","exotique","explication","exposer",
  "exposition","exprimer","extraordinaire","fabriquer","fac","face","facilement","façon","faim",
  "fait","falaise","falloir","fan","fantastique","farine","fatigant","fatiguer","faux","faveur",
  "félicitation","féliciter","féminin","fer","férié","fermeture","fêter","feuilleton","fidèle",
  "fidélité","fier","fin","finalement","fixer","foie","fonction","fonctionner","fond","fonder",
  "fontaine","foot","football","force","former","formidable","fou","foyer","frais","français",
  "francophone","francophonie","frapper","fruit","fumé","fumer","futur","galerie","gamin","garage",
  "garde","garder","gardien","gauche","gendarmerie","général","génération","généreux","génial",
  "genre","glisser","goût","gouvernement","grâce","gramme","grand-chose","grands-parents","gratuit",
  "grave","grenouille","grillé","grotte","groupe","guerre","guitare","habiller","habitant",
  "habiter","habitude","hé","hein","héler","héritage","hésiter","heureusement","historique",
  "honneur","horreur","horrible","hors-d'oeuvre","hum","humain","humeur","humour","hygiène",
  "hypermarché","idéal","identité","ignorer","île","illuminer","illustration","illustrer","image",
  "imaginer","immédiatement","immense","important","impossible","impression","inauguration",
  "inconnu","incroyable","indépendant","indice","indien","indiquer","industriel","infirmier",
  "informaticien","information","informatique","informer","ingénieur","innocent","inoubliable",
  "inquiet","inquiéter","inscription","inscrire","insister","inspecteur","inspirer","installation",
  "installer","institut","institution","insupportable","intense","interdire","intéressant",
  "intéresser","intérieur","international","internet","interroger","inventer","invention",
  "invitation","invité","italien","itinéraire","jaloux","japonais","jazz","jean","jeter","jeu",
  "jeunesse","jouet","joueur","journaliste","journée","joyeux","juge","jumeau","jusque","juste",
  "justement","justice","kilo","kilomètre","laboratoire","laitier","lancer","lapin","larme","latin",
  "lecture","légende","léger","légume","lendemain","lentement","lequel","lever","libération",
  "libérer","liberté","libre","lieu","linguistique","liste","litre","littérature","local",
  "logement","loi","lointain","loisir","longtemps","longue","louer","loup","lourd","lui-même",
  "luire","magazine","magnifique","mail","maire","mairie","maître","mal","malade","malheureusement",
  "malheureux","manière","manquer","maquette","marche","marier","marocain","marque","marquer",
  "marrant","marre","masque","maternel","mathématique","maths","mec","médecin","médias","médiéval",
  "meilleur","ménage","mener","menthe","mentir","merci","merveille","merveilleux","message","messe",
  "messieurs","mesurer","métal","métier","mètre","métropole","mi","micro","midi","mieux","mignon",
  "milieu","million","minéral","mistral","mixte","mode","moderne","moi","moins","moitié","monde",
  "mondial","monnaie","montant","montrer","monument","monumental","moquer","morceau","moteur",
  "motif","moulin","moyen","moyenne","mule","mural","muser","musical","musicien","musulman",
  "mystère","mystérieux","naissance","natation","national","nationalité","nature","naturel",
  "nécessaire","neveu","ni","niveau","nocturne","nom","nombre","nombreux","nord","normal",
  "notamment","noter","nul","numéro","numéroter","objet","obligatoire","obliger","observer",
  "occasion","occuper","océan","odeur","oeil","oeuf","oeuvre","office","officiel","offrir","oh",
  "olive","ombre","opéra","opération","or","ordre","organisation","organiser","organisme",
  "original","origine","où","ouais","oublie","ouest","ouf","outil","outre-mer","ouverture",
  "ouvrier","page","paix","palais","pamplemousse","panneau","panorama","pape","paquet","par",
  "paradis","parapluie","parce","pardon","parfait","parfum","parisien","parking","parole","part",
  "partager","participer","particulier","particulièrement","partie","passage","passé","passer",
  "passion","passionnant","passionner","pat","pâte","pâté","patient","pâtisserie","pays","paysage",
  "pêche","peindre","peine","peintre","peinture","pendre","perdu","période","perle","permettre",
  "pers","personnage","personnel","pétanque","petite-fille","photo","photocopie","photographe",
  "pièce","piéton","pire","pis","piscine","piste","plaire","plaisanter","plaisir","planche",
  "planter","plastique","pleurer","pleuvoir","plume","plutôt","poésie","poète","point","police",
  "politique","polluant","polonais","populaire","population","portugais","position","posséder",
  "possibilité","possible","poupée","pourboire","pourquoi","pourtant","poussière","pratique",
  "pratiquer","pré","précieux","précis","préféré","prénom","présent","présentateur","présenter",
  "président","presque","presse","presser","prêt","prêter","prévoir","prier","prince","principal",
  "prison","prisonnier","privilégier","prix","proche","production","produire","produit",
  "professeur","profession","profiter","programme","progrès","projet","promenade","promener",
  "promettre","proposer","proposition","propriétaire","protéger","prouver","province","proximité",
  "publicité","publier","publique","pyramide","qu'","quai","qualité","quart","que","québécois",
  "quel","quelqu'un","queue","qui","quoi","quotidien","rabat","radio","raide","raison","ramasser",
  "ramener","randonnée","rapidement","rapprocher","rare","rassurer","rattraper","ré","réalisateur",
  "réaliser","réalité","réception","recherche","rechercher","recommencer","recomposer",
  "reconnaître","recouvrir","rédiger","réfléchir","regarder","région","régler","regretter","reine",
  "relation","religion","remarquer","remercier","remonter","remplacer","remplir","remporter",
  "renaissance","rencontre","rencontrer","rendre","renseigner","rentrer","repartir","répéter",
  "répondeur","reposer","reprendre","représenter","république","réserve","réserver","résidence",
  "résistant","respecter","responsabilité","responsable","ressembler","restau","restaurer","reste",
  "resto","retard","retenir","retirer","retour","retraite","retrouver","réunir","réveiller",
  "réveillon","revenir","rêver","revoir","rhum","richesse","rire","rive","rock","roi","rôle",
  "romain","roman","romantique","rond","rosier","roue","rouler","royal","royaume","russe","sage",
  "saison","salle","salut","salutation","sapin","sardine","saucisson","sauf","sauvage","sauver",
  "scène","science","scientifique","scolaire","sculpture","secret","secrétaire","secrétariat",
  "secteur","sécurité","séjour","selon","sensible","sentiment","séparer","sérieux","serpent",
  "serveur","service","seul","seulement","sévère","siècle","signe","silence","simple","simplement",
  "sincère","sinon","sirop","site","situation","situer","ski","skier","social","société","soeur",
  "soif","soirée","soit","solaire","soldat","solde","solidarité","sommeil","sommet","sonner","sort",
  "sortie","soudain","souffler","soulier","souriant","sourire","souvenir","spécial","spécialement",
  "spécialité","spectacle","spectaculaire","spectateur","sportif","stage","studio","stupide",
  "style","succès","sud","sud-est","sud-ouest","suffire","suite","suivre","sujet","super","superbe",
  "supérieur","sûr","surprendre","surprise","surtout","surveiller","symbole","symboliser","sympa",
  "sympathie","taire","tant","tapisserie","tartine","tchao","technologie","télé","téléviser",
  "télévision","tellement","tennis","tente","terrain","terrible","terrifiant","territoire","texte",
  "tiens","titre","toi","toilette","tomber","total","toucher","tourisme","touriste","touristique",
  "tourner","tradition","traditionnel","traditionnellement","tranquillement","transformer",
  "transport","traversée","traverser","tromper","tuer","type","union","universitaire","utile",
  "utiliser","vacance","vain","valeur","vallée","varier","véhicule","vendeur","vérifier",
  "véritable","vers","version","vestige","vexer","vif","violent","visite","visiteur","vite","voeu",
  "voici","voilà","voile","voix","vol","voler","voleur","voyageur","vrai","vraiment","vue","zone",
  "zoo",
];

const normalizeOe = (s: string) => s.replace(/œ/g, "oe").replace(/æ/g, "ae");

export const FRENCH_A1_A2_LEMMAS: ReadonlySet<string> = new Set(
  [...FRENCH_A1_A2_ORIGINAL, ...FRENCH_A1_A2_FLELEX_BEACCO].map(normalizeOe),
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
