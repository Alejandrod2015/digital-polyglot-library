import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "el-punto-cuatro-miente"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la cesta", "a basket bed"), ("el teléfono", "a phone"), ("el bulto", "a shape under something"), ("el punto", "a numbered line")]),
 F("se equivoca", "Tu hoja _____.",
   ["se escapa", "descansa", "vuelve"],
   "Your sheet _____.",
   ["has it wrong", "runs away", "rests", "comes back"]),
 F("Se escapa", "Mi gata no se pierde. _____.",
   ["Descansa", "Espera", "Pesa"],
   "My cat does not get lost. She _____.",
   ["sneaks out", "rests", "waits", "weighs"]),
 F("descansar", "Sube a comer. Después se va a _____.",
   ["equivocarse", "escaparse", "cerrar"],
   "She goes up to eat. Then she goes off to _____.",
   ["rest", "be wrong", "run away", "close"]),
 M("cerrada", "La ventana está [[cerrada]].", "closed", ["cracked", "painted", "new"]),
 M("abierta", "Su ventana está [[abierta]].", "open", ["wide", "broken", "small"]),
 M("sale", "La gata [[sale]] sola y vuelve sola.", "goes out", ["waits", "eats", "hides"]),
 M("vuelve", "La gata sale sola y [[vuelve]] sola.", "comes back", ["settles", "hunts", "grows"]),
 M("lado", "Tu gata no está en ningún [[lado]] desde ayer.", "anywhere", ["hurry", "danger", "mood"]),
 M("sola", "La gata sale [[sola]] y vuelve sola.", "on her own", ["at dusk", "in a hurry", "every day"]),
 # pool
 M("siguiente", "Al día [[siguiente]], Nicolás sube a casa de Mariana.", "next", ["same", "last", "third"]),
 M("desde ayer", "Tu gata no está en ningún lado [[desde ayer]].", "since yesterday", ["since June", "since noon", "since the move"]),
 M("diecisiete", "El punto [[diecisiete]] está al final.", "seventeen", ["seventy", "seven", "nineteen"]),
 M("al final", "El punto diecisiete está [[al final]].", "at the end", ["in the margin", "on the back", "at the top"]),
 M("otra cosa", "El punto diecisiete dice [[otra cosa]].", "something else", ["the same thing", "almost nothing", "too much"]),
 M("van", "Los dos puntos no [[van]] juntos.", "go", ["count", "read", "arrive"]),
 M("por dónde", "¿Y [[por dónde]] entra?", "which way", ["how often", "what time", "how far"]),
]
m.escribe(m.SLUG, ejercicios)
