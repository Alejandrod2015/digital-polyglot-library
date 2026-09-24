import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "yo-no-le-doy-nada"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la escalera", "the stairs"), ("el pollo", "chicken"), ("la nota", "a note"), ("el cuello", "the neck")]),
 F("huele", "Tu cocina _____ a pollo todas las noches.",
   ["pelea", "toca", "busca"],
   "Your kitchen _____ of chicken every night.",
   ["smells", "argues", "touches", "looks for"]),
 F("peleamos", "Y nosotros _____ por nada.",
   ["olemos", "tocamos", "damos"],
   "And we _____ over nothing.",
   ["argue", "smell", "touch", "give"]),
 F("toca", "Entonces Nicolás _____ el cuello del gato.",
   ["pesa", "pelea", "dice"],
   "Then Nicolas _____ the cat's neck.",
   ["touches", "weighs", "argues", "says"]),
 M("serios", "Los dos están muy [[serios]].", "serious", ["curious", "tired", "hungry"]),
 M("das", "¿Tú le [[das]] comida a Luna?", "do you give", ["do you buy", "do you take", "do you find"]),
 M("comida", "¿Tú le das [[comida]] a Luna?", "food", ["water", "a name", "a home"]),
 M("toma", "Solo [[toma]] agua.", "drinks", ["carries", "looks for", "spills"]),
 M("Dice", "[[Dice]]: Me llamo Rey.", "it says", ["it asks", "it hides", "it counts"]),
 M("azul", "Ceno en la casa [[azul]].", "blue", ["green", "quiet", "empty"]),
 # pool
 M("solo", "Tigre come [[solo]] por la mañana.", "only", ["never", "slowly", "again"]),
 M("pequeño", "Hay un papel [[pequeño]] en el collar.", "small", ["wet", "yellow", "torn"]),
 M("Rey", "Me llamo [[Rey]].", "King", ["Neighbour", "Shadow", "Sunday"]),
 M("de enfrente", "La casa azul es la casa [[de enfrente]].", "across the street", ["next door", "upstairs", "at the corner"]),
 M("cocina", "Tu [[cocina]] huele a pollo todas las noches.", "kitchen", ["balcony", "bedroom", "hallway"]),
 M("por nada", "Y nosotros peleamos [[por nada]].", "over nothing", ["out loud", "every day", "on purpose"]),
 M("Me llamo", "[[Me llamo]] Rey.", "my name is", ["I live in", "I come from", "I look like"]),
]
m.escribe(m.SLUG, ejercicios)
