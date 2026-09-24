import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "nunca-tuve-un-barco"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la terraza", "a roof terrace"), ("el viento", "the wind"), ("la ropa", "clothes"), ("el barco", "a boat")]),
 M("tiende", "En la terraza, Mariana [[tiende]] su ropa.", "hangs out to dry", ["takes in", "sorts out", "counts"]),
 F("vuela", "Una camiseta blanca _____.",
   ["tiende", "dobla", "huele"],
   "A white t-shirt _____.",
   ["flies off", "hangs out", "folds", "smells"]),
 M("dobla", "Nicolás [[dobla]] la camiseta. La deja limpia en una silla.", "folds", ["shakes out", "hands over", "hangs up"]),
 M("blanca", "Una camiseta [[blanca]] vuela.", "white", ["torn", "striped", "borrowed"]),
 M("negra", "Mi ropa es [[negra]] o gris.", "black", ["thick", "plain", "cheap"]),
 M("deja", "La [[deja]] limpia en una silla.", "he leaves it", ["he washes it", "he hides it", "he throws it"]),
 M("limpia", "La deja [[limpia]] en una silla.", "clean", ["folded", "damp", "warm"]),
 M("olor", "Pero huele a balde viejo. Y el [[olor]] viene de tu gato.", "smell", ["stain", "noise", "water"]),
 M("sigue", "El viento [[sigue]] fuerte en la terraza.", "keeps on being", ["turns", "dies down", "starts"]),
 # pool
 M("Ya voy", "[[Ya voy]].", "I am coming", ["I am done", "I am busy", "I am home"]),
 M("seguro", "Es mía, [[seguro]].", "surely", ["almost", "at last", "perhaps"]),
 M("se la lleva", "El viento [[se la lleva]].", "is carrying it away", ["is drying it out", "is tearing it up", "is blowing it open"]),
 M("Ya está", "[[Ya está]].", "there you go", ["hold on", "watch out", "come back"]),
 M("Hace viento", "[[Hace viento]].", "it is windy", ["it is raining", "it is late", "it is cold"]),
 M("tuve", "Yo nunca [[tuve]] un barco.", "I had", ["I wanted", "I drew", "I saw"]),
 M("Un momento", "[[Un momento]].", "hold on a second", ["right away", "once again", "over here"]),
]
m.escribe(m.SLUG, ejercicios)
