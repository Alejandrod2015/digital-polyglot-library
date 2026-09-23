import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "el-agua-esta-caliente"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el balde", "a bucket"), ("el plomero", "a plumber"), ("la gotera", "a leak"), ("el tubo", "a pipe")]),
 F("cobra", "El plomero _____ igual.",
   ["habla", "baja", "cierra"],
   "The plumber _____ the same either way.",
   ["charges", "speaks", "comes down", "closes"]),
 F("cerramos", "Y _____ la llave hasta el lunes.",
   ["hablamos", "pagamos", "bajamos"],
   "And we _____ the tap until Monday.",
   ["turn off", "speak", "pay", "come down"]),
 F("llamas", "Pero el plomero lo _____ tú.",
   ["cierras", "cobras", "bajas"],
   "But you are the one who _____ the plumber.",
   ["calls", "closes", "charges", "comes down"]),
 M("caliente", "Porque el agua está [[caliente]].", "hot", ["clean", "dark", "salty"]),
 M("tibia", "Está [[tibia]], como un café de ayer.", "warm", ["sweet", "murky", "still"]),
 M("baja", "Mariana, [[baja]] un momento.", "come down", ["wait", "listen", "look"]),
 M("paga", "¿Y quién [[paga]] un tubo?", "pays for", ["repairs", "chooses", "owns"]),
 M("habla", "Nadie [[habla]] durante un minuto largo.", "speaks", ["moves", "breathes", "leaves"]),
 M("dedo", "Mete un [[dedo]] aquí.", "finger", ["coin", "stick", "cloth"]),
 # pool
 M("tienes", "Tú [[tienes]] la gotera.", "you have", ["you fixed", "you found", "you caused"]),
 M("largo", "Nadie habla durante un minuto [[largo]].", "long", ["quiet", "final", "whole"]),
 M("igual", "El plomero cobra [[igual]].", "all the same", ["by the hour", "in advance", "too much"]),
 M("cada mañana", "El balde de Nicolás está lleno [[cada mañana]].", "every morning", ["every Monday", "twice a day", "since June"]),
 M("mitad y mitad", "Pagamos [[mitad y mitad]].", "half and half", ["right away", "in cash", "next month"]),
 M("de ayer", "Está tibia, como un café [[de ayer]].", "from yesterday", ["from a machine", "without sugar", "in a paper cup"]),
 M("quien", "Paga [[quien]] tiene la gotera.", "the one who", ["the day when", "the place where", "the reason why"]),
]
m.escribe(m.SLUG, ejercicios)
