import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "nadie-pide-este-paquete"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el cuchillo", "a knife"), ("la etiqueta", "a label"), ("la cinta", "packing tape"), ("la entrada", "the entrance")]),
 F("firma", "Nadie _____ nada.",
   ["empuja", "pesa", "corta"],
   "Nobody _____ for anything.",
   ["signs", "pushes", "weighs", "cuts"]),
 F("empuja", "Mariana baja y lo _____ un poco.",
   ["firma", "corta", "pide"],
   "Mariana comes down and _____ it a little.",
   ["nudges", "signs", "cuts", "orders"]),
 F("corta", "Nicolás _____ la cinta con el cuchillo.",
   ["firma", "empuja", "pide"],
   "Nicolas _____ the tape with the knife.",
   ["cuts", "signs", "pushes", "orders"]),
 M("paquete", "Un [[paquete]] llega al edificio el jueves.", "parcel", ["neighbour", "letter", "lorry"]),
 M("compro", "Yo [[compro]] otra marca.", "I buy", ["I prefer", "I tried", "I ordered"]),
 M("pido", "Yo no [[pido]] nada.", "I order", ["I open", "I expect", "I owe"]),
 M("marca", "Mariana y Nicolás leen la [[marca]] en silencio.", "brand", ["warning", "weight", "date"]),
 M("pesadas", "Dentro hay doce bolsas iguales y bastante [[pesadas]].", "heavy", ["torn", "sealed", "warm"]),
 M("dirección", "Mira la [[dirección]].", "address", ["price", "postmark", "receipt"]),
 # pool
 M("jueves", "Un paquete llega al edificio el [[jueves]].", "Thursday", ["Monday", "Sunday", "Tuesday"]),
 M("un poco", "Mariana baja y lo empuja [[un poco]].", "a little", ["a lot", "a bit later", "a second time"]),
 M("A ver", "[[A ver]] qué trae.", "let us see", ["let us wait", "let us ask", "let us call"]),
 M("en silencio", "Mariana y Nicolás leen la marca [[en silencio]].", "in silence", ["in a hurry", "in turn", "in the dark"]),
 M("mejor que", "Ese gato come [[mejor que]] nosotros.", "better than", ["more often than", "as much as", "instead of"]),
 M("bolsas", "Dentro hay doce [[bolsas]] iguales y bastante pesadas.", "bags", ["tins", "boxes", "trays"]),
 M("treinta y ocho", "Nosotros somos el [[treinta y ocho]].", "thirty-eight", ["thirty-nine", "forty-eight", "twenty-eight"]),
]
m.escribe(m.SLUG, ejercicios)
