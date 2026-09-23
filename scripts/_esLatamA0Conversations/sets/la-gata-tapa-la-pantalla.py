import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "la-gata-tapa-la-pantalla"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la pantalla", "a screen"), ("la cámara", "a camera"), ("la cola", "a tail"), ("la sala", "the living room")]),
 M("levanta", "Nicolás [[levanta]] a la gata. Ella pesa bastante.", "lifts up", ["strokes", "shuts out", "feeds"]),
 F("pregunta", "Mi mamá _____ si comes bien.",
   ["levanta", "devuelve", "tapa"],
   "My mum _____ whether you eat properly.",
   ["asks", "lifts", "gives back", "covers"]),
 F("tapa", "Su cara _____ la pantalla.",
   ["levanta", "pregunta", "carga"],
   "His face _____ the screen.",
   ["fills", "lifts", "asks", "carries"]),
 M("familia", "Mariana habla por video con su [[familia]].", "family", ["company", "neighbour", "doctor"]),
 M("tía", "Mi [[tía]] te espera en diciembre.", "aunt", ["cousin", "grandmother", "godmother"]),
 M("siempre", "Ella [[siempre]] busca la cámara.", "always", ["rarely", "suddenly", "finally"]),
 M("cargo", "Yo la [[cargo]].", "I will pick her up", ["I will feed her", "I will shut her out", "I will call her"]),
 M("cara", "Su [[cara]] tapa la pantalla.", "face", ["hand", "shadow", "arm"]),
 M("bastante", "Ella pesa [[bastante]].", "quite a lot", ["very little", "the same", "too little"]),
 # pool
 M("Ven acá", "[[Ven acá]], Tigre.", "come here", ["get down", "stay put", "go away"]),
 M("Para ellos", "[[Para ellos]], tú vives aquí.", "in their eyes", ["from now on", "for a while", "in the end"]),
 M("saludo", "Entonces [[saludo]].", "I will say hello", ["I will sit down", "I will explain", "I will leave"]),
 M("Buenas tardes", "[[Buenas tardes]] a todos.", "good afternoon", ["good night", "see you soon", "many thanks"]),
 M("video", "Mariana habla por [[video]] con su familia.", "video call", ["video game", "voice message", "photo album"]),
 M("les gusta", "A ellos [[les gusta]] más.", "they like her", ["they expect her", "they miss her", "they know her"]),
 M("devolver", "Nicolás sube a [[devolver]] un plato.", "give back", ["borrow", "wash", "fill"]),
]
m.escribe(m.SLUG, ejercicios)
