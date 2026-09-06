# Un trozo con sentido por clausula; cada palabra de la clausula hereda su par es/en.
import json, re, sys, io
STORIES = {
"celia-no-dice-que-si": [
 ("Celia no dice que sí.", "Celia does not say yes."),
 ("una traductora de Madrid,", "a translator from Madrid"),
 ("se muda a Granada,", "moves to Granada"),
 ("en el sur de España.", "in the south of Spain"),
 ("La habitación está en un cuarto sin ascensor,", "The room is on a fourth floor with no lift"),
 ("sobre una tienda.", "above a shop"),
 ("el casero,", "the landlord"),
 ("la espera en el umbral.", "is waiting for her in the doorway"),
 ("El alquiler es de mes en mes,", "The rent runs month by month"),
 ("y el primero por adelantado", "and the first one is paid in advance"),
 ("Y arriba se oye de todo,", "And upstairs you hear all sorts"),
 ("ya lo irá viendo", "you will see soon enough"),
 ("añade.", "he adds"),
 ("Celia comprueba el armario,", "Celia checks the wardrobe"),
 ("que no cierra a la primera.", "which does not shut first time"),
 ("El colchón huele a nuevo y prueba el interruptor:", "The mattress smells new and she tries the switch"),
 ("no enciende nada.", "it turns nothing on"),
 ("Emilio mueve un enchufe y tarda en contestar.", "Emilio moves a socket and takes his time answering"),
 ("Ella calla.", "She says nothing"),
 ("La calefacción va por horas y en enero no sube aquí", "The heating runs on a timer and in January it does not reach up here"),
 ("avisa.", "he warns"),
 ("Si le falta,", "If you run short"),
 ("en el mueble del pasillo hay una estufa", "there is a heater in the hall cupboard"),
 ("ofrece.", "he offers"),
 ("Celia acepta el dato y apunta la cifra en el billete.", "Celia takes the point and notes the figure on the banknote"),
 ("En la sala hay una mancha blanda encima de la mesa.", "In the living room there is a soft stain above the table"),
 ("El alquiler es la mitad que en Madrid y ella lo sabe.", "The rent is half what it is in Madrid, and she knows it"),
 ("Cambia la cerradura el jueves,", "She will change the lock on Thursday"),
 ("decide,", "she decides"),
 ("y baja los cuatro pisos sin decir nada.", "and goes down the four floors without a word"),
]}
slug = sys.argv[1]
out = {}
for es, en in STORIES[slug]:
    for w in re.findall(r'[^\W\d_]+', es.lower(), re.UNICODE):
        out.setdefault(w, {"es": es.strip(" ,.;:"), "en": en})
io.open(f"scripts/_b1/g/{slug}.chunks.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
print(len(out), "palabras con trozo")
