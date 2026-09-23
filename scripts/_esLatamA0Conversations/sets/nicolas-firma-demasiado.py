import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "nicolas-firma-demasiado"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el apellido", "a surname"), ("el papel", "paper"), ("el felpudo", "a doormat"), ("el vecino", "a neighbour")]),
 F("saca", "Nicolás _____ la caja de abajo.",
   ["recuerda", "cabe", "firma"],
   "Nicolas _____ the box at the bottom.",
   ["pulls out", "remembers", "fits", "signs"]),
 F("recuerdo", "Un momento. Ahora _____.",
   ["saco", "quepo", "firmo"],
   "Hold on. Now I _____.",
   ["remember", "pull out", "fit", "sign"]),
 F("cabe", "Hoy su casa está llena de cajas ajenas. Él ya no _____.",
   ["recuerda", "saca", "firma"],
   "Today his flat is full of other people's boxes. He no longer _____.",
   ["fits", "remembers", "pulls out", "signs"]),
 M("llena", "Hoy su casa está [[llena]] de cajas ajenas.", "full", ["dark", "open", "tidy"]),
 M("ajenas", "Hoy su casa está llena de cajas [[ajenas]].", "belonging to other people", ["ready to post", "left over", "half empty"]),
 M("juntas", "Hay once cajas [[juntas]].", "stacked together", ["missing", "unopened", "identical"]),
 M("doblado", "Encima hay un papel [[doblado]].", "folded", ["torn", "damp", "printed"]),
 M("Encima", "[[Encima]] hay un papel doblado.", "on top", ["nearby", "beneath", "at the back"]),
 M("paciencia", "Entonces el felpudo tiene [[paciencia]].", "patience", ["company", "dust", "competition"]),
 # pool
 M("once", "Hay [[once]] cajas juntas.", "eleven", ["seven", "twenty", "fifteen"]),
 M("Hoy", "[[Hoy]] su casa está llena de cajas ajenas.", "today", ["lately", "again", "by now"]),
 M("casi nunca", "Yo [[casi nunca]] salgo.", "almost never", ["quite often", "only at night", "on foot"]),
 M("en voz alta", "Mariana lo lee [[en voz alta]].", "out loud", ["straight away", "to herself", "one more time"]),
 M("bienvenido", "Dice [[bienvenido]].", "welcome", ["private", "fragile", "handle with care"]),
 M("delante", "Ponlo [[delante]] de tu puerta.", "in front", ["to one side", "just inside", "underneath"]),
 M("salgo", "Yo casi nunca [[salgo]].", "I go out", ["I complain", "I refuse", "I answer"]),
]
m.escribe(m.SLUG, ejercicios)
