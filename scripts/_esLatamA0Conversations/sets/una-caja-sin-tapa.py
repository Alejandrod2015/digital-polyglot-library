import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "una-caja-sin-tapa"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la tapa", "a lid"), ("el cartero", "a postman"), ("el ladrón", "a thief"), ("el sello", "a stamp")]),
 F("roba", "Él no _____ nada. Yo lo conozco.",
   ["salta", "viaja", "gana"],
   "He does not _____ anything. I know him.",
   ["steal", "jump", "travel", "gain"]),
 F("salta", "Ella _____ hacia atrás.",
   ["roba", "viaja", "gana"],
   "She _____ backwards.",
   ["jumps", "steals", "travels", "gains"]),
 F("gana", "Al contrario. La caja _____ un gato.",
   ["roba", "salta", "asusta"],
   "On the contrary. The box _____ a cat.",
   ["gains", "steals", "jumps", "scares"]),
 M("fondo", "El [[fondo]] está roto.", "bottom", ["label", "corner", "handle"]),
 M("vacía", "Está abierta y [[vacía]].", "empty", ["soaked", "sealed", "upside down"]),
 M("suelo", "La tapa está suelta en el [[suelo]].", "ground", ["shelf", "step", "landing"]),
 M("suelta", "La tapa está [[suelta]] en el suelo.", "loose", ["missing", "cracked", "heavy"]),
 M("asustas", "¿Te [[asustas]]?", "are you scared", ["are you hurt", "are you sure", "are you joking"]),
 M("viaja", "Pues este paquete [[viaja]] gratis.", "travels", ["weighs", "arrives", "returns"]),
 # pool
 M("martes", "Una caja abierta llega el [[martes]].", "Tuesday", ["Sunday", "Thursday", "Saturday"]),
 M("rápido", "Nicolás sube [[rápido]] por la escalera.", "fast", ["quietly", "again", "behind her"]),
 M("blando", "Algo [[blando]] se mueve dentro.", "soft", ["small", "warm", "wet"]),
 M("hacia atrás", "Ella salta [[hacia atrás]].", "backwards", ["to one side", "off the step", "into the hall"]),
 M("gratis", "Pues este paquete viaja [[gratis]].", "free of charge", ["overnight", "by mistake", "without a lid"]),
 M("duerme", "Es un gatito, y [[duerme]].", "he is asleep", ["he is grey", "he is tiny", "he is hidden"]),
 M("Al contrario", "[[Al contrario]].", "on the contrary", ["in any case", "for once", "after all"]),
]
m.escribe(m.SLUG, ejercicios)
