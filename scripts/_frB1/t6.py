from comun import v,dump
T="stress-and-burnout"
s1="""Trois semaines avant la Braderie, l'atelier sentait la peinture et la sueur. Aurélien et Élodie travaillaient quatorze heures par jour pour ouvrir pendant le grand week-end de septembre.

Un nouveau client, Quentin, un médecin généraliste du quartier, est arrivé avec un vieux vélo au dérailleur fatigué. Pendant qu'Élodie réglait les vitesses, il a remarqué que ses mains tremblaient.

“Vous dormez combien d'heures par nuit?” a demandé Quentin. “Assez pour tenir le coup, docteur. On se reposera après l'ouverture, je vous assure”, mentait Élodie en souriant, les yeux cernés.

Quentin a secoué la tête. “À ce rythme, vous allez craquer avant la Braderie. Je le vois tous les jours dans mon cabinet”, l'a prévenue Quentin.

Derrière l'établi, Aurélien avait envie de lui dire de ralentir. Pourtant, il s'est tu: cette date, il ne voulait pas s'en passer, lui non plus. Puis il a rallumé sa ponceuse."""
v1=[
 v("la Braderie","Braderie","noun","a giant street flea market in Lille on the first weekend of September",True,"cultural"),
 v("sentir","sentait","verb","to have a certain smell, for example of paint or sweat"),
 v("la sueur","sueur","noun","the water that comes out of your skin when you work hard"),
 v("par jour","par jour","expression","every day, each day, for example hours of work"),
 v("le médecin généraliste","médecin généraliste","noun","a family doctor who treats all common health problems",True),
 v("le dérailleur","dérailleur","noun","the part of a bike that moves the chain to change gears",True),
 v("régler","réglait","verb","to adjust a machine so that it works correctly"),
 v("les vitesses","vitesses","noun","the gears of a bike, which make pedalling easier or harder",True),
 v("trembler","tremblaient","verb","to shake a little, because you are cold, afraid or tired"),
 v("se reposer","reposera","verb","to stop working for a while so that your body can rest"),
 v("en souriant","en souriant","expression","while smiling, with a smile on your face"),
 v("secouer la tête","secoué la tête","expression","to move your head from side to side to say no"),
 v("à ce rythme","À ce rythme","expression","if things continue at this speed or in this way"),
 v("craquer","craquer","verb","to lose control and break down because of too much stress",register="colloquial"),
 v("le cabinet","cabinet","noun","the room or office where a doctor sees patients",True),
 v("ralentir","ralentir","verb","to go slower, to do less or work less hard"),
 v("pourtant","Pourtant","adverb","but still, even if the other thing is true"),
 v("se passer de","s'en passer","expression","to live or work without something that you want"),
 v("rallumer","rallumé","verb","to turn a machine or a light on again after a pause"),
 v("la ponceuse","ponceuse","noun","an electric tool that makes wood or walls smooth",True),
]
s2="""Dans le silence de l'atelier, Élodie s'est endormie debout, un jeudi. Elle était appuyée contre l'établi, une chambre à air à la main. Aurélien a appelé Quentin, qui est venu au pas de course.

Après l'avoir examinée, le médecin a sorti son carnet, l'air grave: “Je vous mets en arrêt maladie une semaine. Il faut que vous dormiez, et pas contre votre établi, cette fois.”

“Une semaine? Mais la Braderie est dans dix jours!” a protesté Élodie, pâle comme un linge. “Je m'occupe de tout, promis. Toi, tu rentres dormir, et tu ne discutes pas”, lui a juré Aurélien.

Aurélien a travaillé tout seul, trois nuits blanches de suite. Il montait des roues. Le quatrième soir, à bout de forces, il a relu la liste d'attente. Puis il a fait le calcul: impossible.

Le lendemain, il a prévenu tout le quartier par message: l'ouverture était repoussée. La Braderie, elle, ne reviendrait que dans un an."""
v2=[
 v("endormi debout","endormie debout","expression","so tired that you fall asleep while you are still standing"),
 v("appuyé","appuyée","adjective","leaning against something so that it holds your weight"),
 v("la chambre à air","chambre à air","noun","the soft rubber tube inside a bike tyre that holds air",True),
 v("au pas de course","au pas de course","expression","very quickly, almost running, because something is urgent"),
 v("examiner","examinée","verb","for a doctor, to look carefully at a patient's body"),
 v("l'arrêt maladie","arrêt maladie","noun","official time off work that a doctor gives you when you are ill",True,"cultural"),
 v("l'air grave","l'air grave","expression","with a serious face, because something important is happening"),
 v("pâle comme un linge","pâle comme un linge","expression","with a very white face, because you are ill or scared"),
 v("jurer","juré","verb","to promise very seriously that you will do something"),
 v("tout seul","tout seul","expression","alone, without any help or company from another person"),
 v("la nuit blanche","nuits blanches","noun","a night when you do not sleep at all"),
 v("de suite","de suite","expression","one after the other, without a break between them"),
 v("la roue","roues","noun","one of the two round parts of a bike that touch the ground"),
 v("à bout de forces","à bout de forces","expression","so tired that you have no energy left"),
 v("la liste d'attente","liste d'attente","noun","a list of people who are waiting for a service",True),
 v("faire le calcul","fait le calcul","expression","to count carefully to see if something is possible"),
 v("impossible","impossible","adjective","that cannot happen or cannot be done, whatever you try"),
 v("revenir","reviendrait","verb","to come back again, or to happen again later"),
 v("dans un an","dans un an","expression","one year later, after twelve long months have passed"),
 v("promis","promis","expression","I promise, said quickly to show you really mean it"),
]
s3="""Personne n'osait se débarrasser des cinq cents prospectus imprimés avec la date de la Braderie. Ils attendaient en pile.

Élodie, revenue plus tôt que prévu, a trouvé Aurélien assis par terre, les mains moites. “Toi aussi, tu es au bout du rouleau, Aurélien. Ne mens pas, je te connais par cœur”, constatait Élodie.

Il avait des vertiges, mais il a secoué la tête. Puis il a ravalé sa fierté: “Je n'en peux plus. Je croyais que je pouvais tout faire seul, comme avant.” Élodie lui a répété qu'on ne gagnait rien à se tuer au travail.

Ils ont passé la soirée à écrire leurs règles: le dimanche fermé, pas plus de dix heures par jour, et le droit de dire stop. “Il vaut mieux ouvrir un mardi pluvieux que fermer au bout d'un mois”, a résumé Élodie.

Ils ont mis les prospectus au recyclage, sans regret. L'atelier a ouvert un mardi ordinaire, sous la drache, avec trois clients et un café chaud."""
v3=[
 v("oser","osait","verb","to have the courage to do something difficult"),
 v("se débarrasser de","se débarrasser des","expression","to throw away or give away something that you do not want"),
 v("le prospectus","prospectus","noun","a small printed paper that advertises a shop or an event",True),
 v("imprimé","imprimés","adjective","printed on paper by a machine, with words or pictures"),
 v("en pile","en pile","expression","put one on top of the other in a tall stack"),
 v("plus tôt que prévu","plus tôt que prévu","expression","earlier than the time that was planned at the start"),
 v("au bout du rouleau","au bout du rouleau","expression","completely exhausted, with no energy left at all",register="colloquial"),
 v("par cœur","par cœur","expression","perfectly, so well that you know everything about it"),
 v("constater","constatait","verb","to see and say that something is true"),
 v("avoir des vertiges","avait des vertiges","expression","to feel that everything turns around you and you might fall"),
 v("je n'en peux plus","Je n'en peux plus","expression","I cannot continue, I am too tired or too stressed"),
 v("se tuer au travail","se tuer au travail","expression","to work so much that it damages your health"),
 v("passer la soirée à","passé la soirée à","expression","to spend the whole evening doing one particular thing"),
 v("le droit de","droit de","expression","the permission or the freedom to do something"),
 v("dire stop","dire stop","expression","to say clearly that you want something to stop now"),
 v("pluvieux","pluvieux","adjective","with a lot of rain, grey and wet"),
 v("résumer","résumé","verb","to say the most important idea in a few words"),
 v("le recyclage","recyclage","noun","the place where paper and plastic go to be used again",True),
 v("sans regret","sans regret","expression","without feeling sad about losing or leaving something"),
 v("ordinaire","ordinaire","adjective","normal, like every other day, with nothing special"),
]
data=[
 {"topic":T,"slotIndex":0,"title":"Des mains qui tremblent","synopsis":"Les deux associés se sont fixé une date impossible pour ouvrir l'atelier, et ils refusent de la lâcher, même quand leur corps commence à protester. Un nouveau client est médecin, et il voit tout de suite ce qu'ils refusent de voir. Élodie dit qu'elle va très bien. Aurélien, lui, préfère ne rien dire.","text":s1,"vocab":v1,"arcType":"reframe-turn"},
 {"topic":T,"slotIndex":1,"title":"Endormie contre l'établi","synopsis":"Ce que le médecin avait prévu arrive plus vite que prévu, et Élodie doit s'arrêter. Aurélien jure qu'il va tout faire seul pour garder la date de la Braderie. Pendant trois nuits, il y croit. La quatrième, seul devant la liste des vélos à réparer, il fait enfin ses comptes, et les chiffres lui disent autre chose.","text":s2,"vocab":v2,"arcType":"juxtaposition-discovery"},
 {"topic":T,"slotIndex":2,"title":"Cinq cents prospectus","synopsis":"Les prospectus de la Braderie attendent toujours sur l'établi, et personne n'ose les jeter. Quand Élodie revient, elle découvre que son associé n'est pas en meilleur état qu'elle. Ensemble, ils décident de changer leur façon de travailler, et l'atelier finit par ouvrir, un jour bien ordinaire.","text":s3,"vocab":v3,"arcType":"harmonic-close"},
]
dump("/Users/alejandrodelcarpio/digital-polyglot-library/scripts/_frB1/t6.json",data)
