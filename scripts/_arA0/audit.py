# -*- coding: utf-8 -*-
"""Audita las 21 contra las reglas que NINGUN gate comprueba."""
import json, re, sys, collections
d = json.load(open("/tmp/ar_a0.json", encoding="utf-8"))
txt = {f'{s["topic"]}#{s["slotIndex"]}': s["text"] for s in d}
orden = list(txt.keys())
tok = lambda t: re.findall(r"[\wáéíóúñüÁÉÍÓÚÑ]+", t.lower())
def falla(x): print("  FALLA " + x)

print("== 1. Voseo (registro de la variante)")
VOSEO = ["vos","sos","tenés","querés","decís","hacés","podés","sabés","venís","salís","entendés",
         "mirá","vení","tomá","esperá","dale","acordate","fijate","quedate","sacá","pasame","dejámelo",
         "contame","prestame","mostrame","subí","dormí","comé","probala","sostenela","llevate","anotás",
         "preguntás","escuchás","pensás","preferís","cortás","fiás","abrís","repetís","dejás","avisame"]
# Solo formas INEQUIVOCAS de tú, y solo dentro de una cita: "espera" y "mira"
# en la narracion son tercera persona, no imperativos.
TU = r"\b(tienes|quieres|vienes|eres|sabes|puedes|dices|haces|vives|tú|contigo|quédate|acuérdate|fíjate|dime|cuéntame|préstame|muéstrame)\b"
sinvoseo = []
for k, t in txt.items():
    hits = [w for w in VOSEO if re.search(r"(?<![a-zá-úñ])" + re.escape(w) + r"(?![a-zá-úñ])", t, re.I)]
    tu = re.findall(TU, " ".join(re.findall(r"“([^”]*)”", t)), re.I)
    if not hits: sinvoseo.append(k)
    if tu: falla(f"{k}: formas de tú -> {set(tu)}")
print(f"  historias con al menos una forma de voseo: {21-len(sinvoseo)}/21" + (f" · SIN: {sinvoseo}" if sinvoseo else ""))

print("\n== 2. Superlativo -ísimo y argot (nivel A)")
ARGOT = ["boludo","quilombo","laburo","guita","bondi","pibe","piba","mina","chabón","posta","copado",
         "flaco","re ","joya","garrón","bancar","zafar","chamuyo","fiaca","macana"]
for k, t in txt.items():
    sup = re.findall(r"\b\w+ísim[oa]s?\b", t, re.I)
    if sup: falla(f"{k}: superlativo -ísimo {sup}")
    ar = [w for w in ARGOT if re.search(r"(?<![a-zá-úñ])" + w.strip() + r"(?![a-zá-úñ])", t, re.I)]
    if ar: falla(f"{k}: argot {ar}")
    if re.search(r"(?<![a-zá-úñ])che(?![a-zá-úñ])", t, re.I): falla(f"{k}: 'che' (vocativo marcado, mismo caso que 'órale')")

print("\n== 3. Plan de estructura del journey")
NOM = ["Julieta","Damián","Facundo","Brenda","Leandro","Agustina","Emanuel","Yamila"]
HABLA = r"(?:dice|pregunta|contesta|avisa|pide|admite|agrega|explica|propone|promete|comenta|protesta|insiste|calcula|acepta|grita|cuenta|saluda|se disculpa|llama|repite)"
for k in orden:
    t = txt[k]
    presentes = [n for n in NOM if re.search(r"\b"+n+r"\b", t)]
    hablan = set()
    for m in re.finditer(r"”[^“]{0,40}?"+HABLA+r"\s+(él|ella|"+"|".join(NOM)+r")\b", t): hablan.add(m.group(1))
    for m in re.finditer(r"”,\s*(?:se\s+)?"+HABLA+r"\s+("+"|".join(NOM)+r")\b", t): hablan.add(m.group(1))
    for m in re.finditer(r"\b("+"|".join(NOM)+r")\b[^“”]{0,30}?"+HABLA+r"[^“”]{0,20}?”", t): hablan.add(m.group(1))
    print(f"  {k:34} presentes: {','.join(presentes):45} citas: {t.count(chr(8220))}")
print("  Julieta en las 21:", all("Julieta" in txt[k] for k in orden))
print("  Damián en:", sum(1 for k in orden if "Damián" in txt[k]), "/21 (regla: la mitad)")
print("  historia 1 solo fijos:", [n for n in NOM if re.search(r"\b"+n+r"\b", txt[orden[0]])])

print("\n== 4. Forma de la escalera: portables vs ancladas")
voc = {f'{s["topic"]}#{s["slotIndex"]}': [v["word"] for v in s["vocab"]] for s in d}
cuerpos = [set(tok(txt[k])) for k in orden]
tot_p = tot_a = 0
tarde = []
for i, k in enumerate(orden):
    port = [w for w in voc[k] if any(w in cuerpos[j] for j in range(len(orden)) if j != i)]
    anc = [w for w in voc[k] if w not in port]
    tot_p += len(port); tot_a += len(anc)
    if i >= 15 and port: tarde.append((k, len(port)))
    print(f"  {i+1:2} {k:34} portables {len(port):2} · ancladas {len(anc):2}")
print(f"  TOTAL portables {tot_p} ({100*tot_p//(tot_p+tot_a)}%) · ancladas {tot_a} · regla de diseno 12/8 por historia")
if tarde: print("  portables que entran despues de la 15 (la tabla lo prohibe):", tarde)

print("\n== 5. Imperativo breve como unica oracion de la cita, y relativa final")
IMPER = r"\b(vení|mirá|tomá|esperá|sacá|pasame|contame|prestame|mostrame|dejame|dejámelo|quedate|acordate|fijate|subí|dormí|comé|probala|sostenela|llevate|repetime|repetímelo|callate|devolvémela|avisame|firmá|anotá)\b"
for k, t in txt.items():
    for m in re.finditer(r"“([^”]*)”(\s*[,.]?\s*)([^.!?]*)", t):
        cita, cola = m.group(1), m.group(3).strip()
        frases = [f for f in re.split(r"(?<=[.!?])\s+", cita) if f.strip()]
        if len(frases) == 1 and re.search(IMPER, cita, re.I) and len(cita.split()) <= 4 and not cola:
            falla(f"{k}: imperativo breve sin oracion de cierre -> “{cita}”")
    for f in re.split(r"(?<=[.!?])\s+", re.sub(r"“[^”]*”", " ", t).replace("\n", " ")):
        # relativa COLGANDO DE UN SUSTANTIVO: la completiva de un verbo de habla
        # ("avisa que...") no es el caso que rompe la entonacion.
        if re.search(r"\b(?<!avisa )(?<!dice )(?<!cuenta )[a-zá-úñ]+a?\s+(que|quien|donde)\s+[^,]{3,40}[.]$", f.strip(), re.I) \
           and not re.search(r"\b(avisa|dice|cuenta|explica|admite|promete|sabe|entiende|igual de|más|menos)\b[^.]{0,30}\b(que|quien)\b", f, re.I):
            falla(f"{k}: relativa al final -> {f.strip()[-55:]}")

print("\n== 6. Ancla cultural en el vocab")
ANCLAS = {"mate","termo","yerba","medialuna","fiado","birome","canilla","vereda","kiosco","remis",
          "milanesas","rotisería","escribano","ph","pocillo","heladera","campera","parrilla","asado","tiras","ambo"}
todo_voc = {w for v in voc.values() for w in v}
print("  anclas culturales enseñadas:", sorted(ANCLAS & todo_voc))
print("  anclas que salen en el texto pero NO se enseñan:",
      sorted({a for a in ANCLAS if any(a in c for c in cuerpos)} - todo_voc))

print("\n== 7. Tipos de vocab (categoria gramatical, no registro)")
tipos = collections.Counter(v["type"] for s in d for v in s["vocab"])
print("  ", dict(tipos))
