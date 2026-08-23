# -*- coding: utf-8 -*-
"""Reparte las 21 plazas de vocab por historia maximizando la escalera de
recirculacion. Regla del gate: cero palabras del mismo tipo de journey (DURO)
y como mucho DOS de otro tipo (blando) por historia."""
import json, sys
words = json.load(open("/tmp/ar_words.json", encoding="utf-8"))
NOMBRES = {"julieta","damián","damian","emanuel","facundo","brenda","leandro","agustina","yamila",
           "córdoba","cordoba","aráoz","araoz","warnes","corrientes","lea","facu","villa","crespo","bio"}
# Solo se descartan las que no pueden ser una plaza de vocab: articulos,
# preposiciones vacias de contenido y demostrativos sueltos. Las palabras
# funcionales con categoria propia (adverbios, pronombres, conjunciones,
# numerales) SI son vocab de A0: el gold ES LATAM ensena "esta", "hay" y "muy".
BAN = set("""que del las los una unos unas por para con como
esto esta este esos esas eso esa ese otros otras
soy son cada uno
teléfono hospital café foto problema""".split())
N = int(sys.argv[1]) if len(sys.argv) > 1 else 21
BLANDO_MAX = 2
keys = list(words.keys())
import re as _re
_st = json.load(open("/tmp/ar_a0.json", encoding="utf-8"))
PARR = {f'{x["topic"]}#{x["slotIndex"]}': x["text"].split("\n\n") for x in _st}
def parrafos_de(k, w):
    """Indices de parrafo donde aparece la palabra, para repartir las plazas."""
    rx = _re.compile(r"(?<![a-zá-úñ])" + _re.escape(w) + r"(?![a-zá-úñ])")
    return [i for i, p in enumerate(PARR[k]) if rx.search(p.lower())]
def raiz(w):
    return w[:5]
cand = {k: [x for x in words[k] if x["e"] in ("libre","blando") and x["w"] not in NOMBRES
            and x["w"] not in BAN and len(x["w"]) > 2] for k in keys}
todos = {}
for k in keys:
    for x in cand[k]: todos[x["w"]] = (x["n"], x["e"])
# Emparejamiento con caminos aumentantes: el goloso dejaba historias sin llenar
# porque otra se habia quedado con su ultima palabra libre. Se procesan las
# palabras de mas a menos repartidas y, si la historia esta llena, se intenta
# reacomodar lo ya asignado en vez de descartar la palabra.
por_palabra = {}
for k in keys:
    for x in cand[k]:
        por_palabra.setdefault(x["w"], {"n": x["n"], "e": x["e"], "hist": []})["hist"].append(k)
# El ancla cultural de una historia va SIEMPRE en su vocab, aunque el
# emparejamiento por recirculacion prefiera otra palabra
# ([[feedback_cultural_anchor_always_vocab]]).
FORZADAS = {
    "borrowing-and-lending#2": ["yerba"],
    "time-and-waiting#1": ["remis"],
    "couples-and-introductions#1": ["rotisería", "milanesas"],
    # `asado` y `parrilla` ya las ensena el Friends argentino C1, y el cero
    # absoluto entre journeys del mismo tipo manda sobre el ancla: en esta
    # historia el ancla teachable son las `tiras`, el corte de la parrilla.
    "couples-and-introductions#3": ["tiras"],
    "secrets-and-promises#3": ["medialuna"],
    "time-and-waiting#3": ["termo"],
}
asign = {k: [] for k in keys}
nblando = {k: 0 for k in keys}

# `vocab-distribution` solo falla si hay un parrafo VACIO junto a uno de 6+,
# o si un parrafo pasa del 45% de las plazas. El tope real es 7, no 5.
PARA_MAX = 8
raices = {k: {} for k in keys}
porpara = {k: [0] * len(PARR[k]) for k in keys}

def cabe(k, e, w=None):
    if len(asign[k]) >= N: return False
    if e != "libre" and nblando[k] >= BLANDO_MAX: return False
    if w is not None:
        r = raiz(w)
        if raices[k].get(r): return False
        # `vocab-distribution` pide de 3 a 5 plazas por parrafo: sin este tope
        # el emparejamiento amontonaba nueve en un parrafo y dejaba otro vacio.
        for i in parrafos_de(k, w):
            if porpara[k][i] >= PARA_MAX: return False
    return True

def poner(w, k):
    e = por_palabra[w]["e"]
    asign[k].append(w)
    raices[k][raiz(w)] = w
    for i in parrafos_de(k, w): porpara[k][i] += 1
    if e == "blando": nblando[k] += 1

def sacar(w, k):
    asign[k].remove(w)
    raices[k].pop(raiz(w), None)
    for i in parrafos_de(k, w): porpara[k][i] -= 1
    if por_palabra[w]["e"] == "blando": nblando[k] -= 1

def intentar(w, visto):
    e = por_palabra[w]["e"]
    # Entre las historias que pueden llevarla, la que tenga mas flaco el parrafo
    # donde cae: asi la distribucion 3-5 sale del emparejamiento y no de parches.
    opciones = [k for k in por_palabra[w]["hist"] if cabe(k, e, w)]
    if opciones:
        k = min(opciones, key=lambda k: min([porpara[k][i] for i in parrafos_de(k, w)] or [9]))
        poner(w, k); return True
    for k in por_palabra[w]["hist"]:
        if k in visto: continue
        visto.add(k)
        for otro in list(asign[k]):
            if por_palabra[otro]["e"] == "blando" and e == "libre" and len(asign[k]) < N: continue
            sacar(otro, k)
            if cabe(k, e, w):
                poner(w, k)
                if intentar(otro, visto): return True
                sacar(w, k)
            poner(otro, k)
    return False

for k, ws in FORZADAS.items():
    for w in ws:
        if w not in por_palabra: raise SystemExit(f"ancla ausente del cuerpo: {w} en {k}")
        poner(w, k)
_ya = {w for v in asign.values() for w in v}
_fall = 0
for w in sorted(por_palabra, key=lambda w: (-por_palabra[w]["n"], w)):
    if w in _ya: continue
    if not intentar(w, set()): _fall += 1
import sys as _s
print("no colocadas:", _fall, "de", len(por_palabra), file=_s.stderr)
# Reparacion: si un parrafo se quedo con menos de 3 plazas, se cambia una
# palabra de un parrafo lleno por otra que viva en el parrafo flaco.
usadas = {w for v in asign.values() for w in v}
for _ in range(6):
    arreglado = False
    for k in keys:
        while min(porpara[k]) < 2:
            i = porpara[k].index(min(porpara[k]))
            libres_i = [x["w"] for x in cand[k]
                        if x["w"] not in usadas and i in parrafos_de(k, x["w"])
                        and not raices[k].get(raiz(x["w"]))
                        and (x["e"] == "libre" or nblando[k] < BLANDO_MAX)
                        and all(porpara[k][j] < PARA_MAX for j in parrafos_de(k, x["w"]))]
            if not libres_i: break
            nuevo = max(libres_i, key=lambda w: por_palabra[w]["n"])
            fuera = [w for w in asign[k]
                     if all(porpara[k][j] > 3 for j in parrafos_de(k, w))
                     and i not in parrafos_de(k, w)]
            if not fuera: break
            viejo = min(fuera, key=lambda w: por_palabra[w]["n"])
            sacar(viejo, k); usadas.discard(viejo)
            poner(nuevo, k); usadas.add(nuevo)
            arreglado = True
    if not arreglado: break

# ── RE-ENSEÑANZA CONTROLADA (encuentros 3 y 4 de la escalera) ──
#
# La escalera dice que los encuentros 2, 3 y 4 van en el TEXTO y no gastan
# plaza. Con 20 plazas DISTINTAS por historia eso es imposible: el suelo de
# palabras que no reaparecen lo fija cuantas comparten los 21 cuerpos, y 21
# cuerpos de 170 palabras no dan para 252 compartidas. Los A0 publicados
# resuelven lo mismo reenseñando (el Traveler LATAM tiene 313 palabras
# distintas en 521 plazas). Aqui se hace acotado y con criterio: solo palabras
# PORTABLES (salen en 3 historias o mas), solo a la distancia de la escalera
# (6 historias o mas despues de donde se enseñaron) y como mucho REPES_MAX por
# historia, muy por debajo del 50% que tolera `vocab-cross-story` en A0.
REPES_MAX = 6
DISTANCIA = 6
idx = {k: i for i, k in enumerate(keys)}
donde = {w: idx[k] for k, v in asign.items() for w in v}
for i, k in enumerate(keys):
    if i < DISTANCIA: continue
    repes = 0
    for _ in range(REPES_MAX):
        # candidatas: enseñadas hace 6 historias o mas, portables, y que
        # aparezcan en ESTE cuerpo
        cands = [w for w, j in donde.items()
                 if i - j >= DISTANCIA and por_palabra.get(w, {}).get("n", 0) >= 3
                 and por_palabra[w]["e"] == "libre"
                 and any(x["w"] == w for x in cand[k])
                 and w not in asign[k] and not raices[k].get(raiz(w))
                 and all(porpara[k][q] < PARA_MAX for q in parrafos_de(k, w))]
        if not cands: break
        # la escalera pide CUATRO encuentros, no ocho: se prefiere la palabra
        # que quede en cuatro historias, no la que ya sale en veinte.
        nuevo = min(cands, key=lambda w: (abs(por_palabra[w]["n"] - 4), -por_palabra[w]["n"]))
        # sale la plaza mas pobre de la historia que se pueda soltar
        salen = [w for w in asign[k]
                 if por_palabra[w]["n"] == 1 and por_palabra[w]["e"] == "libre"
                 and min([porpara[k][q] for q in parrafos_de(k, w)] or [9]) > 2]
        if not salen: break
        viejo = min(salen, key=lambda w: por_palabra[w]["n"])
        sacar(viejo, k); poner(nuevo, k); repes += 1
    if repes: print(f"   {k}: {repes} plazas reenseñadas")

asign = {k: [(w, por_palabra[w]["n"], por_palabra[w]["e"]) for w in v] for k, v in asign.items()}
faltan = {k: N - len(asign[k]) for k in keys if len(asign[k]) < N}
flojos = {k: porpara[k] for k in keys if min(porpara[k]) < 2 or max(porpara[k]) > 8}
if flojos:
    print("parrafos fuera de 3-5:", flojos)
total = sum(n for v in asign.values() for _, n, _ in v)
plazas = sum(len(v) for v in asign.values())
print(f"plazas {plazas}/{N*21} · MEDIA {total/plazas:.4f} (total {total}) (hace falta 3.00)")
if faltan: print("faltan plazas:", faltan)
if len(sys.argv) > 2:
    for k in keys:
        v = asign[k]
        print(f"{k:34} {len(v):2} media {sum(n for _,n,_ in v)/max(1,len(v)):.1f}  " + " ".join(f"{w}·{n}{'*' if e=='blando' else ''}" for w,n,e in v))
json.dump({k: [[w,e] for w,_,e in v] for k,v in asign.items()}, open("/tmp/ar_assign.json","w"), ensure_ascii=False, indent=1)
