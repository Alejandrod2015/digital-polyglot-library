import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "mi-sofa-esta-mojado"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el techo", "the ceiling"), ("el charco", "a puddle"), ("la pata", "a paw"), ("el lavadero", "a laundry sink")]),
 M("lavo", "¿Mi cocina? Hoy no [[lavo]] nada.", "I am washing", ["I am cooking", "I am moving", "I am spilling"]),
 F("cae", "El agua _____, gota a gota, sobre su sofá.",
   ["lava", "pasa", "mete"],
   "The water _____, drop by drop, onto his sofa.",
   ["falls", "washes", "comes in", "puts in"]),
 F("sube", "Nicolás _____ y toca su puerta.",
   ["lava", "mete", "cae"],
   "Nicolas _____ and knocks on her door.",
   ["goes up", "washes", "puts in", "falls"]),
 M("mancha", "En el techo de Nicolás hay una [[mancha]] nueva.", "stain", ["lamp", "window", "crack"]),
 M("nueva", "En el techo de Nicolás hay una mancha [[nueva]].", "new", ["round", "dark", "small"]),
 M("mojado", "Mi sofá está [[mojado]].", "wet", ["broken", "old", "heavy"]),
 M("seco", "Está [[seco]].", "dry", ["clean", "warm", "empty"]),
 M("piso", "Mariana y Nicolás miran el [[piso]] de la cocina.", "floor", ["window", "door", "wall"]),
 M("litro", "¿Medio [[litro]] de agua para un gato?", "litre", ["metre", "hour", "step"]),
 # pool
 M("Arriba", "[[Arriba]] vive Mariana.", "upstairs", ["next door", "across the street", "at the back"]),
 M("Justo", "[[Justo]] arriba está tu cocina.", "right", ["almost", "never", "sometimes"]),
 M("pasar", "Puedes [[pasar]].", "come in", ["sit down", "wait here", "come back"]),
 M("mete", "Y [[mete]] la pata adentro todos los días.", "she puts in", ["she pulls out", "she washes", "she hides"]),
 M("Pongo", "[[Pongo]] el plato en el lavadero.", "I will put", ["I will wash", "I will fill", "I will throw away"]),
 M("gota a gota", "El agua cae, [[gota a gota]], sobre su sofá.", "drop by drop", ["all at once", "now and then", "little by little"]),
 M("por si acaso", "[[Por si acaso]].", "just in case", ["for once", "as usual", "no wonder"]),
]
m.escribe(m.SLUG, ejercicios)
