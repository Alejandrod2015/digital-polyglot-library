import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "una-caja-que-hace-ruido"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el ruido", "a noise"), ("la caja", "a box"), ("el gatito", "a kitten"), ("la gata", "a female cat")]),
 F("despacio", "Mariana abre la caja muy _____.",
   ["fácil", "abajo", "adentro"],
   "Mariana opens the box very _____.",
   ["slowly", "easy", "downstairs", "inside"]),
 F("buscan", "Los dos lo _____ por el edificio.",
   ["escuchan", "abren", "quedan"],
   "The two of them _____ him around the building.",
   ["look for", "listen to", "open", "keep"]),
 F("vieja", "Viene de la caja _____, debajo de la escalera.",
   ["fácil", "cuarta", "despacio"],
   "It comes from the _____ box, under the stairs.",
   ["old", "easy", "fourth", "slow"]),
 M("Escucha", "[[Escucha]], Nicolás.", "listen", ["wait", "look", "answer"]),
 M("abajo", "Hay un ruido [[abajo]].", "downstairs", ["outside", "next door", "far away"]),
 M("debajo de", "Viene de la caja vieja, [[debajo de]] la escalera.", "under", ["next to", "on top of", "behind"]),
 M("Adentro", "[[Adentro]] está el gato.", "inside", ["nearby", "underneath", "upstairs"]),
 M("fácil", "Es [[fácil]].", "easy", ["urgent", "strange", "expensive"]),
 M("Se queda", "[[Se queda]] con su mamá.", "he stays", ["he leaves", "he cries", "he grows"]),
 # pool
 M("Come por cinco", "[[Come por cinco]], no por uno.", "she eats for five", ["she eats at five", "she eats every five days", "she eats the fifth one"]),
 M("Y ahora", "¿[[Y ahora]]?", "and now what", ["and where", "and who", "and how much"]),
 M("cuarto", "¿Y el [[cuarto]] gatito?", "fourth", ["quiet", "grey", "lost"]),
 M("cuatro", "[[Cuatro]] gatitos y tres casas.", "four", ["seven", "twelve", "twenty"]),
 M("ninguna", "Hoy el gato no está en [[ninguna]] casa.", "not any", ["another", "the same", "his own"]),
 M("nombres", "Tiene tres [[nombres]] y no viene.", "names", ["homes", "bowls", "collars"]),
 M("Tiene", "[[Tiene]] tres nombres y no viene.", "he has", ["he wants", "he hears", "he loses"]),
]
m.escribe(m.SLUG, ejercicios)
