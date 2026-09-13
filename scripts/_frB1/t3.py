from comun import v,dump
T="money-and-debts"
s1="""Dans son bureau froid, Yasmine, une conseillère bancaire aux gestes rapides, a ouvert leur dossier sans sourire. C'était une amie de fac d'Élodie, mais au travail, elle ne faisait pas de cadeaux. “Vous voulez emprunter quatre-vingt mille euros?” a demandé Yasmine.

“Le taux est bon, mais il manque l'apport personnel”, a expliqué Yasmine. Élodie, fauchée depuis la fermeture du magasin, n'avait pas un sou. Aurélien avait la boule au ventre.

“J'ai trente mille euros d'économies, mises de côté par prudence pour un deux-pièces à Wazemmes. Et si je les mettais dans l'atelier?” a proposé Aurélien. Yasmine l'a regardé longtemps. “Vous pourriez tout perdre, vous le savez?” l'a prévenu Yasmine.

Aurélien a hoché la tête, parce qu'Élodie le regardait. Le soir même, il a appelé l'agence pour renoncer au deux-pièces. Il a raccroché à contrecœur.

Dans l'escalier, Élodie lui a serré la main très fort, sans rien dire."""
v1=[
 v("la conseillère bancaire","conseillère bancaire","noun","a woman at a bank who helps clients with loans and money",True),
 v("ne pas faire de cadeaux","faisait pas de cadeaux","expression","to be strict and not make things easy for anyone"),
 v("emprunter","emprunter","verb","to get money from a bank that you must pay back later"),
 v("le taux","taux","noun","the percentage of extra money you pay the bank for a loan",True),
 v("l'apport personnel","apport personnel","noun","the money you put in yourself before the bank lends you more",True),
 v("fauché","fauchée","adjective","having no money at all, or almost none",register="colloquial"),
 v("la fermeture","fermeture","noun","the moment when a shop or business closes for good"),
 v("pas un sou","pas un sou","expression","no money at all, not even a small amount"),
 v("les économies","économies","noun","money that you keep and do not spend, for later",True),
 v("mettre de côté","mises de côté","expression","to keep money aside little by little for the future"),
 v("le deux-pièces","deux-pièces","noun","a small flat with a living room and one bedroom",True,"cultural"),
 v("longtemps","longtemps","adverb","for a long time, during many minutes, days or years"),
 v("tout perdre","tout perdre","expression","to lose everything you have, for example all your money"),
 v("prévenir","prévenu","verb","to tell someone about a danger or a problem before it happens"),
 v("le soir même","Le soir même","expression","on the evening of that same day, only a few hours later"),
 v("renoncer à","renoncer au","verb","to decide not to have or do something you wanted"),
 v("raccrocher","raccroché","verb","to end a phone call and put the phone down"),
 v("à contrecœur","à contrecœur","expression","doing something you do not really want to do"),
 v("serrer la main","serré la main","expression","to hold someone's hand tightly to show support or thanks"),
 v("sans rien dire","sans rien dire","expression","without saying a single word, in complete silence"),
]
s2="""La réponse de la banque est arrivée un jeudi, par téléphone. Yasmine a expliqué à Aurélien que le prêt était accepté, mais à un seul nom: le sien. Pour la banque, Élodie était au chômage, et elle ne comptait pas.

Le soir, Aurélien a posé le contrat sur l'établi. “Ça ne change rien. Avec ou sans ta signature, c'est notre atelier”, lui a assuré Aurélien. Élodie a lu le contrat deux fois, en silence, les lèvres serrées.

“Sur le papier, tout est à toi. Et moi, je suis quoi? L'employée de mon copain?” a lâché Élodie. “C'est juste de la paperasse. On peut négocier”, tentait Aurélien. Élodie a tranché: “Non. C'est une question de justice.”

“Je ne signerai rien qui fasse de moi une invitée dans mon propre atelier”, a prévenu Élodie. Elle est partie en claquant la porte, le trousseau dans la poche. L'offre était valable jusqu'au vendredi.

Le vendredi est passé, le taux a grimpé, et le contrat est resté sur l'établi, sans signature."""
v2=[
 v("à un seul nom","à un seul nom","expression","in the name of only one person, not two"),
 v("le sien","le sien","expression","his or hers; the thing that belongs to that person"),
 v("compter","comptait","verb","to be important; when it does not count, it does not matter"),
 v("le contrat","contrat","noun","an official paper that people sign to agree on something",True),
 v("l'établi","établi","noun","a strong table for working with tools in a workshop",True),
 v("assurer","assuré","verb","to tell someone firmly that something is true, to calm them"),
 v("la signature","signature","noun","your name written by hand at the bottom of a paper"),
 v("les lèvres serrées","les lèvres serrées","expression","with your mouth closed tight because you are angry or hurt"),
 v("sur le papier","Sur le papier","expression","officially, in the documents, but not always in real life"),
 v("l'employée","employée","noun","a woman who works for a boss or a company"),
 v("la paperasse","paperasse","noun","boring official papers and documents that you must fill in",register="colloquial"),
 v("la justice","justice","noun","the idea that things are fair and equal for everyone"),
 v("négocier","négocier","verb","to discuss with someone to get a better deal"),
 v("faire de quelqu'un","fasse de moi","expression","to turn someone into something, to give them a certain role"),
 v("l'invitée","invitée","noun","a woman who comes to a place that belongs to someone else"),
 v("propre","propre","adjective","before a noun: your own, belonging to you and nobody else"),
 v("tenter","tentait","verb","to try to do or say something, without being sure it works"),
 v("l'offre","offre","noun","what a bank or a company proposes to you, with its conditions"),
 v("valable","valable","adjective","still good and accepted, until a certain date"),
 v("grimper","grimpé","verb","to go up quickly, for example a price or a number"),
]
s3="""Aurélien a trouvé une solution sur un coin de tableur: prêter à Élodie la moitié de ses économies, pour que chacun mette la même somme. Sûr de lui, il est allé à l'atelier.

“Comme ça, l'atelier est à nos deux noms”, lui a expliqué Aurélien. Dans le silence, Élodie n'a pas souri. Elle a posé une condition: “D'accord. Mais je veux une reconnaissance de dette, avec des dates et nos deux signatures.”

“C'est ridicule, entre nous. Tu n'as pas confiance en moi?” a protesté Aurélien. “Justement si. Je veux que notre amitié reste propre”, s'est expliquée Élodie.

Ils l'ont écrite à la main, sur l'établi: deux cents euros par mois, pendant six ans. Élodie a signé la première, d'une écriture appliquée, puis elle a rangé le stylo comme si de rien n'était.

Le lundi, Yasmine a validé le prêt, à un taux moins avantageux. Aurélien était soulagé. En rangeant la feuille, il a pensé qu'entre eux, il y avait maintenant un compte écrit."""
v3=[
 v("entre nous","entre nous","expression","between the two of us, in our private relationship"),
 v("prêter","prêter","verb","to give money or a thing that the person must give back"),
 v("la somme","somme","noun","an amount of money, for example what each person pays"),
 v("à nos deux noms","à nos deux noms","expression","officially belonging to both of us, with our two names"),
 v("sourire","souri","verb","to make a small happy movement with your mouth"),
 v("la reconnaissance de dette","reconnaissance de dette","noun","a signed paper saying that you owe someone money",True),
 v("protester","protesté","verb","to say that you do not agree and that something is wrong"),
 v("ridicule","ridicule","adjective","so silly that it makes people laugh or feel embarrassed"),
 v("avoir confiance en","as pas confiance en","expression","to believe that someone is honest and will not hurt you"),
 v("justement si","Justement si","expression","yes, and that is exactly the reason, said to contradict"),
 v("rester","reste","verb","to continue to be in the same state, not change"),
 v("s'expliquer","s'est expliquée","verb","to give the reasons for what you do or say"),
 v("par mois","par mois","expression","every month, one time in each month of the year"),
 v("d'une écriture appliquée","d'une écriture appliquée","expression","with careful, neat handwriting, like a good student"),
 v("valider","validé","verb","to officially accept something after checking that everything is correct"),
 v("avantageux","avantageux","adjective","good for you because it costs less or gives more"),
 v("en rangeant","En rangeant","expression","while putting something back in its usual place, to tidy"),
 v("la feuille","feuille","noun","a single piece of paper, for writing or printing on"),
 v("penser","pensé","verb","to have an idea or an opinion in your head"),
 v("le compte","compte","noun","a record of money that one person owes to another",True),
]
data=[
 {"topic":T,"slotIndex":0,"title":"Trente mille euros","synopsis":"À la banque, une amie de fac d'Élodie étudie leur projet d'atelier sans aucune indulgence. Il manque de l'argent, et Élodie n'a rien. Aurélien, lui, a gardé pendant dix ans des économies pour un rêve bien précis. Pour que l'atelier existe, il faudrait qu'il y renonce, et il n'a qu'une soirée pour le faire.","text":s1,"vocab":v1,"arcType":"reframe-turn"},
 {"topic":T,"slotIndex":1,"title":"Un seul nom sur le contrat","synopsis":"La banque dit enfin oui, mais à une condition qui change tout entre les deux amis. Aurélien pense que ce n'est qu'un détail administratif. Élodie, elle, y voit sa place dans l'atelier, et elle refuse de la céder. Pendant ce temps, l'offre de la banque ne va pas attendre éternellement.","text":s2,"vocab":v2,"arcType":"juxtaposition-discovery"},
 {"topic":T,"slotIndex":2,"title":"Deux cents euros par mois","synopsis":"Aurélien trouve une solution pour que les deux amis soient enfin égaux devant la banque. Élodie accepte, mais elle pose une condition que son ami trouve d'abord ridicule. Ils la mettent pourtant en place, et l'atelier peut enfin avancer. Le prêt est signé, et la feuille finit dans un tiroir de l'atelier.","text":s3,"vocab":v3,"arcType":"harmonic-close"},
]
dump("/Users/alejandrodelcarpio/digital-polyglot-library/scripts/_frB1/t3.json",data)
