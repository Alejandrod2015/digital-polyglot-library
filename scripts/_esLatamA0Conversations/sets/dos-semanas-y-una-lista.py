import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "dos-semanas-y-una-lista"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la maleta", "a suitcase"), ("el llavero", "a keyring"), ("la hoja", "a sheet of paper"), ("el cepillo", "a brush")]),
 M("desdobla", "Nicolás [[desdobla]] la hoja. Cuenta veinte puntos.", "unfolds", ["signs", "tears up", "hands back"]),
 F("Riega", "_____ mis plantas.",
   ["Desdobla", "Guarda", "Espera"],
   "_____ my plants.",
   ["water", "unfold", "put away", "wait for"]),
 F("espera", "Nicolás la _____ en el felpudo.",
   ["riega", "desdobla", "guarda"],
   "Nicolas _____ her on the doormat.",
   ["waits for", "waters", "unfolds", "puts away"]),
 M("guarda", "Punto veinte: [[guarda]] el cepillo arriba.", "put away", ["rinse", "share", "replace"]),
 M("basta", "Con tres minutos [[basta]].", "is enough", ["is too long", "is the rule", "is the limit"]),
 M("encanta", "Le [[encanta]].", "she loves it", ["she allows it", "she expects it", "she ignores it"]),
 M("llora", "Uno solo [[llora]] toda la noche.", "cries", ["purrs", "wanders", "shivers"]),
 M("entera", "Nicolás lee la hoja [[entera]], de arriba abajo.", "whole", ["aloud", "twice", "slowly"]),
 M("se quejan", "Ellas no se [[quejan]].", "complain", ["wander off", "wake up", "grow fast"]),
 # pool
 M("problema", "Sin [[problema]].", "problem", ["delay", "charge", "promise"]),
 M("dos semanas", "Me voy [[dos semanas]].", "for two weeks", ["for the weekend", "until spring", "on Thursday"]),
 M("trece", "Punto [[trece]]: los gatitos duermen juntos.", "thirteen", ["thirty", "three", "twelve"]),
 M("instrucciones", "Son mis [[instrucciones]].", "instructions", ["introductions", "measurements", "reasons"]),
 M("minutos", "Con tres [[minutos]] basta.", "minutes", ["moments", "days", "tries"]),
 M("planta", "Después mira las [[plantas]] tristes del balcón.", "plants", ["plans", "curtains", "boxes"]),
 M("cada cuánto", "¿Y [[cada cuánto]] las riego?", "how often", ["how much", "how long", "how many"]),
]
m.escribe(m.SLUG, ejercicios)
