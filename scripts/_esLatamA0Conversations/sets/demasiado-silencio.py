import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "demasiado-silencio"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("el silencio", "silence"), ("la pelusa", "fluff"), ("el ronquido", "a snore"), ("la almohada", "a pillow")]),
 F("regalo", "Hoy los _____. Tres casas nuevas.",
   ["sirvo", "sueño", "ronco"],
   "Today I _____ them. Three new homes.",
   ["gave away", "am useful", "dream", "snore"]),
 F("Ronca", "_____ como un camión.",
   ["Sirve", "Regala", "Extraña"],
   "He _____ like a truck.",
   ["snores", "is useful", "gives away", "misses"]),
 F("extraño", "Ese ruido sí lo _____ un poco.",
   ["regalo", "ronco", "sirvo"],
   "That noise I do _____ a little.",
   ["miss", "give away", "snore", "use"]),
 M("camión", "Ronca como un [[camión]].", "a lorry", ["a kettle", "a drum", "a storm"]),
 M("cabeza", "Yo me tapo la [[cabeza]].", "head", ["ears", "face", "eyes"]),
 M("triste", "Mi sofá está [[triste]].", "sad", ["damp", "bare", "crowded"]),
 M("suave", "Del sofá llega un ronquido [[suave]].", "soft", ["steady", "distant", "odd"]),
 M("sonríe", "Mariana [[sonríe]].", "smiles", ["listens", "stands up", "whispers"]),
 M("sirve", "Yo me tapo la cabeza. No [[sirve]].", "it is no use", ["it is too warm", "it is a habit", "it is enough"]),
 # pool
 M("me tapo", "Yo [[me tapo]] la cabeza.", "I cover my head", ["I hold my breath", "I count to ten", "I turn over"]),
 M("ya no", "Los gatitos [[ya no]] están.", "not anymore", ["not quite", "not often", "not together"]),
 M("demasiado", "Aquí hay [[demasiado]] silencio.", "too much", ["a little", "the same", "almost no"]),
 M("Todavía", "[[Todavía]] no duermo.", "still", ["never", "hardly", "barely"]),
 M("Apenas", "[[Apenas]] duermo sin ese ruido.", "hardly", ["gladly", "finally", "always"]),
 M("tampoco", "¿Tú [[tampoco]] duermes?", "not either", ["already", "any better", "so late"]),
 M("De verdad", "[[De verdad]].", "really", ["perhaps", "as usual", "if you like"]),
]
m.escribe(m.SLUG, ejercicios)
