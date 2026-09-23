import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "seis-calcetines-solos"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la cuchara", "a spoon"), ("el guante", "a glove"), ("la pierna", "a leg"), ("la pareja", "a matching pair")]),
 F("caminan", "Cuatro gatitos _____ y corren por la casa.",
   ["faltan", "quieren", "buscan"],
   "Four kittens _____ and run around the flat.",
   ["walk", "are missing", "want", "look for"]),
 M("falta", "[[Falta]] un sitio, Mariana. La caja de los gatitos.", "there is one place left", ["there is no room", "there is one too many", "there is a better one"]),
 M("quiere", "¿Para qué [[quiere]] una cuchara?", "does it want", ["does it hide", "does it need", "does it carry"]),
 M("Ningún", "[[Ningún]] calcetín tiene pareja.", "not one", ["almost every", "the last", "another"]),
 M("escondidas", "Aquí están las seis, juntas y [[escondidas]].", "hidden", ["damp", "ruined", "counted"]),
 M("busca", "Mariana [[busca]] debajo de la cama.", "looks", ["sweeps", "reaches", "kneels"]),
 M("izquierdo", "Todos del pie [[izquierdo]].", "left", ["bare", "same", "small"]),
 M("sábado", "Ellos también quieren [[sábado]].", "Saturday", ["Sunday", "Monday", "Friday"]),
 M("seis", "A mí me faltan [[seis]].", "six", ["two", "nine", "twenty"]),
 # pool
 M("me faltan", "A mí [[me faltan]] seis.", "I am missing", ["I found", "I washed", "I counted"]),
 M("Aquí están", "[[Aquí están]] las seis, juntas y escondidas.", "here they are", ["there they go", "that is all", "so it seems"]),
 M("cuatro patas", "Alguien pequeño, con [[cuatro patas]].", "four paws", ["four fingers", "four buttons", "four names"]),
 M("dentro", "Y [[dentro]] del balde.", "inside", ["beside", "beneath", "around"]),
 M("detrás", "Después miran [[detrás]] de la puerta.", "behind", ["beside", "beneath", "through"]),
 M("conmigo", "Y mis calcetines vuelven [[conmigo]].", "with me", ["for me", "to me", "like me"]),
 M("también", "Ellos [[también]] quieren sábado.", "too", ["only", "still", "already"]),
]
m.escribe(m.SLUG, ejercicios)
