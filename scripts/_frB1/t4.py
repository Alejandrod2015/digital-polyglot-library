from comun import v,dump
T="rumours-and-reputation"
s1="""Le patron de l'estaminet de Fives s'appelle Florian, et il connaît tout le quartier. Ce matin-là, dans le bruit des tasses, derrière son zinc, il a servi une chicorée brûlante à Aurélien d'un drôle d'air. “Alors, c'est vous, le nouveau de l'atelier de vélos?” a demandé Florian.

Aurélien a hoché la tête, surpris. “On vous a viré de votre bureau, paraît-il, pour une erreur dans les comptes”, continuait Florian à voix basse. Aurélien a failli renverser sa tasse.

“Pas du tout. J'ai démissionné, discrètement, après dix ans de travail”, a démenti Aurélien. Florian a souri, méfiant, comme si de rien n'était. “Bien sûr. C'est ce qu'ils disent tous”, lui a répondu Florian.

Plus Aurélien se justifiait, plus son histoire avait l'air louche. La rumeur avait déjà fait le tour du quartier.

À midi, deux anciens collègues, ses premiers clients, ont annulé leur réparation par message. Aurélien a relu l'écran longtemps. Quelqu'un avait parlé, mais qui?"""
v1=[
 v("le zinc","zinc","noun","the metal bar counter of a traditional French café",True,"cultural"),
 v("ce matin-là","Ce matin-là","expression","on that morning in the past, not this morning"),
 v("la chicorée","chicorée","noun","a hot drink like coffee made from a root, loved in the north",True,"cultural"),
 v("d'un drôle d'air","d'un drôle d'air","expression","with a strange look, as if something is not normal"),
 v("virer","viré","verb","to make someone leave their job, often suddenly",register="colloquial"),
 v("paraît-il","paraît-il","expression","so people say; it seems, but nobody is really sure"),
 v("les comptes","comptes","noun","the numbers that show the money a company gets and spends",True),
 v("à voix basse","à voix basse","expression","speaking very quietly so that other people cannot hear"),
 v("faillir","failli","verb","to almost do something, but not do it in the end"),
 v("renverser","renverser","verb","to make a cup or glass fall so that the liquid goes out"),
 v("démentir","démenti","verb","to say clearly that a piece of news is not true"),
 v("méfiant","méfiant","adjective","not trusting someone, thinking they might lie to you"),
 v("c'est ce qu'ils disent tous","C'est ce qu'ils disent tous","expression","that is what everyone says, so it is probably not true"),
 v("plus... plus","Plus Aurélien se justifiait, plus","expression","the more you do one thing, the more another thing happens"),
 v("se justifier","se justifiait","verb","to explain why you did something because people think it was wrong"),
 v("louche","louche","adjective","strange in a way that makes you think something is wrong",register="colloquial"),
 v("brûlant","brûlante","adjective","very hot, so hot that it can hurt your mouth or hand"),
 v("annuler","annulé","verb","to say that something that was planned will not happen"),
 v("la réparation","réparation","noun","work to make a broken thing, like a bike, work again"),
 v("relire","relu","verb","to read something again because you cannot believe it"),
]
s2="""Aurélien a mené l'enquête toute la matinée, de comptoir en comptoir. Florian lui a raconté qu'il tenait l'histoire de la boulangère. La boulangère la tenait d'un client, et le client, de la serveuse de l'estaminet.

La serveuse a rougi quand Aurélien l'a interrogée. Elle avait seulement répété une phrase d'Élodie, entendue au zinc: “Mon associé s'est fait virer de sa vie de bureau.”

Ce soir-là, dans l'odeur de peinture fraîche, Aurélien a lâché son pinceau. “C'était une blague? Tout le quartier me prend pour un incapable!” a crié Aurélien. Élodie s'est mordu la lèvre.

“Je ne voudrais jamais te faire du mal. Je voulais dire que tu avais quitté une vie triste. Ils ont tout déformé”, s'est excusée Élodie. “Et ma réputation, tu t'en fiches?” a répliqué Aurélien, blessé.

Élodie est rentrée chez elle à contrecœur, sans finir le mur. Le lendemain, la peinture avait séché en traînées, à moitié grise, à moitié blanche, et personne n'avait envie de la reprendre."""
v2=[
 v("mener l'enquête","mené l'enquête","expression","to ask questions everywhere to discover the truth about something"),
 v("de comptoir en comptoir","de comptoir en comptoir","expression","going from one café counter to the next, asking people"),
 v("tenir de","tenait l'histoire de","expression","to have heard a story or news from a certain person"),
 v("la boulangère","boulangère","noun","a woman who makes or sells bread in a bakery",True),
 v("la serveuse","serveuse","noun","a woman who brings drinks and food to people in a café",True),
 v("rougir","rougi","verb","when your face becomes red because you feel shy or ashamed"),
 v("interroger","interrogée","verb","to ask someone many questions to find out what happened"),
 v("l'associé","associé","noun","a person who owns and runs a business with you"),
 v("la peinture fraîche","peinture fraîche","noun","paint that is still wet because it was just put on",True),
 v("le pinceau","pinceau","noun","a tool with soft hair that you use to paint walls",True),
 v("prendre pour","prend pour","expression","to wrongly think that someone is a certain kind of person"),
 v("l'incapable","incapable","noun","a person who cannot do anything right, used as an insult"),
 v("se mordre la lèvre","s'est mordu la lèvre","expression","to bite your lip because you feel guilty or want to stay quiet"),
 v("déformer","déformé","verb","to change someone's words so that the meaning is different"),
 v("la réputation","réputation","noun","what people think and say about a person"),
 v("s'en ficher","t'en fiches","expression","to not care at all about something, even if it is important",register="colloquial"),
 v("répliquer","répliqué","verb","to answer quickly, often in an angry or sharp way"),
 v("sécher","séché","verb","to become dry after being wet, like paint on a wall"),
 v("la traînée","traînées","noun","a long uneven line or mark left on a surface",True),
 v("reprendre","reprendre","verb","to start doing something again after a pause"),
]
s3="""Dans le quartier, une autre rumeur a couru: l'estaminet de Florian allait faire faillite. Chaque habitué, prudent, allait boire son demi ailleurs.

Derrière son zinc vide, Florian essuyait des verres déjà propres. “C'est faux, mais personne ne me croit. Vous savez ce que c'est, maintenant”, a soupiré Florian.

Aurélien a pris le temps de calculer, avec les factures et le cahier de caisse. “Vos comptes sont sains. Il faut que le quartier le sache”, lui a promis Aurélien.

Le samedi, devant les habitués réunis au zinc, il a parlé la boule au ventre. Pour qu'on le croie, il a dû admettre une chose: “J'ai quitté mon bureau parce que j'avais peur de rater ma vie, pas parce qu'on m'a viré, je vous le jure.”

Il y a eu un silence, puis quelqu'un a commandé un demi. Au fond de la salle, Élodie applaudissait. Aurélien avait perdu son image d'homme sûr de lui, mais le soir, l'estaminet était bondé, et l'atelier avait trois vélos à réparer."""
v3=[
 v("la rumeur","rumeur","noun","a story that people repeat, which may not be true"),
 v("faire faillite","faire faillite","expression","when a business has no more money and must close"),
 v("l'habitué","habitué","noun","a person who comes to the same café very often"),
 v("le demi","demi","noun","a glass of beer in a French café, about a quarter litre",True,"cultural"),
 v("ailleurs","ailleurs","adverb","in another place, somewhere different from here or from usual"),
 v("essuyer","essuyait","verb","to make something dry or clean with a cloth"),
 v("c'est faux","C'est faux","expression","that is not true at all, it is completely wrong"),
 v("savoir ce que c'est","savez ce que c'est","expression","to know how something feels because it happened to you too"),
 v("la facture","factures","noun","a paper that shows how much money you must pay",True),
 v("le cahier de caisse","cahier de caisse","noun","a notebook where a shop writes all the money of the day",True),
 v("sain","sains","adjective","healthy; for money or a business, in a good state"),
 v("réuni","réunis","adjective","together in one place, as a group of people"),
 v("croire","croie","verb","to think that what someone says is true"),
 v("rater sa vie","rater ma vie","expression","to fail in life, to not do what really matters to you"),
 v("prendre le temps de","pris le temps de","expression","to do something slowly and carefully, without hurrying"),
 v("au fond de","Au fond de","expression","at the back of a room, far from the door"),
 v("applaudir","applaudissait","verb","to hit your hands together to show that you like something"),
 v("bondé","bondé","adjective","so full of people that there is almost no free space"),
 v("l'image","image","noun","the idea that other people have of you"),
 v("réparer","réparer","verb","to make a broken thing, like a bike, work again"),
]
data=[
 {"topic":T,"slotIndex":0,"title":"Ce qu'on raconte à Fives","synopsis":"Dans un quartier où tout se sait, une mauvaise histoire circule sur le nouvel associé de l'atelier. Elle est fausse, mais elle amuse tout le monde. Plus Aurélien essaie de la corriger, plus on le soupçonne, et l'atelier n'est même pas encore ouvert. Il lui faut une chose: savoir qui a parlé le premier.","text":s1,"vocab":v1,"arcType":"mini-cliffhanger"},
 {"topic":T,"slotIndex":1,"title":"Une blague mal répétée","synopsis":"Aurélien veut savoir qui a lancé la rumeur, et il remonte l'histoire de café en boulangerie. Chaque personne l'a entendue de quelqu'un d'autre, un peu différente à chaque fois. Au bout de la chaîne, il trouve un nom qu'il n'attendait pas, et la soirée de peinture à l'atelier tourne mal.","text":s2,"vocab":v2,"arcType":"late-reveal"},
 {"topic":T,"slotIndex":2,"title":"Des comptes bien tenus","synopsis":"Cette fois, c'est Florian qui est la victime d'une rumeur, et son estaminet se vide. Aurélien étudie ses comptes et voit qu'ils sont sains, mais les chiffres ne suffisent pas à convaincre un quartier. Pour qu'on le croie, il avoue devant les habitués pourquoi il a vraiment quitté son bureau, et le soir même, l'estaminet est de nouveau plein.","text":s3,"vocab":v3,"arcType":"recurring-character-callback"},
]
dump("/Users/alejandrodelcarpio/digital-polyglot-library/scripts/_frB1/t4.json",data)
