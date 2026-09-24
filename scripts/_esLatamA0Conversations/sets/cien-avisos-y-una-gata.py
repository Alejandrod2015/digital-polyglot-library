import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "cien-avisos-y-una-gata"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el mensaje", "a message"), ("el grupo", "a group chat"), ("la lista", "a list"), ("el aviso", "a notice")]),
 F("tiembla", "Mi celular _____ toda la tarde.",
   ["revisa", "responde", "manda"],
   "My phone _____ all afternoon.",
   ["buzzes", "goes through", "answers", "sends"]),
 F("revisan", "Mariana y Nicolás _____ la lista juntos.",
   ["tiemblan", "responden", "mandan"],
   "Mariana and Nicolas _____ the list together.",
   ["go through", "shake", "answer", "send"]),
 M("responde", "Nadie [[responde]]. Nadie lo lee.", "answers", ["complains", "notices", "objects"]),
 M("cien", "En una tarde suenan [[cien]] avisos.", "a hundred", ["a dozen", "a thousand", "a handful of"]),
 M("mando", "Yo [[mando]] dos.", "I sent", ["I saw", "I deleted", "I saved"]),
 M("tarde", "En una [[tarde]] suenan cien avisos.", "afternoon", ["message", "meeting", "minute"]),
 M("lee", "Nadie lo [[lee]].", "reads", ["forwards", "believes", "needs"]),
 M("ven", "Todos [[ven]] a la gata.", "look at", ["feed", "know", "photograph"]),
 M("se mueve", "La gata no [[se mueve]].", "moves", ["wakes up", "cares", "minds"]),
 # pool
 M("toda la tarde", "Mi celular tiembla [[toda la tarde]].", "all afternoon", ["every Sunday", "once or twice", "since lunch"]),
 M("a las ocho", "Yo apago el sonido [[a las ocho]].", "at eight o'clock", ["after supper", "at bedtime", "every evening"]),
 M("Entre foto y foto", "[[Entre foto y foto]] hay un aviso corto.", "between one photo and the next", ["under every photo", "instead of a photo", "before the photos"]),
 M("juntos", "Mariana y Nicolás revisan la lista [[juntos]].", "together", ["twice over", "in turn", "out loud"]),
 M("sin parar", "Tu grupo suena [[sin parar]].", "without stopping", ["from downstairs", "at all hours", "in the night"]),
 M("ahora mismo", "Yo mando el aviso [[ahora mismo]].", "right now", ["once more", "in the morning", "by hand"]),
 M("todo el edificio", "Así lo lee [[todo el edificio]].", "the whole building", ["the whole street", "half the group", "everyone upstairs"]),
]
m.escribe(m.SLUG, ejercicios)
