import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "un-gato-con-dos-nombres"
M, F, MATCH = m.M, m.F, m.MATCH

# fill_blank SOLO donde el resto de la frase deja una unica respuesta posible
# (leido tapando la solucion). Donde dos opciones encajaban ("un gato gris
# sale por su ventana"), el ejercicio pasa a meaning_in_context.
ejercicios = [
 MATCH([("el gato", "a cat"), ("la ventana", "a window"), ("el sofá", "a sofa"), ("gris", "grey")]),
 F("entra", "Todas las noches, un gato gris _____ por su ventana.",
   ["duerme", "come", "cena"],
   "Every night a grey cat _____ in through her window.",
   ["comes in", "sleeps", "eats", "has dinner"]),
 F("cena", "Luna _____ en mi casa todas las noches.",
   ["mira", "pierde", "comparte"],
   "Luna _____ at my place every night.",
   ["has dinner", "looks", "loses", "shares"]),
 F("oye", "Mariana _____ un gato en la casa de al lado.",
   ["cena", "comparte", "pierde"],
   "Mariana _____ a cat in the house next door.",
   ["hears", "has dinner", "shares", "loses"]),
 M("viene", "Hoy el gato no [[viene]].", "comes", ["eats", "sleeps", "looks"]),
 M("vive", "Tigre [[vive]] aquí.", "lives", ["eats", "waits", "plays"]),
 M("Come", "[[Come]] aquí todos los días.", "he eats", ["he sleeps", "he plays", "he waits"]),
 M("mira", "El gato [[mira]] a Mariana.", "looks at", ["touches", "calls", "follows"]),
 M("gordo", "Está muy [[gordo]].", "fat", ["tired", "quiet", "dirty"]),
 M("perder", "Pero no quiero [[perder]] a Luna.", "to lose", ["to feed", "to call", "to carry"]),
 # pool
 M("Después", "[[Después]] mira a Nicolás.", "after that", ["before", "never", "always"]),
 M("Compartimos", "¿[[Compartimos]] el gato?", "shall we share", ["shall we sell", "shall we feed", "shall we count"]),
 M("todas las noches", "[[Todas las noches]], un gato gris entra por su ventana.", "every night", ["every morning", "once a week", "on Sundays"]),
 M("todos los días", "Come aquí [[todos los días]].", "every day", ["every month", "on Fridays", "twice a year"]),
 M("dos veces", "El gato come [[dos veces]].", "twice", ["slowly", "at night", "alone"]),
 M("Por eso", "¡[[Por eso]] está tan gordo!", "that is why", ["even so", "until then", "by the way"]),
 M("Trato hecho", "[[Trato hecho]].", "it is a deal", ["no way", "too late", "never mind"]),
]
m.escribe(m.SLUG, ejercicios)
