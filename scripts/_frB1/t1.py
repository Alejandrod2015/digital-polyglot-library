import json
T="careers-and-ambitions"
def v(word,surface,typ,definition,anchor=False,register="neutral"):
    d={"type":typ,"word":word,"surface":surface,"register":register,"definition":definition}
    if anchor: d["anchor"]=True
    return d
s1_text="""Aurélien, un comptable de trente-cinq ans, attendait à l'estaminet, dans l'odeur chaude des welshs. Il voulait offrir une tournée: sa cheffe lui avait proposé une promotion. Élodie, une mécanicienne de vélos, est arrivée la boule au ventre.

Élodie a jeté son casque sur la banquette: “Mon magasin ferme en janvier. Ils vont licencier tout le monde.” Prudent, Aurélien a gardé pour lui sa nouvelle. “Le chômage, ça ne dure pas, tu verras”, a dit Aurélien, et il s'est senti coupable.

Fêter une promotion devant elle lui semblait déplacé, et il avait du mal à la regarder. Élodie a ri jaune. “Tu te souviens? À la fac, on rêvait d'ouvrir un atelier. C'est maintenant ou jamais”, lui a rappelé Élodie.

Aurélien a hoché la tête et griffonné deux noms sur une serviette en papier. “Ce serait une folie, et je suis comptable!” a plaisanté Aurélien. Sa tournée, il ne l'a jamais offerte.

Ce soir-là, il n'a pas pensé une seule fois à sa promotion."""
s1_vocab=[
 v("l'estaminet","estaminet","noun","a small traditional café and bar in the north of France",True,"cultural"),
 v("le welsh","welshs","noun","a hot northern French dish of cheese, beer and bread",True,"cultural"),
 v("offrir une tournée","offrir une tournée","expression","to pay for a drink for everyone at the table"),
 v("la promotion","promotion","noun","a better job with more money in the same company",True),
 v("ce soir-là","Ce soir-là","expression","on that evening in the past, not this evening"),
 v("la boule au ventre","la boule au ventre","expression","with a heavy, nervous feeling in your stomach"),
 v("licencier","licencier","verb","to tell workers that they no longer have a job"),
 v("prudent","Prudent","adjective","careful, someone who thinks about risks before acting"),
 v("garder pour soi","gardé pour lui","expression","to keep something secret and not tell other people"),
 v("le chômage","chômage","noun","the situation of having no job and looking for work",True),
 v("avoir du mal à","avait du mal à","expression","to find it hard to do something, or to manage it badly"),
 v("déplacé","déplacé","adjective","not right for the moment, a little rude"),
 v("se sentir coupable","senti coupable","expression","to feel bad because you think that you did something wrong"),
 v("rire jaune","ri jaune","expression","to laugh a little, but without finding the situation funny at all"),
 v("rêver de","rêvait d'","verb","to hope for something for a long time"),
 v("l'atelier","atelier","noun","a small workshop where people make or repair things",True),
 v("hocher la tête","hoché la tête","expression","to move your head up and down to say yes"),
 v("griffonner","griffonné","verb","to write or draw something quickly and not neatly"),
 v("la serviette en papier","serviette en papier","noun","a thin paper square for cleaning your hands at the table",True),
 v("une seule fois","une seule fois","expression","not even once, used to make a strong point"),
]
s2_text="""Sur son écran, Aurélien avait ouvert un tableur: loyer, outils, un an sans salaire fixe. Sa cheffe voulait une réponse avant vendredi, et ce délai lui serrait la gorge.

Mercredi soir, Élodie a débarqué avec deux bières froides. “Arrête de calculer, Aurélien. Tu en as envie?” a demandé Élodie. “Je veux peser le pour et le contre, sans me précipiter”, s'est défendu Aurélien.

“Personne n'est sûr de rien avant de sauter le pas”, insistait Élodie. À force de fixer l'écran, il a su qu'elle avait raison, et ça l'agaçait. Jeudi, sa cheffe lui a demandé si c'était oui.

Il voulait accepter par prudence, mais devant le beffroi allumé, il a refusé poliment, les mains moites. La promotion est allée à un collègue ambitieux, pour de bon. Aurélien a tapé trois mots à Élodie: “J'ai dit non.”

Élodie a appelé dans la minute. “Tu es complètement fou, et je suis fière de toi!” a crié Élodie. Aurélien a fermé le tableur sans l'enregistrer, soulagé."""
s2_vocab=[
 v("le tableur","tableur","noun","a computer program with tables for numbers and money",True),
 v("le salaire fixe","salaire fixe","noun","the same pay every month, which does not change",True),
 v("le délai","délai","noun","the time you have before something must be finished",True),
 v("débarquer","débarqué","verb","to arrive somewhere suddenly, without telling anyone first",register="colloquial"),
 v("calculer","calculer","verb","to count numbers carefully to find an answer"),
 v("peser le pour et le contre","peser le pour et le contre","expression","to think about the good and bad sides before deciding"),
 v("à force de","À force de","expression","because you do something many times or for a long time"),
 v("se précipiter","me précipiter","verb","to do something too fast, without taking time to think"),
 v("taper","tapé","verb","to write a message by pressing the keys of a phone"),
 v("sauter le pas","sauter le pas","expression","to finally make a big decision after waiting a long time"),
 v("agacer","agaçait","verb","to make someone a little angry or annoyed"),
 v("par prudence","par prudence","expression","to be careful and avoid a possible problem"),
 v("le beffroi","beffroi","noun","a tall old bell tower in a town centre, typical of the north",True,"cultural"),
 v("poliment","poliment","adverb","in a kind and correct way, with good manners"),
 v("moite","moites","adjective","a little wet with sweat, because you are nervous or hot"),
 v("serrer la gorge","serrait la gorge","expression","to make you feel so nervous that it is hard to swallow"),
 v("ambitieux","ambitieux","adjective","wanting very much to be successful and have a better job"),
 v("dans la minute","dans la minute","expression","immediately, only a very short time after something happens"),
 v("soulagé","soulagé","adjective","feeling better because a worry or a problem has gone away"),
 v("enregistrer","enregistrer","verb","to keep a file on a computer so you can open it again"),
]
s3_text="""Un lundi matin, Aurélien a posé sa lettre de démission sur le bureau de sa cheffe, sans un mot de trop. Il voulait partir discrètement, après son préavis. La nouvelle a pourtant fait le tour du cabinet avant midi.

Pour une collègue, il était sûrement tombé sur la tête. Au pot de départ, il avait envie de disparaître, un champagne tiède à la main. “Merci à tous, vraiment!” a dit Aurélien pendant les discours gênants, et il a tenu le coup jusqu'au bout.

Sous la drache, Élodie l'attendait à cheval sur son vélo. “Il pèse lourd, ce carton?” a demandé Élodie. “Moins lourd que dix ans de CDI”, lui a répondu Aurélien.

Élodie lui a tendu un trousseau rouillé: “Le local de Fives. Le propriétaire voudrait qu'on signe vite, avant la fin du mois.” “Adieu le salaire fixe et la mutuelle”, a soupiré Aurélien, et il a rangé les clés dans la poche où il mettait son badge. “Bienvenue au chômage, associé”, s'est moquée Élodie."""
s3_vocab=[
 v("la lettre de démission","lettre de démission","noun","a letter that tells your boss you are leaving your job",True),
 v("sans un mot de trop","sans un mot de trop","expression","saying only what is really needed and nothing more"),
 v("discrètement","discrètement","adverb","quietly, so that other people do not notice"),
 v("le préavis","préavis","noun","the weeks you must still work after you say you are leaving",True),
 v("faire le tour","fait le tour","expression","to go everywhere in a place, so that everyone knows"),
 v("le CDI","CDI","noun","a French work contract with no end date, very safe",True,"cultural"),
 v("tomber sur la tête","tombé sur la tête","expression","to act in a crazy way, as if you had lost your mind",register="colloquial"),
 v("disparaître","disparaître","verb","to go away so that nobody can see you any more"),
 v("le pot de départ","pot de départ","noun","a small party at work for a person who is leaving",True,"cultural"),
 v("gênant","gênants","adjective","making people feel uncomfortable or a little ashamed"),
 v("tenir le coup","tenu le coup","expression","to stay strong and not give up in a hard moment"),
 v("jusqu'au bout","jusqu'au bout","expression","until the very end of something, without stopping or leaving before"),
 v("à cheval sur","à cheval sur","expression","sitting with one leg on each side of something"),
 v("la drache","drache","noun","a heavy, cold rain, a word used in the north of France",True,"regional"),
 v("peser","pèse","verb","to have a certain weight, heavy or light"),
 v("le trousseau","trousseau","noun","a group of keys held together on a ring"),
 v("rouillé","rouillé","adjective","old metal that has turned brown and rough with water"),
 v("le local","local","noun","an empty room or shop that a business can rent"),
 v("la mutuelle","mutuelle","noun","extra health insurance, often paid in part by your job"),
 v("le badge","badge","noun","a small card that lets you enter your office building",True),
]
data=[
 {"topic":T,"slotIndex":0,"title":"La tournée jamais offerte","synopsis":"Aurélien a enfin une bonne nouvelle au travail, et il a réservé une table pour la fêter avec Élodie, sa meilleure amie depuis la fac. Mais Élodie arrive avec une nouvelle bien pire que la sienne. Il faudrait choisir laquelle compte ce soir, et Aurélien décide de se taire. La soirée ne se passe pas du tout comme il l'avait prévu.","text":s1_text,"vocab":s1_vocab,"arcType":"reframe-turn"},
 {"topic":T,"slotIndex":1,"title":"Réponse avant vendredi","synopsis":"Aurélien voudrait des chiffres sûrs avant de choisir entre son bureau tranquille et un vieux rêve de la fac. Il fait des tableaux, il compte, il recompte. Mais sa cheffe attend une réponse avant vendredi, Élodie en a assez des peut-être, et les chiffres, eux, ne décident rien à sa place. Il faut qu'il choisisse, et vite.","text":s2_text,"vocab":s2_vocab,"arcType":"juxtaposition-discovery"},
 {"topic":T,"slotIndex":2,"title":"Un carton sous le bras","synopsis":"Aurélien quitte le cabinet où il travaille depuis dix ans, et il voudrait partir sans bruit, comme un invité discret. Ses collègues, eux, ont beaucoup de choses à dire sur un homme qui abandonne un poste si sûr. Pendant une semaine, il sourit et il supporte les questions. Et le dernier soir, quelqu'un l'attend en bas avec une surprise.","text":s3_text,"vocab":s3_vocab,"arcType":"harmonic-close"},
]
json.dump(data,open("/Users/alejandrodelcarpio/digital-polyglot-library/scripts/_frB1/t1.json","w"),ensure_ascii=False,indent=1)
for d in data:
    print(d["title"], len(d["title"]), "palabras", len(d["text"].split()), "vocab", len(d["vocab"]), "anchors", sum(1 for x in d["vocab"] if x.get("anchor")))
    for x in d["vocab"]:
        if x["surface"] not in d["text"]: print("  NO EN TEXTO:", x["surface"])
