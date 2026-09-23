import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "ahora-soy-mas-gordo"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el dibujo", "a drawing"), ("la cuerda", "a washing line"), ("el balcón", "a balcony"), ("la silla", "a chair")]),
 F("contesta", "La nota está en la escalera desde el lunes. Nadie _____.",
   ["conoce", "dobla", "vuela"],
   "The note has been on the stairs since Monday. Nobody _____.",
   ["answers", "knows", "folds", "flies"]),
 M("conozco", "Yo [[conozco]] esta camiseta. Ahora recuerdo.", "I know", ["I want", "I washed", "I lost"]),
 F("Se sienta", "El gato sube a la silla. _____ encima.",
   ["Contesta", "Conoce", "Cree"],
   "The cat climbs onto the chair. It _____ on top.",
   ["sits down", "answers", "knows", "thinks"]),
 M("tercero", "¿Es de la señora del [[tercero]]?", "the third floor", ["the back flat", "the shop", "the next street"]),
 M("niño", "Esta camiseta es de [[niño]].", "a child", ["a workman", "a stranger", "a guest"]),
 M("atrás", "Tiene mi nombre [[atrás]].", "on the back", ["in ink", "in a corner", "twice over"]),
 M("Creo", "[[Creo]] que es mía.", "I think", ["I hope", "I doubt", "I insist"]),
 M("señora", "¿Es de la [[señora]] del tercero?", "the lady", ["the caretaker", "the owner", "the visitor"]),
 M("lunes", "La nota está en la escalera desde el [[lunes]].", "Monday", ["Friday", "Easter", "the summer"]),
 # pool
 M("Yo también", "[[Yo también]] tiendo ropa.", "me too", ["every week", "of course", "back then"]),
 M("me da vergüenza", "Porque el barco [[me da vergüenza]].", "makes me feel ashamed", ["makes me laugh", "reminds me of home", "is not mine"]),
 M("queda bien", "Al gato le [[queda bien]].", "it looks good on him", ["it belongs to him", "it bothers him", "it is too small for him"]),
 M("otra vez", "Miro el dibujo [[otra vez]].", "again", ["closely", "at last", "in the light"]),
 M("hace tres años", "Es de [[hace tres años]].", "from three years ago", ["from last winter", "from my school days", "from before the move"]),
 M("pequeña", "Después mira la camiseta [[pequeña]].", "small", ["faded", "folded", "damp"]),
 M("años", "Es de hace tres [[años]].", "years", ["sizes", "washes", "summers"]),
]
m.escribe(m.SLUG, ejercicios)
