from comun import v,dump
T="pride-and-envy"
s1="""Un mois après l'ouverture, une ancienne camarade de fac est venue à l'atelier avec un appareil photo. Charlotte est une journaliste d'un journal local. Elle cherchait une belle histoire pour le week-end.

“Un comptable qui plaque son CDI pour réparer des vélos, mes lecteurs vont adorer!” s'est enthousiasmée Charlotte. Pendant tout l'entretien, elle ne s'adressait qu'à Aurélien, qui tenait la vedette.

“Et ton pot de départ, c'était comment? Et les nuits blanches?” Flatté, Aurélien racontait tout sans s'arrêter. Au fond de l'atelier, dans l'odeur de graisse, Élodie changeait un pneu. Personne ne lui a demandé son avis.

“Tu peux te mettre derrière lui, pour la photo? Ce serait plus joli avec l'établi”, a proposé Charlotte. Élodie a hoché la tête, les lèvres serrées, et elle est restée en retrait, un peu floue.

“Merci, tu es un amour”, ajoutait Charlotte, qui l'a à peine regardée. Aurélien n'a rien vu. Il pensait déjà à l'article, fier comme un paon."""
v1=[
 v("la camarade","camarade","noun","a person who studied at the same school or university as you"),
 v("l'appareil photo","appareil photo","noun","a small machine that you use to take pictures",True),
 v("le journal local","journal local","noun","a newspaper that tells news about one city or area",True),
 v("chercher une belle histoire","cherchait une belle histoire","expression","for a journalist, to look for a good story that people will like"),
 v("plaquer","plaque","verb","to leave something suddenly, like a job or a partner",register="colloquial"),
 v("le lecteur","lecteurs","noun","a person who reads a newspaper, a magazine or a book"),
 v("s'enthousiasmer","s'est enthousiasmée","verb","to become very excited and happy about an idea"),
 v("l'entretien","entretien","noun","a meeting where a journalist asks someone many questions",True),
 v("s'adresser à","s'adressait","verb","to speak to a particular person and not to the others"),
 v("tenir la vedette","tenait la vedette","expression","to be the star, the person that everyone looks at"),
 v("flatté","Flatté","adjective","happy and proud because someone gives you a lot of attention"),
 v("sans s'arrêter","sans s'arrêter","expression","without stopping, continuing to talk or work all the time"),
 v("changer un pneu","changeait un pneu","expression","to take off an old bike tyre and put on a new one"),
 v("rester en retrait","restée en retrait","expression","to stay in the background, not in front of other people"),
 v("flou","floue","adjective","not clear in a photo, with soft edges that you cannot see well"),
 v("tu es un amour","tu es un amour","expression","you are very kind, said quickly to thank someone"),
 v("ajouter","ajoutait","verb","to say something more after what you have already said"),
 v("à peine","à peine","expression","almost not, only a very little, for a short moment"),
 v("l'article","article","noun","a piece of writing about one subject in a newspaper",True),
 v("fier comme un paon","fier comme un paon","expression","very proud, in a way that other people can easily see"),
]
s2="""La photo d'Aurélien faisait la une et occupait la moitié de la page, sous un grand titre sur le comptable qui avait tout plaqué. Derrière lui, un peu floue, on devinait Élodie. Son nom n'apparaissait nulle part.

Élodie a lu l'article une seule fois, puis elle l'a posé sur l'établi, blessée dans son orgueil. “Tu as l'air content de toi.” Ensuite, plus rien: tout l'après-midi, dans le bruit du compresseur, elle a travaillé sans lui adresser la parole.

Furieux, Aurélien a appelé Charlotte. “Pourquoi tu n'as pas mis son nom? Il faut que les gens sachent que c'est son atelier autant que le mien!”

“Je n'ai rien déformé. C'est toi qui m'as dit que l'idée était de toi, mon vieux”, lui a répondu Charlotte. Aurélien s'est souvenu de l'entretien: il avait bien dit ça, pour se donner de l'importance.

Il a raccroché, la honte aux joues. De l'autre côté de l'atelier, Élodie tordait une chambre à air entre ses mains, comme si elle voulait l'étrangler."""
v2=[
 v("occuper","occupait","verb","to fill a space, for example half of a newspaper page"),
 v("le titre","titre","noun","the big words at the top of a newspaper article",True),
 v("deviner","devinait","verb","to see something only a little, without seeing it clearly"),
 v("apparaître","apparaissait","verb","to be visible or written somewhere so that people can see it"),
 v("nulle part","nulle part","expression","in no place at all, not anywhere in the text"),
 v("content de soi","content de toi","expression","too pleased with yourself, in a way that annoys other people"),
 v("plus rien","plus rien","expression","nothing more at all, not one more word"),
 v("le compresseur","compresseur","noun","a machine that pushes air, used to fill bike tyres",True),
 v("adresser la parole","adresser la parole","expression","to speak to someone; with sans, to ignore them completely"),
 v("furieux","Furieux","adjective","very angry, so angry that you want to act immediately"),
 v("autant que","autant que","expression","as much as, in the same way and amount as"),
 v("le mien","le mien","expression","mine, the thing that belongs to me and not to you"),
 v("faire la une","faisait la une","expression","to be the main story on the front page of a newspaper"),
 v("mon vieux","mon vieux","expression","old friend, a familiar way to speak to a man",register="colloquial"),
 v("se souvenir de","s'est souvenu de","expression","to remember something that happened in the past"),
 v("se donner de l'importance","se donner de l'importance","expression","to try to look more important than you really are"),
 v("la honte aux joues","la honte aux joues","expression","with red cheeks because you feel ashamed of what you did"),
 v("de l'autre côté de","De l'autre côté de","expression","on the opposite side of a room or a street"),
 v("tordre","tordait","verb","to turn something hard with your hands so that it bends"),
 v("étrangler","étrangler","verb","to squeeze a neck very hard so that someone cannot breathe"),
]
s3="""Le journal a refusé de publier un rectificatif: Charlotte proposait seulement une petite note sur internet, que personne ne lirait.

Le lendemain, Aurélien est arrivé avant Élodie, dans l'odeur des croissants tièdes. Il avait longtemps cherché les mots, puis il avait décidé d'aller droit au but.

Il lui a tendu une feuille, sans préambule. “Dès aujourd'hui, c'est toi la gérante. Moi, je fais les comptes dans l'arrière-boutique.”

Élodie l'a regardé longtemps, les bras croisés. “Tu ne fais pas ça par pitié, j'espère?” “Non. Par justice, et parce que tu es bien meilleure que moi avec les clients, tu le sais”, lui a répondu Aurélien.

Sur le papier, le nom d'Élodie était maintenant écrit en premier. “Un café, monsieur le comptable de l'arrière-boutique?” a dit Élodie en souriant.

Aurélien a repris sa place derrière la cloison. Le premier client de la journée a demandé à voir la mécanicienne, et Élodie s'est levée. Aurélien avait perdu la vitrine et les compliments, et pourtant, en l'entendant, il a souri."""
v3=[
 v("publier","publier","verb","to print something in a newspaper or put it online"),
 v("le rectificatif","rectificatif","noun","a short text in a newspaper that corrects a mistake",True),
 v("sur internet","sur internet","expression","online, on a website instead of on paper"),
 v("cherché les mots","cherché les mots","expression","to look for the right words to say something difficult"),
 v("aller droit au but","aller droit au but","expression","to say the important thing directly, without a long introduction"),
 v("sans préambule","sans préambule","expression","directly, without any introduction before the important part"),
 v("dès aujourd'hui","Dès aujourd'hui","expression","starting today, from this very day and for the future"),
 v("la gérante","gérante","noun","a woman who manages a shop or a small business",True),
 v("faire les comptes","fais les comptes","expression","to take care of the money and numbers of a business"),
 v("l'arrière-boutique","arrière-boutique","noun","the private room at the back of a shop",True),
 v("les bras croisés","les bras croisés","expression","with your arms folded, often because you are not sure"),
 v("par pitié","par pitié","expression","because you feel sorry for someone, not for a good reason"),
 v("en premier","en premier","expression","first, before all the other names or things"),
 v("reprendre sa place","repris sa place","expression","to go back to your usual place or role"),
 v("la cloison","cloison","noun","a thin wall that separates two parts of a room",True),
 v("demander à voir","demandé à voir","expression","to ask to speak to a particular person"),
 v("la mécanicienne","mécanicienne","noun","a woman whose job is to repair machines, like bikes"),
 v("les compliments","compliments","noun","nice words that people say to show they admire you"),
 v("en l'entendant","en l'entendant","expression","while hearing it, at the moment that you hear it"),
 v("tiède","tièdes","adjective","a little warm, not hot and not cold"),
]
data=[
 {"topic":T,"slotIndex":0,"title":"Une photo pour le journal","synopsis":"Une journaliste qui a connu les deux associés à la fac vient écrire sur leur atelier. L'histoire du comptable qui a tout quitté plaît beaucoup à la journaliste, et Aurélien aime qu'on l'écoute. Pendant qu'il parle, quelqu'un d'autre reste au fond de l'atelier, et personne ne pense à lui demander quoi que ce soit.","text":s1,"vocab":v1,"arcType":"reframe-turn"},
 {"topic":T,"slotIndex":1,"title":"Son nom n'y est pas","synopsis":"L'article sort enfin, avec une grande photo, mais il manque quelque chose d'important. Élodie ne dit rien et travaille tout l'après-midi sans un regard pour son associé. Aurélien veut accuser la journaliste, jusqu'au moment où elle lui rappelle ce qu'il a dit lui-même pendant l'entretien.","text":s2,"vocab":v2,"arcType":"late-reveal"},
 {"topic":T,"slotIndex":2,"title":"Derrière la cloison","synopsis":"Le journal ne corrigera pas son erreur, et Aurélien ne veut pas réparer les choses avec de grandes phrases. Il arrive un matin avant son associée, avec des croissants et une décision. Ce qu'il propose lui coûte la partie de l'atelier qu'il commençait à aimer, et c'est justement pour ça qu'il le propose.","text":s3,"vocab":v3,"arcType":"harmonic-close"},
]
dump("/Users/alejandrodelcarpio/digital-polyglot-library/scripts/_frB1/t7.json",data)
