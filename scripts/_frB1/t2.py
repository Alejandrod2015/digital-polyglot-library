from comun import v,dump
T="advice-and-opinions"
s1="""Chez Guillaume, à Roubaix, la carbonnade mijotait dans une odeur de bière. Le grand frère d'Aurélien s'appelle Guillaume, et il est agent immobilier. Au dessert, Aurélien a parlé de l'atelier qu'il voulait ouvrir avec Élodie.

Guillaume a pointé sa fourchette vers lui, sûr de lui. “À ta place, je garderais ton CDI. Un comptable et une mécanicienne, ça ne fait pas une entreprise”, lui a dit Guillaume. Aurélien a serré les dents.

“Je ne te demande pas de conseils. Je voulais que tu sois content”, a murmuré Aurélien. Guillaume se mêlait de tout et lui coupait la parole. “Il vaut mieux réfléchir avant, crois-moi”, répétait Guillaume.

Aurélien a fixé la tarte au sucre. “C'est trop tard. J'ai démissionné il y a trois semaines.” Guillaume est devenu tout rouge, blessé dans son orgueil. “Et ton frère l'apprend au dessert?” a lancé Guillaume.

Aurélien est parti avant le café, sans claquer la porte et sans se réconcilier. Il en voulait à Guillaume, et à lui-même d'avoir été têtu."""
v1=[
 v("la carbonnade","carbonnade","noun","a northern French beef stew cooked slowly with beer and onions",True,"cultural"),
 v("mijoter","mijotait","verb","to cook slowly for a long time on a low heat"),
 v("le grand frère","grand frère","noun","your brother who is older than you in the family"),
 v("l'agent immobilier","agent immobilier","noun","a person whose job is to sell or rent houses and shops",True),
 v("sûr de soi","sûr de lui","expression","very confident, sure that you are right about everything"),
 v("à ta place","À ta place","expression","if I were you, used when you give someone advice"),
 v("serrer les dents","serré les dents","expression","to stay quiet and patient when you are angry or hurt"),
 v("le conseil","conseils","noun","an idea you give someone about what they should do"),
 v("se mêler de","se mêlait de","expression","to take part in something that is not your business"),
 v("couper la parole","coupait la parole","expression","to start talking while another person is still speaking"),
 v("il vaut mieux","Il vaut mieux","expression","it is better, the wiser thing to do is"),
 v("crois-moi","crois-moi","expression","believe me, said to make someone trust what you say"),
 v("la tarte au sucre","tarte au sucre","noun","a sweet flat cake with brown sugar, typical of the north",True,"cultural"),
 v("devenir tout rouge","devenu tout rouge","expression","when your face turns red because you feel angry or ashamed"),
 v("blessé","blessé","adjective","hurt inside because of something that someone said or did"),
 v("l'orgueil","orgueil","noun","the strong feeling that you are important and must be respected"),
 v("claquer la porte","claquer la porte","expression","to close a door very hard because you are angry"),
 v("se réconcilier","se réconcilier","verb","to become friends again after an argument or a problem"),
 v("en vouloir à","en voulait à","expression","to stay angry with someone because of what they did"),
 v("têtu","têtu","adjective","not ready to change your idea, even when others disagree"),
]
s2="""Le mardi suivant, Guillaume a rappelé comme si de rien n'était. Il avait du flair, et il avait trouvé un local dans le Vieux-Lille, avec une vitrine et un loyer abordable. “Viens le voir avant de signer pour Fives”, lui a proposé Guillaume.

Dans le froid, les passants grelottaient dans leurs manteaux chics. “L'emplacement est parfait. Tu auras des clients qui paient sans discuter”, expliquait Guillaume. Aurélien était presque convaincu.

Pourtant, la veille, Élodie lui avait dit que dans le Vieux-Lille, les gens ne réparaient pas leurs vélos: ils en achetaient des neufs. “Élodie n'y connaît rien en affaires”, a tranché Guillaume.

Aurélien a senti la moutarde lui monter au nez, mais son frère voulait l'aider, alors il a respiré lentement. Puis il a répondu: “Je préfère Fives. Les ouvriers ont besoin de vélos qui marchent.”

“Tu préfères l'avis de ta copine. Très bien!” a lâché Guillaume. Le surlendemain, un fleuriste a pris la boutique du Vieux-Lille, et Guillaume n'a plus appelé de la semaine."""
v2=[
 v("comme si de rien n'était","comme si de rien n'était","expression","as if nothing had happened, in a normal and calm way"),
 v("avoir du flair","avait du flair","expression","to be naturally good at finding good things or chances"),
 v("le Vieux-Lille","Vieux-Lille","noun","the old and expensive historic centre of the city of Lille",True,"cultural"),
 v("abordable","abordable","adjective","not too expensive, at a price that people can pay"),
 v("grelotter","grelottaient","verb","to shake with small movements of the body because you are cold"),
 v("le passant","passants","noun","a person who is walking past in the street"),
 v("chic","chics","adjective","elegant and expensive, in a style that shows money"),
 v("l'emplacement","emplacement","noun","the exact place where a shop or a building is",True),
 v("sans discuter","sans discuter","expression","without saying no or asking questions about it"),
 v("convaincre","convaincu","verb","to make someone believe that an idea is right"),
 v("la veille","la veille","noun","the day before a particular day or event"),
 v("s'y connaître","n'y connaît rien","expression","to know a lot about a subject; with rien, to know nothing"),
 v("trancher","tranché","verb","to give a final opinion quickly, in a hard voice"),
 v("la moutarde monte au nez","la moutarde lui monter au nez","expression","to start to feel angry, little by little",register="colloquial"),
 v("respirer","respiré","verb","to take air in and out, often slowly to stay calm"),
 v("l'ouvrier","ouvriers","noun","a person who works with their hands in a factory"),
 v("l'avis","avis","noun","what a person thinks about something, their opinion"),
 v("lâcher","lâché","verb","to say something suddenly and coldly, without wanting to talk more"),
 v("le fleuriste","fleuriste","noun","a person who sells flowers in a shop"),
 v("de la semaine","de la semaine","expression","during the whole week, not once in seven days"),
]
s3="""Un mois avant la signature, Aurélien a ravalé sa fierté et il a appelé son frère.

“Je ne te demande pas d'être d'accord. Je voudrais juste ton avis franc sur le local.”

Sans Élodie, Guillaume est venu à Fives avec une lampe de poche. Ça sentait l'humidité. Il a tapoté les murs, il a regardé le plafond fissuré, puis il a ouvert le compteur et il a grimacé. “C'est grave?” a demandé Aurélien.

“L'installation électrique n'est pas aux normes. Avant d'ouvrir, il faut que tout soit refait”, s'est inquiété Guillaume. Aurélien avait envie de dire que son frère exagérait, mais les câbles noircis ne mentaient pas.

“D'accord. Tu avais raison, et ce n'est pas facile à dire”, a fini par admettre Aurélien. L'ouverture a été repoussée d'un mois.

Guillaume a sorti de sa poche le numéro d'un électricien et une part de tarte au sucre dans du papier alu. “Sans rancune?” a demandé Guillaume. “Sans rancune”, lui a répondu Aurélien, la bouche pleine."""
v3=[
 v("ravaler sa fierté","ravalé sa fierté","expression","to hide your pride and do something that feels humble"),
 v("être d'accord","être d'accord","expression","to have the same opinion as another person"),
 v("franc","franc","adjective","honest and direct, saying what you really think"),
 v("la lampe de poche","lampe de poche","noun","a small light with batteries that you carry in your hand"),
 v("l'humidité","humidité","noun","water in the air or in walls that makes them wet"),
 v("tapoter","tapoté","verb","to hit something lightly many times with your fingers"),
 v("fissuré","fissuré","adjective","with long thin lines where something is starting to break"),
 v("le compteur","compteur","noun","the box that measures electricity and controls the power in a building",True),
 v("grimacer","grimacé","verb","to twist your face because something looks bad or hurts"),
 v("l'installation électrique","installation électrique","noun","all the wires and parts that bring electricity into a building",True),
 v("aux normes","aux normes","expression","following the official safety rules for buildings and machines"),
 v("le câble","câbles","noun","a thick wire that carries electricity from one place to another"),
 v("noirci","noircis","adjective","made black by heat, smoke or a long time"),
 v("admettre","admettre","verb","to agree that something is true, even when you do not like it"),
 v("l'ouverture","ouverture","noun","the day when a shop or business opens for the first time"),
 v("repousser","repoussée","verb","to move an event to a later date than planned"),
 v("l'électricien","électricien","noun","a person whose job is to install and repair electrical wires"),
 v("le papier alu","papier alu","noun","thin silver metal paper used to wrap food",register="colloquial"),
 v("sans rancune","Sans rancune","expression","no hard feelings; I am not angry with you any more"),
 v("la bouche pleine","la bouche pleine","expression","with food in your mouth while you are speaking"),
]
data=[
 {"topic":T,"slotIndex":0,"title":"Des conseils pas demandés","synopsis":"Au déjeuner du dimanche, chez son grand frère à Roubaix, Aurélien veut enfin raconter son projet d'atelier. Il espère un peu d'enthousiasme. Guillaume, lui, a un avis sur tout, et il le donne sans qu'on le lui demande. Mais Aurélien a gardé un secret, et le dessert risque de mal finir.","text":s1,"vocab":v1,"arcType":"late-reveal"},
 {"topic":T,"slotIndex":1,"title":"Une vitrine trop chic","synopsis":"Guillaume a trouvé un local dans le plus beau quartier de Lille, et il est sûr que c'est la bonne affaire. Élodie pense exactement le contraire. Entre l'avis de son frère et celui de son amie, Aurélien doit choisir, et l'un des deux va forcément se sentir trahi.","text":s2,"vocab":v2,"arcType":"reframe-turn"},
 {"topic":T,"slotIndex":2,"title":"Le compteur ne ment pas","synopsis":"Aurélien a toujours détesté admettre que son grand frère avait raison. Cette fois, pourtant, il a besoin de la vérité plus que d'un compliment, et il la demande. Guillaume n'est pas du genre à mentir pour faire plaisir, et ce qu'il découvre risque de coûter à Aurélien du temps, de l'argent et un peu d'orgueil.","text":s3,"vocab":v3,"arcType":"harmonic-close"},
]
dump("/Users/alejandrodelcarpio/digital-polyglot-library/scripts/_frB1/t2.json",data)
