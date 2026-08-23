# -*- coding: utf-8 -*-
import re, sys, importlib, statistics, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
mods = sys.argv[1:] or ["t1"]
allst = []
for m in mods:
    allst += importlib.import_module(m).STORIES

def sentences(t):
    t = re.sub(r"\s*\n+\s*", " ", t)
    parts = re.split(r'(?<=[.!?”])\s+', t)
    return [p.strip() for p in parts if p.strip()]

PROH = re.compile(r"^(?:Pero\s+|Y\s+)?(En|Sobre|Bajo|Entre|Desde|Hasta|Durante|Por|Para|Con|Sin|Contra|Segun|Según|Al|Del|De|A|Ante|Tras|Hoy|Ayer|Ahora|Luego|Despues|Después|Antes|Siempre|Nunca|Recien|Recién|Todavia|Todavía|Entonces|Tambien|También|Tampoco|Aca|Acá|Alla|Allá|Aqui|Aquí|Alli|Allí|Adentro|Afuera|Arriba|Abajo|Cerca|Lejos|Enfrente|Atras|Atrás|Adelante|Encima|Debajo|Primero|Igual|Casi|Quizas|Quizás|Capaz|Seguro|Menos|Mas|Más|Solo|Sólo|Asi|Así|Mientras|Cuando|Si|Aunque|Como|Es|Son|Hay|Hace|Esta|Está|Estan|Están|Falta|Faltan|Sobra|Sobran|Queda|Quedan|Llega|Llegan|Suena|Suenan|Entra|Entran|Sale|Salen)(?![a-zá-úñ])")
OK_SUJ = re.compile(r"^(?:Pero\s+|Y\s+)?(?:Cada|Todos|Todas|Media|Medio|Dos|Tres|Cuatro|Cinco|Seis|Siete|Ocho|Nueve|Diez)\s+[a-zá-úñ]")
PAS = re.compile(r"(?<![a-zá-úñ])(?:[a-zá-úñ]{2,}(?:ó|ió|aron|ieron|eron))(?![a-zá-úñ])|(?<![a-zá-úñ])(fue|fueron|era|eran|estaba|estaban|estuvo|estuvieron|tuvo|tuvieron|tenia|tenía|tenian|tenían|habia|había|habian|habían|hubo|hizo|hicieron|dijo|dijeron|vino|vinieron|vio|vieron|dio|dieron|puso|pusieron|quiso|quisieron|pudo|pudieron|supo|supieron|iba|iban|fui|fuiste|trajo|trajeron|andaba|andaban|sabia|sabía|sabian|sabían|queria|quería|querian|querían|podia|podía|podian|podían|hacia|hacía|hacian|hacían|decia|decía|decian|decían|veia|veía|veian|veían|iban|estuve|tuve)(?![a-zá-úñ])", re.I)
B1 = [
 (re.compile(r"\b(aunque|para\s+que|cuando|hasta\s+que|antes\s+de\s+que|sin\s+que|ojal[áa]|que)\s+(sea|sean|est[ée]|est[ée]n|haya|hayan|tenga|tengan|venga|vengan|vaya|vayan|pueda|puedan|quiera|quieran|haga|hagan|diga|digan|ponga|salga|viva|vivan|d[ée]|sepa|conozca)\b", re.I), "subjuntivo B1"),
 (re.compile(r"\bde\s+lo\s+que\b", re.I), "de lo que"),
 (re.compile(r"\bhace\s+\w+\s+(años?|meses?|d[ií]as?|semanas?|horas?)\s+que\b|\bhace\s+años?\s+que\b", re.I), "hace X que"),
]
PAS1 = re.compile(r"(?<![a-zá-úñ])(perdí|pagué|dije|hice|fui|tuve|estuve|vine|pude|quise|supe|puse|llegué|salí|volví|conté|pedí|compré|hablé|escuché|esperé|olvidé|dejé|mandé|anoté|firmé|cobré|presté|arreglé|entendí|terminé|empecé|trabajé|estabas|estaba|tenías|querías|podías|sabías|decías|hacías|ibas|eras|dijiste|hiciste|fuiste|viniste|pediste|contaste|pagaste|prestaste|entendiste)(?![a-zá-úñ])", re.I)

def opening_shape(t):
    f = sentences(t)[0]
    w = re.sub(r"[.,:;]$", "", f.split()[0])
    if f.startswith("“"): return "replica directa"
    if re.match(r"^(El|La|Los|Las)$", w): return "def"
    if re.match(r"^(Un|Una|Unos|Unas)$", w): return "indef"
    if re.match(r"^(Su|Sus|Mi|Mis|Tu|Tus|Nuestro|Nuestra)$", w): return "poses"
    if re.match(r"^(Dos|Tres|Cuatro|Cinco|Seis|Siete|Ocho|Nueve|Diez|Media|Medio|Todos|Todas|Cada|Nadie|Alguien|Nada|Algo|Muchos|Muchas|Pocos|Pocas|Otro|Otra)$", w): return "cant"
    if PROH.match(w + " x"): return "COMPLEMENTO"
    if re.match(r"^[A-ZÁÉÍÓÚÑ][a-zá-úñ]+$", w): return "nombre"
    return "otra"

print(f"{'slug/topic':44} {'pal':>4} {'orac':>4} {'med':>4} {'max':>4} {'cita%':>6}  apertura")
for s in allst:
    t = s["text"]
    words = len(t.split())
    ss = sentences(t)
    lens = [len(x.split()) for x in ss]
    quoted = sum(len(m.split()) for m in re.findall(r"“([^”]*)”", t))
    pct = 100.0*quoted/words
    flag = "" if 25 <= pct <= 35 else "  <-- CITA FUERA"
    print(f'{s["topic"][:26]+"#"+str(s["slotIndex"]):44} {words:4} {len(ss):4} {statistics.median(lens):4} {max(lens):4} {pct:6.1f}  {opening_shape(t)}{flag}')
    for x in ss:
        if len(x.split()) > 22: print(f'    ORACION LARGA ({len(x.split())}): {x[:80]}')
    narr = re.sub(r"“[^”]*”", " ", t)
    for f in sentences(narr):
        limpio = re.sub(r"^[\s,;:.]+", "", f).strip()
        if len(limpio) < 4 or not re.match(r"^[A-ZÁÉÍÓÚÑ]", limpio): continue
        if PROH.match(limpio) and not OK_SUJ.match(limpio): print(f"    SUJETO: {limpio[:70]}")
        m = PAS.search(limpio)
        if m: print(f"    PASADO ({m.group(0)}): {limpio[:70]}")
    for m in re.finditer(r"“([^”]*)”", t):
        mm = PAS.search(m.group(1)) or PAS1.search(m.group(1))
        if mm: print(f"    PASADO EN CITA ({mm.group(0)}): {m.group(1)[:60]}")
    for rx, name in B1:
        if rx.search(t): print(f"    B1 {name}")
    if any(c in t for c in (chr(0x2014), chr(0x2013), '"', chr(0xAB))): print("    COMILLAS/GUION MALO")
    parr = t.split("\n\n")
    for i, p in enumerate(parr):
        n = len(sentences(p))
        if n != 3: print(f"    PARRAFO {i+1} tiene {n} oraciones")
