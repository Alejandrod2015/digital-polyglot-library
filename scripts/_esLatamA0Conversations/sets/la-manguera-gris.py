import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "la-manguera-gris"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la manguera", "a hose"), ("la lavadora", "a washing machine"), ("la linterna", "a torch"), ("el postre", "dessert")]),
 F("apunta", "Después _____ con la linterna a una manguera gris.",
   ["llega", "acepta", "trae"],
   "Then he _____ the torch at a grey hose.",
   ["points", "arrives", "accepts", "brings"]),
 F("llega", "El plomero _____ y abre el techo.",
   ["apunta", "acepta", "dobla"],
   "The plumber _____ and opens up the ceiling.",
   ["arrives", "points", "accepts", "folds"]),
 F("traes", "Con una condición: el postre lo _____ tú.",
   ["apuntas", "llegas", "abres"],
   "On one condition: you _____ the dessert.",
   ["bring", "point", "arrive", "open"]),
 M("abre", "El plomero llega y [[abre]] el techo.", "opens up", ["paints", "measures", "knocks on"]),
 M("roto", "¿Está [[roto]] el tubo?", "broken", ["blocked", "hidden", "heavy"]),
 M("se va", "Después [[se va]].", "he leaves", ["he waits", "he sits down", "he explains"]),
 M("Acepto", "¿Comida el sábado? [[Acepto]].", "I accept", ["I refuse", "I doubt it", "I forgot"]),
 M("apagada", "¿Y la lavadora [[apagada]]?", "switched off", ["brand new", "half full", "repaired"]),
 M("encerrado", "Y el gato, [[encerrado]] en mi cuarto.", "shut in", ["asleep", "fed", "forgotten"]),
 # pool
 M("Lo siento", "[[Lo siento]] mucho, Nicolás.", "I am sorry", ["I am sure", "I agree", "I noticed"]),
 M("caja de herramientas", "El plomero cierra su [[caja de herramientas]].", "toolbox", ["lunchbox", "notebook", "ladder"]),
 M("llevo", "Entonces [[llevo]] el postre.", "I will bring", ["I will bake", "I will skip", "I will choose"]),
 M("Tiene que ser", "[[Tiene que ser]] el tubo.", "it must be", ["it might be", "it is never", "it used to be"]),
 M("mucho", "Lo siento [[mucho]], Nicolás.", "a lot", ["a little", "as well", "again"]),
 M("Una semana de", "[[Una semana de]] baldes por una manguera.", "a whole week of", ["a quiet night of", "a couple of", "a good reason for"]),
 M("condición", "Con una [[condición]]: el postre lo traes tú.", "condition", ["decision", "apology", "promise"]),
]
m.escribe(m.SLUG, ejercicios)
