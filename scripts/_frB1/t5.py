from comun import v,dump
T="dating-and-romance"
s1="""Sur la Grand-Place, sous les lumières de la Vieille Bourse, Aurélien attendait son premier rendez-vous depuis deux ans. Il avait rencontré Marion sur une appli de rencontre, et il ne tenait pas en place.

Marion est une infirmière de nuit au CHU, et elle est arrivée en courant. “Désolée pour le retard, ma garde a fini tard. Alors, tu fais quoi dans la vie?” a demandé Marion.

Aurélien a hésité: un associé d'atelier qui n'avait pas un sou, ça lui semblait peu séduisant. Aurélien a menti, sûr de lui: “Je suis expert-comptable, dans un grand cabinet du centre.”

“Les chiffres? Moi, je suis nulle en maths!” a ri Marion, impressionnée. Ils ont parlé deux heures. Aurélien a évité soigneusement les questions sur son travail, et il a gardé pour lui la vérité.

“J'aimerais te revoir. Samedi soir, ça te dit?” lui a proposé Marion. Aurélien a dit oui trop vite, le cœur léger et un mensonge sur la conscience."""
v1=[
 v("la Vieille Bourse","Vieille Bourse","noun","a famous old building with a courtyard on the main square of Lille",True,"cultural"),
 v("le premier rendez-vous","premier rendez-vous","noun","the first time two people meet to see if they like each other",True),
 v("l'appli de rencontre","appli de rencontre","noun","a phone application for meeting people who want to date",True),
 v("tenir en place","tenait pas en place","expression","to stay calm and still; with ne pas, to be too nervous"),
 v("l'infirmière","infirmière","noun","a woman who takes care of sick people in a hospital"),
 v("le CHU","CHU","noun","a big university hospital in a French city",True,"cultural"),
 v("la garde","garde","noun","a long period of work at night or at weekends in a hospital",True),
 v("tu fais quoi dans la vie","tu fais quoi dans la vie","expression","what is your job, asked in a friendly and informal way"),
 v("séduisant","séduisant","adjective","attractive, in a way that makes other people interested in you"),
 v("mentir","menti","verb","to say something that you know is not true"),
 v("être nul en","nulle en","expression","to be very bad at a school subject or an activity",register="colloquial"),
 v("impressionné","impressionnée","adjective","feeling admiration because someone seems important or very good"),
 v("éviter","évité","verb","to stay away from something because you do not want it"),
 v("soigneusement","soigneusement","adverb","very carefully, paying attention to every little detail"),
 v("j'aimerais","J'aimerais","expression","I would like, a polite way to say what you want"),
 v("ça te dit","ça te dit","expression","would you like that, a friendly way to invite someone"),
 v("trop vite","trop vite","expression","too quickly, before thinking about it for long enough"),
 v("le cœur léger","le cœur léger","expression","feeling happy and free, without any worry in your mind"),
 v("le mensonge","mensonge","noun","something that you say and that you know is not true"),
 v("avoir sur la conscience","sur la conscience","expression","to feel guilty because of something bad you did"),
]
s2="""Deux jours plus tard, Aurélien s'est rendu compte de son erreur. Il avait promis à Élodie de monter les étagères de l'atelier le même samedi soir. Son idée: être à la fois à l'atelier et au restaurant.

Alors il a inventé une excuse bidon. “Je suis malade comme un chien, je ne viendrai pas ce soir, désolé”, prétendait-il d'une voix faible.

“Tant pis. Je les monterai toute seule, et tu me devras une bière, deux même”, lui a répondu Élodie dans la minute.

Au restaurant, Marion racontait sa nuit aux urgences, et Aurélien avait la tête ailleurs. Il pensait aux vis, à l'escabeau trop haut, à Élodie seule dans l'atelier.

À minuit, il a reçu une photo: trois étagères bien droites. Sur la photo, on voyait aussi le pouce d'Élodie, entouré d'un pansement. “Mission accomplie. J'espère que tu vas mieux, mon pauvre, et que tu dors bien”, avait écrit Élodie.

Aurélien s'est senti coupable. Le dessert, pourtant délicieux, lui a paru sans goût."""
v2=[
 v("se rendre compte","s'est rendu compte","expression","to suddenly understand something that you did not see before"),
 v("promettre","promis","verb","to say that you will surely do something for someone"),
 v("à la fois","à la fois","expression","at the same time, in two places or ways together"),
 v("inventer","inventé","verb","to create a story or a reason that is not true"),
 v("bidon","bidon","adjective","fake, not real or not serious at all",register="colloquial"),
 v("malade comme un chien","malade comme un chien","expression","very ill, feeling really bad in your body",register="colloquial"),
 v("faible","faible","adjective","without much strength or energy, like a quiet tired voice"),
 v("devoir","devras","verb","to owe something to someone, like money or a favour"),
 v("les urgences","urgences","noun","the part of a hospital for patients who need help immediately",True),
 v("avoir la tête ailleurs","la tête ailleurs","expression","to think about something else and not listen to what happens"),
 v("la vis","vis","noun","a small pointed metal piece that you turn to fix wood",True),
 v("l'escabeau","escabeau","noun","a small folding ladder that you use inside a house",True),
 v("droit","droites","adjective","straight, not bending to one side or the other"),
 v("le pouce","pouce","noun","the short thick finger on the side of your hand"),
 v("entouré","entouré","adjective","with something all around it, covering it completely"),
 v("le pansement","pansement","noun","a piece of material that you put on a cut or wound",True),
 v("mission accomplie","Mission accomplie","expression","the job is done, said with humour when you finish something"),
 v("mon pauvre","mon pauvre","expression","poor you, said with a little pity or with irony"),
 v("délicieux","délicieux","adjective","very good to eat, with a very nice taste"),
 v("sans goût","sans goût","expression","with no taste at all, like water or cardboard"),
]
s3="""“Il faut que je te dise la vérité. Je ne suis plus comptable: je répare des vélos à Fives”, a avoué Aurélien, un dimanche matin, dans l'odeur de café de la cafétéria.

Marion a tourné son gobelet entre ses doigts. Elle sortait d'une garde de douze heures, les yeux cernés. “Le vélo, je m'en fiche. C'est le mensonge qui me gêne”, lui a répondu Marion sans détour.

Elle lui a expliqué qu'elle passait ses nuits avec des gens qui mentaient sur leurs symptômes. Elle n'avait plus la force d'en entendre ailleurs.

Marion a conclu: “On en reste là, d'accord? Tu es gentil, mais je ne veux pas commencer comme ça.” Aurélien n'a rien répondu, la gorge serrée. Il n'a pas insisté.

Il a traversé Lille à vélo, sous une pluie fine, jusqu'à Fives. À l'atelier, il a tout raconté à Élodie, sans chercher d'excuses. Son amie a écouté jusqu'au bout. Puis elle lui a tendu une clé à molette, sans rien dire."""
v3=[
 v("avouer","avoué","verb","to say something true that you did not want to tell before"),
 v("la cafétéria","cafétéria","noun","a simple restaurant inside a hospital, a school or an office",True),
 v("cerné","cernés","adjective","with dark circles under the eyes because you are very tired"),
 v("gêner","gêne","verb","to make someone feel uncomfortable, annoyed or not at ease"),
 v("sans détour","sans détour","expression","in a direct way, without trying to hide what you mean"),
 v("passer ses nuits","passait ses nuits","expression","to spend all your nights doing something, often work"),
 v("les symptômes","symptômes","noun","the signs in your body that show you are ill",True),
 v("la force","force","noun","the energy that you need to continue doing something hard"),
 v("en rester là","en reste là","expression","to stop something now and not continue it"),
 v("gentil","gentil","adjective","kind and nice to other people, but sometimes not more"),
 v("conclure","conclu","verb","to say the last words that end a conversation"),
 v("la gorge serrée","la gorge serrée","expression","with a tight throat because you want to cry or feel emotion"),
 v("traverser","traversé","verb","to go from one side of a place to the other side"),
 v("fin","fine","adjective","for rain, made of very small and light drops"),
 v("chercher des excuses","chercher d'excuses","expression","to try to find reasons to make a mistake look less bad"),
 v("écouter","écouté","verb","to pay attention to what a person is saying"),
 v("tendre","tendu","verb","to hold something out towards a person so they can take it"),
 v("la clé à molette","clé à molette","noun","an adjustable metal tool used to turn nuts and bolts",True),
 v("commencer","commencer","verb","to start something, like a job or a relationship"),
 v("raconter","raconté","verb","to tell someone what happened, from the beginning to the end"),
]
data=[
 {"topic":T,"slotIndex":0,"title":"Rendez-vous sous la Bourse","synopsis":"Pour la première fois depuis longtemps, Aurélien a un rendez-vous, et la femme qu'il rencontre lui plaît tout de suite. Mais quand elle lui demande ce qu'il fait dans la vie, sa nouvelle vie d'atelier lui paraît soudain trop petite. La réponse qu'il donne va l'aider ce soir, et le suivre ensuite.","text":s1,"vocab":v1,"arcType":"juxtaposition-discovery"},
 {"topic":T,"slotIndex":1,"title":"Samedi, deux promesses","synopsis":"Aurélien a promis deux choses pour le même samedi soir, et il ne peut pas être partout. Plutôt que de choisir franchement, il invente une excuse et laisse quelqu'un se débrouiller sans lui. Le dîner est parfait sur le papier, mais une photo reçue à minuit en gâche le goût.","text":s2,"vocab":v2,"arcType":"reframe-turn"},
 {"topic":T,"slotIndex":2,"title":"Une vérité trop tard","synopsis":"Aurélien ne supporte plus son mensonge, et il décide de dire enfin la vérité à la femme qu'il voit depuis quelques semaines. Il espère qu'elle comprendra, parce que son métier n'a rien de honteux. Mais pour elle, le problème n'est pas du tout celui qu'il imagine, et la conversation se termine autrement.","text":s3,"vocab":v3,"arcType":"harmonic-close"},
]
dump("/Users/alejandrodelcarpio/digital-polyglot-library/scripts/_frB1/t5.json",data)
