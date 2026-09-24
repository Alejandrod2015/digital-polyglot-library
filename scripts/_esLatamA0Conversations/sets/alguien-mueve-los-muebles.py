import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "alguien-mueve-los-muebles"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la canica", "a marble"), ("el cajón", "a drawer"), ("el mueble", "a piece of furniture"), ("el tren", "a train")]),
 M("arrastra", "Alguien [[arrastra]] muebles arriba.", "is dragging", ["is stacking", "is measuring", "is covering"]),
 F("pesa", "Esta cosa _____ dos gramos.",
   ["arrastra", "juega", "suena"],
   "This thing _____ two grams.",
   ["weighs", "drags", "plays", "sounds"]),
 F("juega", "Mi gata _____. Empuja la canica y corre.",
   ["arrastra", "pesa", "descansa"],
   "My cat _____. She pushes the marble and runs.",
   ["plays", "drags", "weighs", "rests"]),
 M("madrugada", "Son las dos de la [[madrugada]].", "the small hours", ["the afternoon", "the weekend", "the rush hour"]),
 M("suena", "Arriba [[suena]] algo pesado.", "makes a noise", ["falls over", "moves about", "gets stuck"]),
 M("Parece", "[[Parece]] un mueble grande.", "it sounds like", ["it damages", "it fills", "it blocks"]),
 M("corto", "Es seco y [[corto]].", "short", ["regular", "faint", "familiar"]),
 M("gramos", "Esta cosa pesa dos [[gramos]].", "grams", ["kilos", "coins", "seconds"]),
 M("casi", "Yo [[casi]] no duermo hoy.", "hardly", ["gladly", "finally", "usually"]),
 # pool
 M("oyes", "Nicolás, ¿tú [[oyes]] eso?", "do you hear", ["do you mind", "do you believe", "do you feel"]),
 M("de nuevo", "El golpe empieza [[de nuevo]].", "again", ["at once", "nearby", "faintly"]),
 M("cerca", "Ahí está, [[cerca]] de la puerta.", "near", ["short", "quiet", "loose"]),
 M("despierto", "Nicolás está [[despierto]].", "awake", ["annoyed", "downstairs", "dressed"]),
 M("corre", "Empuja la canica y [[corre]].", "she runs", ["she hides", "she waits", "she watches"]),
 M("todo el día", "Duerme [[todo el día]].", "all day", ["all week", "till noon", "on the sofa"]),
 M("Ni idea", "[[Ni idea]].", "no idea", ["no way", "not again", "never mind"]),
]
m.escribe(m.SLUG, ejercicios)
