import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "aqui-abajo-duerme-mejor"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el bolsillo", "a pocket"), ("el rascador", "a scratching post"), ("la llave", "a key"), ("el timbre", "a doorbell")]),
 F("se ríe", "Saca una llave dorada y _____.",
   ["necesita", "corre", "toca"],
   "He takes out a golden key and _____.",
   ["laughs", "needs", "runs", "rings"]),
 F("necesita", "Ella no _____ llave. Tiene la ventana.",
   ["ríe", "corre", "guarda"],
   "She does not _____ a key. She has the window.",
   ["need", "laugh", "run", "keep"]),
 F("corren", "Los gatitos _____ por toda la casa.",
   ["ríen", "necesitan", "tocan"],
   "The kittens _____ all over the flat.",
   ["run", "laugh", "need", "ring"]),
 M("dorada", "Saca una llave [[dorada]] y se ríe.", "golden", ["spare", "bent", "heavy"]),
 M("tuya", "Esta llave es [[tuya]], para siempre.", "yours", ["new", "spare", "special"]),
 M("casas", "Ya tiene dos [[casas]].", "homes", ["bowls", "beds", "names"]),
 M("todas", "Tus plantas viven. Casi [[todas]].", "all of them", ["most days", "one of them", "the big ones"]),
 M("por fin", "Mariana abre su puerta [[por fin]].", "at last", ["as always", "in a rush", "by mistake"]),
 M("en orden", "Todo está [[en orden]].", "in order", ["in the hall", "as new", "on the list"]),
 # pool
 M("en ningún lado", "No está [[en ningún lado]].", "nowhere to be found", ["out on the roof", "back in her basket", "under the sofa"]),
 M("sin hacer ruido", "Mariana y Nicolás bajan [[sin hacer ruido]].", "without making a sound", ["one after the other", "in the dark", "in a hurry"]),
 M("Yo no digo nada", "[[Yo no digo nada]].", "I am saying nothing", ["I told you so", "I do not mind", "I want it back"]),
 M("para siempre", "Esta llave es tuya, [[para siempre]].", "for good", ["for tonight", "for a while", "for the summer"]),
 M("algo para ti", "Yo también tengo [[algo para ti]].", "something for you", ["a word with you", "a favour to ask", "news from home"]),
 M("No hace falta", "[[No hace falta]].", "there is no need", ["there is no time", "that is not fair", "that is the rule"]),
 M("gracias por todo", "Nicolás, [[gracias por todo]].", "thanks for everything", ["sorry for the delay", "welcome back", "see you tomorrow"]),
]
m.escribe(m.SLUG, ejercicios)
