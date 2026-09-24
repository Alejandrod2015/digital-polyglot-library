import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "nadie-me-avisa-nada"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el despertador", "an alarm clock"), ("el biberón", "a baby bottle"), ("el maullido", "a meow"), ("la mesa", "a table")]),
 F("preparas", "¿Tú _____ la leche?",
   ["avisas", "apagas", "empiezas"],
   "Do you _____ the milk?",
   ["make up", "warn", "turn off", "begin"]),
 F("Apago", "¿_____ el despertador?",
   ["Aviso", "Preparo", "Empiezo"],
   "Shall I _____ the alarm clock?",
   ["turn off", "warn", "make up", "begin"]),
 F("levantas", "¿Entonces por qué te _____?",
   ["apagas", "preparas", "avisas"],
   "Then why do you _____?",
   ["get up", "turn off", "make up", "warn"]),
 M("fuerte", "Suena [[fuerte]].", "loud", ["early", "twice", "briefly"]),
 M("dormida", "Hoy baja medio [[dormida]] y da un bostezo.", "asleep", ["dressed", "annoyed", "barefoot"]),
 M("empieza", "¿Tu trabajo [[empieza]] tan temprano?", "starts", ["pays", "ends", "matters"]),
 M("avisa", "¿Y nadie me [[avisa]] nada?", "tells in advance", ["owes", "asks", "explains"]),
 M("tranquila", "La cocina está [[tranquila]].", "quiet", ["tidy", "dark", "warm"]),
 M("trabajo", "¿Tu [[trabajo]] empieza tan temprano?", "job", ["bus", "class", "shift"]),
 # pool
 M("leche", "¿Biberones con [[leche]]?", "milk", ["water", "juice", "soup"]),
 M("bostezo", "Hoy baja medio dormida y da un [[bostezo]].", "yawn", ["shrug", "sigh", "wave"]),
 M("a las seis", "Comen [[a las seis]].", "at six o'clock", ["in the evening", "once a day", "after me"]),
 M("como una piedra", "Tú duermes [[como una piedra]].", "like a log", ["with the light on", "in the armchair", "for ten hours"]),
 M("ya sabes", "Ahora [[ya sabes]].", "now you know", ["now you decide", "now you owe me", "now you see them"]),
 M("a tiempo", "Mañana yo doy la leche [[a tiempo]].", "on time", ["in silence", "by hand", "as well"]),
 M("temprano", "¿Tu trabajo empieza tan [[temprano]]?", "early", ["often", "suddenly", "far away"]),
]
m.escribe(m.SLUG, ejercicios)
